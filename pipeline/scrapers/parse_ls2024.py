import re, json, sys
txt=open(sys.argv[1],encoding='utf-8').read()
i=txt.index('===Assembly Seat wise leads==='); j=txt.index('\n|}',i)
tbl=txt[i:j]
tbl=re.sub(r'<ref[^>]*/>','',tbl); tbl=re.sub(r'<ref[^>]*>.*?</ref>','',tbl,flags=re.S)
abbr={'Bharatiya Janata Party':'BJP','Samajwadi Party':'SP','Indian National Congress':'INC','Bahujan Samaj Party':'BSP','Rashtriya Lok Dal':'RLD','Apna Dal (Sonelal)':'AD(S)','Suheldev Bharatiya Samaj Party':'SBSP','All India Trinamool Congress':'AITC','Aazad Samaj Party (Kanshi Ram)':'ASP(KR)','Independent politician':'IND','Independent':'IND'}
pc=None; out=[]
for r in tbl.split('\n|-'):
    m=re.search(r'colspan="13"\s*\|\s*\[\[([^\]|]+)',r)
    if m: pc=m.group(1).replace(' Lok Sabha constituency',''); continue
    lines=[l.strip() for l in r.strip().split('\n') if l.strip()]
    if len(lines)<9: continue
    vals=[]
    for l in lines:
        l=l.lstrip('|!').strip()
        pm=re.search(r'\{\{[Pp]arty name with colou?r\|([^}|]+)',l)
        if pm: vals.append(abbr.get(pm.group(1).strip(),pm.group(1).strip())); continue
        l=re.sub(r'^.*?\|\s*(?=[\d,]+$)','',l)
        l=re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]",r"\2",l); l=re.sub(r"\[\[([^\]]*)\]\]",r"\1",l)
        vals.append(l.strip())
    try:
        no=int(vals[0]); n=lambda s: float(s.replace(',','')) if s else None
        out.append(dict(no=no,name=vals[1],pc=pc,w=vals[2],wv=int(n(vals[3])),wp=n(vals[4]),r=vals[5],rv=int(n(vals[6])),rp=n(vals[7]),margin=int(n(vals[8]))))
    except Exception as e:
        print('ERR',vals,e,file=sys.stderr)
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
print(len(out))
