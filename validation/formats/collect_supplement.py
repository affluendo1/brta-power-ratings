import json,zipfile,sys
from pathlib import Path
from scraper.trols_collect import Collector,parse_scorecard
if len(sys.argv)!=4:raise SystemExit('Usage: python -m validation.formats.collect_supplement snapshot.zip current-directory private-output-directory')
archive=Path(sys.argv[1]);fresh=Path(sys.argv[2]);out=Path(sys.argv[3]);old={};refs=[];collectors={}
with zipfile.ZipFile(archive) as z:
 for n in z.namelist():
  if '/entities/section/' in n and n.endswith('.json'):
   x=json.loads(z.read(n));old[(x['association'],x.get('competition_code'),x.get('native_season_id'),x.get('native_id'))]={str(m['native_id']) for m in x.get('matches',[])}
for p in fresh.glob('*/entities/section/*.json'):
 x=json.loads(p.read_text());key=(x['association'],x.get('competition_code'),x.get('native_season_id'),x.get('native_id'));ids={str(i) for r in x.get('results',{}).get('rows',[]) for i in r.get('match_ids',[]) if i}
 for mid in sorted(ids-old.get(key,set())):
  a,comp,season,section=key;c=collectors.setdefault(a,Collector(a,out));html,raw=c.read('match_popup.php',params={'matchid':mid,'seasonid':season,'daytime':comp,'section':section},context={'competition':comp,'season':season,'section':section});parsed=parse_scorecard(html);path=c.store.entity('match',mid,season,{'raw_path':raw,'data':parsed},competition=comp);refs.append({'association':a,'competition':comp,'season':season,'section':section,'label':x.get('section_label'),'path':str(Path(a)/path),'normalised':parsed['normalised']});print(a,comp,season,section,mid,parsed['normalised'],flush=True)
out.mkdir(parents=True,exist_ok=True);(out/'manifest.json').write_text(json.dumps({'scope':'Scorecards referenced by live 2 November 2026 current sections but absent from retained 1 November archive','scorecards':refs},indent=2)+'\n')
