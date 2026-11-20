import re, json, glob, sys, html
rows={}
for f in sorted(glob.glob(sys.argv[1]+'/w*.html')):
    h=open(f,encoding='utf-8',errors='ignore').read()
    for m in re.finditer(r"<tr[^>]*>\s*<td[^>]*>(\d+)</td>\s*<td[^>]*>\s*<a href=candidate\.php\?candidate_id=(\d+)>([^<]*)</a>.*?</td><td>([^<]*)</td>\s*<td>([^<]*)</td><td[^>]*>(.*?)</td><td\s*>([^<]*)</td>\s*<td[^>]*>Rs&nbsp;([\d,]+).*?</td><td[^>]*>Rs&nbsp;([\d,]+)", h, re.S):
        sno,cid,name,ac,party,crim,edu,assets,liab=m.groups()
        crim=re.sub(r'<[^>]+>','',crim).strip()
        rows[cid]=dict(cid=int(cid),name=html.unescape(name).strip(),ac=ac.strip(),party=party.strip(),crim=int(crim or 0),edu=edu.strip(),assets=int(assets.replace(',','')),liab=int(liab.replace(',','')))
json.dump(list(rows.values()),open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
print(len(rows))
