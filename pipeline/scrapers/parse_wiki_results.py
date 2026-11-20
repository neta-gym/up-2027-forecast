import re, json, sys
src, start_marker, out = sys.argv[1], sys.argv[2], sys.argv[3]
txt = open(src, encoding='utf-8').read()
i = txt.index(start_marker)
j = txt.index('\n|}', i)
tbl = txt[i:j]
tbl = re.sub(r'<ref[^>]*/>', '', tbl)
tbl = re.sub(r'\{\{[Pp]arty colou?r\|[^}]*\}\}', 'X', tbl)
tbl = re.sub(r'\n\|\s*(bgcolor|style)="[^"]*"\s*\|\s*(?=\n)', '\n|', tbl)
tbl = re.sub(r'<ref[^>]*>.*?</ref>', '', tbl, flags=re.S)
def clean(c):
    c = c.strip()
    # drop attributes like style="..."| or rowspan=2 |
    if '|' in c and not c.startswith('[['):
        # attribute | value (only if the part before | has = and no [[)
        parts = re.split(r'(?<!\|)\|(?!\|)', c)
        if len(parts) > 1 and '=' in parts[0] and '[[' not in parts[0]:
            c = '|'.join(parts[1:]).strip()
    c = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", c)
    c = re.sub(r"\[\[([^\]]*)\]\]", r"\1", c)
    c = re.sub(r"'''?", '', c)
    c = re.sub(r'\{\{[^}]*\}\}', '', c)
    c = re.sub(r'<[^>]+>', '', c)
    return c.strip()
def num(s):
    s = re.sub(r'[^0-9.]', '', s)
    return float(s) if '.' in s else (int(s) if s else None)
rows = tbl.split('\n|-')
res = []
district = None
for r in rows:
    lines = [l for l in r.strip('\n').split('\n') if l.strip()]
    if not lines: continue
    cells = []
    for l in lines:
        if l.startswith('!') or l.startswith('|'):
            body = l[1:]
            # split inline || cells
            for part in re.split(r'\|\||!!', body):
                cells.append((l[0], part))
        else:
            if cells: cells[-1] = (cells[-1][0], cells[-1][1] + ' ' + l)
    # find the AC number cell: a '!' cell that's purely a number
    idx = None
    for k,(t,c) in enumerate(cells):
        cc = clean(c)
        if re.fullmatch(r'\d{1,3}', cc):
            idx = k; break
    if idx is None: continue
    if idx > 0:
        d = clean(cells[0][1])
        if d: district = d
    rest = [clean(c) for t,c in cells[idx:]]
    # rest: no, name, turnout, winner, color(empty), party, votes, pct, runner, color, party, votes, pct, margin
    rest = [x for x in rest]
    # remove empty colour cells
    vals = [x for x in rest if x != '']
    try:
        no = int(vals[0]); name = vals[1]
        rec = dict(no=no, name=name, district=district, turnout=num(vals[2]),
                   winner=vals[3], w_party=vals[4], w_votes=num(vals[5]), w_pct=num(vals[6]),
                   runner=vals[7], r_party=vals[8], r_votes=num(vals[9]), r_pct=num(vals[10]),
                   margin=num(vals[11]) if len(vals)>11 else None)
        res.append(rec)
    except Exception as e:
        print('ERR', vals, e, file=sys.stderr)
json.dump(res, open(out,'w'), ensure_ascii=False, indent=0)
print(len(res))
