import json
import tempfile
import unittest
from pathlib import Path
from generate_player_search import build_player_search, section_players
from player_identity import appearances, link
from datetime import date


class PlayerSearchTests(unittest.TestCase):
    def test_fill_ins_and_competition_changes_link_but_same_day_namesakes_do_not(self):
        sunday = {date(2026, 8, 2), date(2026, 8, 16)}
        fill_in = {date(2026, 8, 9)}
        saturday = {date(2027, 2, 6)}
        rows = [('Alex Lee', 'Club Blue', sunday), ('Alex Lee', 'Club 2', fill_in),
                ('Álex Lee', 'Club 1', saturday), ('Alex Lee', 'Other Club', saturday)]
        self.assertEqual(link(rows), [[0, 1, 2]])
        rows[1] = ('Alex Lee', 'Club 2', {date(2026, 8, 2)})
        self.assertEqual(link(rows), [])

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
