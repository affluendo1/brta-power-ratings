"""Build a compact name index across every published Saturday/Sunday section."""
from __future__ import annotations

import json
import re
from pathlib import Path

INDEX_PATH = Path('data/archive/player-search.json')


def section_players(payload: dict) -> dict[str, set[str]]:
    players: dict[str, set[str]] = {}

    def add(name, team=''):
        name = str(name or '').strip()
        if not name or name.startswith('[') or re.fullmatch(r'No Player\s*\d*', name, re.I):
            return
        players.setdefault(name, set())
        if team:
            players[name].add(str(team))

    for key in ('singles', 'doublesIndividuals'):
        for row in payload.get(key, []):
            add(row.get('player'), row.get('team'))
    for row in payload.get('doubles', []):
        for name in str(row.get('player', '')).split(' / '):
            add(name, row.get('team'))
    # Include players with only incomplete/retired/forfeited records, too.
    for group in payload.get('results', []):
        for fixture in group.get('fixtures', []):
            for rubber in fixture.get('rubbers', []):
                for side in ('home', 'away'):
                    for name in str(rubber.get(side, '')).split(' / '):
                        add(name, fixture.get(side, ''))
    return players


def build_player_search(catalog: dict, root: Path = Path('.')) -> dict:
    names, name_ids, sections, entries, unavailable = [], {}, [], [], []
    seen = set()
    for season in catalog.get('seasons', []):
        if season['competition_code'] not in ('AA', 'AP', 'UA', 'TA', 'TN', 'WA', 'HA'):
            continue
        for section in season.get('sections', []):
            path = section.get('data_path', '')
            key = (season['id'], section['section_code'])
            if key in seen:
                continue
            seen.add(key)
            if not path or not (root / path).is_file():
                unavailable.append({'seasonKey': season['id'], 'sectionCode': section['section_code']})
                continue
            payload = json.loads((root / path).read_text(encoding='utf-8'))
            section_id = len(sections)
            sections.append({
                'seasonKey': season['id'], 'seasonId': season['season_id'],
                'seasonLabel': season['season_label'],
                'seasonOptionLabel': season.get('season_option_label', season['season_label']),
                'competitionCode': season['competition_code'],
                'competitionLabel': season['competition_label'],
                'sectionCode': section['section_code'], 'sectionLabel': section['section_label'],
                'dataPath': path, 'isCurrent': bool(season.get('is_current')),
            })
            for name, teams in sorted(section_players(payload).items()):
                if name not in name_ids:
                    name_ids[name] = len(names)
                    names.append(name)
                entries.append([name_ids[name], section_id, ' / '.join(sorted(teams))])
    return {'version': 1, 'players': names, 'sections': sections, 'entries': entries,
            'unavailableSections': unavailable}


def build_rating_search(catalog: dict, root: Path = Path('.')) -> dict:
    result = {view: [] for view in ('singles', 'doublesPlayers', 'pairs', 'overall')}
    for season in catalog.get('seasons', []):
        if season['competition_code'] not in ('AA', 'AP', 'UA', 'TA', 'TN', 'WA', 'HA'):
            continue
        for section in season.get('sections', []):
            path = root / section.get('data_path', '__missing__')
            if not path.is_file():
                continue
            data = json.loads(path.read_text())
            context = {'sectionCode': section['section_code'], 'sectionLabel': section['section_label'],
                       'seasonKey': season['id'], 'seasonLabel': season['season_label'],
                       'competitionLabel': season['competition_label'], 'competitionCode': season['competition_code'],
                       'seasonId': season['season_id'], 'isCurrent': bool(season.get('is_current')), 'dataPath': section.get('data_path')}
            sm = {r['player']: r for r in data.get('singles', [])}
            dm = {r['player']: r for r in data.get('doublesIndividuals', [])}
            groups = {'singles': data.get('singles', []), 'doublesPlayers': data.get('doublesIndividuals', []), 'pairs': data.get('doubles', [])}
            groups['overall'] = []
            for name in sm.keys() | dm.keys():
                a, b = sm.get(name, {}), dm.get(name, {})
                rating = round((a['rating'] + b['rating']) / 2) if a and b else (a or b)['rating']
                row = {'player': name, 'team': (a or b).get('team', ''), 'rating': rating,
                       'qualified': bool(a.get('matches', 0) >= 4 and b.get('qualified'))}
                for field in ('wins', 'losses', 'gf', 'ga'):
                    row[field] = (a.get(field) or 0) + (b.get(field) or 0)
                groups['overall'].append(row)
            for view, rows in groups.items():
                for r in rows:
                    qualified = r.get('qualified', False) if view in ('overall', 'doublesPlayers') else r.get('matches', 0) >= (2 if view == 'pairs' else 4)
                    result[view].append({**context, **{k: r.get(k) for k in ('player', 'team', 'rating', 'wins', 'losses', 'gf', 'ga', 'matches', 'se', 'pairEffect', 'individualAverage')}, 'qualified': qualified})
    return result


def rating_candidates(groups):
    """Only extremes are needed by commands; retain all ties for singular queries."""
    result = {}
    for cohort in ('ranked', 'all'):
        result[cohort] = {}
        for view, values in groups.items():
            rows = [r for r in values if cohort == 'all' or r['qualified']]
            selected = {}
            for metric in ('rating', 'record', 'games'):
                for direction in (-1, 1):
                    def key(r):
                        if metric == 'rating':
                            return (r['rating'],)
                        if metric == 'record':
                            total = (r.get('wins') or 0) + (r.get('losses') or 0)
                            return ((r.get('wins') or 0) / total, (r.get('wins') or 0) if direction == -1 else -(r.get('losses') or 0)) if total else None
                        total = (r.get('gf') or 0) + (r.get('ga') or 0)
                        return ((r.get('gf') or 0) / total,) if total else None
                    candidates = sorted((r for r in rows if r.get('rating') is not None and key(r) is not None), key=key, reverse=direction == -1)
                    if candidates:
                        top = key(candidates[0])
                        for i, r in enumerate(candidates):
                            if i >= 10 and key(r) != top:
                                break
                            selected[(r['seasonKey'], r['sectionCode'], r['player'], r.get('team'))] = r
            result[cohort][view] = list(selected.values())
    return result


def compact_rating_candidates(candidates):
    sections, section_ids = [], {}
    result = {'version': 1, 'sections': sections}
    for cohort, groups in candidates.items():
        result[cohort] = {}
        for view, rows in groups.items():
            output = []
            for row in rows:
                key = (row['seasonKey'], row['sectionCode'])
                if key not in section_ids:
                    section_ids[key] = len(sections)
                    sections.append({k: row.get(k) for k in ('seasonKey', 'sectionCode', 'sectionLabel', 'competitionLabel', 'seasonLabel')})
                output.append([section_ids[key]] + [row.get(k) for k in ('player','team','rating','wins','losses','gf','ga','qualified')])
            result[cohort][view] = output
    return result


def compact_complete_rows(rows):
    sections, ids, entries = [], {}, []
    for row in rows:
        key=(row['seasonKey'],row['sectionCode'])
        if key not in ids:
            ids[key]=len(sections)
            sections.append({k:row.get(k) for k in ('sectionCode','sectionLabel','seasonKey','seasonId','seasonLabel','competitionCode','competitionLabel','isCurrent','dataPath')})
        entries.append([ids[key]]+[row.get(k) for k in ('player','team','rating','wins','losses','gf','ga','matches','se','qualified','pairEffect','individualAverage')])
    return {'version':1,'sections':sections,'entries':entries}


def write_player_search(catalog: dict) -> dict:
    index = build_player_search(catalog)
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    groups=build_rating_search(catalog)
    for view, filename in [('pairs','pair-search.json'),('singles','singles-search.json')]:
        (INDEX_PATH.parent/filename).write_text(json.dumps(compact_complete_rows(groups[view]),ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    (INDEX_PATH.parent / 'rating-search.json').write_text(json.dumps(compact_rating_candidates(rating_candidates(groups)), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"Player search: {len(index['players'])} names, {len(index['sections'])} sections, "
          f"{len(index['unavailableSections'])} unavailable sections")
    return index


if __name__ == '__main__':
    write_player_search(json.loads(Path('data/archive/catalog.json').read_text(encoding='utf-8')))
