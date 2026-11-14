"""Conservative links between published player appearances."""

from collections import defaultdict
from datetime import datetime
from functools import lru_cache
import re
import unicodedata


def normalized(value):
    text = unicodedata.normalize('NFKD', str(value or '')).casefold()
    return ' '.join(''.join(c for c in text if not unicodedata.combining(c)
                            and c not in "'’").split())


def club_key(team):
    words = normalized(team).split()
    suffixes = {'red', 'blue', 'white', 'green', 'gold', 'yellow', 'silver',
                'orange', 'purple', 'black', 'navy', 'pink'}
    protected = 2 if words[:2] == ['black', 'rock'] else 1
    while len(words) > protected and (words[-1].isdigit() or words[-1] in suffixes):
        words.pop()
    return ' '.join(words)


@lru_cache(maxsize=8192)
def played_date(value):
    for pattern in ('%Y-%m-%d', '%d %b %y', '%d %b %Y', '%d %B %Y'):
        try:
            return datetime.strptime(str(value), pattern).date()
        except ValueError:
            continue
    return None


def appearances(payload):
    played = defaultdict(set)
    for group in payload.get('results', []):
        for fixture in group.get('fixtures', []):
            day = played_date(fixture.get('date') or group.get('date'))
            if not day:
                continue
            for rubber in fixture.get('rubbers', []):
                score = str(rubber.get('score', ''))
                status = rubber.get('status')
                if status not in ('Completed', 'Retired', 'Unfinished', None, ''):
                    continue
                if not status and (not rubber.get('winner') or re.search(r'\b(?:forfeit|walkover|w/o)\b', score, re.I)):
                    continue
                if not re.search(r'\d+\s*[-–:]\s*\d+', score):
                    continue
                for side in ('home', 'away'):
                    for name in str(rubber.get(side) or '').split(' / '):
                        played[(name.strip(), fixture.get(side))].add(day)
    return played


def link(occurrences):
    """Return groups of entry indexes. A date clash blocks the entire merge."""
    by_name = defaultdict(list)
    for index, (name, team, days) in enumerate(occurrences):
        club = club_key(team)
        if len(normalized(name).split()) >= 2 and club and days:
            by_name[normalized(name), club].append(index)
    groups = []
    for indexes in by_name.values():
        days = {i: occurrences[i][2] for i in indexes}
        neighbors = defaultdict(set)
        for offset, i in enumerate(indexes):
            for j in indexes[offset + 1:]:
                if days[i] & days[j]:
                    continue
                gap = max((min(days[i]) - max(days[j])).days,
                          (min(days[j]) - max(days[i])).days, 0)
                if gap <= 550:
                    neighbors[i].add(j)
                    neighbors[j].add(i)
        seen = set()
        for i in indexes:
            if i in seen:
                continue
            component, queue = [], [i]
            seen.add(i)
            while queue:
                j = queue.pop()
                component.append(j)
                for k in sorted(neighbors[j] - seen):
                    seen.add(k)
                    queue.append(k)
            occupied = set()
            for j in component:
                if occupied & days[j]:
                    break
                occupied.update(days[j])
            else:
                if len(component) > 1:
                    groups.append(sorted(component))
    return sorted(groups)
