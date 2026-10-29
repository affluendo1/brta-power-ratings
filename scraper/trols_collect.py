"""Collect public TROLS competition data for every association, current and past.

This store is independent of the BRTA ratings/publication pipeline. Native values
and original HTML are retained; no association's scoring rules are guessed.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, quote, urljoin, urlparse

from bs4 import BeautifulSoup
from .trols_sources import ASSOCIATIONS, SourceClient, inspect_controls

SCHEMA_VERSION = 1


def text(node):
    return ' '.join(node.get_text(' ', strip=True).replace('\xa0', ' ').split())


def options(html, selector):
    return [o for s in inspect_controls(html)['selectors'] if selector in (s['id'], s['name']) for o in s['options']]


class SelectionMismatch(RuntimeError):
    pass


def validate_selection(html, requested):
    """Reject a server response that silently selected a different source scope."""
    requested=requested or {}
    for select in inspect_controls(html)['selectors']:
        key=next((k for k in (select['id'],select['name']) if k in requested and k in {'daytime','season','section','team','club'}),None)
        if key is None:continue
        wanted=str(requested[key]);available={o['value'] for o in select['options']}
        selected={o['value'] for o in select['options'] if o['selected']}
        if wanted not in available or (selected and wanted not in selected):
            raise SelectionMismatch(f'TROLS returned a different {key} selection than requested: {wanted}')


def source_tables(html):
    """Keep every direct cell, including blanks, merged cells and source order."""
    soup = BeautifulSoup(html, 'html.parser')
    return [{'rows': [[{'text': text(cell), 'rowspan': cell.get('rowspan', '1'),
                       'colspan': cell.get('colspan', '1')}
                      for cell in row.find_all(['td', 'th'], recursive=False)]
                     for row in table.find_all('tr') if row.find_parent('table') is table]}
            for table in soup.select('table')]


def match_reference(anchor):
    onclick = anchor.get('onclick', '')
    match = re.search(r'open_match\s*\((.*?)\)', onclick, re.S)
    if match:
        strings = re.findall(r'''['"]([^'"]*)['"]''', match.group(1))
        if strings and strings[-1]:
            return strings[-1]
    query = parse_qs(urlparse(anchor.get('href', '')).query)
    return (query.get('matchid') or [None])[0]


def parse_results(html):
    rows, heading = [], ''
    for row in BeautifulSoup(html, 'html.parser').select('tr'):
        cells = row.find_all(['td', 'th'], recursive=False)
        values = [text(c) for c in cells]
        if len(cells) == 1 and re.search(r'\b(?:Rd\.?|Round|Final|Play[- ]?off)\b', values[0], re.I):
            heading = values[0]
        if len(cells) < 3:
            continue
        ids = list(dict.fromkeys(filter(None, (match_reference(a) for a in cells[0].select('[onclick], a[href]')))))
        is_bye = values[0].casefold() == 'bye' or values[-1].casefold() == 'bye'
        # Published no-score/washout rows need not expose a scorecard link.
        is_status = bool(re.search(r'wash.?out|forfeit|missing result|not played|heat.?out|abandon|cancel|unplayed', ' '.join(values[1:-1]), re.I))
        if not ids and not (heading and (is_bye or is_status)):
            continue
        rows.append({'native_match_id': ids[0] if len(ids) == 1 else None,
                     'match_ids': ids, 'round_heading': heading,
                     'home': values[0], 'away': values[-1], 'source_cells': values})
    return rows


def parse_scorecard(html):
    """Parse two-, three-, four- or larger rosters without four-player padding.

    Scores and their punctuation are source evidence, not an inferred official
    result or rating decision. Blank scores and missing identities are retained.
    """
    soup = BeautifulSoup(html, 'html.parser')
    candidates = []
    for table in soup.select('table'):
        rows = (table.find('tbody', recursive=False) or table).find_all('tr', recursive=False)
        if len(rows) < 2:
            continue
        teams = rows[0].find_all('td', recursive=False)
        nested = rows[1].find_all('table')
        if len(teams) >= 2 and len(nested) == 3:
            candidates.append((table, teams, nested))
    if len(candidates) != 1:
        # Lossless HTML and generic tables are still stored. Mark this explicitly
        # for review rather than pretending an empty scorecard parsed normally.
        return {'layout': 'unrecognised', 'normalised': False, 'tables': source_tables(html)}
    table, teams, nested = candidates[0]
    rosters = []
    for roster in (nested[0], nested[2]):
        players = []
        for row in roster.select('tr'):
            cells = row.find_all(['td', 'th'], recursive=False)
            if not cells:
                continue
            label = text(cells[-1]); number = re.match(r'(\d+)\.\s*(.*)', label)
            if not number:
                continue
            marker = ' '.join(text(c) for c in cells[:-1])
            players.append({'code': number.group(1), 'name': number.group(2),
                            'emergency': bool(re.search(r'\b[EX]\b', marker) or row.select_one('.xsr')),
                            'source_cells': [text(c) for c in cells]})
        rosters.append(players)
    rubbers, totals, other = [], [], []
    for row in nested[1].select('tr'):
        cells = row.find_all(['td', 'th'], recursive=False)
        values = [text(c) for c in cells]
        if row.select_one('.separate'):
            totals.append(values);continue
        if len(cells) != 3:
            if any(values):other.append(values)
            continue
        home, score, away = values
        is_code = lambda v: bool(re.fullmatch(r'\d+(?:\s*\+\s*\d+)*', v))
        if not (is_code(home) or is_code(away)):
            if any(values):other.append(values)
            continue
        refs = [re.findall(r'\d+', value) if is_code(value) else [] for value in (home, away)]
        participant_groups = []
        for refs_side, roster in zip(refs, rosters):
            lookup = {p['code']: p for p in roster}
            participant_groups.append([{'code': c, 'name': lookup.get(c, {}).get('name'),
                                        'emergency': lookup.get(c, {}).get('emergency')} for c in refs_side])
        discipline = 'doubles' if any(len(r) > 1 for r in refs) else 'singles'
        rubbers.append({'order': len(rubbers)+1, 'discipline': discipline,
                        'home_codes': refs[0], 'away_codes': refs[1],
                        'home_players': participant_groups[0], 'away_players': participant_groups[1],
                        'score': score, 'score_html': cells[1].decode_contents(),
                        'score_components': [{'home': int(a), 'away': int(b)} for a,b in re.findall(r'(\d+)\s*[-–/]\s*(\d+)',score)],
                        'has_score': bool(score), 'source_cells': values})
    return {'layout': 'three-table', 'normalised': True, 'table_width': table.get('width'),
            'home': text(teams[0]), 'away': text(teams[-1]),
            'home_roster': rosters[0], 'away_roster': rosters[1], 'matches': rubbers,
            'totals': totals, 'other_rows': other}


def document(html):
    soup = BeautifulSoup(html, 'html.parser')
    return {'title': text(soup.title) if soup.title else '', 'tables': source_tables(html),
            'text': text(soup.body or soup), 'controls': inspect_controls(html),
            'links': [{'text': text(a), 'href': a.get('href'), 'onclick': a.get('onclick')}
                      for a in soup.select('a') if a.get('href') or a.get('onclick')]}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    temporary.replace(path)


def asset_key(value):
    # Hashing the complete namespace avoids traversal, invalid filenames and
    # collisions between source IDs that merely sanitise to the same string.
    return hashlib.sha256(value.encode()).hexdigest()


class Store:
    def __init__(self, root, association, *, refresh=False):
        self.root = Path(root) / association.key
        self.association = association
        self.refresh = refresh
        self.fetched = 0
        self.cached = 0

    def read(self, client, page, *, controls=None, params=None, context=None):
        request = {'page': page, 'controls': controls, 'params': params}
        if context is not None:
            request['context'] = context
        key = asset_key(json.dumps(request, sort_keys=True))
        raw = self.root/'raw'/f'{key}.html'
        meta = self.root/'raw'/f'{key}.json'
        if not self.refresh and raw.exists() and meta.exists():
            info = json.loads(meta.read_text());html=raw.read_text(encoding='utf-8')
            if info.get('sha256') == hashlib.sha256(html.encode()).hexdigest():
                validate_selection(html,controls or params)
                self.cached += 1
                return html, str(raw.relative_to(self.root))
        html = client.read(page, controls=controls, params=params)
        validate_selection(html,controls or params)
        soup = BeautifulSoup(html,'html.parser')
        if not soup.find(['table','select']):
            raise RuntimeError(f'{page}: response contains no TROLS data tables or controls')
        raw.parent.mkdir(parents=True,exist_ok=True)
        temp = raw.with_suffix('.html.tmp');temp.write_text(html,encoding='utf-8');temp.replace(raw)
        write_json(meta, {'request': request,'url':client.association.endpoint(page),
                          'fetched_at_utc':datetime.now(timezone.utc).isoformat(),
                          'sha256':hashlib.sha256(html.encode()).hexdigest()})
        self.fetched += 1
        return html,str(raw.relative_to(self.root))

    def entity(self, kind, source_id, season_id, value, *, competition=None):
        namespace_season=(competition+'/'+season_id) if competition else season_id
        identity=self.association.identity(kind,source_id,season_id=namespace_season)
        path=Path('entities')/kind/(asset_key(identity)+'.json')
        write_json(self.root/path, {'id':identity,'association':self.association.key,
                                  'native_id':source_id,'native_season_id':season_id,'competition_code':competition,**value})
        return str(path)


class Collector:
    def __init__(self, association, root, *, refresh=False, history='all', limit_sections=None,
                 limit_matches=None, limit_clubs=None, limit_seasons=None, limit_competitions=None, client=None):
        self.client=client or SourceClient(association)
        self.profile=self.client.association
        self.store=Store(root,self.profile,refresh=refresh)
        self.history=history
        self.limits={'sections':limit_sections,'matches':limit_matches,'clubs':limit_clubs,'seasons':limit_seasons,'competitions':limit_competitions}
        self.report={'schema_version':SCHEMA_VERSION,'association':association,'base_url':self.profile.base_url,
                     'legacy_directory':not self.profile.active,
                     'scope':{'history':history,'limits':self.limits},'competitions':[],
                     'seasons':[],'sections':[],'clubs':[],'special_standings':[],'errors':[],'warnings':[]}

    def read(self,page,**kwargs):return self.store.read(self.client,page,**kwargs)

    def checkpoint(self, *, finished=False):
        self.report.update({'finished':finished,'complete':finished and not self.report['errors'] and not any(v is not None for v in self.limits.values()),
                            'updated_at_utc':datetime.now(timezone.utc).isoformat(),
                            'requests_fetched':self.store.fetched,'requests_cached':self.store.cached})
        write_json(self.store.root/'manifest.json',self.report)

    def failure(self,scope,error):
        self.report['errors'].append({'scope':scope,'error':str(error)});self.checkpoint()

    def section(self,comp,season,section):
        code=section['value'];sid=season['value']
        form={'which':'1','style':'','daytime':comp['value'],'season':sid,'section':code}
        html,raw=self.read('p_results.php',controls=form)
        rows=parse_results(html)
        # Preserve source rows/documents even when a new result layout has no
        # recognised match links; no numeric association-specific inference.
        match_ids=list(dict.fromkeys(m for row in rows for m in row['match_ids']))
        all_ids=list(dict.fromkeys(filter(None,(match_reference(a) for a in BeautifulSoup(html,'html.parser').select('[onclick], a[href]')))))
        if set(all_ids) != set(match_ids):
            raise RuntimeError('Result table layout did not account for all published match links')
        cards=[]
        for match in match_ids[:self.limits['matches']]:
            try:
                card,card_raw=self.read('match_popup.php',params={'matchid':match,'seasonid':sid,'daytime':comp['value'],'section':code},
                                        context={'competition':comp['value'],'season':sid,'section':code})
                parsed=parse_scorecard(card)
                path=self.store.entity('match',match,sid,{'raw_path':card_raw,'data':parsed},competition=comp['value'])
                cards.append({'native_id':match,'path':path,'normalised':parsed['normalised']})
                if not parsed['normalised']:
                    self.report['warnings'].append({'scope':f'{sid}/{code}/{match}','message':'New card layout retained losslessly as tables and HTML'})
            except Exception as error:self.failure(f'{sid}/{code}/{match}',error)
        ladder,ladder_raw=self.read('p_ladders.php',params={'style':'','daytime':comp['value'],'season':sid,'section':code})
        draws=[]
        historical=season['label'].casefold() not in {'current','current season'}
        fixture_page={}
        fallback=[]
        try:
            fixture_html,fixture_raw=self.read('fixture.php',controls=form)
            if historical and sid not in {o['value'] for o in options(fixture_html,'season') if o['selected']}:
                raise SelectionMismatch('Fixtures page does not identify the requested historical season')
            fixture_page={'raw_path':fixture_raw,'data':document(fixture_html),'availability':'published'}
            teams=options(fixture_html,'team')
            for team in teams:
                try:
                    draw,draw_raw=self.read('fixture.php',controls={**form,'which':'2','team':team['value']})
                    if historical and sid not in {o['value'] for o in options(draw,'season') if o['selected']}:
                        raise SelectionMismatch('Team draw does not identify the requested historical season')
                    draws.append({'native_team_id':team['value'],'team':team['label'],'raw_path':draw_raw,'data':document(draw)})
                except SelectionMismatch:
                    if not historical:raise
                    fixture_page={'availability':'historical_draw_unavailable'}
                    draws=[]
                    break
                except Exception as error:self.failure(f'{sid}/{code}/draw/{team["value"]}',error)
            if not teams:
                self.report['warnings'].append({'scope':f'{sid}/{code}','message':'No team draw selector published; fixture page and Results retained'})
        except SelectionMismatch:
            if not historical:raise
            fixture_page={'availability':'historical_draw_unavailable'}
        if fixture_page.get('availability')=='historical_draw_unavailable':
            # A fixture observed in this season's Results is authoritative for
            # its published date/opponents, but says nothing about start times,
            # holiday gaps or unplayed future rounds. Never fill those in.
            fallback=[{'source':'results','native_match_id':r['native_match_id'],
                       'round_heading':r['round_heading'],'home':r['home'],'away':r['away'],
                       'start_time':None,'venue':None} for r in rows]
            self.report['warnings'].append({'scope':f'{sid}/{code}',
                'message':'No verified historical draw is published; retained only this season’s Results fixtures'})
        path=self.store.entity('section',code,sid,{
            'competition_code':comp['value'],'competition_label':comp['label'],
            'season_label':season['label'],'section_label':section['label'],
            'results':{'raw_path':raw,'rows':rows,'data':document(html)},
            'matches':cards,'ladder':{'raw_path':ladder_raw,'data':document(ladder)},
            'fixture_page':fixture_page,'team_draws':draws,'result_fixtures':fallback},competition=comp['value'])
        self.report['sections'].append({'id':self.profile.identity('section',code,season_id=comp['value']+'/'+sid),
                                        'path':path,'matches_available':len(match_ids),'matches_collected':len(cards)})
        self.checkpoint()

    def clubs(self):
        html,raw=self.read('clubs.php')
        self.report['club_directory']={'raw_path':raw,'data':document(html)}
        for club in options(html,'club')[:self.limits['clubs']]:
            try:
                page,raw=self.read('clubs.php',controls={'which':'2','style':'','club':club['value']})
                path=self.store.entity('club',club['value'],'directory',{'name':club['label'],'raw_path':raw,'data':document(page)})
                self.report['clubs'].append({'native_id':club['value'],'name':club['label'],'path':path})
                self.checkpoint()
            except Exception as error:self.failure('club/'+club['value'],error)

    def special_standings(self):
        # Awards are public ladders, not standard fixture competitions. Discover
        # them from the ladder selector instead of assuming BRTA-only code XX.
        html,raw=self.read('ladders.php')
        self.report['ladder_directory']={'raw_path':raw,'data':document(html)}
        competition_codes={c['value'] for c in self.report.get('competition_options',self.report['competitions'])}
        for special in options(html,'daytime'):
            if special['value'] in competition_codes:continue
            page,raw=self.read('ladders.php',controls={'which':'0','style':'','daytime':special['value']})
            frames=[]
            for frame in inspect_controls(page)['frames']:
                url=urlparse(urljoin(self.profile.base_url,frame))
                if url.path.startswith(urlparse(self.profile.base_url).path) and url.path.endswith('/awards.php'):
                    data,source=self.read('awards.php',params={k:v[-1] for k,v in parse_qs(url.query).items()})
                    frames.append({'raw_path':source,'data':document(data)})
            self.report['special_standings'].append({'code':special['value'],'label':special['label'],'raw_path':raw,'data':document(page),'frames':frames})

    def run(self):
        self.checkpoint()
        try:
            html,raw=self.read('index.php');self.report['overview']={'raw_path':raw,'data':document(html)}
            current_html,_=self.read('results.php')
            current_labels={c['value']:c['label'] for c in options(current_html,'daytime')}
            html,_=self.read('p_results.php')
            competitions=options(html,'daytime')
            if not competitions:raise RuntimeError('No competition selector values published')
            self.report['competition_options']=competitions
            for comp in competitions[:self.limits['competitions']]:
                comp={**comp,'current_label':current_labels.get(comp['value'])}
                self.report['competitions'].append(comp)
                try:
                    form={'which':'0','style':'','daytime':comp['value']}
                    seasons_html,_=self.read('p_results.php',controls=form)
                    seasons=options(seasons_html,'season')
                    if not seasons:raise RuntimeError('No source season IDs published')
                    if self.history=='current':
                        seasons=[s for s in seasons if s['label'].casefold() in {'current','current season'}]
                        if not seasons:raise RuntimeError('Current season cannot be identified explicitly')
                    if self.history=='past':
                        seasons=[s for s in seasons if s['label'].casefold() not in {'current','current season'}]
                    for season in seasons[:self.limits['seasons']]:
                        try:
                            html,_=self.read('p_results.php',controls={**form,'season':season['value']})
                            sections=options(html,'section')
                            self.report['seasons'].append({'competition_code':comp['value'],**season,'sections':sections})
                            if not sections and not any('section' in (s['id'],s['name']) for s in inspect_controls(html)['selectors']) and not re.search(r'no sections|no competition',html,re.I):
                                raise RuntimeError('Section selector missing without an explicit empty-season notice')
                            if not sections:
                                self.report['warnings'].append({'scope':season['value'],'message':'Season exposes no sections; selector response retained'})
                            for section in sections[:self.limits['sections']]:
                                try:self.section(comp,season,section)
                                except Exception as error:self.failure(season['value']+'/'+section['value'],error)
                        except Exception as error:self.failure(season['value'],error)
                except Exception as error:self.failure(comp['value'],error)
            try:self.clubs()
            except Exception as error:self.failure('clubs',error)
            try:self.special_standings()
            except Exception as error:self.failure('special standings',error)
        except Exception as error:self.failure('association',error)
        finally:
            self.checkpoint(finished=True);self.client.close()
        return self.report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--associations',nargs='+',choices=['all',*ASSOCIATIONS],default=['all'])
    parser.add_argument('--history',choices=['all','current','past'],default='all')
    parser.add_argument('--out',type=Path,default=Path('data/trols'))
    parser.add_argument('--workers',type=int,default=2,help='Concurrent associations (1–4); one request at a time per association')
    parser.add_argument('--refresh',action='store_true',help='Re-fetch cached pages for a new snapshot')
    for noun in ('sections','matches','clubs','seasons','competitions'):
        parser.add_argument('--limit-'+noun,type=int,help='Explicit validation subset; manifest is never marked complete')
    args=parser.parse_args()
    if not 1<=args.workers<=4:parser.error('--workers must be between 1 and 4')
    if any(v is not None and v<0 for v in (args.limit_sections,args.limit_matches,args.limit_clubs,args.limit_seasons,args.limit_competitions)):
        parser.error('Limits must be non-negative')
    for reserved in ('data/current','data/site','data/archive'):
        out=args.out.resolve();target=Path(reserved).resolve()
        if out==target or target in out.parents or out in target.parents:
            parser.error('Collector output must be separate from BRTA production data')
    keys=list(ASSOCIATIONS) if 'all' in args.associations else list(dict.fromkeys(args.associations))
    def collect(key):
        result=Collector(key,args.out,refresh=args.refresh,history=args.history,
                         limit_sections=args.limit_sections,limit_matches=args.limit_matches,limit_clubs=args.limit_clubs,
                         limit_seasons=args.limit_seasons,limit_competitions=args.limit_competitions).run()
        print(json.dumps({'association':key,'sections':len(result['sections']),'clubs':len(result['clubs']),
                          'errors':len(result['errors']),'complete':result['complete']}),flush=True)
        return {'association':key,'manifest':str(Path(key)/'manifest.json'),
                'complete':result['complete'],'errors':len(result['errors'])}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:results=list(pool.map(collect,keys))
    write_json(args.out/'manifest.json',{'schema_version':SCHEMA_VERSION,'associations':results,
                                       'complete':all(r['complete'] for r in results)})
    if any(r['errors'] for r in results):raise SystemExit(1)


if __name__=='__main__':main()
