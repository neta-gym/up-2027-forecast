#!/bin/bash
# usage: fetch_ac.sh <titles.json> <outdir>
python3 -I -c "
import json,sys,urllib.parse
d=json.load(open(sys.argv[1]))
for k,v in d.items(): print(k+'\t'+urllib.parse.quote(v.replace(' ','_')))
" "$1" | while IFS=$'\t' read -r no t; do
  f="$2/$no.txt"
  [ -s "$f" ] && continue
  curl -sL -m 30 -A "Mozilla/5.0 (election-research script)" "https://en.wikipedia.org/w/index.php?title=$t&action=raw" -o "$f"
  sleep 0.3
done
echo done
