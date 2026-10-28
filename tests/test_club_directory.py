import unittest
from scraper.club_directory import club_options,parse_club
from generate_player_search import rating_candidates
PAGE='''<table><tr><td><table><tr><th>Address</th><th>Mailing Address</th><th>Melways</th><th>Club Phone</th></tr><tr><td>Reserve<br>East Road</td><td>PO Box 1</td><td><a onclick="pop_map('Test',-37.9,145);return false;">77 J3</a></td><td>9822 3333</td></tr><tr><td colspan="4"><a href="https://example.com">Website</a></td></tr><tr><td>8 courts</td></tr></table><table><tr><th>Contact</th><th>Name</th><th>Phone</th><th>E-mail</th></tr><tr><td>Junior</td><td>Test Person</td><td>0400 123 456</td><td>example@example.com</td></tr></table></td></tr></table>'''
class DirectoryTests(unittest.TestCase):
 def test_nested_detail_table_and_contacts(self):
  c=parse_club(PAGE,'Test');self.assertEqual(c['address_lines'],['Reserve','East Road']);self.assertEqual(c['phones'],['9822 3333']);self.assertEqual(c['coordinates']['latitude'],-37.9);self.assertEqual(c['contacts'][0]['role'],'Junior');self.assertEqual(c['websites'],['https://example.com']);self.assertIn('8 courts',c['published_details'])
 def test_missing_structure_fails(self):
  with self.assertRaises(RuntimeError):parse_club('<p>Missing</p>','Test')
  self.assertEqual(club_options('<select name="club"><option></option><option value="a">A</option></select>'),[('A','a')])
 def test_history_candidate_cohorts_keep_extremes_and_ties(self):
  rows=[dict(player=str(i),team='A',seasonKey='S',sectionCode='1',rating=i,wins=0,losses=i,gf=0,ga=i,qualified=i>2) for i in range(30)]
  c=rating_candidates({'singles':rows});self.assertTrue(any(r['rating']==29 for r in c['ranked']['singles']));self.assertFalse(any(r['rating']==0 for r in c['ranked']['singles']));self.assertTrue(any(r['rating']==0 for r in c['all']['singles']))
