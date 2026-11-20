/* UP 2027 Forecast — static single-page app. No build step, no dependencies. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ constants
  const C = { NDA: '#D9711A', INDIA: '#13906F', BSP: '#2D55B5', SPM: '#C23B7A', OTH: '#8B9099' };
  const BL = { NDA: 'NDA', INDIA: 'INDIA', BSP: 'BSP', SPM: 'Azad–Owaisi', OTH: 'Others' };
  const BL_LONG = { NDA: 'NDA (BJP+)', INDIA: 'INDIA (SP+INC)', BSP: 'BSP', SPM: 'Azad–Owaisi front (ASP+AIMIM)', OTH: 'Others / independents' };
  const BLOCS = ['NDA', 'INDIA', 'BSP', 'SPM', 'OTH'];
  const PARTY_BLOC = { 'Apni Janata Party': 'INDIA', BJP: 'NDA', RLD: 'NDA', 'AD(S)': 'NDA', SBSP: 'NDA', NISHAD: 'NDA', SP: 'INDIA', INC: 'INDIA', AITC: 'INDIA', 'AD(K)': 'INDIA', JAP: 'INDIA', 'SP / INC': 'INDIA', BSP: 'BSP', 'ASP(KR)': 'SPM', AIMIM: 'SPM', 'ASP(KR) / AIMIM': 'SPM' };
  const P2022 = { BJP: 'NDA', 'AD(S)': 'NDA', NISHAD: 'NDA', SP: 'INDIA', RLD: 'INDIA', SBSP: 'INDIA' }; // 2022 alliances
  const RATING_ORDER = ['Safe NDA', 'Likely NDA', 'Lean NDA', 'Toss-up', 'Lean INDIA', 'Likely INDIA', 'Safe INDIA', 'Lean BSP', 'Likely BSP', 'Safe BSP', 'Lean Others', 'Likely Others', 'Safe Others', 'Lean SPM', 'Likely SPM', 'Safe SPM'];
  const MAJ = 202;
  const BIG = [322, 199, 175, 246, 183, 377, 251, 244, 384, 367, 273, 275, 110, 217, 253, 356, 1, 8];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
  const pc = (p, d = 0) => (p == null ? '—' : d === 0 && p > 0.995 && p < 1 ? '>99%' : d === 0 && p > 0 && p < 0.005 ? '<1%' : (p * 100).toFixed(d) + '%');
  const pct1 = (x) => (x == null ? '—' : Number(x).toFixed(1) + '%');
  const blocOf = (p) => PARTY_BLOC[p] || 'OTH';
  const rupees = (n) => {
    if (n == null) return 'See affidavit';
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(n >= 1e9 ? 0 : 1) + ' Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L';
    return '₹' + nf(n);
  };
  function mix(hex, t) { // blend hex with white; t=1 -> full colour
    const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const m = (c) => Math.round(255 + (c - 255) * t);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  function ratingColor(rating, lead) {
    if (rating === 'Toss-up') return '#cfcbc0';
    const t = rating.startsWith('Safe') ? 1 : rating.startsWith('Likely') ? 0.68 : 0.4;
    return mix(C[lead], t);
  }
  const rateChip = (s) => `<span class="rate" style="background:${ratingColor(s.rating, s.lead)};color:${s.rating.startsWith('Safe') || s.rating.startsWith('Likely') ? '#fff' : 'var(--ink)'}">${esc(s.rating.replace('SPM', 'Azad–Owaisi'))}</span>`;
  const partyChip = (p) => `<span class="chip"><i style="background:${C[blocOf(p)]}"></i>${esc(p)}</span>`;
  const pbar = (prob) => `<div class="pbar" role="img" aria-label="${BLOCS.filter((b) => prob[b] >= 0.005).map((b) => BL[b] + ' ' + pc(prob[b])).join(', ')}">${BLOCS.filter((b) => prob[b] > 0.004).map((b) => `<span style="width:${prob[b] * 100}%;background:${C[b]}"></span>`).join('')}</div>`;
  const seatLink = (s) => `#/seat/${s.no}`;

  // tooltip
  const tip = $('#tip');
  function showTip(html, ev) {
    tip.innerHTML = html; tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
    if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = () => { tip.style.display = 'none'; };
  function seatTip(s, mode) {
    const top = BLOCS.filter((b) => s.prob[b] >= 0.01).sort((a, b) => s.prob[b] - s.prob[a]);
    let rows = top.map((b) => `<div class="row"><span><i style="background:${C[b]}"></i>${BL[b]}</span><b style="font-family:var(--mono);font-size:12px;display:inline">${pc(s.prob[b])}</b></div>`).join('');
    let extra = '';
    if (mode === '2022') extra = `<div class="small muted">2022: ${esc(s.r2022.cands[0].n)} (${esc(s.r2022.cands[0].p)}) by ${nf(s.r2022.margin)}</div>`;
    if (mode === '2024') extra = `<div class="small muted">2024 LS: ${esc(s.ls2024.w)} led by ${nf(s.ls2024.margin)}</div>`;
    return `<b>#${s.no} ${esc(s.name)}</b><div class="small muted">${esc(s.district)} · ${esc(s.rating.replace('SPM', 'Azad–Owaisi'))}</div>${rows}${extra}<div class="small" style="margin-top:4px">MLA: ${esc(s.mla.name)} (${esc(s.mla.partyNow)})${s.mla.status === 'vacant' ? ' — vacant' : ''}</div>`;
  }

  // ------------------------------------------------------------------ data
  let SEATS = [], SUM = null, GEO = null, BYNO = {};
  async function load() {
    const [s, m] = await Promise.all([fetch('data/seats.json').then((r) => r.json()), fetch('data/summary.json').then((r) => r.json())]);
    SEATS = s; SUM = m; SEATS.forEach((x) => (BYNO[x.no] = x));
    const d = new Date(SUM.asOf + 'T00:00:00');
    const ds = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    $('#asof').textContent = ds; $('#ver').textContent = 'v1.0 · ' + ds;
  }
  async function loadGeo() { if (!GEO) GEO = await fetch('data/up_ac.geojson').then((r) => r.json()); return GEO; }

  // ------------------------------------------------------------------ search
  function searchIndex(q) {
    q = q.trim().toLowerCase(); if (q.length < 2) return [];
    const out = [];
    for (const s of SEATS) {
      let score = 0, why = '';
      const n = s.name.toLowerCase();
      if (n.startsWith(q)) score = 100; else if (n.includes(q)) score = 80;
      else if (String(s.no) === q) score = 90;
      else if (s.mla.name.toLowerCase().includes(q)) { score = 70; why = 'MLA ' + s.mla.name; }
      else if (s.district.toLowerCase().includes(q)) { score = 50; why = s.district + ' district'; }
      else if (s.pc.toLowerCase().includes(q)) { score = 40; why = s.pc + ' Lok Sabha'; }
      else { const c = s.cands.find((c) => c.name && c.name.toLowerCase().includes(q)); if (c) { score = 60; why = c.name + ' (' + c.party + ')'; } }
      if (score) out.push({ s, score, why });
    }
    return out.sort((a, b) => b.score - a.score || a.s.no - b.s.no).slice(0, 10);
  }
  function wireSearch(box) {
    const input = $('input', box), res = $('.results', box); let hl = -1, items = [];
    const draw = () => {
      items = searchIndex(input.value);
      res.innerHTML = items.length ? items.map((it, i) => `<a href="${seatLink(it.s)}" class="${i === hl ? 'hl' : ''}"><span><b>${esc(it.s.name)}</b>${it.why ? ' <span class="muted small">· ' + esc(it.why) + '</span>' : ''}</span><small>#${it.s.no} · ${esc(it.s.rating.replace('SPM', 'Azad–Owaisi'))}</small></a>`).join('') : (input.value.trim().length > 1 ? '<a><span class="muted">No match — try a district or MLA name</span></a>' : '');
      res.classList.toggle('on', !!res.innerHTML);
    };
    input.addEventListener('input', () => { hl = -1; draw(); });
    input.addEventListener('focus', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { hl = Math.min(items.length - 1, hl + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { const it = items[Math.max(0, hl)]; if (it) { location.hash = seatLink(it.s); input.value = ''; res.classList.remove('on'); input.blur(); } }
      else if (e.key === 'Escape') { res.classList.remove('on'); input.blur(); }
    });
    document.addEventListener('click', (e) => { if (!box.contains(e.target)) res.classList.remove('on'); });
    res.addEventListener('click', () => { input.value = ''; res.classList.remove('on'); });
  }

  // ------------------------------------------------------------------ charts
  function seatBar(counts, opts = {}) {
    const order = BLOCS.filter((b) => counts[b] > 0);
    const total = 403;
    return `<div class="seatbar"><div class="bar">${order.map((b) => `<div class="seg" style="flex:${counts[b]} 0 0;background:${C[b]}" title="${BL_LONG[b]}: ${counts[b]}">${counts[b] >= 25 ? `${BL[b]} ${counts[b]}` : ''}</div>`).join('')}</div>
      <div class="maj" style="left:calc(${(MAJ / total) * 100}% )"><span>MAJORITY ${MAJ}</span></div></div>
      <div class="legend">${order.map((b) => `<span><i style="background:${C[b]}"></i>${BL_LONG[b]} <b class="mono">${counts[b]}</b></span>`).join('')}${opts.note ? `<span class="muted">${opts.note}</span>` : ''}</div>`;
  }

  function histogram(el) {
    const O = SUM.outcomeByNDA, N = SUM.sims;
    const lo = 106, hi = 302, bw = 4; // 4-seat bins of NDA seat totals; 202 starts a bin
    const bins = []; for (let x = lo; x < hi; x += bw) {
      let a = 0, b = 0, h = 0; for (let k = x; k < x + bw; k++) { const o = O[k] || [0, 0, 0]; a += o[0]; b += o[1]; h += o[2]; }
      bins.push({ x, nda: a / N, india: b / N, hung: h / N });
    }
    const W = 1000, Ht = 300, m = { l: 44, r: 16, t: 26, b: 40 };
    const ymax = Math.max(...bins.map((d) => d.nda + d.india + d.hung)) * 1.15;
    const X = (v) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r);
    const Y = (v) => Ht - m.b - (v / ymax) * (Ht - m.t - m.b);
    const yt = []; for (let v = 0; v <= ymax; v += 0.01) yt.push(v);
    const xt = []; for (let v = 125; v <= 300; v += 25) xt.push(v);
    const bwpx = X(lo + bw) - X(lo) - 2;
    const bars = bins.map((b) => {
      let y0 = 0; const segs = [['india', C.INDIA], ['hung', '#a9a59a'], ['nda', C.NDA]].filter(([k]) => b[k] > 0).map(([k, col], i, arr) => {
        const y1 = y0 + b[k]; const top = Y(y1), hgt = Math.max(0, Y(y0) - Y(y1) - (i < arr.length - 1 ? 1.5 : 0)); y0 = y1;
        return `<rect x="${X(b.x) + 1}" y="${top}" width="${bwpx}" height="${hgt}" fill="${col}" ${i === arr.length - 1 ? 'rx="2"' : ''}/>`;
      });
      return segs.join('');
    }).join('');
    const pm = SUM.pMajority;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Distribution of NDA seat totals across simulations, coloured by which bloc wins a majority">
      <g class="grid">${yt.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
      <g class="axis">${yt.map((v) => `<text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`).join('')}
      ${xt.map((v) => `<text x="${X(v)}" y="${Ht - 20}" text-anchor="middle">${v}</text>`).join('')}</g>
      ${bars}
      <line x1="${X(MAJ)}" x2="${X(MAJ)}" y1="${m.t - 10}" y2="${Ht - m.b}" stroke="#14151a" stroke-width="2" stroke-dasharray="5 4"/>
      <text x="${X(MAJ) + 8}" y="${m.t}" style="fill:#14151a;font-weight:700">NDA MAJORITY → ${pc(pm.NDA)}</text>
      <text x="${X(MAJ) - 8}" y="${m.t}" text-anchor="end" style="fill:#14151a;font-weight:700">← INDIA MAJORITY ${pc(pm.INDIA)} · HUNG ${pc(pm.hung)}</text>
      <line class="xh" x1="0" x2="0" y1="${m.t}" y2="${Ht - m.b}" stroke="#14151a" stroke-width="1" style="display:none"/>
      <rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${Ht - m.t - m.b}" fill="transparent" class="hit"/>
      <text x="${W / 2}" y="${Ht - 2}" text-anchor="middle">NDA seats won (4-seat bins)</text>
    </svg>`;
    const svg = $('svg', el), xh = $('.xh', el);
    $('.hit', el).addEventListener('mousemove', (ev) => {
      const r = svg.getBoundingClientRect(); const vx = ((ev.clientX - r.left) / r.width) * W;
      const seat = lo + ((vx - m.l) / (W - m.l - m.r)) * (hi - lo); const b = bins[Math.max(0, Math.min(bins.length - 1, Math.floor((seat - lo) / bw)))];
      xh.setAttribute('x1', X(b.x + bw / 2)); xh.setAttribute('x2', X(b.x + bw / 2)); xh.style.display = '';
      showTip(`<b>NDA ${b.x}–${b.x + bw - 1} seats</b><div class="row"><span>Share of simulations</span><span class="mono">${pc(b.nda + b.india + b.hung, 1)}</span></div>${b.nda ? `<div class="row"><span><i style="background:${C.NDA}"></i>NDA majority</span><span class="mono">${pc(b.nda, 1)}</span></div>` : ''}${b.india ? `<div class="row"><span><i style="background:${C.INDIA}"></i>INDIA majority</span><span class="mono">${pc(b.india, 1)}</span></div>` : ''}${b.hung ? `<div class="row"><span><i style="background:#a9a59a"></i>Hung</span><span class="mono">${pc(b.hung, 1)}</span></div>` : ''}`, ev);
    });
    $('.hit', el).addEventListener('mouseleave', () => { xh.style.display = 'none'; hideTip(); });
  }

  function strip(el) {
    const grp = (s) => (s.lead === 'NDA' || s.lead === 'INDIA' || s.rating === 'Toss-up' ? 0 : 1);
    const order = [...SEATS].sort((a, b) => grp(a) - grp(b) || (b.prob.NDA - b.prob.INDIA) - (a.prob.NDA - a.prob.INDIA) || (b.proj.NDA - b.proj.INDIA) - (a.proj.NDA - a.proj.INDIA));
    const W = 1000, H = 64, w = W / 403;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="All 403 seats ordered from safest NDA to safest INDIA">
      ${order.map((s, i) => `<rect data-no="${s.no}" x="${(i * w).toFixed(2)}" y="0" width="${(w + 0.15).toFixed(2)}" height="${H}" fill="${ratingColor(s.rating, s.lead)}"/>`).join('')}
      <line x1="${MAJ * w}" x2="${MAJ * w}" y1="-6" y2="${H + 6}" stroke="#14151a" stroke-width="2.5" stroke-dasharray="4 3"/>
      <text x="${MAJ * w}" y="${H + 20}" text-anchor="middle" style="fill:#14151a;font-weight:700">202nd seat</text>
      <text x="0" y="${H + 20}">◀ safest NDA</text><text x="${W}" y="${H + 20}" text-anchor="end">safest INDIA ▶</text>
    </svg>`;
    el.addEventListener('mousemove', (ev) => { const t = ev.target.closest('rect[data-no]'); if (t) showTip(seatTip(BYNO[t.dataset.no]), ev); else hideTip(); });
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('click', (ev) => { const t = ev.target.closest('rect[data-no]'); if (t) location.hash = '#/seat/' + t.dataset.no; });
  }

  async function drawMap(el, mode = 'forecast', highlight = null, compact = false) {
    const g = await loadGeo();
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    g.features.forEach((f) => f.geometry.coordinates.forEach((poly) => poly[0].forEach(([x, y]) => { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; })));
    const k = Math.cos(((miny + maxy) / 2) * Math.PI / 180);
    const W = 1000, sx = W / ((maxx - minx) * k), Hh = (maxy - miny) * sx;
    const P = ([x, y]) => `${((x - minx) * k * sx).toFixed(1)},${((maxy - y) * sx).toFixed(1)}`;
    const fill = (s) => {
      if (!s) return '#eee';
      if (mode === 'forecast') return ratingColor(s.rating, s.lead);
      if (mode === '2022') { const p = s.r2022.cands[0].p; const b = P2022[p] || (p === 'BSP' ? 'BSP' : p === 'INC' ? 'INC' : 'OTH'); return b === 'INC' ? '#62a7d9' : C[b] || C.OTH; }
      if (mode === '2024') return C[blocOf(s.ls2024.w)] || C.OTH;
      if (mode === 'mla') { const sc = s.mla.score; if (sc == null) return '#ddd'; return sc >= 70 ? '#1f7a4d' : sc >= 55 ? '#7fbf8f' : sc >= 40 ? '#f0c869' : '#d9534f'; }
    };
    const paths = g.features.map((f) => {
      const s = BYNO[f.properties.ac];
      const d = f.geometry.coordinates.map((poly) => poly.map((ring) => 'M' + ring.map(P).join('L') + 'Z').join('')).join('');
      const hl = highlight && f.properties.ac === highlight;
      return `<path data-no="${f.properties.ac}" d="${d}" fill="${fill(s)}" ${highlight && !hl ? 'fill-opacity=".45"' : ''} class="${hl ? 'hl' : ''}"/>`;
    });
    el.innerHTML = `<svg viewBox="-4 -4 ${W + 8} ${Hh + 8}" role="img" aria-label="Map of Uttar Pradesh assembly constituencies">${paths.join('')}</svg>`;
    if (highlight) { const p = $(`path[data-no="${highlight}"]`, el); if (p) p.parentNode.appendChild(p); }
    el.onmousemove = (ev) => { const t = ev.target.closest('path[data-no]'); if (t) showTip(seatTip(BYNO[t.dataset.no], mode), ev); else hideTip(); };
    el.onmouseleave = hideTip;
    el.onclick = (ev) => { const t = ev.target.closest('path[data-no]'); if (t) { hideTip(); location.hash = '#/seat/' + t.dataset.no; } };
  }

  function mapLegend(mode) {
    if (mode === 'forecast') {
      const rows = [['Safe', 1], ['Likely', 0.68], ['Lean', 0.4]];
      return `<div class="legend">${['NDA', 'INDIA'].map((b) => rows.map(([l, t]) => `<span><i style="background:${mix(C[b], t)}"></i>${l} ${BL[b]}</span>`).join('')).join('')}<span><i style="background:#cfcbc0"></i>Toss-up</span><span><i style="background:${C.OTH}"></i>Others</span><span><i style="background:${mix(C.BSP, .4)}"></i>BSP</span></div>`;
    }
    if (mode === '2022') return `<div class="legend"><span><i style="background:${C.NDA}"></i>BJP+ won (2022 alliance)</span><span><i style="background:${C.INDIA}"></i>SP+ won (incl. RLD, SBSP then)</span><span><i style="background:#62a7d9"></i>INC</span><span><i style="background:${C.BSP}"></i>BSP</span><span><i style="background:${C.OTH}"></i>Others (JD-L)</span></div>`;
    if (mode === '2024') return `<div class="legend"><span><i style="background:${C.NDA}"></i>NDA led segment</span><span><i style="background:${C.INDIA}"></i>INDIA led segment</span><span><i style="background:${C.SPM}"></i>ASP(KR) led</span></div>`;
    return `<div class="legend"><span><i style="background:#1f7a4d"></i>Strong (70+)</span><span><i style="background:#7fbf8f"></i>Solid (55–69)</span><span><i style="background:#f0c869"></i>Shaky (40–54)</span><span><i style="background:#d9534f"></i>Vulnerable (&lt;40)</span><span><i style="background:#ddd"></i>Vacant</span></div>`;
  }

  // what-if: deterministic re-run of seat leaders under a different statewide swing
  // Same structure as the main model, minus the statewide error (the slider *is* the statewide result).
  function whatIf(marginNDA, bsp, sims = 400) {
    const base = SUM.target.NDA - SUM.target.INDIA, d = marginNDA - base, bscale = bsp / SUM.target.BSP;
    let seed = 20271; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const regions = [...new Set(SEATS.map((s) => s.region))];
    const P = SEATS.map((s) => { const p = { ...s.proj }; const nb = p.BSP * bscale, db = nb - p.BSP; p.BSP = nb; p.NDA += d / 2 - db / 2; p.INDIA += -d / 2 - db / 2; return p; });
    const tot = { NDA: 0, INDIA: 0, BSP: 0, SPM: 0, OTH: 0 }; let ndaMaj = 0, indiaMaj = 0;
    for (let k = 0; k < sims; k++) {
      const reg = {}; regions.forEach((r) => (reg[r] = gauss() * 3));
      const c = { NDA: 0, INDIA: 0, BSP: 0, SPM: 0, OTH: 0 };
      SEATS.forEach((s, i) => {
        const p = P[i], ms = reg[s.region] + gauss() * 6, bd = gauss() * 2 * Math.sqrt(p.BSP / 9), sd = gauss() * 1.5 * Math.sqrt(Math.max(p.SPM, 0.2) / 3), od = s.othCan ? gauss() * 4 : 0;
        const v = { NDA: p.NDA + ms / 2 - bd / 2 - sd * 0.3 - od / 2, INDIA: p.INDIA - ms / 2 - bd / 2 - sd * 0.7 - od / 2, BSP: p.BSP + bd, SPM: p.SPM + sd, OTH: (p.OTH + od) * (s.othCan ? 1 : 0.3) };
        let best = 'NDA'; for (const b of BLOCS) if (v[b] > v[best]) best = b; c[best]++;
      });
      BLOCS.forEach((b) => (tot[b] += c[b])); if (c.NDA >= MAJ) ndaMaj++; if (c.INDIA >= MAJ) indiaMaj++;
    }
    const out = {}; BLOCS.forEach((b) => (out[b] = Math.round(tot[b] / sims)));
    const diff = 403 - BLOCS.reduce((a, b) => a + out[b], 0); out.OTH += diff;
    out.pNDA = ndaMaj / sims; out.pINDIA = indiaMaj / sims;
    return out;
  }

  // ------------------------------------------------------------------ views
  function viewHome(app) {
    const S = SUM.seats, pm = SUM.pMajority;
    const head = pm.NDA >= 0.65 ? 'NDA FAVOURED' : pm.INDIA >= 0.65 ? 'INDIA FAVOURED' : 'TOO CLOSE TO CALL';
    const med = { NDA: S.NDA.median, INDIA: S.INDIA.median, BSP: S.BSP.median, SPM: S.SPM.median, OTH: S.OTH.median };
    const sumMed = BLOCS.reduce((a, b) => a + med[b], 0); med.OTH += 403 - sumMed;
    const tc = {}; SEATS.forEach((s) => { tc[s.rating] = (tc[s.rating] || 0) + 1; });
    const toss = SEATS.filter((s) => s.rating === 'Toss-up').sort((a, b) => Math.abs(a.prob.NDA - a.prob.INDIA) - Math.abs(b.prob.NDA - b.prob.INDIA));
    const flipsToIndia = SEATS.filter((s) => s.flip && s.flip.endsWith('INDIA')).length, flipsToNda = SEATS.filter((s) => s.flip && s.flip.endsWith('NDA')).length;
    const atRisk = SEATS.filter((s) => s.mla.status === 'sitting' && s.mla.score != null).map((s) => ({ s, own: s.prob[blocOf(s.mla.partyNow)] ?? s.prob.OTH })).filter((x) => x.own < 0.5).sort((a, b) => a.own - b.own);
    const ms = SUM.mlaStats;
    const polls = SUM.polls;
    app.innerHTML = `
    <section class="card hero shadow">
      <span class="tag">● ${SUM.sims.toLocaleString('en-IN')} simulated elections · 403 seats</span>
      <h1>WHO WINS UTTAR PRADESH?<br><span class="grad">${head}</span></h1>
      <p class="lede">A seat-by-seat forecast of the 2027 Vidhan Sabha election, built on every constituency's 2012–2022 results, the 2024 Lok Sabha vote in all 403 assembly segments, MLA affidavits, defections, and the latest opinion polls. Find your seat and see who is likely to win it — and why.</p>
      <div class="big-search search" id="heroSearch"><input type="search" placeholder="Your constituency, district or MLA…" aria-label="Search your constituency" autocomplete="off"><div class="results"></div></div>
      <div class="links"><a href="#/seats">Browse all 403 seats</a><a href="#/mlas">MLA report cards</a><a href="#/method">How the model works</a></div>
    </section>

    <section class="card">
      <span class="tag ink">The forecast</span>
      <h2>Median outcome: NDA ${S.NDA.median}, INDIA ${S.INDIA.median}</h2>
      <p class="lede">Majority is ${MAJ}. In ${SUM.sims.toLocaleString('en-IN')} simulations, the NDA's seat total landed between ${S.NDA.p05} and ${S.NDA.p95} nine times in ten; the SP-led INDIA bloc between ${S.INDIA.p05} and ${S.INDIA.p95}. On today's numbers neither side can count on a majority.</p>
      ${seatBar(med, { note: 'median seats in simulation' })}
      <div class="tiles">
        <div class="tile dot" style="--c:${C.NDA}"><div class="k">NDA majority</div><div class="v">${pc(pm.NDA)}</div><div class="s">chance of ${MAJ}+ seats · median ${S.NDA.median}</div></div>
        <div class="tile dot" style="--c:${C.INDIA}"><div class="k">INDIA majority</div><div class="v">${pc(pm.INDIA)}</div><div class="s">chance of ${MAJ}+ seats · median ${S.INDIA.median}</div></div>
        <div class="tile"><div class="k">Hung assembly</div><div class="v">${pc(pm.hung)}</div><div class="s">no bloc reaches ${MAJ}</div></div>
        <div class="tile"><div class="k">Toss-up seats</div><div class="v">${tc['Toss-up'] || 0}</div><div class="s">no side above 60% — these decide it</div></div>
      </div>
    </section>

    <section class="card">
      <span class="tag ink">Range of outcomes</span>
      <h2>${SUM.sims.toLocaleString('en-IN')} simulated assemblies</h2>
      <p class="lede">Each simulation draws a statewide polling error, a regional swing for each of the 7 regions and a local swing in every seat. Bars show how often the NDA ends up with each seat total — and who gets a majority in those runs.</p>
      <div class="legend"><span><i style="background:${C.NDA}"></i>NDA majority</span><span><i style="background:${C.INDIA}"></i>INDIA majority</span><span><i style="background:#a9a59a"></i>Hung assembly</span></div>
      <div class="chart" id="hist"></div>
    </section>

    <section class="card">
      <span class="tag ink">Every seat</span>
      <h2>The 403-seat map</h2>
      <div class="seg-toggle" id="mapMode"><button data-m="forecast" class="on">2027 forecast</button><button data-m="2022">2022 result</button><button data-m="2024">2024 Lok Sabha lead</button><button data-m="mla">MLA strength</button></div>
      <div class="mapwrap">
        <div><div id="mapLegend">${mapLegend('forecast')}</div><div class="map chart" id="map"><div class="loading">Drawing 403 constituencies…</div></div></div>
        <div>
          <h3>Seat ratings</h3>
          <div class="ratings">${RATING_ORDER.filter((r) => tc[r]).map((r) => { const lead = r.includes('NDA') ? 'NDA' : r.includes('INDIA') ? 'INDIA' : r.includes('BSP') ? 'BSP' : r.includes('SPM') ? 'SPM' : r.includes('Others') ? 'OTH' : 'NDA'; return `<a class="r" href="#/seats?rating=${encodeURIComponent(r)}" style="text-decoration:none;color:inherit"><i style="background:${ratingColor(r, lead)}"></i><span>${esc(r.replace('SPM', 'Azad–Owaisi'))}</span><b>${tc[r]}</b></a>`; }).join('')}</div>
          <p class="small muted" style="margin-top:12px">Safe ≥95% · Likely 80–95% · Lean 60–80% · Toss-up &lt;60% win probability. Tap any seat for its full breakdown.</p>
          <p class="small"><b>Projected flips vs 2022:</b> ${flipsToIndia} seats to INDIA, ${flipsToNda} to NDA (2022 RLD/SBSP wins counted as NDA, their current alliance).</p>
        </div>
      </div>
      <h3 style="margin-top:20px">All 403 seats, safest NDA to safest INDIA</h3>
      <div class="chart strip" id="strip"></div>
    </section>

    <section class="card">
      <span class="tag acc">What if?</span>
      <h2>Move the swing, watch the seats</h2>
      <div class="whatif">
        <div class="ctl">
          <label for="wiM">NDA lead over INDIA (vote %)</label><div class="val" id="wiMv"></div>
          <input type="range" id="wiM" min="-12" max="12" step="0.1">
          <label for="wiB">BSP vote share</label><div class="val" id="wiBv"></div>
          <input type="range" id="wiB" min="3" max="18" step="0.5">
          <button id="wiReset">Reset to poll average</button>
        </div>
        <div><div id="wiBar"></div><p class="small muted" id="wiNote"></p></div>
      </div>
    </section>

    <section class="card">
      <span class="tag ink">By region</span>
      <h2>Where it will be won</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Region</th><th class="num">Seats</th><th class="num">NDA won 2022*</th><th class="num">NDA led 2024</th><th class="num">INDIA led 2024</th><th class="num">NDA 2027 (exp.)</th><th class="num">INDIA 2027 (exp.)</th><th class="num">Others (exp.)</th></tr></thead><tbody>
      ${Object.entries(SUM.regions).map(([r, d]) => `<tr><td><b>${esc(r)}</b></td><td class="num">${d.seats}</td><td class="num">${d.won2022.NDA}</td><td class="num">${d.led2024.NDA}</td><td class="num">${d.led2024.INDIA}</td><td class="num"><b>${Math.round(d.exp.NDA)}</b></td><td class="num"><b>${Math.round(d.exp.INDIA)}</b></td><td class="num">${Math.round(d.exp.BSP + d.exp.SPM + d.exp.OTH)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="small muted">*2022 wins by parties in today's NDA (incl. RLD and SBSP, who fought 2022 alongside SP). Expected seats = sum of win probabilities.</p>
    </section>

    <section class="card">
      <span class="tag">Battlegrounds</span>
      <h2>The closest ${Math.min(12, toss.length)} seats</h2>
      <p class="lede">Seats where neither alliance clears 60%. Candidate selection — especially BJP's planned ticket changes and SP–Congress seat-sharing — will swing these.</p>
      <div class="grid3">${toss.slice(0, 12).map(miniCard).join('')}</div>
      <p><a href="#/seats?rating=Toss-up">See all ${toss.length} toss-ups →</a></p>
    </section>

    <section class="card">
      <span class="tag ink">Big names</span>
      <h2>Marquee contests</h2>
      <div class="grid3">${BIG.map((n) => BYNO[n]).filter(Boolean).map(miniCard).join('')}</div>
    </section>

    <section class="card">
      <span class="tag">MLAs on the edge</span>
      <h2>${atRisk.length} sitting MLAs are more likely to lose than win</h2>
      <p class="lede">Ranked by the projected chance that the MLA's current alliance holds the seat. These are the seats most likely to change hands — or to see the incumbent dropped.</p>
      <div class="grid3">${atRisk.slice(0, 9).map((x) => miniCard(x.s, x.own)).join('')}</div>
      <p><a href="#/mlas?sort=own">Full MLA ranking →</a></p>
    </section>

    <section class="card">
      <span class="tag ink">Accountability snapshot</span>
      <h2>Who you elected in 2022</h2>
      <div class="tiles">
        <div class="tile"><div class="k">MLAs with criminal cases</div><div class="v">${ms.withCases}</div><div class="s">of ${ms.analysed} affidavits analysed (${Math.round((ms.withCases / ms.analysed) * 100)}%)</div></div>
        <div class="tile"><div class="k">Crorepati MLAs</div><div class="v">${ms.crorepati}</div><div class="s">declared assets ≥ ₹1 crore</div></div>
        <div class="tile"><div class="k">Switched sides</div><div class="v">${ms.defected}</div><div class="s">SP MLAs now with the BJP</div></div>
        <div class="tile"><div class="k">BJP MLAs at high ticket risk</div><div class="v">${ms.highRisk}</div><div class="s">our flag: weak 2024 segment + narrow 2022 win; BJP reportedly plans to drop 30–40%</div></div>
      </div>
    </section>

    <section class="card">
      <span class="tag ink">Polls</span>
      <h2>What the surveys say</h2>
      <p class="lede">Our statewide baseline is the simple average of published vote-share polls: <b>NDA ${SUM.target.NDA.toFixed(1)}%</b>, <b>INDIA ${SUM.target.INDIA.toFixed(1)}%</b>, with BSP set at ${SUM.target.BSP}% and the new Azad–Owaisi front at ${SUM.target.SPM}%. Polls in UP have missed badly before (2024), so the model assumes a ±4-point statewide error.</p>
      <div class="tbl-wrap"><table><thead><tr><th>Published</th><th>Pollster</th><th class="num">NDA vote</th><th class="num">INDIA vote</th><th class="num">BSP vote</th><th class="num">NDA seats</th><th class="num">INDIA seats</th></tr></thead><tbody>
      ${polls.map((p) => `<tr><td class="mono">${p.date}</td><td>${esc(p.agency)}</td><td class="num">${p.vote.NDA != null ? p.vote.NDA + '%' : '—'}</td><td class="num">${p.vote.INDIA != null ? p.vote.INDIA + '%' : '—'}</td><td class="num">${p.vote.BSP != null ? p.vote.BSP + '%' : '—'}</td><td class="num">${p.seats.NDA ?? '—'}</td><td class="num">${p.seats.INDIA ?? '—'}</td></tr>`).join('')}
      <tr><td class="mono">${SUM.asOf}</td><td><b>This forecast (median)</b></td><td class="num"><b>${SUM.target.NDA.toFixed(1)}%</b></td><td class="num"><b>${SUM.target.INDIA.toFixed(1)}%</b></td><td class="num"><b>${SUM.target.BSP}%</b></td><td class="num"><b>${S.NDA.median}</b></td><td class="num"><b>${S.INDIA.median}</b></td></tr>
      </tbody></table></div>
      <h3 style="margin-top:20px">State of play</h3>
      <ul class="small">${SUM.keyFacts.map((f) => `<li>${esc(f)}</li>`).join('')}
        ${Object.values(SUM.alliances).filter((a) => a.note).map((a) => `<li><b>${esc(a.label)}:</b> ${esc(a.note)}</li>`).join('')}</ul>
    </section>`;
    wireSearch($('#heroSearch'));
    histogram($('#hist'));
    drawMap($('#map'), 'forecast');
    strip($('#strip'));
    $$('#mapMode button').forEach((b) => b.addEventListener('click', () => {
      $$('#mapMode button').forEach((x) => x.classList.toggle('on', x === b));
      $('#mapLegend').innerHTML = mapLegend(b.dataset.m); drawMap($('#map'), b.dataset.m);
    }));
    // what-if
    const m0 = +(SUM.target.NDA - SUM.target.INDIA).toFixed(1), b0 = SUM.target.BSP;
    const M = $('#wiM'), B = $('#wiB');
    let raf = 0;
    const upd = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updNow); };
    const updNow = () => {
      const m = +M.value, b = +B.value; const c = whatIf(m, b);
      $('#wiMv').textContent = (m > 0 ? 'NDA +' : m < 0 ? 'INDIA +' : 'Tied ') + (m === 0 ? '' : Math.abs(m).toFixed(1) + ' pts');
      $('#wiBv').textContent = b.toFixed(1) + '%';
      $('#wiBar').innerHTML = seatBar(c);
      const lead = c.NDA >= MAJ ? 'NDA majority' : c.INDIA >= MAJ ? 'INDIA majority' : 'Hung assembly';
      $('#wiNote').innerHTML = `<b>Average outcome: ${lead}.</b> With the statewide result fixed at this swing, the NDA wins a majority in ${pc(c.pNDA)} of 400 quick simulations and INDIA in ${pc(c.pINDIA)} (regional and local swings still vary). Poll average: NDA +${m0} pts.`;
    };
    M.value = m0; B.value = b0; updNow();
    M.addEventListener('input', upd); B.addEventListener('input', upd);
    $('#wiReset').addEventListener('click', () => { M.value = m0; B.value = b0; upd(); });
  }

  function miniCard(s, own) {
    const top = BLOCS.filter((b) => s.prob[b] >= 0.01).sort((a, b) => s.prob[b] - s.prob[a]).slice(0, 2);
    const cands = top.map((b) => s.cands.find((c) => c.bloc === b)).filter(Boolean);
    return `<a class="mini" href="${seatLink(s)}"><div class="t"><b>${esc(s.name)}</b><small>#${s.no} · ${esc(s.district)}</small></div>
      <div class="who">${own != null ? `<b>MLA ${esc(s.mla.name)}</b> (${esc(s.mla.partyNow)}) — hold chance <b>${pc(own)}</b><br>` : ''}${cands.map((c) => `${esc(c.name)} <span class="muted">(${esc(c.party)})</span>`).join(' vs ')}${s.mla.role && own == null ? `<br><span class="muted">${esc(s.mla.role)}: ${esc(s.mla.name)}</span>` : ''}</div>
      ${pbar(s.prob)}<div class="pl">${top.map((b) => `<span style="color:${C[b] === C.OTH ? 'var(--ink-2)' : 'var(--ink)'}">${BL[b]} ${pc(s.prob[b])}</span>`).join('')}</div>
      <div style="margin-top:8px">${rateChip(s)}${s.flip ? ` <span class="flag amber">flip ${esc(s.flip.replace('SPM', 'Azad–Owaisi'))}</span>` : ''}${s.mla.status === 'defected' ? ' <span class="flag red">defector</span>' : ''}${s.mla.status === 'vacant' ? ' <span class="flag gray">vacant</span>' : ''}</div></a>`;
  }

  // ---------------------------------------------------------------- all seats
  function viewSeats(app, params) {
    const regions = [...new Set(SEATS.map((s) => s.region))];
    const districts = [...new Set(SEATS.map((s) => s.district))].sort();
    const ratings = RATING_ORDER.filter((r) => SEATS.some((s) => s.rating === r));
    const parties = [...new Set(SEATS.map((s) => s.mla.partyNow))].sort();
    const st = { q: params.get('q') || '', region: params.get('region') || '', district: params.get('district') || '', rating: params.get('rating') || '', party: params.get('party') || '', sort: params.get('sort') || 'no', dir: 1 };
    app.innerHTML = `<section class="card"><span class="tag ink">All constituencies</span><h2>403 seats, one table</h2>
      <p class="lede">Filter by region, district, rating or current MLA party. Click any row for the full constituency breakdown — candidates, MLA record, history and model inputs.</p>
      <div class="filters">
        <input id="fq" type="search" placeholder="Seat, MLA or candidate…" value="${esc(st.q)}">
        <select id="fr"><option value="">All regions</option>${regions.map((r) => `<option ${r === st.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
        <select id="fd"><option value="">All districts</option>${districts.map((r) => `<option ${r === st.district ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
        <select id="ft"><option value="">All ratings</option>${ratings.map((r) => `<option value="${esc(r)}" ${r === st.rating ? 'selected' : ''}>${esc(r.replace('SPM', 'Azad–Owaisi'))}</option>`).join('')}</select>
        <select id="fp"><option value="">MLA: any party</option>${parties.map((r) => `<option ${r === st.party ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
        <span class="count" id="fc"></span>
      </div>
      <div class="tbl-wrap"><table><thead><tr>
        <th class="sort num" data-k="no">#</th><th class="sort" data-k="name">Constituency</th><th class="hide-sm">District</th><th class="sort" data-k="mla">MLA (party)</th>
        <th class="sort num hide-sm" data-k="m22">2022 margin</th><th class="hide-sm">2024 LS lead</th><th class="sort" data-k="nda">Win probability</th><th class="sort" data-k="rating">Rating</th></tr></thead><tbody id="tb"></tbody></table></div></section>`;
    const tb = $('#tb');
    const keyf = { no: (s) => s.no, name: (s) => s.name, mla: (s) => s.mla.name, m22: (s) => s.r2022.marginPct, nda: (s) => s.prob.NDA - s.prob.INDIA, rating: (s) => RATING_ORDER.indexOf(s.rating) };
    const render = () => {
      const q = st.q.toLowerCase();
      let rows = SEATS.filter((s) => (!st.region || s.region === st.region) && (!st.district || s.district === st.district) && (!st.rating || s.rating === st.rating) && (!st.party || s.mla.partyNow === st.party)
        && (!q || s.name.toLowerCase().includes(q) || s.mla.name.toLowerCase().includes(q) || s.cands.some((c) => (c.name || '').toLowerCase().includes(q)) || String(s.no) === q));
      const kf = keyf[st.sort] || keyf.no;
      rows.sort((a, b) => { const x = kf(a), y = kf(b); return (x < y ? -1 : x > y ? 1 : 0) * st.dir; });
      $('#fc').textContent = rows.length + ' seats';
      tb.innerHTML = rows.map((s) => {
        const top = BLOCS.filter((b) => s.prob[b] >= 0.01).sort((a, b) => s.prob[b] - s.prob[a]).slice(0, 2);
        return `<tr class="link" data-no="${s.no}"><td class="num mono">${s.no}</td><td><b>${esc(s.name)}</b>${s.reserved ? '' : ''}</td><td class="hide-sm">${esc(s.district)}</td>
        <td>${esc(s.mla.name)} ${partyChip(s.mla.partyNow)}${s.mla.status === 'vacant' ? ' <span class="flag gray">vacant</span>' : s.mla.status === 'defected' ? ' <span class="flag red">ex-SP</span>' : ''}</td>
        <td class="num hide-sm mono">${nf(s.r2022.margin)}<div class="small muted">${s.r2022.marginPct.toFixed(1)}%</div></td>
        <td class="hide-sm">${partyChip(s.ls2024.w)} <span class="small muted mono">+${s.ls2024.marginPct.toFixed(1)}</span></td>
        <td>${pbar(s.prob)}<div class="small mono">${top.map((b) => `${BL[b]} ${pc(s.prob[b])}`).join(' · ')}</div></td><td>${rateChip(s)}</td></tr>`;
      }).join('') || '<tr><td colspan="8" class="muted">No seats match these filters.</td></tr>';
      const p = new URLSearchParams(); ['q', 'region', 'district', 'rating', 'party'].forEach((k) => st[k] && p.set(k, st[k])); if (st.sort !== 'no') p.set('sort', st.sort);
      history.replaceState(null, '', '#/seats' + (p.toString() ? '?' + p : ''));
    };
    $('#fq').addEventListener('input', (e) => { st.q = e.target.value; render(); });
    [['#fr', 'region'], ['#fd', 'district'], ['#ft', 'rating'], ['#fp', 'party']].forEach(([id, k]) => $(id).addEventListener('change', (e) => { st[k] = e.target.value; render(); }));
    $$('th.sort').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.k; st.dir = st.sort === k ? -st.dir : (k === 'nda' ? -1 : 1); st.sort = k; render(); }));
    tb.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-no]'); if (tr) location.hash = '#/seat/' + tr.dataset.no; });
    render();
  }

  // ---------------------------------------------------------------- one seat
  function ring(score) {
    const r = 38, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score || 0));
    const col = v >= 70 ? '#1f7a4d' : v >= 55 ? '#5fae74' : v >= 40 ? '#d9a21b' : '#c8352b';
    return `<svg class="ring" viewBox="0 0 92 92" role="img" aria-label="Re-election strength ${v} out of 100"><circle cx="46" cy="46" r="${r}" fill="none" stroke="#e7e5dd" stroke-width="9"/><circle cx="46" cy="46" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 46 46)" stroke-linecap="round"/><text x="46" y="53" text-anchor="middle" style="font-family:var(--display);font-size:24px;fill:#14151a">${v}</text></svg>`;
  }
  function voteRows(sh, keys) {
    const mx = Math.max(...keys.map((k) => sh[k] || 0), 1);
    return keys.map((k) => `<div class="vs-row"><span>${esc(BL_LONG[k] || k)}</span><div class="track"><div class="fill" style="width:${((sh[k] || 0) / mx) * 100}%;background:${C[k] || C.OTH}"></div></div><span class="n">${pct1(sh[k])}</span></div>`).join('');
  }
  function resultTable(cands, opts = {}) {
    return `<div class="tbl-wrap"><table><thead><tr><th>Candidate</th><th>Party</th>${opts.votes !== false ? '<th class="num">Votes</th>' : ''}<th class="num">Share</th></tr></thead><tbody>${cands.map((c, i) => `<tr><td>${i === 0 ? '<b>' : ''}${esc(c.n || '—')}${i === 0 ? '</b> <span class="flag blue">won</span>' : ''}</td><td>${partyChip(c.p)}</td>${opts.votes !== false ? `<td class="num mono">${nf(c.v)}</td>` : ''}<td class="num mono">${pct1(c.pct)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function viewSeat(app, no) {
    const s = BYNO[no]; if (!s) { app.innerHTML = '<div class="card"><h2>Seat not found</h2><p><a href="#/seats">Back to all seats</a></p></div>'; return; }
    const top = s.lead, m = s.mla;
    const blocsShown = BLOCS.filter((b) => s.proj[b] >= 0.5 && (b !== 'OTH' || s.othCan || s.proj.OTH > 4));
    const sp = m.scoreParts;
    const flags = [];
    if (m.role) flags.push(`<span class="flag blue">${esc(m.role)}</span>`);
    if (m.status === 'defected') flags.push('<span class="flag red">Switched SP → BJP</span>');
    if (m.status === 'rebel') flags.push('<span class="flag amber">SP rebel</span>');
    if (m.status === 'vacant') flags.push('<span class="flag gray">Seat vacant</span>');
    if (m.crim) flags.push(`<span class="flag red">${m.crim} criminal case${m.crim > 1 ? 's' : ''} declared</span>`);
    if (m.ticketRisk) flags.push(`<span class="flag ${m.ticketRisk === 'High' ? 'red' : m.ticketRisk === 'Medium' ? 'amber' : 'gray'}">Ticket risk: ${m.ticketRisk}</span>`);
    if (m.terms >= 2) flags.push(`<span class="flag gray">${m.terms}× winner here</span>`);
    const prev = BYNO[no - 1], next = BYNO[no + 1];
    const reg = s.reserved ? ` · Reserved (${s.reserved})` : '';
    app.innerHTML = `
    <div class="crumbs"><a href="#/">Forecast</a> / <a href="#/seats?region=${encodeURIComponent(s.region)}">${esc(s.region)}</a> / <a href="#/seats?district=${encodeURIComponent(s.district)}">${esc(s.district)}</a> / #${s.no}</div>
    <section class="card shadow">
      <div class="seat-head">
        <div><span class="tag ink">Constituency #${s.no}</span><h1 style="margin-top:12px">${esc(s.name)}</h1>
          <div class="meta">${esc(s.district)} district · ${esc(s.region)} · ${esc(s.pc)} Lok Sabha${reg}</div></div>
        <div class="verdict"><div class="small mono muted">MOST LIKELY WINNER</div><div class="pc" style="color:${C[top] === C.OTH ? 'var(--ink)' : C[top]}">${pc(s.prob[top])}</div><div style="font-family:var(--display);text-transform:uppercase">${esc(BL_LONG[top])}</div><div style="margin-top:6px">${rateChip(s)}</div></div>
      </div>
      <div style="margin-top:18px">${pbar(s.prob)}</div>
      <p class="analysis" style="margin-top:18px">${esc(s.analysis)}</p>
    </section>

    <div class="cols">
      <div>
        <section class="card">
          <span class="tag">Prospective candidates</span><h2>Who's in the race</h2>
          <p class="small muted">Win probability is for the candidate's alliance. Names are provisional: “Announced / reported” = named by the party or in credible reports; “Sitting MLA” = expected to re-contest; “2022 nominee” = the party's last candidate here, the likeliest pick until lists are out.</p>
          ${s.cands.map((c) => `<div class="cand"><div class="stripe" style="background:${C[c.bloc]}"></div><div><div class="nm">${esc(c.name)}</div><div class="sub">${esc(c.party)} · ${esc(BL_LONG[c.bloc])}</div><div class="sub" style="color:var(--ink-2)">${esc(c.status)}</div></div><div class="p">${c.prob < 0.005 ? '&lt;1%' : pc(c.prob)}<small>win chance</small></div></div>`).join('')}
        </section>
        <section class="card">
          <span class="tag ink">Projected vote share</span><h2>2027 projection</h2>
          ${voteRows(s.proj, blocsShown)}
          <p class="small muted" style="margin-top:12px">Blend of this seat's 2022 assembly result and its 2024 Lok Sabha segment result, each swung to today's statewide poll average${s.bypoll ? `, plus the ${s.bypoll.year} bypoll` : ''}.</p>
          <details style="margin-top:8px"><summary class="small mono" style="cursor:pointer">Show model inputs</summary>
            <h3 style="margin-top:14px">From the 2022 assembly result</h3>${voteRows(s.base.a2022, blocsShown)}
            <h3 style="margin-top:14px">From the 2024 Lok Sabha segment</h3>${voteRows(s.base.ls2024, blocsShown)}
            ${s.adj.length ? `<h3 style="margin-top:14px">Adjustments</h3><ul class="small">${s.adj.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
          </details>
        </section>
      </div>
      <div>
        <section class="card">
          <span class="tag">${m.status === 'vacant' ? 'Last MLA' : 'Sitting MLA'}</span><h2>${esc(m.name)}</h2>
          <div>${partyChip(m.partyNow)} ${m.party2022 !== m.partyNow ? `<span class="small muted">elected as ${esc(m.party2022)}</span>` : ''}</div>
          <div style="margin:10px 0">${flags.join('')}</div>
          ${m.note ? `<div class="note">${esc(m.note)}</div>` : ''}
          ${m.score != null ? `<div class="score">${ring(m.score)}<div><div style="font-family:var(--display);text-transform:uppercase">Re-election strength</div><div class="small muted">0–100 composite of 2022 margin (30%), 2024 segment result (25%), track record (15%) and the 2027 projection for the MLA's alliance (30%).</div></div></div>
          <div class="small">${[['2022 margin', sp.margin2022], ['2024 segment', sp.segment2024], ['Track record', sp.trackRecord], ['2027 projection', sp.projection]].map(([k, v]) => `<div class="vs-row" style="grid-template-columns:110px minmax(0,1fr) 40px"><span>${k}</span><div class="track"><div class="fill" style="width:${v}%;background:var(--ink-2)"></div></div><span class="n">${v}</span></div>`).join('')}</div>` : ''}
          <h3 style="margin-top:16px">From the 2022 affidavit</h3>
          ${m.crim != null ? `<div class="kv"><div><div class="k">Criminal cases</div><div class="v" style="color:${m.crim ? 'var(--red)' : 'inherit'}">${m.crim}</div></div><div><div class="k">Education</div><div class="v">${esc(m.edu)}</div></div><div><div class="k">Total assets</div><div class="v">${rupees(m.assets)}</div></div><div><div class="k">Liabilities</div><div class="v">${rupees(m.liab)}</div></div></div>
          <p class="small muted">Self-declared in the 2022 nomination affidavit (MyNeta / ADR). Cases are pending cases, not convictions. ${m.myneta ? `<a href="https://myneta.info/uttarpradesh2022/candidate.php?candidate_id=${m.myneta}" target="_blank" rel="noopener">View affidavit →</a>` : ''}</p>`
            : `<p class="small muted">${m.status === 'vacant' ? 'Seat is vacant.' : 'Elected in a bypoll — not covered by the 2022 winners’ affidavit dataset.'}</p>`}
        </section>
        <section class="card">
          <span class="tag ink">Track record</span><h2>Past results</h2>
          <div class="small mono muted">2024 LOK SABHA · ${esc(s.ls2024.pc)} segment</div>
          <p style="margin:4px 0 14px">${partyChip(s.ls2024.w)} ${pct1(s.ls2024.wp)} vs ${partyChip(s.ls2024.r)} ${pct1(s.ls2024.rp)} — margin <b>${nf(s.ls2024.margin)}</b></p>
          ${s.bypoll ? `<div class="small mono muted">${s.bypoll.year} BYPOLL</div>${resultTable(s.bypoll.cands, { votes: false })}<div style="height:14px"></div>` : ''}
          <div class="small mono muted">2022 ASSEMBLY · turnout ${pct1(s.r2022.turnout)}</div>
          ${resultTable(s.r2022.cands.filter((c) => c.p !== 'NOTA').slice(0, 5))}
          <div style="height:14px"></div>
          <div class="small mono muted">WINNERS</div>
          <div class="tbl-wrap"><table><tbody>${s.hist.map((h) => `<tr><td class="mono">${h.y}</td><td>${esc(h.n)}</td><td>${partyChip(h.p)}</td></tr>`).join('')}</tbody></table></div>
        </section>
      </div>
    </div>

    <section class="card"><span class="tag ink">Where it sits</span><h2>${esc(s.name)} on the map</h2><div class="map chart" id="smap" style="max-width:760px"></div></section>
    <div class="pager">${prev ? `<a href="#/seat/${prev.no}">← #${prev.no} ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a href="#/seat/${next.no}">#${next.no} ${esc(next.name)} →</a>` : ''}</div>`;
    drawMap($('#smap'), 'forecast', s.no);
  }

  // ---------------------------------------------------------------- MLA report cards
  function viewMlas(app, params) {
    const list = SEATS.filter((s) => s.mla.status !== 'vacant').map((s) => ({ s, own: s.prob[s.mla.partyNow === 'JD(L)' ? 'OTH' : blocOf(s.mla.partyNow)] ?? 0 }));
    const parties = [...new Set(list.map((x) => x.s.mla.partyNow))].sort();
    const st = { q: '', party: params.get('party') || '', sort: params.get('sort') || 'score', dir: params.get('sort') === 'own' ? 1 : -1, flag: params.get('flag') || '' };
    const strongest = [...list].sort((a, b) => b.s.mla.score - a.s.mla.score).slice(0, 5);
    const weakest = [...list].sort((a, b) => a.s.mla.score - b.s.mla.score).slice(0, 5);
    app.innerHTML = `<section class="card hero shadow" style="text-align:left">
      <span class="tag">● ${list.length} sitting MLAs scored</span>
      <h1 style="font-size:clamp(28px,5vw,46px)">MLA REPORT CARDS:<br><span class="grad">WILL YOUR MLA SURVIVE 2027?</span></h1>
      <p class="lede" style="margin-left:0">Each MLA gets a Re-election Strength score (0–100) from their 2022 margin, how their alliance did in their segment in 2024, how often they've won the seat, and our 2027 projection. Alongside: criminal cases, assets and education from their own sworn affidavits.</p>
      <div class="tiles">
        <div class="tile"><div class="k">Strongest</div>${strongest.map((x) => `<div class="small"><a href="${seatLink(x.s)}">${esc(x.s.mla.name)}</a> <span class="muted">${esc(x.s.name)}</span> <b class="mono">${x.s.mla.score}</b></div>`).join('')}</div>
        <div class="tile"><div class="k">Most vulnerable</div>${weakest.map((x) => `<div class="small"><a href="${seatLink(x.s)}">${esc(x.s.mla.name)}</a> <span class="muted">${esc(x.s.name)}</span> <b class="mono">${x.s.mla.score}</b></div>`).join('')}</div>
      </div>
    </section>
    <section class="card"><span class="tag ink">Leaderboard</span><h2>All sitting MLAs</h2>
      <div class="filters"><input id="mq" type="search" placeholder="MLA or seat…"><select id="mp"><option value="">All parties</option>${parties.map((p) => `<option ${p === st.party ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <select id="mf"><option value="">All MLAs</option><option value="crim" ${st.flag === 'crim' ? 'selected' : ''}>With criminal cases</option><option value="risk" ${st.flag === 'risk' ? 'selected' : ''}>BJP: high ticket risk</option><option value="def" ${st.flag === 'def' ? 'selected' : ''}>Switched parties</option><option value="role" ${st.flag === 'role' ? 'selected' : ''}>Ministers & office-holders</option></select><span class="count" id="mc"></span></div>
      <div class="tbl-wrap"><table><thead><tr><th class="sort num" data-k="rank">#</th><th class="sort" data-k="name">MLA</th><th class="sort" data-k="seat">Seat</th><th class="sort num" data-k="score">Strength</th><th class="sort num" data-k="own">Hold chance</th><th class="sort num hide-sm" data-k="crim">Cases</th><th class="sort num hide-sm" data-k="assets">Assets</th><th class="hide-sm">Education</th><th>Flags</th></tr></thead><tbody id="mb"></tbody></table></div>
      <p class="small muted">Hold chance = projected probability that the MLA's current alliance wins the seat in 2027 (whoever its candidate is). Ticket risk is our own estimate, not a party announcement.</p></section>`;
    const kf = { rank: (x) => x.s.mla.score, name: (x) => x.s.mla.name, seat: (x) => x.s.no, score: (x) => x.s.mla.score, own: (x) => x.own, crim: (x) => x.s.mla.crim ?? -1, assets: (x) => x.s.mla.assets ?? -1 };
    const render = () => {
      const q = st.q.toLowerCase();
      let rows = list.filter((x) => (!st.party || x.s.mla.partyNow === st.party) && (!q || x.s.mla.name.toLowerCase().includes(q) || x.s.name.toLowerCase().includes(q))
        && (!st.flag || (st.flag === 'crim' && x.s.mla.crim > 0) || (st.flag === 'risk' && x.s.mla.ticketRisk === 'High') || (st.flag === 'def' && x.s.mla.status === 'defected') || (st.flag === 'role' && x.s.mla.role)));
      const f = kf[st.sort] || kf.score;
      rows.sort((a, b) => { const p = f(a), q2 = f(b); return (p < q2 ? -1 : p > q2 ? 1 : 0) * st.dir; });
      $('#mc').textContent = rows.length + ' MLAs';
      $('#mb').innerHTML = rows.map((x, i) => { const s = x.s, m = s.mla; return `<tr class="link" data-no="${s.no}"><td class="num mono">${i + 1}</td><td><b>${esc(m.name)}</b> ${partyChip(m.partyNow)}</td><td>${esc(s.name)}<div class="small muted">${esc(s.district)}</div></td>
        <td class="num"><b class="mono" style="color:${m.score >= 70 ? '#1f7a4d' : m.score >= 55 ? '#3c8a52' : m.score >= 40 ? '#9a6b00' : 'var(--red)'}">${m.score}</b></td><td class="num mono">${pc(x.own)}</td>
        <td class="num mono hide-sm" style="color:${m.crim ? 'var(--red)' : 'inherit'}">${m.crim ?? '—'}</td><td class="num mono hide-sm">${m.assets != null ? rupees(m.assets) : '—'}</td><td class="hide-sm small">${esc(m.edu || '—')}</td>
        <td>${m.role ? `<span class="flag blue">${esc(m.role.split(' (')[0])}</span>` : ''}${m.status === 'defected' ? '<span class="flag red">ex-SP</span>' : ''}${m.status === 'rebel' ? '<span class="flag amber">rebel</span>' : ''}${m.ticketRisk === 'High' ? '<span class="flag red">ticket risk</span>' : ''}</td></tr>`; }).join('');
      const p = new URLSearchParams(); if (st.party) p.set('party', st.party); if (st.flag) p.set('flag', st.flag); if (st.sort !== 'score') p.set('sort', st.sort);
      history.replaceState(null, '', '#/mlas' + (p.toString() ? '?' + p : ''));
    };
    $('#mq').addEventListener('input', (e) => { st.q = e.target.value; render(); });
    $('#mp').addEventListener('change', (e) => { st.party = e.target.value; render(); });
    $('#mf').addEventListener('change', (e) => { st.flag = e.target.value; render(); });
    $$('th.sort').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.k; st.dir = st.sort === k ? -st.dir : (['name', 'seat'].includes(k) ? 1 : -1); st.sort = k; render(); }));
    $('#mb').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-no]'); if (tr) location.hash = '#/seat/' + tr.dataset.no; });
    render();
  }

  // ---------------------------------------------------------------- method
  function viewMethod(app) {
    const md = SUM.model, b22 = SUM.baseline.S2022, b24 = SUM.baseline.S2024, t = SUM.target;
    app.innerHTML = `<section class="card prose"><span class="tag ink">Methodology</span><h2>How the forecast works</h2>
      <p>The model asks one question for each of the 403 constituencies: <i>given what this seat has done before, and where the state is heading now, how likely is each alliance to win it?</i> It then adds the seats up thousands of times with realistic uncertainty.</p>
      <h3>1 · Two baselines for every seat</h3>
      <p><b>2022 assembly result</b> — every candidate's vote share, re-mapped to today's alliances. RLD and SBSP fought 2022 with the SP but are now in the NDA, so 45% of their 2022 vote is moved to the NDA and 55% stays with the INDIA bloc; we also move 0.5–2 points of RLD/SBSP-loyal votes out of SP candidates' totals in West UP and Purvanchal.</p>
      <p><b>2024 Lok Sabha result by assembly segment</b> — the most recent real vote, already under today's NDA vs INDIA line-up. The BSP's segment share is estimated from the residual vote.</p>
      <div class="formula">Statewide, re-mapped:  2022 → NDA ${b22.NDA}% · INDIA ${b22.INDIA}% · BSP ${b22.BSP}%<br>Statewide, 2024 LS:     NDA ${b24.NDA}% · INDIA ${b24.INDIA}% · BSP ${b24.BSP}%<br>2027 target (poll avg): NDA ${t.NDA}% · INDIA ${t.INDIA}% · BSP ${t.BSP}% · Azad–Owaisi ${t.SPM}%</div>
      <h3>2 · Swing each baseline to today's polls</h3>
      <p>Each baseline is moved to the 2027 statewide target with a hybrid swing — half uniform (every seat moves the same points), half proportional (parties gain or lose more where they are bigger). The two projections are blended ${md.w2022 * 100}/${md.w2024 * 100}. Seats with a 2023–25 bypoll get ${md.wBypoll * 100}% weight on that result (8% for Kundarki, where the 2024 bypoll was marred by turnout complaints).</p>
      <h3>3 · Candidate adjustments</h3>
      <ul><li><b>Defectors:</b> SP MLAs who have joined the BJP (Unchahar, Gauriganj, Goshainganj, Kalpi, Chail) carry ~7 points of personal vote to the NDA. SP rebels whose status is unclear (Jalalpur, Bisauli) carry 2.</li>
      <li><b>Opposition incumbents</b> get +1 point of personal vote (the 2024 Lok Sabha baseline doesn't reflect the local MLA).</li>
      <li><b>Star-candidate Lok Sabha seats</b> (Rae Bareli, Varanasi, Kannauj, Lucknow) put 35% rather than 50% weight on the 2024 result, because a Rahul Gandhi, Narendra Modi, Akhilesh Yadav or Rajnath Singh on the ballot pulls votes an assembly candidate won't.</li>
      <li><b>Personal-vote seats</b> such as Raja Bhaiya's Kunda and Babaganj, Malhani and BSP-held Rasara lean on the 2022 assembly result (75–85%), since a Lok Sabha vote can't capture these candidates.</li></ul>
      <h3>4 · Simulate ${SUM.sims.toLocaleString('en-IN')} elections</h3>
      <p>Each simulation draws: a statewide NDA–INDIA error (SD ${md.sdState} pts), a separate swing for each of 7 regions (SD ${md.sdRegion} pts), a local swing in every seat (SD ${md.sdSeat} pts), plus independent shocks to the BSP, the Azad–Owaisi front and strong independents. The leading alliance in each seat wins it. A seat's win probability is the share of simulations it wins; the seat ranges on the front page come from the same runs.</p>
      <h3>5 · MLA Re-election Strength (0–100)</h3>
      <p>30% 2022 winning margin (25%+ margin = full marks) · 25% 2024 Lok Sabha result in the segment for the MLA's alliance · 15% track record (wins here since 2012) · 30% the 2027 projected chance for the MLA's alliance. <b>Ticket risk</b> for BJP MLAs counts three warning signs — alliance lost the segment in 2024, 2022 margin under 8%, NDA hold chance under 60% — and flags “High” when all three, or two plus a sub-50% hold chance, are present.</p>
      <h3>Prospective candidates</h3>
      <p>Where a party has named someone (or it is credibly reported), we show that name. Otherwise we show the sitting MLA for their alliance, or the party's 2022 nominee as the likeliest pick, clearly labelled. INDIA seats inside the 17 Lok Sabha constituencies Congress fought in 2024 are marked “SP / INC” because seat-sharing is still being negotiated.</p>
      <h3>What this model can't see</h3>
      <ul><li>Final candidate lists, rebels and friendly fights — the single biggest source of error at seat level.</li><li>Caste arithmetic below the seat level, booth management and turnout operations.</li><li>The effect of the 2026 electoral-roll revision (SIR), which removed about 2 crore names statewide; seat-level deletion data isn't public in usable form.</li><li>Late campaign events. Polls are sparse and pollsters disagree (from NDA +6 to INDIA +2).</li></ul>
      <h3>Sources</h3>
      <ul><li>Election Commission of India: 2012, 2017, 2022 assembly results and 2018–25 bypolls (via Wikipedia constituency pages and the 2022 results table).</li><li>2024 Lok Sabha results by assembly segment (ECI Form-20, via Wikipedia's 2024 UP election page).</li><li>MyNeta / Association for Democratic Reforms: 2022 winners' affidavits (criminal cases, assets, liabilities, education).</li><li>Opinion polls: Matrize, Spick Media, Survey Sarva, Vote Vibe, Siddhant Sathe, Dainik Bhaskar (Apr–Sep 2026).</li><li>News reporting on alliances, defections, cabinet changes and vacancies (The Hindu, Indian Express, India TV, Business Today, ThePrint, Free Press Journal, UNI and others) up to ${esc(SUM.asOf)}.</li><li>Constituency boundaries: datta07/INDIAN-SHAPEFILES (simplified).</li></ul>
      <p class="small muted">Rebuild the data: <span class="mono">python3 pipeline/build_model.py</span>. Inputs live in <span class="mono">pipeline/sources/</span>.</p></section>`;
  }

  // ------------------------------------------------------------------ router
  function route() {
    hideTip();
    const app = $('#app');
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = new URLSearchParams(qs || '');
    const parts = path.split('/').filter(Boolean);
    const r = parts[0] || 'home';
    $$('nav.main a').forEach((a) => a.classList.toggle('on', a.dataset.r === (r === 'seat' ? 'seats' : r)));
    if (r === 'seat') viewSeat(app, +parts[1]);
    else if (r === 'seats') viewSeats(app, params);
    else if (r === 'mlas') viewMlas(app, params);
    else if (r === 'method') viewMethod(app);
    else viewHome(app);
    const s = r === 'seat' && BYNO[+parts[1]];
    document.title = s ? `${s.name} 2027: ${BL[s.lead]} ${pc(s.prob[s.lead])} — UP 2027 Forecast` : 'UP 2027 Forecast — Seat-by-seat prediction for all 403 constituencies';
    if (!history.state || history.state.r !== h) window.scrollTo(0, 0);
  }

  load().then(() => { wireSearch($('#topSearch')); window.addEventListener('hashchange', route); route(); })
    .catch((e) => { $('#app').innerHTML = `<div class="card"><h2>Couldn't load data</h2><p class="muted">${esc(e.message)}. If you opened index.html directly from disk, serve the folder instead (e.g. <span class="mono">python3 -m http.server</span>).</p></div>`; });
})();
