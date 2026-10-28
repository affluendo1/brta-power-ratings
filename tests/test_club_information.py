import unittest
from unittest import mock
from pathlib import Path
from scraper.club_information import parse_club_information, build_club_network, club_name
from scraper import sync_trols

PAGE = """<table><tr><td colspan='3'>Section Information</td></tr>
<tr><td>1</td><td>Black Rock Blue <i>(9:00)</i></td><td><a onclick="pop_map('Black Rock',-37.9,145.0);return false;">Melway 77 J3</a></td></tr>
<tr><td></td><td colspan='2'>King George VI Reserve<br>East Boundary Road, East Bentleigh<br>Club House Ph:9822 3333</td></tr>
<tr><td></td><td>Club Contact:Test Contact</td><td>Mob: 0400 123 456</td></tr>
<tr><td colspan='3'>&nbsp;</td></tr>
<tr><td>2</td><td>Moorleigh Red (10:00)</td><td>Melway 88 A2</td></tr>
<tr><td></td><td colspan='2'>Second Reserve</td></tr>
<tr><td></td><td>Team Contact:Other Contact</td><td>0412 345 678</td></tr></table>
<table><tr><td>Rd</td><td>Date</td><td>Home</td><td>Away</td></tr>
<tr><td>1</td><td>19 Jul 26</td><td>Black Rock Blue</td><td>Moorleigh Red</td></tr></table>"""


class ClubInformationTests(unittest.TestCase):
    def test_fixture_table_not_match_rows(self):
        rows = parse_club_information(PAGE)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['club'], 'Black Rock')
        self.assertEqual(rows[0]['team'], 'Black Rock Blue')
        self.assertEqual(rows[0]['start_time'], '9:00')
        self.assertEqual(rows[0]['venue_lines'], ['King George VI Reserve', 'East Boundary Road, East Bentleigh'])
        self.assertEqual(rows[0]['clubhouse_phones'], ['9822 3333'])
        self.assertEqual(rows[0]['contacts'], [{'role': 'club', 'name': 'Test Contact', 'phones': ['0400 123 456']}])
        self.assertEqual(rows[0]['coordinates'], {'latitude': -37.9, 'longitude': 145.0})
        self.assertEqual(rows[1]['contacts'][0]['role'], 'team')
        self.assertEqual(rows[1]['club'], 'Moorleigh')

    def test_normalisation_and_conflicting_observations(self):
        self.assertEqual(club_name('Black Rock Black 2'), 'Black Rock')
        self.assertEqual(club_name('Kings Park (Red)'), 'Kings Park')
        self.assertEqual(club_name('Kooyong Purple **'), 'Kooyong')
        self.assertEqual(club_name('Mentone Gold **'), 'Mentone')
        self.assertEqual(club_name('Mentone (DTC) **'), 'Mentone')
        self.assertEqual(club_name('Green Gully'), 'Green Gully')
        first = parse_club_information(PAGE)[0]
        second = {**first, 'team': 'Black Rock White', 'venue_lines': ['Other courts']}
        source = {'season_id': 'UA41', 'season_label': 'Spring 2026', 'competition_code': 'UA', 'section_label': 'Sets 6'}
        sections = [{**source, 'section_code': 'UA009', 'club_information': [first]},
                    {**source, 'section_code': 'AA001', 'competition_code': 'AA', 'club_information': [second]}]
        network = build_club_network(sections)
        self.assertEqual(len(network['clubs']), 1)
        self.assertEqual(network['sections'], ['AA001', 'UA009'])
        self.assertEqual(len(network['clubs'][0]['observations']), 2)
        self.assertEqual(network, build_club_network(list(reversed(sections))))

    def test_reuses_draw_request_and_rejects_missing_information(self):
        meta = {'competition_code': 'UA', 'season_id': 'UA41', 'section_code': 'UA009'}
        with mock.patch.object(sync_trols, '_post', return_value=type('Response', (), {'text': PAGE})()) as post:
            draw, clubs = sync_trols._team_draw(meta, '6', include_clubs=True)
        post.assert_called_once()
        self.assertEqual(len(draw), 1)
        self.assertEqual(len(clubs), 2)
        with mock.patch.object(sync_trols, '_post', return_value=type('Response', (), {'text': PAGE.replace('Section Information', 'Other')})()):
            with self.assertRaisesRegex(RuntimeError, 'No fixture club information'):
                sync_trols._team_draw(meta, '6', include_clubs=True)

    def test_absent_table_is_empty(self):
        self.assertEqual(parse_club_information('<p>No information</p>'), [])
