import re, json, glob, os, sys
src, out = sys.argv[1], sys.argv[2]
def strip_refs(t):
    t=re.sub(r'<ref[^>]*/>','',t); t=re.sub(r'<ref[^>]*>.*?</ref>','',t,flags=re.S); t=re.sub(r'<!--.*?-->','',t,flags=re.S); return t
def cleanlink(s):
    s=re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]",r"\2",s); s=re.sub(r"\[\[([^\]]*)\]\]",r"\1",s); s=re.sub(r"'''?",'',s)
    s=re.sub(r'\{\{[^{}]*\}\}','',s); s=re.sub(r'<[^>]+>','',s); return s.strip()
def num(s):
    s=re.sub(r'[^0-9.]','',s or '')
    if not s or s=='.': return None
    try: return float(s) if '.' in s else int(s)
    except: return None
def parse_template_body(body):
    # split on top-level |
    parts=[]; depth=0; cur=''
    i=0
    while i<len(body):
        c=body[i]
        if body.startswith('{{',i) or body.startswith('[[',i): depth+=1; cur+=body[i:i+2]; i+=2; continue
        if body.startswith('}}',i) or body.startswith(']]',i): depth-=1; cur+=body[i:i+2]; i+=2; continue
        if c=='|' and depth==0: parts.append(cur); cur=''; i+=1; continue
        cur+=c; i+=1
    parts.append(cur)
    kv={}
    for p in parts[1:]:
        if '=' in p:
            k,v=p.split('=',1); kv[k.strip().lower()]=v.strip()
    return parts[0].strip(), kv
def find_templates(t):
    res=[]; i=0
    while True:
        i=t.find('{{',i)
        if i<0: break
        depth=0; j=i
        while j<len(t):
            if t.startswith('{{',j): depth+=1; j+=2; continue
            if t.startswith('}}',j):
                depth-=1; j+=2
                if depth==0: break
                continue
            j+=1
        res.append((i,t[i+2:j-2])); i=j
    return res
data={}
for f in glob.glob(src+'/*.txt'):
    no=int(os.path.basename(f)[:-4])
    t=strip_refs(open(f,encoding='utf-8').read())
    elections=[]; cur=None
    for pos,body in find_templates(t):
        name,kv=parse_template_body(body)
        nl=name.lower()
        if nl.startswith('election box begin'):
            title=cleanlink(kv.get('title',''))
            y=re.search(r'(20\d\d|19\d\d)',title)
            cur=dict(title=title, year=int(y.group(1)) if y else None, bypoll=bool(re.search(r'by-?\s?(poll|election)',title,re.I)), cands=[])
            elections.append(cur)
        elif nl.startswith('election box') and 'candidate' in nl and cur is not None:
            party=cleanlink(kv.get('party','')).strip()
            cand=cleanlink(kv.get('candidate',''))
            cur['cands'].append(dict(party=party,name=cand,votes=num(kv.get('votes')),pct=num(kv.get('percentage')),win='winning' in nl))
        elif nl.startswith('election box turnout') and cur is not None:
            cur['turnout']=num(kv.get('percentage'))
        elif nl.startswith('election box end'):
            cur=None
    # members table
    data[no]=elections
json.dump(data,open(out,'w'),ensure_ascii=False)
from collections import Counter
c=Counter(); 
for no,els in data.items():
    for e in els: c[(e['year'],e['bypoll'])]+=1
print(sorted(c.items(), key=lambda x: (x[0][0] or 0)))
