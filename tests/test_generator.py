import unittest

import pandas as pd

from generate_site_data import (brta_scoring_rules, fixture_points, reconstructed_standings,
                                 round_rating_history, strength_of_schedule, team_order_evidence,
                                 team_rows)


class TeamPowerTests(unittest.TestCase):
    def test_team_power_uses_all_modelled_players_not_display_cutoff(self):
        players = [
            {"team": "Alpha", "rating": 1600, "matches": 6},
            {"team": "Alpha", "rating": 1400, "matches": 1},
        ]
        fixtures = pd.DataFrame([{"home_team": "Alpha", "away_team": "Beta", "status": "Missing Result", "home_rubbers": "", "away_rubbers": "", "home_games": "", "away_games": ""}])
        rows = team_rows(players, fixtures, brta_scoring_rules({"format": "sets"}))
        alpha = next(row for row in rows if row["team"] == "Alpha")
        self.assertEqual(alpha["avg"], 1500.0)
        self.assertEqual(alpha["modelled"], 2)


class BrtaStandingsTests(unittest.TestCase):
    def test_washout_points_follow_the_format_not_the_section_score_mode(self):
        rubbers = brta_scoring_rules({"format": "rubbers"})
        sets = brta_scoring_rules({"format": "sets"})
        row = pd.Series({"status": "Wash Out", "home_points": "", "away_points": ""})
        self.assertEqual(fixture_points(row, rubbers), (3.5, 3.5))
        self.assertEqual(fixture_points(row, sets), (5.0, 5.0))

    def test_forfeit_awards_all_set_points_and_no_percentage(self):
        fixtures = pd.DataFrame([
            {"home_team": "Home", "away_team": "Away", "status": "Forfeited To", "home_points": "", "away_points": "",
             "home_rubbers": "", "away_rubbers": "", "home_sets": "", "away_sets": "", "home_games": "", "away_games": ""},
        ])
        rows = reconstructed_standings(fixtures, brta_scoring_rules({"format": "sets"}))
        home, away = rows[1], rows[0]
        self.assertEqual((home["points"], away["points"]), (0, 10))
        self.assertEqual((home["gamesFor"], away["gamesFor"]), (0, 0))

    def test_ladder_tie_uses_game_percentage(self):
        fixtures = pd.DataFrame([
            {"home_team": "Alpha", "away_team": "Beta", "status": "Completed", "home_points": 5, "away_points": 5,
             "home_rubbers": 3, "away_rubbers": 3, "home_sets": "", "away_sets": "", "home_games": 24, "away_games": 20},
            {"home_team": "Gamma", "away_team": "Delta", "status": "Completed", "home_points": 5, "away_points": 5,
             "home_rubbers": 3, "away_rubbers": 3, "home_sets": "", "away_sets": "", "home_games": 30, "away_games": 10},
        ])
        rows = reconstructed_standings(fixtures, brta_scoring_rules({"format": "sets"}))
        self.assertEqual([row["team"] for row in rows], ["Gamma", "Alpha", "Beta", "Delta"])


class HistoricalDataTests(unittest.TestCase):
    def setUp(self):
        self.singles = pd.DataFrame([
            {"fixture_id":"f1","round":1,"date":"1 Jul 26","status":"Completed","position":"No. 1","home_team":"A","away_team":"B","home_player":"Alice","away_player":"Bob","home_games":6,"away_games":2,"winning_player":"Alice"},
            {"fixture_id":"f1","round":1,"date":"1 Jul 26","status":"Completed","position":"No. 2","home_team":"A","away_team":"B","home_player":"Amy","away_player":"Ben","home_games":6,"away_games":4,"winning_player":"Amy"},
            {"fixture_id":"f2","round":2,"date":"8 Jul 26","status":"Completed","position":"No. 1","home_team":"A","away_team":"B","home_player":"Alice","away_player":"Ben","home_games":6,"away_games":1,"winning_player":"Alice"},
            {"fixture_id":"f2","round":2,"date":"8 Jul 26","status":"Completed","position":"No. 2","home_team":"A","away_team":"B","home_player":"Amy","away_player":"Bob","home_games":4,"away_games":6,"winning_player":"Bob"},
        ])

    def test_history_is_as_of_each_round_and_schedule_is_ranked(self):
        teams = {"Alice":"A", "Amy":"A", "Bob":"B", "Ben":"B"}
        history = round_rating_history(self.singles, teams)
        self.assertEqual([row["round"] for row in history["rounds"]], [1, 2])
        self.assertEqual(history["players"]["Alice"][0][3], 1)
        self.assertEqual(history["players"]["Alice"][1][3], 2)
        schedule = strength_of_schedule(self.singles, {"Alice":1700,"Amy":1600,"Bob":1400,"Ben":1500}, teams)
        self.assertEqual(schedule[0]["rank"], 1)
        self.assertEqual(len(schedule), 4)

    def test_official_order_evidence_records_direct_precedence(self):
        evidence = team_order_evidence(self.singles, {"Alice":1700,"Amy":1600,"Bob":1400,"Ben":1500}, {})
        edges = {(row["above"], row["below"]): row["count"] for row in evidence["A"]["precedence"]}
        self.assertEqual(edges[("Alice", "Amy")], 2)


if __name__ == "__main__":
    unittest.main()
