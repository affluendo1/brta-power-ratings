"""Historical eligibility boundaries and identity exclusions for release 8.5."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('history_builder', ROOT / 'scripts/build_orchestra_history.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def row(date, name='Alex Example', team='Club A', competition='UA', season='UA27'):
    person = {'name': name, 'team': team, 'usable': True, 'abbreviated': False}
    return {'date': date, 'competition': competition, 'season': season, 'level': 10,
            'homePeople': [person], 'awayPeople': []}


class HistoryEligibilityTests(unittest.TestCase):
    snapshot = {'competition': 'UA', 'start': '2026-07-19', 'cutoffExclusive': '2026-07-12'}

    def test_six_year_boundary_is_inclusive_and_cutoff_is_exclusive(self):
        rows = [row(d) for d in ['2020-07-18', '2020-07-19', '2022-01-01', '2026-07-11', '2026-07-12', '2027-01-01']]
        actual, oldest, _ = builder.eligible_rows(rows, 'UA39', self.snapshot, 6)
        self.assertEqual(oldest, '2020-07-19')
        self.assertEqual([r['date'] for r in actual], ['2020-07-19', '2022-01-01', '2026-07-11'])
        reset, _, _ = builder.eligible_rows(rows, 'UA39', self.snapshot, 3)
        self.assertEqual([r['date'] for r in reset], ['2026-07-11'])

    def test_same_competition_and_previous_season_only(self):
        rows = [row('2025-01-01'), row('2025-01-01', competition='AA'), row('2025-01-01', season='UA39')]
        actual, _, _ = builder.eligible_rows(rows, 'UA39', self.snapshot, 6)
        self.assertEqual(actual, rows[:1])

    def test_collisions_and_placeholder_names_are_excluded(self):
        rows = [row('2025-01-01', team='Club A'), row('2025-01-01', team='Club B'),
                row('2025-02-01'), row('2025-03-01', name='[unnamed player — 3]'),
                row('2025-04-01', name='Safe Name')]
        actual, _, conflicts = builder.eligible_rows(rows, 'UA39', self.snapshot, 6)
        self.assertEqual(conflicts, 1)
        self.assertEqual(actual, rows[-1:])

    def test_calendar_years_handle_leap_day(self):
        self.assertEqual(builder.oldest_date('2024-02-29', 6), '2018-02-28')


if __name__ == '__main__':
    unittest.main()
