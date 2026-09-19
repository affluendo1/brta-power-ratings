import unittest

import pandas as pd

from generate_site_data import team_rows


class TeamPowerTests(unittest.TestCase):
    def test_team_power_uses_all_modelled_players_not_display_cutoff(self):
        players = [
            {"team": "Alpha", "rating": 1600, "matches": 6},
            {"team": "Alpha", "rating": 1400, "matches": 1},
        ]
        fixtures = pd.DataFrame([{"home_team": "Alpha", "away_team": "Beta", "status": "Missing Result", "home_rubbers": "", "away_rubbers": "", "home_games": "", "away_games": ""}])
        rows = team_rows(players, fixtures)
        alpha = next(row for row in rows if row["team"] == "Alpha")
        self.assertEqual(alpha["avg"], 1500.0)
        self.assertEqual(alpha["modelled"], 2)


if __name__ == "__main__":
    unittest.main()
