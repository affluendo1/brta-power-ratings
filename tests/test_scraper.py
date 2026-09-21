import copy
import csv
import unittest
from pathlib import Path

from scraper.sync_trols import parse_draw_page, parse_results_page, parse_scorecard, validate_dataset


ROOT = Path(__file__).resolve().parents[1]


def load_csv(name):
    with (ROOT / "data/current/sections/UA009" / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


class DatasetValidationTests(unittest.TestCase):
    def setUp(self):
        self.fixtures = load_csv("fixtures.csv")
        self.singles = load_csv("singles.csv")
        self.doubles = load_csv("doubles.csv")

    def test_current_dataset_passes_internal_arithmetic_checks(self):
        validate_dataset(self.fixtures, self.singles, self.doubles, "UA009")

    def test_wrong_rubber_score_is_rejected(self):
        bad_singles = copy.deepcopy(self.singles)
        row = next(row for row in bad_singles if int(row["home_games"]) > int(row["away_games"]))
        row["winning_player"] = row["away_player"]
        with self.assertRaisesRegex(RuntimeError, "Winner does not agree"):
            validate_dataset(self.fixtures, bad_singles, self.doubles, "UA009")

    def test_wrong_section_code_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Unexpected section code"):
            validate_dataset(self.fixtures, self.singles, self.doubles, "BAD")

    def test_pending_fixture_without_scorecard_id_gets_non_match_placeholder(self):
        html = """
        <table><tr><td colspan="9">13 Sep 26 · Rd. 9</td></tr>
        <tr><td>Coatesville</td><td>Missing Result</td><td>Lauriston</td></tr></table>
        """
        fixtures, _ = parse_results_page(html, "UA009")
        self.assertEqual(fixtures[0]["fixture_id"], "pending-ua009-r9-coatesville-lauriston")

    def test_rubbers_result_keeps_points_rubbers_sets_and_games(self):
        html = """
        <table><tr><td colspan="11">13 Sep 26 Rd. 9</td></tr>
        <tr><td><a onclick="open_match(event,'','UA001091')">Alpha</a></td>
        <td>7.0</td><td>3</td><td>5</td><td>32</td><td></td>
        <td>0.0</td><td>0</td><td>0</td><td>15</td><td>Beta</td></tr></table>
        """
        fixtures, _ = parse_results_page(html, "UA001")
        self.assertEqual((fixtures[0]["home_points"], fixtures[0]["home_rubbers"], fixtures[0]["home_sets"], fixtures[0]["home_games"]), (7, 3, 5, 32))

    def test_official_draw_parser_preserves_published_order(self):
        html = """<table><tr><th>Rd</th><th>Date</th><th>Home</th><th>Away</th></tr>
        <tr><td>10</td><td>11 Oct 26</td><td>Kings Park (10:00)</td><td>Kooyong</td></tr></table>"""
        draw = parse_draw_page(html, "UA009")
        self.assertEqual((draw[0]["round"], draw[0]["home_team"], draw[0]["away_team"]), (10, "Kings Park", "Kooyong"))

    def test_scorecard_preserves_named_emergency_marker(self):
        html = """
        <table width="99%"><tr><td><b>Home</b></td><td></td><td><b>Away</b></td></tr><tr><td>
        <table><tr><td>&nbsp;</td><td>1. Alice Regular</td></tr><tr><td>&nbsp;</td><td>2. Bob Regular</td></tr><tr><td>&nbsp;</td><td>3. Cara Regular</td></tr><tr><td>&nbsp;</td><td>4. Dan Regular</td></tr></table>
        </td><td><table><tr><td>1</td><td>6-3</td><td>1</td></tr><tr><td>2</td><td>6-1</td><td>2</td></tr><tr><td>3</td><td>6-2</td><td>3</td></tr><tr><td>4</td><td>6-4</td><td>4</td></tr><tr><td>1+2</td><td>6-4</td><td>1+2</td></tr><tr><td>3+4</td><td>6-2</td><td>3+4</td></tr></table></td><td>
        <table><tr><td>&nbsp;</td><td>1. Eve Regular</td></tr><tr><td>&nbsp;</td><td>2. Finn Regular</td></tr><tr><td>&nbsp;</td><td>3. Gail Regular</td></tr><tr><td valign="top"><span class="xsr">E</span>&nbsp;</td><td>4. Holly Emergency</td></tr></table>
        </td></tr></table>
        """
        fixture = {"fixture_id":"UA999001", "date":"1 Jul 26", "round":1, "home_team":"Home", "away_team":"Away", "home_sets":""}
        singles, doubles = parse_scorecard(html, fixture)
        self.assertEqual(singles[3]["away_player"], "Holly Emergency")
        self.assertEqual(singles[3]["away_emergency"], "true")
        self.assertEqual(doubles[1]["away_emergencies"], "[false, true]")

    def test_scorecard_keeps_unknown_emergency_out_of_ratings(self):
        html = """
        <table width="99%"><tr><td><b>Home</b></td><td></td><td><b>Away</b></td></tr><tr><td>
        <table><tr><td valign="top"><span class="xsr">E</span>X</td><td>1. No Player 1</td></tr><tr><td>&nbsp;</td><td>2. Bob</td></tr><tr><td>&nbsp;</td><td>3. Cara</td></tr><tr><td>&nbsp;</td><td>4. Dan</td></tr></table>
        </td><td><table><tr><td>1</td><td>0-6</td><td>1</td></tr></table></td><td>
        <table><tr><td>&nbsp;</td><td>1. Eve</td></tr><tr><td>&nbsp;</td><td>2. Finn</td></tr><tr><td>&nbsp;</td><td>3. Gail</td></tr><tr><td>&nbsp;</td><td>4. Holly</td></tr></table>
        </td></tr></table>
        """
        fixture = {"fixture_id":"AA999001", "date":"1 Jul 26", "round":1, "home_team":"Home", "away_team":"Away", "home_sets":""}
        singles, _ = parse_scorecard(html, fixture)
        self.assertIn("Unnamed emergency", singles[0]["home_player"])
        self.assertIn("AA999001", singles[0]["home_player"])
        self.assertEqual((singles[0]["home_emergency"], singles[0]["valid_for_rating"]), ("true", "false"))


if __name__ == "__main__":
    unittest.main()
