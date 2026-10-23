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
        if season['competition_code'] not in ('AA', 'UA'):
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


def write_player_search(catalog: dict) -> dict:
    index = build_player_search(catalog)
    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"Player search: {len(index['players'])} names, {len(index['sections'])} sections, "
          f"{len(index['unavailableSections'])} unavailable sections")
    return index


if __name__ == '__main__':
    write_player_search(json.loads(Path('data/archive/catalog.json').read_text(encoding='utf-8')))
