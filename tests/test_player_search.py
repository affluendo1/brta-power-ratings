import gzip
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from generate_player_search import build_player_search, section_players
from player_identity import appearances, link
from datetime import date


class PlayerSearchTests(unittest.TestCase):
    def test_search_refresh_publishes_reproducible_career_analytics(self):
        project = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / 'data/archive'
            archive.mkdir(parents=True)
            (archive / 'catalog.json').write_text('{"seasons":[]}', encoding='utf-8')
            output = archive / 'player-analytics.json.gz'
            command = [sys.executable, str(project / 'generate_player_search.py')]
            subprocess.run(command, cwd=root, check=True, capture_output=True)
            first = output.read_bytes()
            self.assertEqual(json.loads(gzip.decompress(first))['indexedSections'], 0)

            section = root / 'data/current/sections/UA001'
            section.mkdir(parents=True)
            (section / 'singles.csv').write_text(
                'fixture_id,position,date,round,home_team,away_team,home_player,away_player,'
                'home_games,away_games,winning_player,valid_for_rating\n'
                '1,1,2026-08-02,1,Home,Away,Alex Lee,Sam Lee,6,2,Alex Lee,true\n',
                encoding='utf-8',
            )
            (root / 'section.json').write_text(json.dumps({
                'singles': [{'player': 'Alex Lee', 'team': 'Home', 'rating': 1600},
                            {'player': 'Sam Lee', 'team': 'Away', 'rating': 1400}],
            }), encoding='utf-8')
            (archive / 'catalog.json').write_text(json.dumps({'seasons': [{
                'id': 'UA:current', 'competition_code': 'UA', 'competition_label': 'Sunday AM',
                'season_id': 'current', 'season_label': 'Spring 2026', 'is_current': True,
                'sections': [{'section_code': 'UA001', 'section_label': 'Sets 1', 'data_path': 'section.json'}],
            }]}), encoding='utf-8')
            subprocess.run(command, cwd=root, check=True, capture_output=True)
            refreshed = output.read_bytes()
            report = json.loads(gzip.decompress(refreshed))
            self.assertEqual((report['indexedSections'], report['scorecards']), (1, 1))
            subprocess.run(command, cwd=root, check=True, capture_output=True)
            self.assertEqual(output.read_bytes(), refreshed)

    def test_fill_ins_and_competition_changes_link_but_same_day_namesakes_do_not(self):
        sunday = {date(2026, 8, 2), date(2026, 8, 16)}
        fill_in = {date(2026, 8, 9)}
        saturday = {date(2027, 2, 6)}
        rows = [('Alex Lee', 'Club Blue', sunday), ('Alex Lee', 'Club 2', fill_in),
                ('Álex Lee', 'Club 1', saturday), ('Alex Lee', 'Other Club', saturday)]
        self.assertEqual(link(rows), [[0, 1, 2]])
        rows[1] = ('Alex Lee', 'Club 2', {date(2026, 8, 2)})
        self.assertEqual(link(rows), [[0, 2]])

    def test_reviewed_alias_preserves_transfer_and_spelling_change(self):
        rows = [('Alex Lee', 'Club Blue', {date(2026, 8, 2)}),
                ('Alexander Li', 'Other Club', {date(2026, 10, 4)})]
        self.assertEqual(link(rows), [])
        aliases = {('alex lee', 'club'): 'example', ('alexander li', 'other club'): 'example'}
        self.assertEqual(link(rows, aliases), [[0, 1]])

    def test_forfeit_does_not_create_a_same_day_conflict(self):
        fixture = {'home': 'Club', 'away': 'Other Club', 'rubbers': [
            {'status': 'Forfeit', 'score': '6-0', 'home': 'Alex Lee'},
            {'status': 'Completed', 'score': '6-4', 'home': 'Sam Lee / Kim Lee'},
            {'score': '4-6', 'home': 'Older Record', 'winner': 'Opponent'},
        ]}
        evidence = appearances({'results': [{'date': '02 Aug 26', 'fixtures': [fixture]}]})
        self.assertNotIn(('Alex Lee', 'Club'), evidence)
        self.assertEqual(evidence['Kim Lee', 'Club'], {date(2026, 8, 2)})
        self.assertEqual(evidence['Older Record', 'Club'], {date(2026, 8, 2)})

    def test_includes_doubles_only_and_unrated_scorecard_players_without_placeholders(self):
        rows = section_players({'singles': [{'player': 'Alex', 'team': 'A'}],
            'doubles': [{'player': 'Alex / Doubles Only', 'team': 'A'}],
            'results': [{'fixtures': [{'home': 'B', 'away': 'C', 'rubbers': [
                {'type': 'Singles', 'home': 'Unrated', 'away': '[Unnamed player]'},
                {'type': 'Doubles', 'home': 'Alex / Partner', 'away': 'No Player 1 / Opponent'}]}]}]})
        self.assertEqual(set(rows), {'Alex', 'Doubles Only', 'Unrated', 'Partner', 'Opponent'})
        self.assertEqual(rows['Alex'], {'A', 'B'})

    def test_both_competitions_repeated_names_and_section_codes_keep_season_context(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'one.json').write_text(json.dumps({'singles': [{'player': 'Same Name', 'team': 'A'}]}))
            seasons = []
            for code, year in [('AA', 2026), ('UA', 2010), ('UA', 2011)]:
                seasons.append({'id': f'{code}:{year}', 'competition_code': code,
                    'competition_label': code, 'season_id': str(year), 'season_label': f'Spring {year}',
                    'is_current': year == 2026, 'sections': [
                        {'section_code': 'S1', 'section_label': '1', 'data_path': 'one.json'},
                        {'section_code': 'missing', 'section_label': '2', 'data_path': 'missing.json'}]})
            index = build_player_search({'seasons': seasons}, root)
            self.assertEqual(index['players'], ['Same Name'])
            self.assertEqual(len(index['entries']), 3)
            self.assertEqual({row['seasonKey'] for row in index['sections']}, {'AA:2026','UA:2010','UA:2011'})
            self.assertEqual(len(index['unavailableSections']), 3)
            self.assertEqual(index['sections'][1]['dataPath'], 'one.json')
