import unittest
from scraper.club_foundation import build_foundation,facts,assignment,resolve_venue
from scraper.club_information import parse_club_information
from generate_player_search import compact_complete_rows

class ClubFoundationTests(unittest.TestCase):
    def test_native_club_identity_survives_a_directory_name_change(self):
        def make(key,name):
            return build_foundation({'clubs':[{'id':key,'name':name,'native_club_id':'C42','address_lines':['1 Road']}]},{},aliases={})
        before,after=make('old-name','Old Name'),make('new-name','New Name')
        self.assertEqual(before['clubs'][0]['id'],after['clubs'][0]['id'])
        self.assertEqual(before['clubs'][0]['main_venue_id'],after['clubs'][0]['main_venue_id'])
        self.assertEqual(after['clubs'][0]['native_club_id'],'C42')
    def test_join_aliases_and_distinct_grounds_without_losing_team_or_fixture_scopes(self):
        directory={'clubs':[{'id':'alpha','name':'Alpha','address_lines':['1 Main Street'],'coordinates':{'latitude':-38,'longitude':145},'published_details':['6 synthetic courts','6 synthetic courts']},{'id':'beta','name':'Beta','address_lines':['2 Other Street']}]}
        network={'clubs':[{'observations':[{'team':'Alpha Rockets','team_number':1,'venue_lines':['1 Main Street'],'coordinates':{'latitude':-38,'longitude':145},'playing_at':'Beta','source':{'section_code':'AA001','season_id':'AA50'}},{'team':'Alpha Rockets','team_number':1,'venue_lines':['9 Alternate Road'],'source':{'section_code':'UA001','season_id':'UA50'}}]}]}
        sections=[{'section_code':'AA001','season_id':'AA50','draw':[{'home_team':'Alpha Rockets','draw_id':'r1','round':1,'date':'1 Nov 26','venue_override':'2 Other Street'}]}]
        d=build_foundation(directory,network,sections,aliases={'alpha-rockets':{'club_id':'alpha'}},checked_at='today');alpha=d['clubs'][0]
        self.assertEqual(len(d['clubs']),2);self.assertEqual(len(d['teams']),2);self.assertEqual(len(alpha['venue_ids']),2);self.assertTrue(alpha['review_required']);self.assertEqual(alpha['facts']['courts']['count'],6)
        self.assertEqual([a['scope'] for a in d['venue_assignments']],['team','fixture']);self.assertEqual(d['venue_assignments'][0]['resolved_venue_id'],'brta:club:beta:venue:main');self.assertEqual(d['venue_assignments'][1]['resolved_venue_id'],'brta:club:beta:venue:main');self.assertIsNone(d['clubs'][1]['facts']['courts']);self.assertEqual(resolve_venue(d,d['teams'][0]['id'],'r1')['scope'],'fixture');self.assertEqual(resolve_venue(d,d['teams'][0]['id'],'other')['scope'],'team')
    def test_unknown_labels_and_conflicting_coordinates_are_reviewed_not_merged(self):
        base={'clubs':[{'id':'a','name':'A','address_lines':['1 Street'],'coordinates':{'latitude':-38,'longitude':145}}]}
        n={'clubs':[{'observations':[{'team':'A','venue_lines':['1 Street'],'coordinates':{'latitude':-37,'longitude':146},'source':{}}]},{'observations':[{'team':'Unknown','venue_lines':[],'source':{}}]}]}
        d=build_foundation(base,n,aliases={});self.assertEqual(len(d['venues']),2);self.assertTrue(any(q['kind']=='unresolved_club' for q in d['review_queue']));self.assertEqual(d['venues'][0]['coordinates']['latitude'],-38)
    def test_facilities_and_playing_at_are_preserved_without_empty_generic_fields(self):
        self.assertEqual(assignment('Playing at North Reserve'),'North Reserve');self.assertEqual(assignment('Playing @ Court Park'),'Court Park');self.assertIsNone(assignment('Club contact: Somebody'));self.assertIsNone(assignment('Playing Atlas Tennis'));self.assertIsNone(facts(['Information'])['lighting']);self.assertIsNone(facts(['6 courts','8 courts'])['courts']['count'])
        html='<table><tr><th>Section Information</th></tr><tr><td>1</td><td>Alpha (9:00) Playing at Beta</td><td></td></tr></table>'
        row=parse_club_information(html)[0];self.assertEqual(row['team'],'Alpha');self.assertEqual(row['playing_at'],'Beta');self.assertIn('Playing at',row['raw_team'])
    def test_unknown_explicit_override_does_not_fall_back_to_main_ground(self):
        d={'teams':[{'id':'a','venue_id':'main'}],'venue_assignments':[{'team_id':'a','scope':'fixture','fixture_id':'r1','label':'Temporary ground','resolved_venue_id':None,'source':{}}]}
        self.assertEqual(resolve_venue(d,'a','r1')['status'],'unresolved');self.assertIsNone(resolve_venue(d,'a','r1')['venue_id']);self.assertEqual(resolve_venue(d,'a','r2')['venue_id'],'main')
    def test_playing_at_does_not_pollute_the_team_name(self):
        from scraper.sync_trols import parse_draw_page
        html='<table><tr><th>Rd</th><th>Date</th><th>Home</th><th>Away</th></tr><tr><td>1</td><td>1 Nov 26</td><td>Alpha (9:00) Playing at Beta</td><td>Other</td></tr></table>'
        row=parse_draw_page(html,'AA001')[0];self.assertEqual(row['home_team'],'Alpha');self.assertEqual(row['venue_override'],'Beta');self.assertEqual(row['venue'],'Beta')
    def test_venue_footnotes_join_the_correct_coloured_team(self):
        directory={'clubs':[{'id':'alpha','name':'Alpha'},{'id':'beta','name':'Beta','address_lines':['2 Street']}]}
        network={'clubs':[{'observations':[{'team':'Alpha Gold **','team_number':1,'source':{'section_code':'AA001','season_id':'AA50'}},{'team':'Alpha Green **','team_number':2,'source':{'section_code':'AA001','season_id':'AA50'}}]}]}
        section={'section_code':'AA001','season_id':'AA50','draw':[{'home_team':'Alpha Gold','round':1,'venue_override':'Beta'},{'home_team':'Alpha Green','round':1,'venue_override':'Unknown ground'},{'home_team':'Alpha Green','round':2,'venue_override':'Unknown ground'}]}
        d=build_foundation(directory,network,[section],aliases={})
        self.assertNotEqual(d['venue_assignments'][0]['team_id'],d['venue_assignments'][1]['team_id'])
        self.assertEqual(d['venue_assignments'][0]['resolved_venue_id'],'brta:club:beta:venue:main')
        self.assertTrue(all(a['team_id'] for a in d['venue_assignments']))
        self.assertEqual([r['kind'] for r in d['review_queue']],['unresolved_venue'])
    def test_complete_index_keeps_partnerships_outside_command_extremes(self):
        rows=[{'seasonKey':'UA:1','sectionCode':'UA001','player':'A / B','team':'One','rating':1501,'qualified':True,'dataPath':'one.json','isCurrent':True},{'seasonKey':'UA:0','sectionCode':'UA001','player':'C / D','rating':1000,'qualified':False,'dataPath':'old.json','isCurrent':False}]
        data=compact_complete_rows(rows);self.assertEqual(len(data['entries']),2);self.assertEqual(len(data['sections']),2);self.assertEqual(data['sections'][0]['dataPath'],'one.json');self.assertFalse(data['sections'][1]['isCurrent'])
if __name__=='__main__':unittest.main()
