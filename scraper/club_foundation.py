"""Join directory facts, fixture observations and explicit venue assignments.

Club identity is not a team nickname, and a match venue is not necessarily its
club's main address. Unknown facts stay null; observations are never averaged.
"""
from __future__ import annotations
import hashlib,json,re
from pathlib import Path
if __package__:
    from .club_information import club_key,clean
else:
    from club_information import club_key,clean

ALIASES=Path(__file__).with_name('club_aliases.json')

def venue_key(lines):
    # Ignore display punctuation/postcodes when comparing a venue observation.
    value=re.sub(r'\b\d{4}\b','', ' '.join(lines)).casefold()
    return re.sub(r'[^a-z0-9]','',value)


def assignment(value):
    value=clean(value)
    m=re.search(r'\bplaying\s*(?:at\b|@)\s*:?\s*(.+?)(?=\s+(?:club\s*house|phone|contact)\b|$)',value,re.I)
    return m.group(1).strip(' .;') if m else None


def facts(lines):
    result={'courts':None,'lighting':None,'parking':None,'accessibility':None}
    unique=list(dict.fromkeys(clean(x) for x in lines if clean(x)))
    counts=[]
    for line in unique:
        if re.search(r'court',line,re.I):
            counts.extend(int(x) for x in re.findall(r'\b(\d+)\s+(?:(?:synthetic|grass|hard|clay|en.tout.cas|mod.grass)\s+)*courts?\b',line,re.I))
        if re.search(r'light|floodlit',line,re.I):result['lighting']=line
        if re.search(r'park(?:ing|\s+(?:in|at|on))|car\s*park',line,re.I):result['parking']=line
        if re.search(r'wheelchair|accessible|accessibility',line,re.I):result['accessibility']=line
    # Repeated descriptions are not additional courts. Different counts need
    # review; no speculative total is derived from ambiguous prose.
    if counts:result['courts']={'count':counts[0] if len(set(counts))==1 else None,'observed_counts':sorted(set(counts))}
    return result


def build_foundation(directory,network,sections=(),*,checked_at=None,aliases=None):
    aliases=aliases if aliases is not None else json.loads(ALIASES.read_text())
    raw_clubs={c['id']:c for c in directory.get('clubs',[])}
    clubs={};venues={};teams={};assignments=[];review=[]
    def provenance(source):return {**source,'checked_at':checked_at}
    def add_venue(cid,lines,coords,source,primary=False):
        lines=list(dict.fromkeys(clean(x) for x in lines if clean(x)))
        signature=venue_key(lines);conflict_suffix=''
        if not primary and not lines and not coords:return cid+':venue:main'
        primary_id=cid+':venue:main'
        if not primary:
            # Same mapped location with differently formatted address lines is
            # one venue. Distinct coordinates/addresses remain separate.
            for venue in venues.values():
                if venue['club_id']!=cid:continue
                a,b=venue.get('coordinates'),coords
                same_point=a and b and abs(a['latitude']-b['latitude'])<.0005 and abs(a['longitude']-b['longitude'])<.0005
                same_address=signature and signature==venue_key(venue['address_lines'])
                conflict=a and b and (abs(a['latitude']-b['latitude'])>.002 or abs(a['longitude']-b['longitude'])>.002)
                if same_address and conflict:conflict_suffix=':'+json.dumps(coords,sort_keys=True)
                if same_point or same_address and not conflict:
                    if not a and coords:venue['coordinates']=coords
                    venue['sources'].append(provenance(source));return venue['id']
        vid=primary_id if primary else cid+':venue:'+hashlib.sha256(((signature+conflict_suffix) if signature else json.dumps(coords,sort_keys=True)).encode()).hexdigest()[:14]
        venues.setdefault(vid,{'id':vid,'club_id':cid,'primary':primary,'address_lines':lines,'coordinates':coords or None,'sources':[],'status':'directory' if primary else 'observed_alternate'})['sources'].append(provenance(source))
        return vid
    for key,c in raw_clubs.items():
        native=c.get('native_club_id')
        cid='brta:club:'+('trols:'+str(native) if native is not None else key)
        vid=add_venue(cid,c.get('address_lines',[]),c.get('coordinates'),c.get('source',{}),True)
        lines=c.get('published_details',[])
        clubs[key]={'id':cid,'legacy_id':key,'native_club_id':native,'name':c['name'],'venue_ids':[vid],'main_venue_id':vid,
                    'contacts':c.get('contacts',[]),'phones':c.get('phones',[]),'websites':c.get('websites',[]),
                    'facts':facts(lines),'additional_details':list(dict.fromkeys(lines)),
                    'sources':[provenance(c.get('source',{}))],'observations':[],'review_required':False}
    def resolve(label):
        key=club_key(label)
        if key in clubs:return clubs[key]
        target=aliases.get(key,{}).get('club_id')
        if target in clubs:return clubs[target]
        candidates=[c['id'] for k,c in clubs.items() if key.startswith(k+'-')]
        review.append({'kind':'unresolved_club','label':label,'candidate_ids':candidates})
        return None
    for group in network.get('clubs',[]):
        for obs in group.get('observations',[]):
            club=resolve(obs['team'])
            if not club:continue
            source=obs.get('source',{});club['observations'].append(obs)
            for field,value in facts(obs.get('venue_lines',[])).items():
                if value is not None and club['facts'][field] is None:club['facts'][field]=value
            key='brta:team:'+':'.join(str(source.get(k,'')) for k in ('season_id','section_code'))+':'+str(obs.get('team_number',club_key(obs['team'])))
            explicit=obs.get('playing_at') or next((assignment(x) for x in obs.get('venue_lines',[]) if assignment(x)),None)
            lines=[x for x in obs.get('venue_lines',[]) if not assignment(x)]
            vid=add_venue(club['id'],lines,obs.get('coordinates'),source)
            if vid not in club['venue_ids']:club['venue_ids'].append(vid)
            teams[key]={'id':key,'club_id':club['id'],'name':obs['team'],'section_code':source.get('section_code'),'season_id':source.get('season_id'),'venue_id':vid,'start_time':obs.get('start_time'),'playing_at':explicit,'source':provenance(source)}
            if explicit:assignments.append({'team_id':key,'scope':'team','label':explicit,'resolved_venue_id':(clubs.get(aliases.get(club_key(explicit),{}).get('club_id',club_key(explicit))) or {}).get('main_venue_id'),'source':provenance(source)})
    for section in sections:
        code=section.get('section_code');season=section.get('season_id')
        for draw in section.get('draw',[]):
            # Fixture-level venue overrides outrank a team default and a club's
            # main ground. Preserve the original sentence for unresolved venues.
            home=draw.get('home_team','')
            target=draw.get('venue_override') or assignment(home) or assignment(draw.get('venue','')) or (draw.get('venue') if draw.get('venue') and draw.get('venue')!=home else None)
            if not target:continue
            # Footnote marks flag alternate grounds, not a different team.
            # Keep colours: Gold and Green may be separate teams in a section.
            same_label=lambda value:re.sub(r'\s+\([A-Z]{2,6}\)$','',re.sub(r'[\s*†‡]+$','',clean(value))).casefold().strip()
            candidates=[t for t in teams.values() if t['section_code']==code and t['season_id']==season and same_label(t['name'])==same_label(home)]
            team=candidates[0] if len(candidates)==1 else None
            if not team:review.append({'kind':'unresolved_fixture_team','team':home,'section_code':code,'season_id':season})
            venue=next((v for v in venues.values() if venue_key([target])==venue_key(v['address_lines'])),None)
            venue_club=clubs.get(aliases.get(club_key(target),{}).get('club_id',club_key(target)))
            if not venue and venue_club:venue=venues[venue_club['main_venue_id']]
            if not venue:review.append({'kind':'unresolved_venue','label':target,'team_id':team['id'] if team else None,'section_code':code,'season_id':season})
            assignments.append({'team_id':team['id'] if team else None,'home_team':home,'scope':'fixture','fixture_id':draw.get('fixture_id') or draw.get('draw_id'),'round':draw.get('round'),'date':draw.get('date'),'label':target,'resolved_venue_id':venue['id'] if venue else None,'source':provenance({'url':network.get('fixture_url','https://www.trols.org.au/brta/fixture.php'),'section_code':code,'season_id':season})})
    for club in clubs.values():
        club['review_required']=len(club['venue_ids'])>1
        if club['review_required']:review.append({'kind':'multiple_venues','club_id':club['id'],'venue_ids':club['venue_ids']})
    review=list({json.dumps(item,sort_keys=True):item for item in review}.values())
    return {'version':1,'association':'brta','checked_at':checked_at,'clubs':list(clubs.values()),'teams':list(teams.values()),'venues':list(venues.values()),'venue_assignments':assignments,'review_queue':review,'aliases':aliases}


def resolve_venue(network,team_id,fixture_id=None,*,round_no=None,date=None):
    """An unresolved explicit override must never fall through to the home club."""
    team=next((t for t in network['teams'] if t['id']==team_id),None)
    if not team:return {'status':'unknown','venue_id':None,'scope':None}
    matches=[a for a in network['venue_assignments'] if a['team_id']==team_id and a['scope']=='fixture' and ((fixture_id and a.get('fixture_id')==fixture_id) or (round_no is not None and a.get('round')==round_no and (date is None or a.get('date')==date)))]
    if not matches:matches=[a for a in network['venue_assignments'] if a['team_id']==team_id and a['scope']=='team']
    if matches:
        choices={(a.get('resolved_venue_id'),a['label']) for a in matches}
        if len(choices)>1:return {'status':'conflict','venue_id':None,'scope':matches[0]['scope'],'observations':matches}
        item=matches[0]
        return {'status':'resolved' if item.get('resolved_venue_id') else 'unresolved','venue_id':item.get('resolved_venue_id'),'scope':item['scope'],'label':item['label'],'source':item['source']}
    return {'status':'default','venue_id':team.get('venue_id'),'scope':'team_default'}
