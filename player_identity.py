"""Conservative links between published player appearances."""

from collections import defaultdict
from itertools import groupby
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


def link(occurrences, aliases=None):
    """Merge compatible histories, leaving equally plausible conflicts unresolved.

    Optional reviewed aliases map (normalized name, club key) to a common
    identity key for known spelling changes and club transfers.
    """
    aliases = aliases or {}
    by_name = defaultdict(list)
    for index, (name, team, days) in enumerate(occurrences):
        name, club = normalized(name), club_key(team)
        if len(name.split()) >= 2 and club and days:
            key = (name, club)
            by_name[aliases.get(key, key)].append(index)
    groups = []
    for indexes in by_name.values():
        dates = {i: set(occurrences[i][2]) for i in indexes}
        members = {i: [i] for i in indexes}
        edges = []
        for offset, i in enumerate(indexes):
            for j in indexes[offset + 1:]:
                if dates[i] & dates[j]:
                    continue
                gap = max((min(dates[i]) - max(dates[j])).days,
                          (min(dates[j]) - max(dates[i])).days, 0)
                if gap <= 550:
                    edges.append((gap, i, j))
        owner = {i: i for i in indexes}
        for _, batch in groupby(sorted(edges), key=lambda edge: edge[0]):
            candidates = defaultdict(set)
            for _, i, j in batch:
                a, b = owner[i], owner[j]
                if a != b and not dates[a] & dates[b]:
                    candidates[a].add(b)
                    candidates[b].add(a)
            # same gap and two possible people? leave that link alone.
            # other links in the group can still work.
            blocked = set()
            for a, neighbors in candidates.items():
                ordered = sorted(neighbors)
                if any(dates[b] & dates[c] for pos, b in enumerate(ordered)
                       for c in ordered[pos + 1:]):
                    blocked.add(a)
            for i, neighbors in candidates.items():
                for j in sorted(neighbors):
                    if i in blocked or j in blocked:
                        continue
                    a, b = owner[i], owner[j]
                    if a == b or dates[a] & dates[b]:
                        continue
                    dates[a].update(dates.pop(b))
                    for entry in members[b]:
                        owner[entry] = a
                    members[a].extend(members.pop(b))
        groups.extend(sorted(group) for group in members.values() if len(group) > 1)
    return sorted(groups)
# BRTA Power Ratings 9.9g
