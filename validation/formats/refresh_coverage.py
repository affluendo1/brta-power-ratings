"""Compare refreshed current section identities and scorecard references with retained evidence."""
import collections,json,sys,zipfile
from pathlib import Path
snapshot=Path(sys.argv[1]);fresh=Path(sys.argv[2]);out=Path(sys.argv[3]);old={}
with zipfile.ZipFile(snapshot) as z:
 for name in z.namelist():
  if '/entities/section/' not in name or not name.endswith('.json'):continue
  x=json.loads(z.read(name));key=(x['association'],x.get('competition_code'),x.get('native_season_id'),x.get('native_id'));old[key]={str(m['native_id']) for m in x.get('matches',[])}
rows=[];counts=collections.Counter();errors=[];manifests={}
for p in sorted(fresh.glob('*/manifest.json')):
 m=json.loads(p.read_text());a=m.get('association',p.parent.name);manifests[a]={'finished':m.get('finished',False),'errors':len(m.get('errors',[])),'updated':m.get('updated_at_utc')};errors.extend(m.get('errors',[]))
for p in sorted(fresh.glob('*/entities/section/*.json')):
 x=json.loads(p.read_text());a=x['association'];counts[a]+=1;key=(a,x.get('competition_code'),x.get('native_season_id'),x.get('native_id'));ids={str(i) for r in x.get('results',{}).get('rows',[]) for i in r.get('match_ids',[]) if i};prior=old.get(key,set());rows.append({'association':a,'competition':key[1],'season':key[2],'section':key[3],'label':x.get('section_label'),'retainedSectionFound':key in old,'listedResultScorecards':len(ids),'listedScorecardsAbsentFromSnapshot':len(ids-prior),'ruleStatus':'explicit native rule assignment pending'})
result={'asOf':'2026-11-02 live section listings','scope':'Current selector sections refreshed from all 12 association directories. New match-page downloads and clubs disabled; this is not a complete scorecard refresh.','coverage':dict(counts),'sectionCount':len(rows),'associations':manifests,'errors':len(errors),'currentSectionsAbsentFromSnapshot':sum(not r['retainedSectionFound'] for r in rows),'newScorecardReferences':sum(r['listedScorecardsAbsentFromSnapshot'] for r in rows),'sections':rows}
if len(manifests)!=12 or not all(x['finished'] and not x['errors'] for x in manifests.values()):raise SystemExit('Refresh is not finished without errors for every association')
out.write_text(json.dumps(result,indent=2)+'\n');print({k:result[k] for k in ['coverage','sectionCount','errors','currentSectionsAbsentFromSnapshot','newScorecardReferences']})
