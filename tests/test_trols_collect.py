import json
from pathlib import Path
import tempfile
import unittest
from scraper.trols_sources import ASSOCIATIONS
from scraper.trols_collect import Collector, Store, asset_key, document, options, parse_results, parse_scorecard, validate_selection

FIXTURES=Path(__file__).parent/'fixtures'/'trols-associations'
RESULTS='''<table><tr><td colspan="9">24 Oct 26 Rd.3</td></tr><tr><td><a onclick="open_match(event,'','same');">Home</a></td><td>8</td><td>6</td><td>37</td><td></td><td>0</td><td>0</td><td>17</td><td>Away</td></tr><tr><td>Home</td><td>Wash Out</td><td>Other</td></tr></table>'''


def select(name,values,id=None):
    return '<select id="'+(id or name)+'" name="'+name+'">'+''.join('<option value="'+v+'">'+label+'</option>' for v,label in values)+'</select>'


class FakeClient:
    def __init__(self,key='wdta',fail_card=False):self.association=ASSOCIATIONS[key];self.calls=[];self.fail_card=fail_card;self.closed=False
    def read(self,page,controls=None,params=None):
        self.calls.append((page,controls,params));c=controls or {};which=c.get('which')
        if page=='index.php':return '<table><tr><td>Overview</td></tr></table>'
        if page=='results.php':return select('daytime',[('AA','Saturday AM - Summer 26/27'),('WN','Wednesday Night - 2026-3')])
        if page=='p_results.php':
            if not controls:return select('daytime',[('AA','Saturday AM'),('WN','Wednesday Night')])
            if 'season' not in c:
                return select('season',[('shared','Current Season')]+([('old','Summer 09/10')] if c['daytime']=='AA' else []))
            if which=='0':return select('section',[('AA001','Section One')])
            return RESULTS
        if page=='match_popup.php':
            return '<p>Temporarily unavailable</p>' if self.fail_card else (FIXTURES/'wdta-triples.html').read_text()
        if page=='p_ladders.php':return '<table><tr><th>Club</th><th>Pts</th><th>%</th></tr><tr><td>Home</td><td>7.5</td><td>123.4</td></tr></table>'
        if page=='fixture.php':
            if which=='1':return '<select id="season"><option value="'+c['season']+'" selected>Scoped season</option></select>'+select('team',[('H','Home'),('A','Away')])
            return '<select id="season"><option value="'+c['season']+'" selected>Scoped season</option></select><table><tr><th>Rd</th><th>Date</th><th>Home</th><th>Away</th></tr><tr><td>1</td><td>1 Nov 26</td><td>Home (9:00)</td><td>Away</td></tr><tr><td></td><td>8 Nov 26</td><td>No Play</td><td></td></tr><tr><td>Grand Final - 15 Nov 26</td></tr></table>'
        if page=='clubs.php':
            if controls:return '<table><tr><th>Address</th><th>Phone</th></tr><tr><td>1 Example Street</td><td>0000</td></tr></table>'
            return select('club',[('H','Home Club')],id='club_select')
        if page=='ladders.php':
            if controls:return '<table><tr><td>Awards</td></tr></table><iframe src="awards.php"></iframe>'
            return select('daytime',[('AA','Saturday AM'),('WN','Wednesday Night'),('XX','Club Award')])
        if page=='awards.php':return '<table><tr><td>Home Club</td><td>6.6667</td></tr></table>'
        raise AssertionError((page,controls,params))
    def close(self):self.closed=True


class CollectionTests(unittest.TestCase):
    def test_crlf_cache_reuses_exact_source_bytes(self):
        class CRLFClient(FakeClient):
            def read(self, *args, **kwargs):
                return super().read(*args, **kwargs) + '\r\n<p>Unchanged source</p>\r\n'
        with tempfile.TemporaryDirectory() as tmp:
            first = CRLFClient()
            store = Store(tmp, first.association)
            original, _ = store.read(first, 'index.php')
            second = CRLFClient()
            cached, _ = store.read(second, 'index.php')
            self.assertEqual(cached, original)
            self.assertEqual(second.calls, [])
            self.assertEqual(store.cached, 1)

    def test_all_observed_cards_parse_real_roster_sizes_and_all_schedule_rows(self):
        expected={'wdta-triples':(3,3,6),'wdta-rubbers':(2,2,3),'bdnta-singles-doubles':(3,3,6),'erta-green':(3,3,6),'ldnta-incomplete':(4,4,6)}
        for name,counts in expected.items():
            with self.subTest(name=name):
                data=parse_scorecard((FIXTURES/(name+'.html')).read_text())
                self.assertTrue(data['normalised'])
                self.assertEqual((len(data['home_roster']),len(data['away_roster']),len(data['matches'])),counts)
                self.assertEqual([m['order'] for m in data['matches']],list(range(1,counts[2]+1)))
                self.assertFalse(any(p['name'] is None for m in data['matches'] for p in m['home_players']+m['away_players']))
        incomplete=parse_scorecard((FIXTURES/'ldnta-incomplete.html').read_text())
        self.assertEqual(sum(not m['has_score'] for m in incomplete['matches']),4)
        blackburn=parse_scorecard((FIXTURES/'bdnta-singles-doubles.html').read_text())
        self.assertEqual(blackburn['matches'][-1]['score'],'5-6')

    def test_live_card_structures_cover_all_twelve_directories(self):
        sources={'wdta':'wdta-triples','bdnta':'bdnta-singles-doubles','erta':'erta-green','ldnta':'ldnta-incomplete',**{k:k+'-live-card' for k in ['brta','bdta','dvta','hdta','metro','mdjta','nejta','nentg']}}
        self.assertEqual(set(sources),set(ASSOCIATIONS))
        for association, fixture in sources.items():
            with self.subTest(association=association):
                parsed=parse_scorecard((FIXTURES/(fixture+'.html')).read_text())
                self.assertTrue(parsed['normalised']);self.assertGreater(len(parsed['matches']),0)
                self.assertGreater(len(parsed['home_roster']),0)

    def test_missing_names_and_emergencies_are_not_invented_or_reordered(self):
        html=(FIXTURES/'wdta-triples.html').read_text().replace('Home Player 3','').replace('<td>\xa0</td><td>1. Home Player 1','<td>X</td><td>1. Home Player 1')
        data=parse_scorecard(html)
        # Original code sequence 2+3 is preserved, including the source gap.
        self.assertEqual(data['matches'][0]['home_codes'],['2','3'])
        self.assertEqual(data['matches'][0]['home_players'][1]['name'],'')
        self.assertEqual(data['home_roster'][0]['name'],'Home Player 1')

    def test_result_links_status_rows_and_opaque_ids_are_kept(self):
        rows=parse_results(RESULTS)
        self.assertEqual(len(rows),2);self.assertEqual(rows[0]['native_match_id'],'same')
        self.assertEqual(rows[0]['source_cells'][1:4],['8','6','37'])
        self.assertIsNone(rows[1]['native_match_id'])
        self.assertIn('Wash Out',rows[1]['source_cells'])

    def test_unknown_cards_keep_tables_and_are_explicitly_unrecognised(self):
        card=parse_scorecard('<table><tr><td>New layout</td><td>7-6</td></tr></table>')
        self.assertFalse(card['normalised']);self.assertEqual(card['tables'][0]['rows'][0][1]['text'],'7-6')

    def test_wrong_cookie_or_server_selection_fails_instead_of_mixing_scopes(self):
        html='<select id="daytime"><option value="AA" selected>Saturday</option><option value="WN">Wednesday</option></select>'
        validate_selection(html,{'daytime':'AA'})
        with self.assertRaises(RuntimeError):validate_selection(html,{'daytime':'WN'})
        with self.assertRaises(RuntimeError):validate_selection(html,{'daytime':'XX'})

    def test_name_selectors_and_empty_merged_cells_survive(self):
        self.assertEqual(options(select('club',[('H','Club')],id='club_select'),'club')[0]['value'],'H')
        data=document('<table><tr><td rowspan="2">A</td><td colspan="3"></td></tr></table>')
        self.assertEqual(data['tables'][0]['rows'][0][1],{'text':'','rowspan':'1','colspan':'3'})

    def test_full_collection_covers_history_draws_cards_clubs_and_awards_and_resumes(self):
        with tempfile.TemporaryDirectory() as tmp:
            client=FakeClient();report=Collector('wdta',tmp,client=client).run()
            self.assertTrue(report['complete'],report['errors']);self.assertTrue(client.closed)
            self.assertEqual(len(report['sections']),3);self.assertEqual(len(report['seasons']),3)
            self.assertEqual(len(report['clubs']),1);self.assertEqual(len(report['special_standings']),1)
            self.assertEqual(len(report['special_standings'][0]['frames']),1)
            sections=[json.loads((Path(tmp)/'wdta'/s['path']).read_text()) for s in report['sections']]
            self.assertEqual(len({s['id'] for s in sections}),3)
            self.assertEqual(len({s['matches'][0]['path'] for s in sections}),3)
            self.assertTrue(all(len(s['team_draws'])==2 for s in sections))
            self.assertIn('No Play',sections[0]['team_draws'][0]['data']['text'])
            self.assertIn('Grand Final',sections[0]['team_draws'][0]['data']['text'])
            second=FakeClient();resumed=Collector('wdta',tmp,client=second).run()
            self.assertTrue(resumed['complete']);self.assertEqual(second.calls,[])
            self.assertGreater(resumed['requests_cached'],0)
            self.assertEqual(resumed['requests_fetched'],0)

    def test_failed_cards_are_retried_while_successful_pages_resume(self):
        with tempfile.TemporaryDirectory() as tmp:
            failed=Collector('wdta',tmp,client=FakeClient(fail_card=True)).run()
            self.assertFalse(failed['complete'])
            client=FakeClient();recovered=Collector('wdta',tmp,client=client).run()
            self.assertTrue(recovered['complete'])
            self.assertTrue(all(page=='match_popup.php' for page,_,_ in client.calls))
            self.assertEqual(len(client.calls),3)

    def test_scorecard_cache_context_includes_competition(self):
        with tempfile.TemporaryDirectory() as tmp:
            client=FakeClient();store=Store(tmp,client.association)
            _,a=store.read(client,'match_popup.php',params={'matchid':'same','seasonid':'shared'},context={'competition':'AA'})
            _,b=store.read(client,'match_popup.php',params={'matchid':'same','seasonid':'shared'},context={'competition':'WN'})
            self.assertNotEqual(a,b);self.assertEqual(len(client.calls),2)

    def test_refresh_and_corrupt_cache_refetch_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            first=FakeClient();store=Store(tmp,first.association)
            _,relative=store.read(first,'index.php')
            (store.root/relative).write_text('corrupted')
            second=FakeClient();store.read(second,'index.php');self.assertEqual(len(second.calls),1)
            third=FakeClient();Store(tmp,third.association,refresh=True).read(third,'index.php');self.assertEqual(len(third.calls),1)

    def test_partial_or_failed_run_cannot_claim_complete(self):
        with tempfile.TemporaryDirectory() as tmp:
            limited=Collector('wdta',tmp,client=FakeClient(),limit_matches=0).run()
            self.assertFalse(limited['complete']);self.assertFalse(limited['errors'])
        with tempfile.TemporaryDirectory() as tmp:
            report=Collector('wdta',tmp,client=FakeClient(fail_card=True)).run()
            self.assertFalse(report['complete']);self.assertEqual(len(report['errors']),3)
            self.assertEqual(len(report['sections']),3)
            self.assertTrue((Path(tmp)/'wdta'/'manifest.json').exists())

    def test_legacy_association_can_collect_without_current_site_enablement(self):
        with tempfile.TemporaryDirectory() as tmp:
            report=Collector('mdjta',tmp,client=FakeClient('mdjta'),history='current').run()
            self.assertTrue(report['complete']);self.assertEqual(len(report['sections']),2)
            self.assertEqual(report['association'],'mdjta')

    def test_past_only_and_resume_do_not_require_four_digit_season_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            report=Collector('wdta',tmp,client=FakeClient(),history='past').run()
            self.assertTrue(report['complete']);self.assertEqual(len(report['sections']),1)
            self.assertEqual(report['seasons'][0]['label'],'Summer 09/10')

    def test_limited_competitions_do_not_turn_other_competitions_into_awards(self):
        with tempfile.TemporaryDirectory() as tmp:
            report=Collector('wdta',tmp,client=FakeClient(),limit_competitions=1).run()
            self.assertFalse(report['complete'])
            self.assertEqual([s['code'] for s in report['special_standings']],['XX'])

    def test_unscoped_old_draws_cannot_impersonate_the_historical_season(self):
        class UnscopedClient(FakeClient):
            def read(self,page,controls=None,params=None):
                html=super().read(page,controls,params)
                if page=='fixture.php':
                    import re
                    html=re.sub(r'<select id="season">.*?</select>','',html)
                return html
        with tempfile.TemporaryDirectory() as tmp:
            report=Collector('wdta',tmp,client=UnscopedClient(),history='past').run()
            self.assertTrue(report['complete'])
            section=json.loads((Path(tmp)/'wdta'/report['sections'][0]['path']).read_text())
            self.assertEqual(section['team_draws'],[])
            self.assertEqual(section['fixture_page']['availability'],'historical_draw_unavailable')
            self.assertEqual(len(section['result_fixtures']),2)
            self.assertIsNone(section['result_fixtures'][0]['start_time'])
            self.assertTrue(report['warnings'])

    def test_cache_paths_do_not_alias_sanitised_ids(self):
        self.assertNotEqual(asset_key('AA/A'),asset_key('AA:A'))
        self.assertEqual(len(asset_key('../unsafe')),64)


if __name__=='__main__':unittest.main()

