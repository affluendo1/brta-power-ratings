import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_scoreline_index import build


class ScorelineIndexTests(unittest.TestCase):
    def test_each_rubber_set_is_indexed_and_orientation_is_ignored(self):
        payload = {
            "meta": {"season_label": "Test 2026", "competition_code": "UA", "section_label": "Rubbers Test"},
            "results": [{"round": 1, "date": "1 Nov 26", "fixtures": [{
                "fixtureId": "f1", "round": 1, "date": "1 Nov 26", "stage": "regular",
                "home": "Home", "away": "Away", "status": "Completed",
                "rubbers": [{"status": "Completed", "score": "6-0 0-6 [10-8]"}],
            }]}],
        }
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "section.json"
            output = Path(tmp) / "scorelines.json"
            source.write_text(json.dumps(payload), encoding="utf-8")
            build([source], output)
            index = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(index["scores"]["6-0"][0], 2)
        self.assertEqual(index["scores"]["[10-8]"][0], 1)
        self.assertEqual(index["total"], 3)


if __name__ == "__main__":
    unittest.main()
