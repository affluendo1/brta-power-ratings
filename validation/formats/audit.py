"""Audit every collected section without equating observed scores with verified rules.
Usage: python3 validation/formats/audit.py snapshot.zip output.json
"""
import collections,json,sys,zipfile,hashlib
from pathlib import Path
source=Path(sys.argv[1]);out=Path(sys.argv[2]);sections=[];associations=collections.Counter();all_patterns=collections.Counter()
with zipfile.ZipFile(source) as z:
 for name in sorted(z.namelist()):
  if '/entities/section/' not in name or not name.endswith('.json'):continue
  d=json.loads(z.read(name));association=d['association'];prefix=name.split('/entities/section/')[0];profiles=collections.defaultdict(lambda:collections.Counter());counts=collections.Counter();missing=0;matches=d.get('matches',[])
  for ref in matches:
   path=prefix+'/'+ref['path']
   try:fixture=json.loads(z.read(path))
   except KeyError:missing+=1;continue
   games=fixture.get('data',{}).get('matches',[]);counts['scorecards']+=1
   for m in games:
    discipline=m.get('discipline','unknown');scores=m.get('score_components',[])
    valid=[(s.get('home'),s.get('away')) for s in scores if isinstance(s,dict) and type(s.get('home')) is int and type(s.get('away')) is int]
    counts[discipline]+=1
    if not valid:profiles[discipline]['no_numeric_score']+=1;continue
    # Preserve a signature of all terminal pairs. This describes source notation only.
    pattern=min(' '.join('%d-%d'%pair for pair in valid),' '.join('%d-%d'%(a,h) for h,a in valid))
    profiles[discipline][pattern]+=1;all_patterns[(association,discipline,len(valid),pattern)]+=1
  associations[association]+=1
  sections.append({'association':association,'competition':d.get('competition_code'),'season':d.get('native_season_id'),'section':d.get('native_id'),'label':d.get('section_label'),'scorecardReferences':len(matches),'missingScorecards':missing,'counts':dict(counts),'observedScores':{k:dict(sorted(v.items())) for k,v in profiles.items()},'ruleStatus':'requires explicit competition rules; observed scores do not establish stopping rules'})
# Optional fresh scorecard supplement, kept outside the public repository.
supplement=None
if len(sys.argv)>3:
 extra=Path(sys.argv[3]);manifest=json.loads((extra/'manifest.json').read_text());lookup={(x['association'],x['competition'],x['season'],x['section']):x for x in sections};hashes=[]
 for ref in manifest['scorecards']:
  path=extra/ref['path'];fixture=json.loads(path.read_text());row=lookup[(ref['association'],ref['competition'],ref['season'],ref['section'])];row['scorecardReferences']+=1;row['counts']['scorecards']=row['counts'].get('scorecards',0)+1;hashes.append(hashlib.sha256(path.read_bytes()).hexdigest())
  for m in fixture.get('data',{}).get('matches',[]):
   discipline=m.get('discipline','unknown');valid=[(x.get('home'),x.get('away')) for x in m.get('score_components',[]) if isinstance(x,dict) and type(x.get('home')) is int and type(x.get('away')) is int];row['counts'][discipline]=row['counts'].get(discipline,0)+1;pattern=min(' '.join('%d-%d'%pair for pair in valid),' '.join('%d-%d'%(a,h) for h,a in valid)) if valid else 'no_numeric_score';profile=row['observedScores'].setdefault(discipline,{});profile[pattern]=profile.get(pattern,0)+1
   if valid:all_patterns[(ref['association'],discipline,len(valid),pattern)]+=1
 supplement={'collectedOn':'2026-11-02','scorecards':len(manifest['scorecards']),'entitySha256':hashes,'source':'current native section result links; original HTML and identities retained privately'}
report={'sourceSnapshot':'TROLS current selectors collected 2026-11-01; not a live 2026-11-02 census','freshSupplement':supplement,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'warning':'Observed score notation includes forfeits, incomplete matches and ambiguous deciding tiebreak encodings. No player identities are included. Native rules must be confirmed before rating or prediction. Legacy MDJTA is retained separately by association.','sections':sections,'coverage':dict(associations),'sectionCount':len(sections),'scorecards':sum(s['counts'].get('scorecards',0) for s in sections),'missingReferences':sum(s['missingScorecards'] for s in sections),'patterns':[{'association':a,'discipline':b,'components':c,'pattern':d,'count':n} for (a,b,c,d),n in sorted(all_patterns.items())]}
out.write_text(json.dumps(report,indent=2)+'\n');print({k:report[k] for k in ['coverage','sectionCount','scorecards','missingReferences']})
