"""Build BRTA career comparisons from the same revision's player index and CSV scorecards."""
import argparse
import bisect
import collections
import csv
import itertools
import json
import math
import re
import statistics
import unicodedata
from pathlib import Path
from datetime import date, datetime
from functools import lru_cache

MEAN = statistics.mean
MEDIAN = statistics.median
DEFAULT = collections.defaultdict
MIN_MATCHES = 3
MIN_PEERS = 20


def normalise(text):
    return ' '.join(''.join(c for c in unicodedata.normalize('NFKD', text.casefold())
                            if not unicodedata.combining(c) and c not in "'’").split())


def season_order(label):
    match = re.search(r'(autumn|winter|spring|summer)\s+(\d{4}|\d{2})\b', label, re.I)
    if not match:
        return 0
    year = int(match[2])
    if len(match[2]) == 2:
        year += 2000 if year < 70 else 1900
    return year * 4 + ('autumn', 'winter', 'spring', 'summer').index(match[1].lower())


def division(label):
    name = normalise(label)
    number = re.search(r'\d+', name)
    if not number:
        return None
    if 'green' in name:
        family = 'green'
    elif 'girl' in name:
        family = 'girls'
    elif re.match(r'^(?:womens?|ladies)\b', name):
        family = 'women-rubbers' if 'rub' in name else 'women'
    elif re.match(r'^(?:mens?|tuemens)\b', name):
        family = 'men-rubbers' if 'rub' in name else 'men'
    elif re.match(r'^(?:mx|mixed)\b', name):
        family = 'mixed'
    else:
        family = 'open'
    return family, int(number[0]), name.startswith('rubbers') and family == 'open'


def base_club(team):
    name = normalise(team)
    return re.sub(r'(?:\s+(?:navy|maroon|white|red|blue|green|gold|yellow|black|silver|purple|orange|[0-9]+))+$', '', name)


def record_file(root, section, kind):
    area = 'current' if section['isCurrent'] else 'archive'
    return root / 'data' / area / 'sections' / section['sectionCode'] / (kind + '.csv')


@lru_cache(maxsize=8192)
def match_day(value):
    try:
        return date.fromisoformat(value).toordinal()
    except ValueError:
        for pattern in ('%d %b %y', '%d %b %Y', '%d/%m/%Y'):
            try:
                return datetime.strptime(value, pattern).date().toordinal()
            except ValueError:
                pass
    return 0


def performance_sample(stat, offset, level, section):
    matches, wins, games, day = stat[offset:offset + 4]
    if matches < MIN_MATCHES or not day:
        return None
    win_rate = wins / matches
    game_share = games / matches
    # Use the same competition scale in both seasons, and shrink short records towards even.
    result_adjustment = (.60 * win_rate + .40 * game_share - .5) * matches / (matches + 5)
    return {'section': section, 'day': day, 'matches': matches, 'score': level * 100 + result_adjustment * 57,
            'winRate': win_rate * 100, 'gameShare': game_share * 100}


def playing_change(samples):
    ordered = sorted(samples.values(), key=lambda row: row['day'])
    first, last = ordered[0], ordered[-1]
    days = last['day'] - first['day']
    if days < 90:
        return None
    return first, last, days, (last['score'] - first['score']) * 365.25 / days


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('scorecards', type=Path)
    parser.add_argument('index', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    index = json.loads(args.index.read_text())
    sections = index['sections']
    entries = DEFAULT(lambda: DEFAULT(list))
    for name_id, section_id, team, *identity in index['entries']:
        name = index['players'][name_id]
        section = sections[section_id]
        key = ('linked:' + identity[0] if identity and identity[0] else
               json.dumps([section['seasonKey'], section['sectionCode'], name, team], ensure_ascii=False, separators=(',', ':')))
        entries[section_id][normalise(name)].append((normalise(team), key))

    groups = DEFAULT(list)
    for i, section in enumerate(sections):
        value = division(section['sectionLabel'])
        order = season_order(section['seasonLabel'])
        if value and order:
            family, number, rubbers = value
            pool = section['competitionCode'] + '/' + family
            groups[pool, order].append((i, (0 if rubbers else 1, number)))

    levels = {}
    for (pool, order), group in groups.items():
        tiers = sorted(set(tier for _, tier in group))
        for section, tier in group:
            position = tiers.index(tier)
            levels[section] = (pool, order, position + 1, 1 - (position + .5) / len(tiers))

    def identity(section, name, team):
        people = entries[section].get(normalise(name), [])
        exact = {key for label, key in people if label == normalise(team)}
        if len(exact) == 1:
            return next(iter(exact))
        club = base_club(team)
        plausible = {key for label, key in people if club and base_club(label) == club}
        if not plausible:
            plausible = {key for _, key in people}
        return next(iter(plausible)) if len(plausible) == 1 else None

    loaded = set()
    stats = DEFAULT(lambda: DEFAULT(lambda: [0, 0, 0, 0, 0, 0, 0, 0]))
    scorecards = 0
    for i, section in enumerate(sections):
        for kind, offset, name in [('singles', 0, 'player'), ('doubles', 4, 'pair')]:
            filename = record_file(args.scorecards, section, kind)
            if not filename.is_file():
                continue
            loaded.add(i)
            with filename.open(encoding='utf-8-sig', newline='') as stream:
                seen = set()
                for row in csv.DictReader(stream):
                    card = tuple(row.get(k) for k in ('fixture_id', 'position', 'date', 'round'))
                    if row.get('valid_for_rating', '').lower() != 'true' or card in seen:
                        continue
                    try:
                        hg, ag = int(row['home_games']), int(row['away_games'])
                        sides = row['home_' + name], row['away_' + name]
                        winner = normalise(row['winning_' + name])
                    except (KeyError, ValueError):
                        continue
                    if not hg + ag or winner not in [normalise(side) for side in sides]:
                        continue
                    seen.add(card)
                    scorecards += 1
                    day = match_day(row.get('date') or '')
                    for index_side, side in enumerate(('home', 'away')):
                        won = normalise(sides[index_side]) == winner
                        own, other = (hg, ag) if side == 'home' else (ag, hg)
                        for player in sides[index_side].split(' / '):
                            key = identity(i, player, row[side + '_team'])
                            if key:
                                stat = stats[i][key]
                                stat[offset] += 1
                                stat[offset + 1] += won
                                stat[offset + 2] += own / (own + other)
                                stat[offset + 3] = max(stat[offset + 3], day)

    # One primary section per person and ladder per season, chosen by matches played.
    players = DEFAULT(dict)
    active = DEFAULT(list)
    performance = DEFAULT(lambda: DEFAULT(dict))
    for i, records in stats.items():
        if i not in levels:
            continue
        pool, order, tier, level = levels[i]
        for key, stat in records.items():
            singles, sw, sg, _, doubles, dw, dg, _ = stat
            if key.startswith('linked:'):
                for discipline, offset in [('singles', 0), ('doubles', 4)]:
                    sample = performance_sample(stat, offset, level, i)
                    if sample is None:
                        continue
                    seasons = performance[key][pool, discipline]
                    previous = seasons.get(order)
                    if previous is None or sample['matches'] > previous['matches']:
                        seasons[order] = sample
            count = singles + doubles
            if count < MIN_MATCHES:
                continue
            # Shrink short records towards 50%. Weight both wins and games, with singles taking priority when available.
            mix = [1.0 if singles else 0, .65 if singles else 1.0]
            weight = singles * mix[0] + doubles * mix[1]
            win = (sw * mix[0] + dw * mix[1]) / weight
            games = (sg * mix[0] + dg * mix[1]) / weight
            form = (.60 * win + .40 * games - .5) * weight / (weight + 5)
            # A 0–100 ladder position before cross-competition calibration.
            score = level * 100 + form * 57
            row = {'i': i, 'n': count, 'wins': sw + dw, 'rate': win, 'game': games,
                   'level': level * 100, 'tier': tier, 'score': score}
            slot = (pool, order)
            if slot not in players[key] or (count, -tier) > (players[key][slot]['n'], -players[key][slot]['tier']):
                players[key][slot] = row
            if sections[i]['isCurrent']:
                active[key].append((pool, row))

    # Compare improvement rates using historical seasons so unfinished seasons do not move the benchmark.
    active_seasons = {(levels[i][0], levels[i][1]) for i, section in enumerate(sections)
                      if section['isCurrent'] and i in levels}
    cohort_rates = DEFAULT(dict)
    comparisons = DEFAULT(dict)
    for key, ladders in performance.items():
        for (pool, discipline), seasons in ladders.items():
            comparison = playing_change(seasons)
            if comparison:
                comparisons[key][pool, discipline] = comparison
            past = {order: row for order, row in seasons.items() if (pool, order) not in active_seasons}
            baseline = playing_change(past) if past else None
            if baseline:
                cohort_rates[pool, discipline][key] = baseline[3]

    peer_rates = {group: sorted(rates.values()) for group, rates in cohort_rates.items()}
    progress = DEFAULT(dict)
    for key, ladders in comparisons.items():
        for (pool, discipline), (first, last, days, rate) in ladders.items():
            if discipline == 'doubles' and (pool, 'singles') in ladders:
                continue
            group = pool, discipline
            peers = peer_rates.get(group, [])
            own = cohort_rates[group].get(key)
            count = len(peers) - (own is not None)
            percentile = None
            if count >= MIN_PEERS:
                low = bisect.bisect_left(peers, rate - 1e-8)
                high = bisect.bisect_right(peers, rate + 1e-8)
                correction = 0
                if own is not None:
                    correction = 1 if own < rate - 1e-8 else .5 if abs(own - rate) <= 1e-8 else 0
                percentile = round(100 * (low + .5 * (high - low) - correction) / count)
            def endpoint(row):
                return {'season': sections[row['section']]['seasonLabel'], 'date': date.fromordinal(row['day']).isoformat(),
                        'score': round(row['score'], 1), 'matches': row['matches'],
                        'winRate': round(row['winRate'], 1), 'gameShare': round(row['gameShare'], 1)}
            progress[key][pool] = {'discipline': discipline, 'days': days, 'first': endpoint(first), 'last': endpoint(last),
                                   'change': round(round(last['score'], 1) - round(first['score'], 1), 1),
                                   'percentile': percentile, 'peers': count}

    # Same person and season, across competitions in the same family. Each player's median counts once.
    overlaps = DEFAULT(lambda: DEFAULT(list))
    latest = max(level[1] for level in levels.values())
    for key, history in players.items():
        if not key.startswith('linked:'):
            continue
        by_season = DEFAULT(list)
        for (pool, order), row in history.items():
            if latest - order <= 22:
                by_season[order, pool.split('/')[1]].append((pool, row))
        for appearances in by_season.values():
            for (left, a), (right, b) in itertools.combinations(sorted(appearances), 2):
                overlaps[left, right][key].append(a['score'] - b['score'])

    graph = DEFAULT(list)
    edges = []
    for (left, right), people in sorted(overlaps.items()):
        values = [(key, MEDIAN(scores)) for key, scores in people.items()]
        train = [score for key, score in values if int(key[-4:], 16) % 5]
        test = [score for key, score in values if not int(key[-4:], 16) % 5]
        if len(values) < 15 or len(train) < 10 or len(test) < 3:
            continue
        shift = MEDIAN(train)
        uncalibrated = MEDIAN(abs(x) for x in test)
        error = MEDIAN(abs(x - shift) for x in test)
        if error > max(18, uncalibrated + 7):
            continue
        edges.append((left, right, len(values), round(shift, 1), len(test), round(error, 1), round(uncalibrated, 1)))
        weight = math.sqrt(len(values)) / (10 + error)
        graph[left].append((right, -shift, weight))
        graph[right].append((left, shift, weight))

    component, offsets = {}, {}
    for pool in sorted({pool for pool, _, _, _ in levels.values()}):
        if pool in component:
            continue
        component[pool] = pool
        nodes = [pool]
        for node in nodes:
            for other, _, _ in graph[node]:
                if other not in component:
                    component[other] = pool
                    nodes.append(other)
        offsets.update(dict.fromkeys(nodes, 0))
        for _ in range(100):
            for node in nodes[1:]:
                neighbours = graph[node]
                offsets[node] = sum((offsets[other] + shift) * weight for other, shift, weight in neighbours) / sum(
                    weight for _, _, weight in neighbours)

    section_comparisons = {}
    season_sections = DEFAULT(list)
    for i, (pool, order, _, level) in levels.items():
        if stats.get(i) and latest - order <= 22:
            season_sections[order].append((i, pool, level * 100 + offsets[pool]))
    for same_season in season_sections.values():
        for i, pool, strength in same_season:
            alternatives = []
            for other, count, error in [(right if left == pool else left, count, error)
                                         for left, right, count, _, _, error, _ in edges if pool in (left, right)]:
                candidates = [(j, abs(strength - score)) for j, op, score in same_season if op == other]
                if candidates:
                    j, distance = min(candidates, key=lambda pair: pair[1])
                    # Do not report matches beyond the source ladder's coverage.
                    if distance <= max(10, error * .6):
                        alternatives.append([sections[j]['sectionLabel'], sections[j]['competitionLabel'], count, error])
            if alternatives:
                section_comparisons[sections[i]['sectionCode']] = alternatives

    rankings = DEFAULT(list)
    samples = DEFAULT(set)
    for key, rows in active.items():
        buckets = DEFAULT(list)
        for pool, row in rows:
            root = component[pool]
            buckets[root].append((pool, row))
            samples[root].add(pool)
        for root, records in buckets.items():
            # Wins and games contribute within each section. Cap the weight of a very busy section.
            weights = [min(12, row['n']) for _, row in records]
            score = sum((row['score'] + offsets[pool]) * weight for (pool, row), weight in zip(records, weights)) / sum(weights)
            rankings[root].append((score, key, sum(row['n'] for _, row in records),
                                   sum(row['wins'] for _, row in records)))
    ranks = DEFAULT(list)
    for root, rows in rankings.items():
        if len(rows) < MIN_PEERS:
            continue
        rows.sort(reverse=True)
        categories = sorted(samples[root])
        rank, previous = 0, None
        for i, (score, key, matches, wins) in enumerate(rows, 1):
            if round(score, 3) != previous:
                rank = i
                previous = round(score, 3)
            ranks[key].append([root, rank, len(rows), matches, wins, len(categories)])

    report = {'association': 'BRTA', 'sections': len(loaded), 'indexedSections': len(sections), 'scorecards': scorecards,
              'progress': progress, 'equivalents': section_comparisons, 'edges': edges,
              'ranks': ranks, 'currentPoolSizes': {root: len(rows) for root, rows in rankings.items()}}
    args.output.write_text(json.dumps(report, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({key: report[key] for key in ('sections', 'indexedSections', 'scorecards', 'edges', 'currentPoolSizes')}, indent=2))


if __name__ == '__main__':
    main()
