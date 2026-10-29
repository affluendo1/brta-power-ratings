import unittest
from pathlib import Path
from unittest.mock import Mock
from scraper.trols_sources import ASSOCIATIONS, Association, SourceClient, discover_associations, inspect_controls, scorecard_layout

FIXTURES = Path(__file__).parent / 'fixtures' / 'trols-associations'


class AssociationPreparationTests(unittest.TestCase):
    def test_namespaces_preserve_native_ids_without_cross_association_collisions(self):
        brta, wdta = ASSOCIATIONS['brta'], ASSOCIATIONS['wdta']
        self.assertNotEqual(brta.identity('section', 'AA001', season_id='AA01'), wdta.identity('section', 'AA001', season_id='AA01'))
        self.assertNotEqual(wdta.identity('section', 'AA001', season_id='AA01'), wdta.identity('section', 'AA001', season_id='AA02'))
        self.assertIn('G%20Series%3A4', wdta.identity('section', 'G Series:4', season_id='term/4'))
        with self.assertRaises(ValueError):wdta.identity('section', 'AA001', season_id='')

    def test_only_brta_is_production_enabled_and_legacy_is_separate(self):
        self.assertEqual([key for key, a in ASSOCIATIONS.items() if a.production_enabled], ['brta'])
        self.assertTrue(all(a.collection_enabled for a in ASSOCIATIONS.values()))
        self.assertFalse(ASSOCIATIONS['mdjta'].active)
        self.assertEqual(ASSOCIATIONS['brta'].base_url, 'https://www.trols.org.au/brta/')

    def test_directory_discovery_rejects_external_routes_and_reports_unknowns(self):
        rows=discover_associations('''<a href="/wdta/index.php">Waverley</a><a href="https://evil.example/brta/index.php">Fake</a><a href="/mobile/index.php">Mobile</a><a href="/newta/index.php">New association</a><a href="/wdta/index.php">Duplicate</a>''')
        self.assertEqual([r['key'] for r in rows], ['wdta','newta'])
        self.assertFalse(rows[1]['known']);self.assertIsNone(rows[1]['active'])
        self.assertFalse(rows[1]['production_enabled'])

    def test_single_competition_and_opaque_season_labels_are_preserved(self):
        report=inspect_controls('''<select id="daytime" name="daytime"><option value="HP" selected>Thursday PM - 2026-3</option></select><select id="season"><option value="">Choose</option><option value="WAabc">G Series Term 4</option></select><iframe src="awards.php"></iframe>''')
        self.assertEqual(report['selectors'][0]['options'][0]['value'],'HP')
        self.assertEqual(report['selectors'][1]['options'][0]['label'],'G Series Term 4')
        self.assertEqual(report['frames'], ['awards.php'])

    def test_transport_stays_association_scoped_and_does_not_enter_club_zone(self):
        session=Mock();session.get.return_value=Mock(url='https://www.trols.org.au/wdta/results.php', text='<h1>Results</h1>')
        client=SourceClient('wdta',session=session)
        client.read('results.php')
        self.assertEqual(session.get.call_args.args[0], 'https://www.trols.org.au/wdta/results.php')
        for page in ['s_start.php','../brta/results.php','https://example.com/results.php']:
            with self.assertRaises(ValueError):client.read(page)
        with self.assertRaises(ValueError):client.read('clubs.php',controls={'password':'ignored'})
        session.get.return_value.url='https://www.trols.org.au/brta/results.php'
        with self.assertRaises(RuntimeError):client.read('results.php')

    def test_sessions_are_not_shared_between_associations(self):
        a,b=SourceClient('brta'),SourceClient('wdta')
        self.assertIsNot(a.session,b.session)
        a.session.cookies.set('daytime','AA');self.assertFalse(b.session.cookies)
        a.close();b.close()

    def test_observed_layouts_without_width_or_four_player_assumptions(self):
        expected={
            'wdta-triples':('97%', [3,3],3,3),
            'wdta-rubbers':('97%', [2,2],2,1),
            'bdnta-singles-doubles':('97%', [3,3],3,3),
            'erta-green':('99%', [3,3],3,3),
            'ldnta-incomplete':('97%', [4,4],0,6),
        }
        for name, values in expected.items():
            with self.subTest(name=name):
                row=scorecard_layout((FIXTURES/(name+'.html')).read_text())
                self.assertEqual((row['table_width'],row['roster_sizes'],row['singles_rows'],row['doubles_rows']),values)
                self.assertFalse(row['rating_rules_verified'])

    def test_unknown_or_ambiguous_cards_fail_instead_of_assuming_brta(self):
        with self.assertRaises(ValueError):scorecard_layout('<table><tr><td>Changed layout</td></tr></table>')
        html=(FIXTURES/'wdta-triples.html').read_text()
        with self.assertRaises(ValueError):scorecard_layout(html+html)


if __name__=='__main__':unittest.main()
