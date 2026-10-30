import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from scraper.score_formats import parse_score, format_score, normalise_frame, rating_counts, junior_decider_code
from scraper.migrate_match_tiebreaks import migrate
from scraper.sync_trols import _rubbers_score, parse_scorecard


class ScoreFormatTests(unittest.TestCase):
    def test_actual_and_extended_points_never_become_games(self):
        for score in ('6-4 3-6 [10-7]', '6-4 3-6 10-7', '6-4 3-6 [22-20]'):
            parsed = _rubbers_score(score, True)
            self.assertEqual((parsed['home_games'], parsed['away_games']), (9, 10))
            self.assertEqual((parsed['home_sets'], parsed['away_sets']), (2, 1))
            self.assertIn('[', parsed['score'])

    def test_legacy_code_requires_verified_format_not_just_a_close_third_set(self):
        meta = {'competition_code': 'UA', 'season_label': 'Autumn 2026', 'format': 'rubbers'}
        original = '6-4 3-6 7-6'
        self.assertEqual(format_score(parse_score(original, outcome_code=junior_decider_code(meta))), '6-4 3-6 [TB W]')
        self.assertFalse(junior_decider_code({**meta, 'competition_code': 'AP'}))
        self.assertFalse(junior_decider_code({**meta, 'season_label': 'Spring 2019'}))
        self.assertFalse(junior_decider_code(meta, 'doubles'))
        self.assertFalse(parse_score(original)[-1]['mt'])
        self.assertFalse(parse_score('6-4 3-6 6-3', outcome_code=True)[-1]['mt'])

    def test_counts_and_statistics_are_separate_and_unknown_points_stay_unknown(self):
        data = pd.DataFrame([{'score':'6-4 3-6 7-6', 'home_games':16, 'away_games':16, 'home_sets':2, 'away_sets':1}])
        cleaned = normalise_frame(data, {'competition_code':'UA', 'season_label':'Spring 2026', 'format':'rubbers'})
        self.assertEqual(cleaned.iloc[0]['score'], '6-4 3-6 [TB W]')
        self.assertEqual(cleaned.iloc[0]['source_score'], '6-4 3-6 7-6')
        self.assertEqual((cleaned.iloc[0].home_games, cleaned.iloc[0].away_games), (9,10))
        zero_h,zero_a = rating_counts(cleaned, match_tiebreak_weight=0)
        self.assertEqual((zero_h[0],zero_a[0]), (9,10))
        with self.assertRaises(ValueError):
            rating_counts(cleaned, match_tiebreak_mode="invent")
        h,a = rating_counts(cleaned)
        self.assertEqual((h[0],a[0]), (10,10))
        h,a = rating_counts(cleaned, 'RM3b')
        self.assertEqual((h[0],a[0]), (11,10))
        actual = cleaned.copy();actual.loc[0,'score']='6-4 3-6 [10-7]'
        h,a = rating_counts(actual, 'RM3b')
        self.assertAlmostEqual(h[0], 9+20/17)
        self.assertAlmostEqual(a[0], 10+14/17)
        pd.testing.assert_frame_equal(cleaned, normalise_frame(cleaned, {}))

    def test_migration_is_idempotent_and_preserves_official_fixture_totals(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);folder=root/'data/archive/sections/UA38-UA003';folder.mkdir(parents=True)
            (folder/'metadata.json').write_text(json.dumps({'format':'rubbers','competition_code':'UA','season_label':'Autumn 2026'}))
            (folder/'singles.csv').write_text('score,home_games,away_games,home_sets,away_sets\n6-4 3-6 6-7,15,17,1,2\n')
            (folder/'doubles.csv').write_text('score,home_games,away_games,home_sets,away_sets\n8-6,8,6,1,0\n')
            (folder/'fixtures.csv').write_text('home_games,away_games\n23,23\n');before=(folder/'fixtures.csv').read_bytes()
            report=migrate(root);self.assertEqual(report['affected_sections'][0]['changed_rows'],1)
            first=(folder/'singles.csv').read_bytes();report=migrate(root)
            self.assertEqual(report['affected_sections'][0]['changed_rows'],0)
            self.assertEqual((folder/'singles.csv').read_bytes(),first)
            self.assertEqual((folder/'fixtures.csv').read_bytes(),before)

    def test_scorecard_uses_outcome_marker_without_fabricating_points(self):
        html='''<table width="99%"><tr><td>Home</td><td></td><td>Away</td></tr><tr><td><table><tr><td></td><td>1. Alice</td></tr><tr><td></td><td>2. Amy</td></tr></table></td><td><table><tr><td>1</td><td>6-4<br>3-6<br>6-7</td><td>1</td></tr></table></td><td><table><tr><td></td><td>1. Bob</td></tr><tr><td></td><td>2. Ben</td></tr></table></td></tr></table>'''
        fixture={'fixture_id':'UA003012','date':'19 Jul 26','round':1,'home_team':'Home','away_team':'Away','home_sets':1,'format':'rubbers','season_label':'Spring 2026'}
        singles,_=parse_scorecard(html,fixture)
        self.assertEqual(singles[0]['score'],'6-4 3-6 [TB L]')
        self.assertEqual(singles[0]['winning_player'],'Bob')
        self.assertEqual((singles[0]['home_games'],singles[0]['away_games']),(9,10))


if __name__ == '__main__':
    unittest.main()
