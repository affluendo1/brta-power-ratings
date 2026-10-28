"""Read-only preparation for other TROLS associations; never publishes site data.

BRTA's production collector remains deliberately opt-in and separate. Observing
another association's controls is not evidence that its scoring rules are known.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = 'https://www.trols.org.au/'
PUBLIC_PAGES = frozenset({'index.php', 'results.php', 'p_results.php', 'ladders.php',
                          'p_ladders.php', 'fixture.php', 'clubs.php', 'match_popup.php'})


@dataclass(frozen=True)
class Association:
    key: str
    label: str
    active: bool = True
    production_enabled: bool = False

    def __post_init__(self):
        if not re.fullmatch(r'[a-z][a-z0-9]*', self.key):
            raise ValueError('Association key must be a TROLS directory name')

    @property
    def base_url(self) -> str:
        return f'{ROOT}{self.key}/'

    def endpoint(self, page: str) -> str:
        if page not in PUBLIC_PAGES:
            raise ValueError('Only supported public TROLS pages may be requested')
        return urljoin(self.base_url, page)

    def identity(self, kind: str, source_id: str, *, season_id: str) -> str:
        if not all(isinstance(v, str) and v.strip() for v in (kind, source_id, season_id)):
            raise ValueError('Association, season, entity kind and source ID are required')
        # Native IDs are opaque. AA001 in WDTA is unrelated to BRTA AA001.
        return ':'.join(quote(v, safe='') for v in (self.key, season_id, kind, source_id))


ASSOCIATIONS = {a.key: a for a in (
    Association('brta', 'Bayside Regional Tennis', production_enabled=True),
    Association('bdta', 'Berwick & District Tennis'),
    Association('bdnta', 'Blackburn & District Night Tennis'),
    Association('dvta', 'Diamond Valley Tennis'),
    Association('erta', 'Eastern Region Tennis'),
    Association('hdta', 'Heidelberg & Districts Tennis'),
    Association('ldnta', 'Lilydale & Districts Night Tennis'),
    Association('metro', 'Metro Masters Tennis'),
    Association('mdjta', 'Moorabbin & District Junior Tennis', active=False),
    Association('nejta', 'North Eastern Junior Tennis'),
    Association('nentg', 'North Eastern Night Tennis Group'),
    Association('wdta', 'Waverley Tennis'),
)}


def discover_associations(html: str) -> list[dict]:
    """Read only directory links actually listed on the TROLS landing page."""
    found = {}
    for anchor in BeautifulSoup(html, 'html.parser').select('a[href]'):
        url = urlparse(urljoin(ROOT, anchor['href']))
        match = re.fullmatch(r'/([a-z][a-z0-9]*)/index\.php', url.path)
        if url.scheme != 'https' or url.hostname not in {'trols.org.au', 'www.trols.org.au'} or not match:
            continue
        key = match.group(1)
        if key == 'mobile':
            continue
        profile = ASSOCIATIONS.get(key)
        found[key] = {'key': key, 'label': anchor.get_text(' ', strip=True),
                      'base_url': f'{ROOT}{key}/', 'known': profile is not None,
                      'active': profile.active if profile else None,
                      'production_enabled': bool(profile and profile.production_enabled)}
    return list(found.values())


def inspect_controls(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')
    selectors = []
    for select in soup.select('select'):
        options = [{'value': option.get('value', ''), 'label': option.get_text(' ', strip=True),
                    'selected': option.has_attr('selected')} for option in select.select('option') if option.get('value')]
        selectors.append({'id': select.get('id'), 'name': select.get('name'), 'options': options})
    return {'title': soup.title.get_text(' ', strip=True) if soup.title else '',
            'selectors': selectors, 'frames': [frame.get('src', '') for frame in soup.select('iframe')]}


class SourceClient:
    """Own cookies per association. No globals, output mutation or credential flows."""
    def __init__(self, association: str, *, session=None):
        self.association = ASSOCIATIONS[association]
        self.session = session if session is not None else requests.Session()

    def read(self, page: str, *, controls: dict | None = None, params: dict | None = None) -> str:
        url = self.association.endpoint(page)
        if controls is not None and page not in {'results.php', 'p_results.php', 'fixture.php', 'ladders.php', 'p_ladders.php'}:
            raise ValueError('Form submissions are limited to public competition selectors')
        if controls is not None and params is not None:
            raise ValueError('Use either form controls or query parameters')
        if controls is not None:
            response = self.session.post(url, data=controls, timeout=45)
        else:
            response = self.session.get(url, params=params, timeout=45)
        response.raise_for_status()
        expected = urlparse(self.association.base_url)
        actual = urlparse(response.url)
        if actual.hostname not in {'trols.org.au', 'www.trols.org.au'} or not actual.path.startswith(expected.path):
            raise RuntimeError('TROLS response left the selected association')
        return response.text

    def inventory(self) -> dict:
        return {'association': self.association.key, 'base_url': self.association.base_url,
                'production_enabled': self.association.production_enabled,
                'pages': {page: inspect_controls(self.read(page)) for page in ('results.php', 'p_results.php')}}

    def close(self):
        self.session.close()


def scorecard_layout(html: str) -> dict:
    """Recognise the three-table family structurally, not by BRTA's 99% width."""
    soup = BeautifulSoup(html, 'html.parser')
    candidates = []
    for table in soup.select('table'):
        rows = (table.find('tbody', recursive=False) or table).find_all('tr', recursive=False)
        if len(rows) < 2 or len(rows[0].find_all('td', recursive=False)) < 2:
            continue
        nested = rows[1].find_all('table')
        if len(nested) != 3:
            continue
        counts = []
        for roster in (nested[0], nested[2]):
            labels = [td.get_text(' ', strip=True) for td in roster.select('td')]
            counts.append(sum(bool(re.match(r'^(?:E\s+)?(?:X\s+)?\d+\.\s*\S', label)) for label in labels))
        if not all(1 <= count <= 6 for count in counts):
            continue
        singles = doubles = 0
        for row in nested[1].select('tr'):
            if row.select_one('td.separate'):
                continue
            cells = [td.get_text(' ', strip=True) for td in row.find_all('td', recursive=False)]
            if len(cells) != 3:
                continue
            home, _, away = cells
            if re.fullmatch(r'\d+\+\d+', home) and re.fullmatch(r'\d+\+\d+', away):
                doubles += 1
            elif re.fullmatch(r'\d+', home) and re.fullmatch(r'\d+', away):
                singles += 1
        if singles + doubles:
            candidates.append({'family': 'three-table', 'table_width': table.get('width'),
                               'roster_sizes': counts, 'singles_rows': singles, 'doubles_rows': doubles})
    if len(candidates) != 1:
        raise ValueError('Unrecognised or ambiguous scorecard layout; retain source for adapter review')
    return {**candidates[0], 'rating_rules_verified': False}
