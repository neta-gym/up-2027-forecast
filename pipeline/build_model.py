"""
UP 2027 seat-by-seat projection model.

Inputs (pipeline/sources/):
  r2022.json          2022 assembly results, winner + runner-up (Wikipedia / ECI)
  acpages.json        full candidate-level results 2012/2017/2022 + bypolls (Wikipedia AC pages)
  ls2024.json         2024 Lok Sabha results by assembly segment (Wikipedia / ECI Form-20)
  myneta2022.json     MLA affidavits: criminal cases, assets, education (MyNeta / ADR)
  announced2027.json  candidates reported/announced for 2027
  context2026.json    alliances, polls, defections, vacancies (news research, Nov 2026)

Output (data/):
  seats.json, summary.json

Run:  python3 -I pipeline/build_model.py
"""
import json, os, re, math, collections
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'pipeline', 'sources')
OUT = os.path.join(ROOT, 'data')
load = lambda f: json.load(open(os.path.join(SRC, f), encoding='utf-8'))

r2022 = {x['no']: x for x in load('r2022.json')}
ls24 = {x['no']: x for x in load('ls2024.json')}
acp = {int(k): v for k, v in load('acpages.json').items()}
myneta = load('myneta2022.json')
announced = load('announced2027.json')
ctx = load('context2026.json')

BLOCS = ['NDA', 'INDIA', 'BSP', 'SPM', 'OTH']

# ---------------------------------------------------------------- party normalisation
PMAP = {
    'bharatiya janata party': 'BJP', 'bjp': 'BJP', 'bharatiya janta party': 'BJP', 'bharatiya janta part': 'BJP',
    'samajwadi party': 'SP', 'sp': 'SP',
    'bahujan samaj party': 'BSP', 'bsp': 'BSP',
    'indian national congress': 'INC', 'inc': 'INC', 'congress': 'INC',
    'rashtriya lok dal': 'RLD', 'rld': 'RLD',
    'apna dal (sonelal)': 'AD(S)', 'ad(s)': 'AD(S)', 'apna dal (soneylal)': 'AD(S)', 'apna dal': 'AD(S)',
    'suheldev bharatiya samaj party': 'SBSP', 'sbsp': 'SBSP',
    'nishad party': 'NISHAD', 'nishad': 'NISHAD', 'nirbal indian shoshit hamara aam dal': 'NISHAD',
    'jansatta dal (loktantrik)': 'JD(L)', 'jd(l)': 'JD(L)', 'jsd(l)': 'JD(L)',
    'all india majlis-e-ittehadul muslimeen': 'AIMIM', 'aimim': 'AIMIM',
    'azad samaj party (kanshi ram)': 'ASP(KR)', 'aazad samaj party (kanshi ram)': 'ASP(KR)', 'asp(kr)': 'ASP(KR)',
    'apna dal (kamerawadi)': 'AD(K)', 'ad(k)': 'AD(K)',
    'jan adhikar party': 'JAP', 'jap': 'JAP',
    'aam aadmi party': 'AAP', 'vikassheel insaan party': 'VIP',
    'none of the above': 'NOTA', 'nota': 'NOTA',
    'independent': 'IND', 'independent politician': 'IND', 'ind': 'IND',
    'trinamool congress': 'AITC', 'all india trinamool congress': 'AITC',
    'janata dal (united)': 'JD(U)', 'jd(u)': 'JD(U)', 'peace party of india': 'PECP', 'peace party (india)': 'PECP',
    'communist party of india': 'CPI', 'communist party of india (marxist)': 'CPI(M)',
    'national democratic alliance': 'NDA', 'indian national developmental inclusive alliance': 'INDIA',
}
def norm_party(p):
    k = (p or '').strip().lower().rstrip(' }"|')
    if k in PMAP: return PMAP[k]
    for kk, v in PMAP.items():
        if k.startswith(kk): return v
    return (p or '').strip() or 'OTH'

BLOC_OF = {'BJP': 'NDA', 'RLD': 'NDA', 'AD(S)': 'NDA', 'SBSP': 'NDA', 'NISHAD': 'NDA', 'NDA': 'NDA',
           'SP': 'INDIA', 'INC': 'INDIA', 'AITC': 'INDIA', 'AD(K)': 'INDIA', 'JAP': 'INDIA', 'INDIA': 'INDIA',
           'BSP': 'BSP', 'ASP(KR)': 'SPM', 'AIMIM': 'SPM'}
bloc_of = lambda p: BLOC_OF.get(p, 'OTH')

def key(s):
    return re.sub(r'[^a-z]', '', re.sub(r'\(s[ct]\)', '', (s or '').lower()))

# ---------------------------------------------------------------- regions
REGION = {}
for d in ['Saharanpur', 'Shamli', 'Muzaffarnagar', 'Bijnor', 'Moradabad', 'Sambhal', 'Rampur', 'Amroha', 'Meerut',
          'Baghpat', 'Ghaziabad', 'Hapur', 'Gautam Buddha Nagar', 'Bulandshahr']: REGION[d] = 'West UP'
for d in ['Aligarh', 'Hathras', 'Mathura', 'Agra', 'Firozabad', 'Kasganj', 'Etah', 'Mainpuri']: REGION[d] = 'Braj'
for d in ['Budaun', 'Bareilly', 'Pilibhit', 'Shahjahanpur']: REGION[d] = 'Rohilkhand'
for d in ['Lakhimpur Kheri', 'Sitapur', 'Hardoi', 'Unnao', 'Lucknow', 'Raebareli', 'Amethi', 'Sultanpur', 'Barabanki',
          'Ayodhya', 'Ambedkar Nagar', 'Bahraich', 'Shrawasti', 'Balrampur', 'Gonda']: REGION[d] = 'Awadh'
for d in ['Farrukhabad', 'Kannauj', 'Etawah', 'Auraiya', 'Kanpur Dehat', 'Kanpur Nagar', 'Fatehpur']: REGION[d] = 'Kanpur–Doab'
for d in ['Jalaun', 'Jhansi', 'Lalitpur', 'Hamirpur', 'Mahoba', 'Banda', 'Chitrakoot']: REGION[d] = 'Bundelkhand'
for d in ['Pratapgarh', 'Kaushambi', 'Prayagraj', 'Siddharthnagar', 'Basti', 'Sant Kabir Nagar', 'Maharajganj', 'Gorakhpur',
          'Kushinagar', 'Deoria', 'Azamgarh', 'Mau', 'Ballia', 'Jaunpur', 'Ghazipur', 'Chandauli', 'Varanasi', 'Bhadohi',
          'Mirzapur', 'Sonbhadra']: REGION[d] = 'Purvanchal'
REGIONS = ['West UP', 'Braj', 'Rohilkhand', 'Awadh', 'Kanpur–Doab', 'Bundelkhand', 'Purvanchal']

# ---------------------------------------------------------------- helpers to read election boxes
def box(no, year, bypoll=False):
    els = [e for e in acp.get(no, []) if e['year'] == year and e['cands'] and bool(e['bypoll']) == bypoll]
    if year == 2022 and not bypoll and len(els) > 1:
        # pick the box whose winner matches the official 2022 table
        wv = r2022[no]['w_votes']
        els.sort(key=lambda e: min(abs((c['votes'] or 0) - wv) for c in e['cands']))
    return els[0] if els else None

def cands_from_box(e):
    out = []
    for c in e['cands']:
        p = norm_party(c['party'])
        out.append(dict(n=c['name'], p=p, v=c['votes'], pct=c['pct']))
    tot = sum(c['v'] or 0 for c in out)
    for c in out:
        if c['pct'] is None and c['v'] and tot: c['pct'] = round(100 * c['v'] / tot, 2)
    out = [c for c in out if c['pct'] is not None]
    out.sort(key=lambda c: -(c['pct'] or 0))
    return out

def cands_2022(no):
    w = r2022[no]
    e = box(no, 2022)
    if e:
        cs = cands_from_box(e)
        if cs and abs(cs[0]['pct'] - w['w_pct']) < 3:
            return cs
    # fallback: top two from official table; remainder split BSP/others
    rem = 100 - w['w_pct'] - w['r_pct']
    cs = [dict(n=w['winner'], p=norm_party(w['w_party']), v=w['w_votes'], pct=w['w_pct']),
          dict(n=w['runner'], p=norm_party(w['r_party']), v=w['r_votes'], pct=w['r_pct'])]
    if 'BSP' not in (cs[0]['p'], cs[1]['p']):
        cs.append(dict(n='', p='BSP', v=None, pct=round(rem * 0.7, 2)))
        cs.append(dict(n='', p='OTH', v=None, pct=round(rem * 0.3, 2)))
    else:
        cs.append(dict(n='', p='OTH', v=None, pct=round(rem, 2)))
    return cs

# ---------------------------------------------------------------- 2022 base remapped to 2027 alliances
def base_2022(no, region):
    cs = cands_2022(no)
    b = dict.fromkeys(BLOCS, 0.0)
    sp_contested = any(c['p'] == 'SP' for c in cs)
    for c in cs:
        p, s = c['p'], c['pct'] or 0
        if p in ('RLD', 'SBSP'):          # 2022: SP allies; 2027: NDA. Core vote follows the party, rest stays with SP.
            b['NDA'] += 0.45 * s; b['INDIA'] += 0.55 * s
        elif p == 'NOTA':
            b['OTH'] += s
        else:
            b[bloc_of(p)] += s
    # RLD's Jat vote / SBSP's Rajbhar vote inside SP candidates' 2022 totals now moves with them to NDA
    if sp_contested:
        shift = 2.0 if region == 'West UP' else 1.5 if region == 'Purvanchal' else 0.5
        shift = min(shift, b['INDIA'] * 0.1)
        b['INDIA'] -= shift; b['NDA'] += shift
    return b, cs

def votes_total_2022(no):
    w = r2022[no]
    return w['w_votes'] / (w['w_pct'] / 100.0)

# ---------------------------------------------------------------- 2024 LS segment base
def base_2024(no, spm22):
    s = ls24[no]
    b = dict.fromkeys(BLOCS, 0.0)
    wp, rp = norm_party(s['w']), norm_party(s['r'])
    b[bloc_of(wp)] += s['wp']; b[bloc_of(rp)] += s['rp']
    rem = max(0.0, 100 - s['wp'] - s['rp'])
    present = {bloc_of(wp), bloc_of(rp)}
    if 'NDA' not in present: b['NDA'] += rem * 0.7; rem *= 0.3
    if 'INDIA' not in present: b['INDIA'] += rem * 0.7; rem *= 0.3
    if 'BSP' not in present:
        bsp = rem * (0.6 if 'SPM' in present else 0.72); b['BSP'] += bsp; rem -= bsp
    if 'SPM' not in present:
        spm = min(spm22, rem * 0.6); b['SPM'] += spm; rem -= spm
    b['OTH'] += rem
    return b

def votes_total_2024(no):
    s = ls24[no]
    return s['wv'] / (s['wp'] / 100.0)

def bypoll_base(no):
    for y in (2025, 2024, 2023):
        e = box(no, y, bypoll=True)
        if e:
            cs = cands_from_box(e)
            b = dict.fromkeys(BLOCS, 0.0)
            for c in cs:
                b['OTH' if c['p'] == 'NOTA' else bloc_of(c['p'])] += c['pct'] or 0
            if sum(b.values()) > 50:
                return y, b, cs
    return None, None, None

# ---------------------------------------------------------------- statewide target (poll average, Nov 2026)
polls = [p for p in ctx['polls'] if p['vote'].get('NDA') and p['vote'].get('INDIA')]
NDA_T = round(sum(p['vote']['NDA'] for p in polls) / len(polls), 2)
INDIA_T = round(sum(p['vote']['INDIA'] for p in polls) / len(polls), 2)
TARGET = {'NDA': NDA_T, 'INDIA': INDIA_T, 'BSP': 9.0, 'SPM': 3.0}
TARGET['OTH'] = round(100 - sum(TARGET.values()), 2)

# ---------------------------------------------------------------- assemble per-seat base
seats = []
for no in range(1, 404):
    w = r2022[no]
    name = w['name']
    district = w['district']
    region = REGION.get(district, 'Purvanchal')
    b22, c22 = base_2022(no, region)
    b24 = base_2024(no, b22['SPM'])
    by_year, bby, by_c = bypoll_base(no)
    seats.append(dict(no=no, name=name, district=district, region=region, b22=b22, c22=c22, b24=b24,
                      by_year=by_year, bby=bby, by_c=by_c, v22=votes_total_2022(no), v24=votes_total_2024(no)))

def state_avg(field, wfield):
    tot = sum(s[wfield] for s in seats)
    return {b: sum(s[field][b] * s[wfield] for s in seats) / tot for b in BLOCS}
S22 = state_avg('b22', 'v22')
S24 = state_avg('b24', 'v24')

def swing_to_target(base, S):
    out = {}
    for b in BLOCS:
        d = TARGET[b] - S[b]
        prop = base[b] / S[b] if S[b] > 0 else 1
        out[b] = max(0.2, base[b] + d * (0.5 + 0.5 * min(prop, 3)))
    t = sum(out.values())
    return {b: out[b] * 100 / t for b in BLOCS}

ctx_key = lambda s: key(s)
defectors = {ctx_key(d['ac']): d for d in ctx['defectors']}
rebels = {ctx_key(d['ac']): d for d in ctx['rebels_uncertain']}
vacant = {ctx_key(d['ac']): d for d in ctx['vacant']}
roles = {ctx_key(k): v for k, v in ctx['roles'].items()}
for coll, nm in ((defectors, 'defectors'), (rebels, 'rebels'), (vacant, 'vacant'), (roles, 'roles')):
    missing = [k for k in coll if k not in {key(s['name']) for s in seats}]
    if missing: print('WARN unmatched', nm, missing)

# current MLA (after bypolls)
BYPOLL_WINNERS = {139: ('Aman Giri', 'BJP'), 37: ('Akash Saxena', 'BJP'), 15: ('Madan Bhaiya', 'RLD'), 34: ('Shafeek Ahmed Ansari', 'AD(S)'),
                  395: ('Rinki Kol', 'AD(S)'), 354: ('Sudhakar Singh', 'SP'), 136: ('Arvind Kumar Singh', 'BJP'),
                  173: ('O. P. Srivastava', 'BJP'), 292: ('Rakesh Kumar Yadav', 'SP'), 403: ('Vijay Singh Gond', 'SP'),
                  16: ('Mithlesh Pal', 'RLD'), 29: ('Ramveer Singh', 'BJP'), 56: ('Sanjeev Sharma', 'BJP'), 71: ('Surender Diler', 'BJP'),
                  110: ('Tej Pratap Singh Yadav', 'SP'), 213: ('Naseem Solanki', 'SP'), 256: ('Deepak Patel', 'BJP'),
                  277: ('Dharmraj Nishad', 'BJP'), 397: ('Suchismita Maurya', 'BJP'), 273: ('Chandrabhanu Paswan', 'BJP')}

mn_by_ac = {}
for m in myneta:
    mn_by_ac[key(m['ac'])] = m

# announced candidates
ann = collections.defaultdict(dict)
ALLY_PARTY = {'Swami Prasad Maurya': 'Apni Janata Party', 'Pallavi Patel': 'AD(K)', 'Manoj Pandey': 'BJP'}
for a in announced:
    p = norm_party(a['party'])
    bl = bloc_of(p) if p not in ('NDA', 'INDIA') else p
    if p == 'JD(L)' or (p == 'IND' and a['name']): bl = 'OTH'
    nm = a['name'].strip()
    if not nm: continue
    nm = {'Vineen Bharala': 'Vineet Bharala', 'Aradhana Misra': 'Aradhana Mishra'}.get(nm, nm)
    party = ALLY_PARTY.get(nm, p if p not in ('NDA', 'INDIA') else None)
    ann[a['no']].setdefault(bl, dict(name=nm, party=party, src=a['src']))

def wins_history(no, mla_name):
    hist = []
    for y in (2012, 2017, 2022):
        e = box(no, y)
        if not e: continue
        cs = cands_from_box(e)
        if cs: hist.append((y, cs[0]['n'], cs[0]['p']))
    return hist

def same_person(a, b):
    ka, kb = key(a), key(b)
    if not ka or not kb: return False
    if ka == kb or ka in kb or kb in ka: return True
    ta = set(re.findall(r'[a-z]{3,}', (a or '').lower())); tb = set(re.findall(r'[a-z]{3,}', (b or '').lower()))
    ta -= {'singh', 'kumar', 'devi', 'yadav', 'prasad', 'chandra', 'lal', 'ram'}; tb -= {'singh', 'kumar', 'devi', 'yadav', 'prasad', 'chandra', 'lal', 'ram'}
    return bool(ta & tb) and len(ta & tb) >= min(len(ta), len(tb), 1)

# strong non-aligned candidates (personal vote) from 2022: e.g. Raja Bhaiya's JD(L)
for s in seats:
    s['strong_oth'] = None
    for c in s['c22']:
        if bloc_of(c['p']) == 'OTH' and c['p'] != 'NOTA' and (c['pct'] or 0) >= 20:
            s['strong_oth'] = dict(name=c['n'], party=c['p'], pct=c['pct'])

# ---------------------------------------------------------------- project each seat
W22, W24, WBY = 0.5, 0.5, 0.15
# Lok Sabha seats where a national leader was on the ballot in 2024 (Rahul Gandhi, Narendra Modi, Akhilesh Yadav, Rajnath Singh)
STAR_PCS = {'Rae Bareli', 'Raebareli', 'Varanasi', 'Kannauj', 'Lucknow'}
for s in seats:
    p22 = swing_to_target(s['b22'], S22)
    p24 = swing_to_target(s['b24'], S24)
    if s['strong_oth']:
        w22, w24 = 0.85, 0.15            # personal-vote seats: LS segment data misses the candidate
        p24['OTH'] = p22['OTH']
    elif norm_party(r2022[s['no']]['w_party']) == 'BSP':
        w22, w24 = 0.75, 0.25            # BSP's lone 2022 win (Rasara) rests on the candidate's personal vote
        p24['BSP'] = p22['BSP']
    elif ls24[s['no']]['pc'] in STAR_PCS:
        w22, w24 = 0.65, 0.35            # 2024 LS vote inflated by a national-leader candidate; lean on the assembly result
    else:
        w22, w24 = W22, W24
    proj = {b: w22 * p22[b] + w24 * p24[b] for b in BLOCS}
    if s['bby']:
        wb = 0.08 if s['no'] == 29 else WBY  # Kundarki 2024 bypoll heavily contested (turnout complaints) -> low weight
        pby = swing_to_target(s['bby'], S22)
        proj = {b: (1 - wb) * proj[b] + wb * pby[b] for b in BLOCS}
    k = key(s['name'])
    adj = []
    if k in defectors:
        proj['INDIA'] -= 7; proj['NDA'] += 7; adj.append('Sitting MLA defected SP→BJP: ~7 pts of personal vote moved to NDA')
    if k in rebels:
        proj['INDIA'] -= 2; proj['NDA'] += 2; adj.append('SP rebel MLA (2024 RS cross-vote): 2 pts moved to NDA')
    w = r2022[s['no']]
    cur = BYPOLL_WINNERS.get(s['no'], (w['winner'], norm_party(w['w_party'])))
    s['mla_name'], s['mla_party_2022'] = cur
    if k not in vacant and k not in defectors and bloc_of(cur[1]) == 'INDIA':
        proj['INDIA'] += 1.0; proj['NDA'] -= 0.5; proj['BSP'] -= 0.5; adj.append('Opposition sitting MLA personal vote (+1 pt)')
    t = sum(max(0.2, v) for v in proj.values())
    s['proj'] = {b: max(0.2, proj[b]) * 100 / t for b in BLOCS}
    s['adj'] = adj
    s['p22'], s['p24'] = p22, p24

# ---------------------------------------------------------------- Monte Carlo
rng = np.random.default_rng(2027)
N = 20000
P = np.array([[s['proj'][b] for b in BLOCS] for s in seats])  # 403 x 5
reg_idx = np.array([REGIONS.index(s['region']) for s in seats])
oth_can_win = np.array([1.0 if s['strong_oth'] else 0.0 for s in seats])
SD_STATE, SD_REG, SD_SEAT = 4.0, 3.0, 6.0     # SDs on NDA–INDIA margin (pts)
wins = np.zeros((403, 5))
totals = np.zeros((N, 5), dtype=np.int32)
chunk = 2000
for c0 in range(0, N, chunk):
    n = min(chunk, N - c0)
    d_state = rng.normal(0, SD_STATE, (n, 1))
    d_reg = rng.normal(0, SD_REG, (n, len(REGIONS)))[:, reg_idx]
    d_seat = rng.normal(0, SD_SEAT, (n, 403))
    margin_shift = d_state + d_reg + d_seat
    bsp_state = rng.normal(0, 1.5, (n, 1)); spm_state = rng.normal(0, 1.0, (n, 1))
    X = np.repeat(P[None, :, :], n, axis=0).copy()
    bsp_d = X[:, :, 2] * bsp_state / 9.0 + rng.normal(0, 2.0, (n, 403)) * np.sqrt(X[:, :, 2] / 9.0)
    spm_d = X[:, :, 3] * spm_state / 3.0 + rng.normal(0, 1.5, (n, 403)) * np.sqrt(np.maximum(X[:, :, 3], 0.2) / 3.0)
    oth_d = rng.normal(0, 4.0, (n, 403)) * oth_can_win
    X[:, :, 0] += margin_shift / 2 - bsp_d / 2 - spm_d * 0.3 - oth_d / 2
    X[:, :, 1] += -margin_shift / 2 - bsp_d / 2 - spm_d * 0.7 - oth_d / 2
    X[:, :, 2] += bsp_d
    X[:, :, 3] += spm_d
    X[:, :, 4] += oth_d
    X[:, :, 4] = np.where(oth_can_win[None, :] > 0, X[:, :, 4], X[:, :, 4] * 0.3)  # fragmented 'others' can't win as a bloc
    win = X.argmax(axis=2)
    for b in range(5):
        wins[:, b] += (win == b).sum(axis=0)
        totals[c0:c0 + n, b] = (win == b).sum(axis=1)
prob = wins / N

# ---------------------------------------------------------------- classify + candidates
def rating(p, bloc):
    lbl = {'NDA': 'NDA', 'INDIA': 'INDIA', 'BSP': 'BSP', 'SPM': 'SPM', 'OTH': 'Others'}[bloc]
    if p >= 0.95: return 'Safe ' + lbl
    if p >= 0.80: return 'Likely ' + lbl
    if p >= 0.60: return 'Lean ' + lbl
    return 'Toss-up'

PARTY_FULL = {'BJP': 'Bharatiya Janata Party', 'SP': 'Samajwadi Party', 'BSP': 'Bahujan Samaj Party', 'INC': 'Indian National Congress',
              'RLD': 'Rashtriya Lok Dal', 'AD(S)': 'Apna Dal (Sonelal)', 'SBSP': 'Suheldev Bharatiya Samaj Party', 'NISHAD': 'NISHAD Party',
              'JD(L)': 'Jansatta Dal (Loktantrik)', 'AIMIM': 'AIMIM', 'ASP(KR)': 'Aazad Samaj Party (Kanshi Ram)', 'AD(K)': 'Apna Dal (Kamerawadi)',
              'AITC': 'Trinamool Congress', 'JAP': 'Jan Adhikar Party', 'IND': 'Independent'}

INC_PCS = {'Saharanpur', 'Amroha', 'Fatehpur Sikri', 'Ghaziabad', 'Mathura', 'Bulandshahr', 'Sitapur', 'Rae Bareli', 'Amethi',
           'Kanpur', 'Jhansi', 'Bansgaon', 'Deoria', 'Barabanki', 'Allahabad', 'Maharajganj', 'Varanasi'}

# 2022 SP nominees convicted after 2022 (eligibility to contest in doubt)
BARRED = {37: 'TBA — 2022 nominee Azam Khan convicted since; eligibility in doubt',
          34: 'TBA — 2022 winner Abdullah Azam Khan disqualified (2023 conviction)'}

out_seats = []
for i, s in enumerate(seats):
    no = s['no']; k = key(s['name']); w = r2022[no]; l = ls24[no]
    pr = {b: round(float(prob[i, j]), 4) for j, b in enumerate(BLOCS)}
    top = max(pr, key=pr.get)
    is_vacant = k in vacant; dfc = defectors.get(k); rbl = rebels.get(k)
    mla_party_now = 'BJP' if dfc else s['mla_party_2022']
    mla_bloc = bloc_of(mla_party_now)
    mn = mn_by_ac.get(k) or mn_by_ac.get(key(s['name'].replace('Cantonment', 'Cantt').replace('Nagar', 'Nagar')))
    if not mn:
        for kk, m in mn_by_ac.items():
            if same_person(m['name'], s['mla_name']): mn = m; break
    if mn and not same_person(mn['name'], s['mla_name']) and no in BYPOLL_WINNERS:
        mn = None  # affidavit belongs to the 2022 winner who has since been replaced
    hist = wins_history(no, s['mla_name'])
    terms = sum(1 for y, n, p in hist if same_person(n, s['mla_name']))
    if no in BYPOLL_WINNERS and terms == 0: terms = 1

    # prospective candidates
    c22 = s['c22']
    def nominee_2022(bloc, parties=None):
        for c in c22:
            if bloc_of(c['p']) == bloc and c['n'] and (parties is None or c['p'] in parties):
                return c
        return None
    cands = []
    for b in ['NDA', 'INDIA', 'BSP', 'SPM']:
        a = ann[no].get(b)
        if a:
            party = a['party'] or ('BJP' if b == 'NDA' else 'SP' if b == 'INDIA' else None)
            if not party:
                party = 'ASP(KR)' if b == 'SPM' else b
            cands.append(dict(bloc=b, name=a['name'], party=party, status='Announced / reported', prob=pr[b])); continue
        if b == 'NDA':
            if dfc:
                cands.append(dict(bloc=b, name=dfc['name'], party='BJP', status='Sitting MLA (switched from SP)', prob=pr[b])); continue
            if not is_vacant and mla_bloc == 'NDA':
                cands.append(dict(bloc=b, name=s['mla_name'], party=mla_party_now, status='Sitting MLA', prob=pr[b])); continue
            c = nominee_2022('NDA', {'BJP', 'AD(S)', 'NISHAD'})
            party = c['p'] if c else 'BJP'
            if mla_party_now in ('RLD', 'SBSP'): party = mla_party_now
            cands.append(dict(bloc=b, name=(c['n'] if c and not is_vacant else 'To be announced'), party=party,
                              status=('2022 nominee' if c and not is_vacant else 'TBA'), prob=pr[b]))
        elif b == 'INDIA':
            if not is_vacant and mla_bloc == 'INDIA' and not dfc:
                cands.append(dict(bloc=b, name=s['mla_name'], party=mla_party_now, status='Sitting MLA', prob=pr[b])); continue
            c = nominee_2022('INDIA', {'SP'})   # INC fought 2022 separately (2.3%); its 2022 runners are not INDIA's likely picks
            if dfc or (c and same_person(c['n'], s['mla_name'])): c = None
            if no in BARRED:
                cands.append(dict(bloc=b, name='To be announced', party='SP', status=BARRED[no], prob=pr[b])); continue
            party = 'SP'
            if l['pc'] in INC_PCS: party = 'SP / INC'
            cands.append(dict(bloc=b, name=(c['n'] if c and not is_vacant else 'To be announced'), party=party,
                              status=('2022 nominee' if c and not is_vacant else 'TBA (seat-sharing pending)' if party == 'SP / INC' else 'TBA'), prob=pr[b]))
        elif b == 'BSP':
            c = nominee_2022('BSP')
            if c and not is_vacant and no == 358:  # Rasra: BSP's lone 2022 winner
                cands.append(dict(bloc=b, name=c['n'], party='BSP', status='Sitting MLA', prob=pr[b])); continue
            cands.append(dict(bloc=b, name=(c['n'] if c else 'To be announced'), party='BSP', status=('2022 nominee' if c else 'TBA'), prob=pr[b]))
        else:
            c = nominee_2022('SPM')
            cands.append(dict(bloc=b, name=(c['n'] if c else 'To be announced'), party=(c['p'] if c else 'ASP(KR) / AIMIM'),
                              status=('2022 nominee' if c else 'TBA'), prob=pr[b]))
    a = ann[no].get('OTH')
    if s['strong_oth'] or a:
        so = s['strong_oth'] or {}
        cands.append(dict(bloc='OTH', name=(a['name'] if a else so.get('name')), party=(a['party'] if a and a['party'] else so.get('party', 'IND')),
                          status=('Announced / reported' if a else 'Sitting MLA' if so and same_person(so.get('name'), s['mla_name']) else '2022 candidate'), prob=pr['OTH']))
    cands.sort(key=lambda c: -c['prob'])

    # MLA report card
    tot22 = s['v22']
    margin22 = (w['w_votes'] - w['r_votes'])
    margin_pct = 100 * margin22 / tot22
    seg_lead_bloc = bloc_of(norm_party(l['w']))
    seg_margin_pct = 100 * l['margin'] / s['v24'] * (1 if seg_lead_bloc == mla_bloc else -1)
    if no in BYPOLL_WINNERS and s['by_c']:
        bc = s['by_c']; margin_pct = (bc[0]['pct'] or 0) - (bc[1]['pct'] or 0)
    score = None; comps = None
    if not is_vacant:
        c_margin = max(0, min(100, margin_pct * 4))
        c_seg = max(0, min(100, 50 + seg_margin_pct * 2.5)) if mla_bloc in ('NDA', 'INDIA') else 50  # party didn't fight the 2024 LS segment
        c_terms = {0: 25, 1: 40, 2: 70}.get(terms, 100)
        own = pr.get(mla_bloc, 0) if mla_bloc in pr else 0
        if no == 358: own = pr['BSP']
        if mla_party_now == 'JD(L)': own = pr['OTH']
        c_proj = own * 100
        score = round(0.30 * c_margin + 0.25 * c_seg + 0.15 * c_terms + 0.30 * c_proj)
        comps = dict(margin2022=round(c_margin), segment2024=round(c_seg), trackRecord=c_terms, projection=round(c_proj))
    risk = None
    if mla_party_now == 'BJP' and not is_vacant and not dfc:
        r = 0
        if seg_lead_bloc != 'NDA': r += 1
        if margin_pct < 8: r += 1
        if pr['NDA'] < 0.6: r += 1
        risk = 'High' if (r == 3 or (r == 2 and pr['NDA'] < 0.5)) else 'Medium' if r >= 1 else 'Low'

    flips = None
    win22_bloc = bloc_of(norm_party(w['w_party']))
    if top != win22_bloc: flips = f"{win22_bloc}→{top}"

    out_seats.append(dict(
        no=no, name=s['name'], district=s['district'], region=s['region'], pc=l['pc'],
        reserved=('SC' if '(SC)' in s['name'] else 'ST' if '(ST)' in s['name'] else ''),
        mla=dict(name=(vacant[k]['last_mla'] if is_vacant else s['mla_name']),
                 party2022=s['mla_party_2022'], partyNow=(vacant[k]['party'] if is_vacant else mla_party_now),
                 status=('vacant' if is_vacant else 'defected' if dfc else 'rebel' if rbl else 'sitting'),
                 note=(vacant[k]['note'] if is_vacant else dfc['note'] if dfc else rbl['note'] if rbl else None),
                 role=roles.get(k), terms=terms,
                 crim=(mn['crim'] if mn else None), edu=(mn['edu'] if mn else None),
                 assets=(mn['assets'] if mn else None), liab=(mn['liab'] if mn else None),
                 myneta=(mn['cid'] if mn else None),
                 score=score, scoreParts=comps, ticketRisk=risk),
        r2022=dict(turnout=w['turnout'], total=round(tot22), margin=margin22, marginPct=round(margin_pct, 2),
                   cands=[dict(n=c['n'], p=c['p'], v=c['v'], pct=c['pct']) for c in c22[:6]]),
        hist=[dict(y=y, n=n, p=p) for y, n, p in hist],
        ls2024=dict(pc=l['pc'], w=norm_party(l['w']), wp=l['wp'], r=norm_party(l['r']), rp=l['rp'], margin=l['margin'],
                    marginPct=round(100 * l['margin'] / s['v24'], 2)),
        bypoll=(dict(year=s['by_year'], cands=[dict(n=c['n'], p=c['p'], pct=c['pct']) for c in s['by_c'][:4]]) if s['by_c'] else None),
        base=dict(a2022={b: round(v, 1) for b, v in s['p22'].items()}, ls2024={b: round(v, 1) for b, v in s['p24'].items()}),
        proj={b: round(v, 1) for b, v in s['proj'].items()},
        prob=pr, lead=top, rating=rating(pr[top], top), flip=flips, adj=s['adj'], othCan=bool(s['strong_oth']),
        cands=cands,
    ))

# ---------------------------------------------------------------- narratives
BL_NAME = {'NDA': 'NDA', 'INDIA': 'INDIA bloc', 'BSP': 'BSP', 'SPM': 'Azad–Owaisi front', 'OTH': 'others'}
def fmt(n): return f"{n:,}" if isinstance(n, int) else str(n)
for s in out_seats:
    m = s['mla']; r = s['r2022']; l = s['ls2024']; parts = []
    if m['status'] == 'vacant':
        parts.append(f"The seat is vacant. {m['note']}")
    else:
        role = f" ({m['role']})" if m['role'] else ''
        t = f"{m['name']}{role} won in {s['bypoll']['year']} bypoll" if s['bypoll'] and same_person(s['bypoll']['cands'][0]['n'], m['name']) and s['no'] in BYPOLL_WINNERS else f"{m['name']}{role} won in 2022 for the {m['party2022']} by {fmt(r['margin'])} votes ({r['marginPct']:.1f}% of votes polled)"
        parts.append(t + '.')
        if m['terms'] and m['terms'] >= 2: parts.append(f"Has won this seat {m['terms']} times since 2012.")
        if m['status'] == 'defected': parts.append(m['note'])
        if m['status'] == 'rebel': parts.append(m['note'])
    lb = BL_NAME[bloc_of(l['w'])]
    held = 'held' if bloc_of(l['w']) == bloc_of(m['partyNow']) else 'lost'
    if m['status'] == 'vacant':
        parts.append(f"In the 2024 Lok Sabha vote this segment ({l['pc']}) went to the {l['w']} by {fmt(l['margin'])} votes.")
    elif bloc_of(m['partyNow']) not in ('NDA', 'INDIA'):
        why = 'finished outside the top two there' if m['partyNow'] == 'BSP' else 'was not in that contest'
        parts.append(f"In the 2024 Lok Sabha vote this segment ({l['pc']}) went to the {l['w']} ({lb}) by {fmt(l['margin'])} votes; the {m['partyNow']} {why}, and since a Lok Sabha vote can't capture this MLA's personal following, the assembly result carries more weight here.")
    else:
        parts.append(f"In the 2024 Lok Sabha vote this segment ({l['pc']}) went to the {l['w']} ({lb}) by {fmt(l['margin'])} votes — the sitting MLA's alliance {held} this ground.")
    p = s['proj']; top = s['lead']
    second = sorted(BLOCS, key=lambda b: -p[b])[1]
    parts.append(f"Our model projects the {BL_NAME[top]} at {p[top]:.1f}% against {p[second]:.1f}% for the {BL_NAME[second]}, giving a {round(100*s['prob'][top])}% chance of winning ({s['rating']}).")
    if m['ticketRisk'] == 'High': parts.append('With BJP reportedly set to drop 30–40% of sitting MLAs, this seat shows the warning signs (weak 2024 segment and/or narrow 2022 win) that make a ticket change likely.')
    s['analysis'] = ' '.join(parts)

# ---------------------------------------------------------------- summary
tot = totals
def dist(b):
    j = BLOCS.index(b); x = tot[:, j]
    return dict(mean=round(float(x.mean()), 1), median=int(np.median(x)), p05=int(np.percentile(x, 5)), p95=int(np.percentile(x, 95)),
                p25=int(np.percentile(x, 25)), p75=int(np.percentile(x, 75)))
hist_nda = np.bincount(tot[:, 0], minlength=404).tolist()
nda_maj = tot[:, 0] >= 202; india_maj = tot[:, 1] >= 202
outcome_by_nda = [[int(((tot[:, 0] == k) & nda_maj).sum()), int(((tot[:, 0] == k) & india_maj).sum()),
                   int(((tot[:, 0] == k) & ~nda_maj & ~india_maj).sum())] for k in range(404)]
hist_india = np.bincount(tot[:, 1], minlength=404).tolist()
summary = dict(
    asOf=ctx['as_of'], sims=N, majority=202,
    target=TARGET, polls=ctx['polls'], alliances=ctx['alliances'], keyFacts=ctx['key_facts'],
    seats={b: dist(b) for b in BLOCS},
    pMajority=dict(NDA=round(float((tot[:, 0] >= 202).mean()), 4), INDIA=round(float((tot[:, 1] >= 202).mean()), 4),
                   hung=round(float(((tot[:, 0] < 202) & (tot[:, 1] < 202)).mean()), 4)),
    histNDA=hist_nda, histINDIA=hist_india, outcomeByNDA=outcome_by_nda,
    baseline=dict(S2022={b: round(v, 2) for b, v in S22.items()}, S2024={b: round(v, 2) for b, v in S24.items()}),
    model=dict(w2022=W22, w2024=W24, wBypoll=WBY, sdState=SD_STATE, sdRegion=SD_REG, sdSeat=SD_SEAT),
    regions={},
    ratings=collections.Counter(s['rating'] for s in out_seats),
)
for rg in REGIONS:
    ss = [s for s in out_seats if s['region'] == rg]
    summary['regions'][rg] = dict(seats=len(ss), exp={b: round(sum(s['prob'][b] for s in ss), 1) for b in BLOCS},
                                  won2022={b: sum(1 for s in ss if bloc_of(s['r2022']['cands'][0]['p']) == b) for b in BLOCS},
                                  led2024={b: sum(1 for s in ss if bloc_of(s['ls2024']['w']) == b) for b in BLOCS})
summary['expected'] = {b: round(sum(s['prob'][b] for s in out_seats), 1) for b in BLOCS}
summary['leads'] = collections.Counter(s['lead'] for s in out_seats)
crim = [s['mla']['crim'] for s in out_seats if s['mla']['crim'] is not None]
summary['mlaStats'] = dict(withCases=sum(1 for c in crim if c > 0), analysed=len(crim),
                           crorepati=sum(1 for s in out_seats if (s['mla']['assets'] or 0) >= 1e7),
                           defected=sum(1 for s in out_seats if s['mla']['status'] == 'defected'),
                           vacant=sum(1 for s in out_seats if s['mla']['status'] == 'vacant'),
                           highRisk=sum(1 for s in out_seats if s['mla']['ticketRisk'] == 'High'))

os.makedirs(OUT, exist_ok=True)
json.dump(out_seats, open(os.path.join(OUT, 'seats.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('target', TARGET)
print('S22', {b: round(v, 2) for b, v in S22.items()}); print('S24', {b: round(v, 2) for b, v in S24.items()})
print('expected', summary['expected']); print('median', {b: summary['seats'][b]['median'] for b in BLOCS})
print('90% NDA', summary['seats']['NDA']['p05'], summary['seats']['NDA']['p95'], 'INDIA', summary['seats']['INDIA']['p05'], summary['seats']['INDIA']['p95'])
print('pMajority', summary['pMajority']); print('ratings', summary['ratings']); print('mlaStats', summary['mlaStats'])
