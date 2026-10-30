"""Collect the public TROLS Clubs directory."""
from __future__ import annotations
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from bs4 import BeautifulSoup
if __package__:
    from .club_information import clean, club_key, phone_numbers
else:
    from club_information import clean, club_key, phone_numbers
URL = 'https://www.trols.org.au/brta/clubs.php'

def club_options(html):
    select = BeautifulSoup(html, 'html.parser').find('select', attrs={'name': 'club'})
    if select is None:
        raise RuntimeError('TROLS club selector is missing')
    return [(clean(o.get_text()), o['value']) for o in select.find_all('option') if o.get('value')]

def parse_club(html, name):
    soup = BeautifulSoup(html, 'html.parser')
    tables = soup.find_all('table')
    heading = soup.find('th', string=lambda text: text and clean(text) == 'Address')
    details = heading.find_parent('table') if heading else None
    if details is None:
        raise RuntimeError('No club detail table for '+name)
    records = details.find_all('tr')
    cells = records[1].find_all('td', recursive=False)
    if len(cells) < 4:
        raise RuntimeError('Malformed club detail table for '+name)
    record = {'id': club_key(name), 'name': name, 'address_lines': [clean(x) for x in cells[0].stripped_strings],
              'mailing_address_lines': [clean(x) for x in cells[1].stripped_strings], 'melway': clean(cells[2].get_text(' ')),
              'phones': phone_numbers('Ph: '+cells[3].get_text(' ')), 'contacts': [], 'websites': [],
              'source': {'url': URL, 'club': name}}
    for link in cells[2].find_all('a'):
        match = re.search(r"pop_map\(.*?,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)", link.get('onclick',''))
        if match:
            lat, lng = map(float, match.groups())
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                record['coordinates'] = {'latitude':lat, 'longitude':lng}
    for table in tables:
        headers = [clean(c.get_text()) for c in table.find_all('th')]
        if headers[:4] == ['Contact','Name','Phone','E-mail']:
            for row in table.find_all('tr')[1:]:
                values=[clean(c.get_text(' ')) for c in row.find_all('td',recursive=False)]
                if len(values)>=4:
                    record['contacts'].append(dict(zip(['role','name','phone','email'],values[:4])))
    # Additional published website/court details are in the detail table itself.
    for link in details.find_all('a',href=True):
        if link['href'].startswith(('https://','http://')):
            record['websites'].append(link['href'])
    record['published_details']=[clean(row.get_text(' ',strip=True)) for row in records[2:] if clean(row.get_text())]
    return record

def collect_directory(request_get, request_post, workers=6):
    options=club_options(request_get(URL).text)
    if not options:
        raise RuntimeError('TROLS published no clubs')
    def load(option):
        name, value=option
        return {**parse_club(request_post(URL, {'which':'2','style':'','club':value}).text,name), 'native_club_id':value}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        clubs=list(pool.map(load,options))
    return {'version':1,'source':URL,'clubs':sorted(clubs,key=lambda c:c['id'])}
