import unittest
from scraper.sync_trols import parse_draw_page, parse_calendar_breaks, observed_rules, DAYTIME_NAMES
from generate_site_data import fixture_points, brta_scoring_rules
class ExpandedCompetitionTests(unittest.TestCase):
    def test_no_play_and_venue_time_are_preserved(self):
        html='''<table><tr><th>Rd</th><th>Date</th><th>Home</th><th>Away</th></tr><tr><td>1</td><td>18 Oct 26</td><td>A (10:00) Playing @ C</td><td>B</td></tr><tr><td></td><td>25 Oct 26</td><td>No Play</td><td></td></tr><tr><td>2</td><td>1 Nov 26</td><td>A</td><td>Bye</td></tr></table>'''
        rows=parse_draw_page(html,'UA009')
        self.assertEqual(rows[0]['start_time'],'10:00');self.assertEqual(rows[0]['venue'],'C')
        self.assertEqual(rows[1]['away_team'],'Bye');self.assertEqual(len(rows),2)
        self.assertEqual(parse_calendar_breaks(html)[0]['date'],'25 Oct 26')
    def test_nonjunior_points_never_use_junior_fallbacks(self):
        rules=brta_scoring_rules({'competition_rules':{'singlesSlots':0,'doublesSlots':4}})
        self.assertEqual(fixture_points({'status':'Wash Out'},rules),(None,None))
        self.assertEqual(fixture_points({'status':'Completed','home_points':7,'away_points':1},rules),(7,1))
    def test_observed_doubles_only_and_long_sets(self):
        section={'singles':[],'doubles':[{'fixture_id':'x','position':'No. '+str(i),'score':'10-8'} for i in range(1,5)]}
        r=observed_rules(section);self.assertEqual(r['singlesSlots'],0);self.assertEqual(r['doublesSlots'],4);self.assertEqual(r['doublesTarget'],10)
        section['doubles'][0]['score']='6-2 6-3';self.assertEqual(observed_rules(section)['doublesBestOf'],3)
        self.assertEqual(set(DAYTIME_NAMES),{'AA','AP','UA','TA','TN','WA','HA'})
if __name__=='__main__':unittest.main()
