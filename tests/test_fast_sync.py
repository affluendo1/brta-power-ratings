import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from shutil import copytree
from unittest.mock import patch

from scraper import fast_sync, sync_trols


class FastSyncTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name) / "UA009"
        root = Path(__file__).resolve().parents[1]
        copytree(root / "data/current/sections/UA009", self.directory)
        self.meta = fast_sync.read_json(self.directory / "metadata.json")
        self.fixtures = sync_trols.read_csv(self.directory / "fixtures.csv")
        self.completed = next(row for row in self.fixtures if row["status"] == "Completed")

    def response(self, fixtures):
        return {**self.meta, "fixtures": fixtures, "results_loaded_by_trols": None}

    def test_unchanged_index_fetches_no_scorecards(self):
        with patch.object(sync_trols, "_section_results", return_value=self.response(self.fixtures[::-1])), \
             patch.object(sync_trols, "_scorecard") as scorecard:
            self.assertIsNone(fast_sync.merge(self.meta, self.directory))
        scorecard.assert_not_called()

    def test_changed_fixture_fetches_only_its_scorecard(self):
        fid = self.completed["fixture_id"]
        fresh = [{**row, "home_points": str(float(row["home_points"]) + 1)}
                 if row["fixture_id"] == fid else row for row in self.fixtures]
        rubbers = {kind: sync_trols.read_csv(self.directory / f"{kind}.csv")
                   for kind in fast_sync.DISCIPLINES}
        card = (fid, *[[row for row in rubbers[kind] if row["fixture_id"] == fid]
                       for kind in ("singles", "doubles")])
        with patch.object(sync_trols, "_section_results", return_value=self.response(fresh)), \
             patch.object(sync_trols, "_scorecard", return_value=card) as scorecard:
            merged = fast_sync.merge(self.meta, self.directory)
        self.assertEqual(scorecard.call_count, 1)
        self.assertEqual(scorecard.call_args.args[0]["fixture_id"], fid)
        for kind in rubbers:
            self.assertEqual(len(merged[kind]), len(rubbers[kind]))

    def test_incomplete_index_cannot_remove_published_results(self):
        fresh = [row for row in self.fixtures if row is not self.completed]
        with patch.object(sync_trols, "_section_results", return_value=self.response(fresh)), \
             patch.object(sync_trols, "_scorecard") as scorecard:
            with self.assertRaisesRegex(RuntimeError, "Dataset shrank"):
                fast_sync.merge(self.meta, self.directory)
        scorecard.assert_not_called()

    def test_same_day_play_is_due_on_each_five_minute_tick(self):
        date = datetime.strptime(self.completed["date"], "%d %b %y")
        for minute in (2, 7, 12):
            now = date.replace(hour=16, minute=minute, tzinfo=fast_sync.MELBOURNE)
            self.assertTrue(fast_sync.due(self.meta, self.directory, now))

    def test_late_results_remain_due_through_day_four(self):
        played = datetime(2026, 11, 8, 16, 2, tzinfo=fast_sync.MELBOURNE)
        slot = {"date": "8 Nov 26", "round": "13", "home_team": "Home", "away_team": "Away"}
        for status in ("Missing Result", "Completed"):
            for age in (2, 3, 4, 5):
                now = played + timedelta(days=age)
                with self.subTest(status=status, age=age), patch.object(
                    sync_trols, "read_csv", side_effect=[[{**slot, "status": status}], [slot]]
                ):
                    if status == "Missing Result" and age <= 4:
                        self.assertTrue(fast_sync.due({"section_code": "UA009"}, self.directory, now))
                    else:
                        staggered = int(now.timestamp()) // 300 % 12 == fast_sync.crc32(b"UA009") % 12
                        self.assertEqual(fast_sync.due({"section_code": "UA009"}, self.directory, now), staggered)


if __name__ == "__main__":
    unittest.main()
