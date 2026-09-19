import copy
import csv
import unittest
from pathlib import Path

from scraper.sync_trols import parse_results_page, validate_dataset


ROOT = Path(__file__).resolve().parents[1]


def load_csv(name):
    with (ROOT / "data/current" / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


class DatasetValidationTests(unittest.TestCase):
    def setUp(self):
        self.fixtures = load_csv("section6_fixtures.csv")
        self.singles = load_csv("section6_singles_results.csv")
        self.doubles = load_csv("section6_doubles_results.csv")

    def test_current_dataset_passes_internal_arithmetic_checks(self):
        validate_dataset(self.fixtures, self.singles, self.doubles, "UA009")

    def test_wrong_rubber_score_is_rejected(self):
        bad_singles = copy.deepcopy(self.singles)
        row = next(row for row in bad_singles if int(row["home_games"]) > int(row["away_games"]))
        row["winning_player"] = row["away_player"]
        with self.assertRaisesRegex(RuntimeError, "Winner does not agree"):
            validate_dataset(self.fixtures, bad_singles, self.doubles, "UA009")

    def test_wrong_section_code_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "Expected section code"):
            validate_dataset(self.fixtures, self.singles, self.doubles, "UA010")

    def test_pending_fixture_without_scorecard_id_gets_non_match_placeholder(self):
        html = """
        <table><tr><td colspan="9">13 Sep 26 · Rd. 9</td></tr>
        <tr><td>Coatesville</td><td>Missing Result</td><td>Lauriston</td></tr></table>
        """
        fixtures, _ = parse_results_page(html)
        self.assertEqual(fixtures[0]["fixture_id"], "pending-r9-coatesville-lauriston")


if __name__ == "__main__":
    unittest.main()
