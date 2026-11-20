import json, sys, math
src, out, tol = sys.argv[1], sys.argv[2], float(sys.argv[3])
d=json.load(open(src))
def dp(pts, eps):
    if len(pts)<3: return pts
    # iterative Douglas-Peucker
    keep=[False]*len(pts); keep[0]=keep[-1]=True
    stack=[(0,len(pts)-1)]
    while stack:
        a,b=stack.pop()
        ax,ay=pts[a]; bx,by=pts[b]; dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy)
        md=-1; mi=-1
        for i in range(a+1,b):
            px,py=pts[i]
            dist=abs(dy*px-dx*py+bx*ay-by*ax)/L if L>0 else math.hypot(px-ax,py-ay)
            if dist>md: md,mi=dist,i
        if md>eps: keep[mi]=True; stack.append((a,mi)); stack.append((mi,b))
    return [p for p,k in zip(pts,keep) if k]
def ring(r):
    s=dp(r,tol)
    s=[[round(x,3),round(y,3)] for x,y in s]
    # dedupe consecutive
    o=[]
    for p in s:
        if not o or p!=o[-1]: o.append(p)
    return o if len(o)>=4 else None
feats=[]
for f in d['features']:
    g=f['geometry']; p=f['properties']
    polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    np_=[]
    for poly in polys:
        rings=[ring(r) for r in poly]
        if rings[0] is None: continue
        np_.append([r for r in rings if r])
    if not np_:
        # fallback: keep largest ring with low tolerance
        poly=max(polys,key=lambda pp: len(pp[0]))
        np_=[[[[round(x,3),round(y,3)] for x,y in poly[0]]]]
    feats.append({'type':'Feature','properties':{'ac':p['AC_NO'],'n':p['AC_NAME'],'d':p['dtname11'] or p['DIST_NAME'],'pc':p['PC_NAME']},'geometry':{'type':'MultiPolygon','coordinates':np_}})
json.dump({'type':'FeatureCollection','features':feats},open(out,'w'),separators=(',',':'))
