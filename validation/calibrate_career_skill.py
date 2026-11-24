"""Compare career formulas on later BRTA singles matches between returning players.

Run from repository root with NumPy installed. Select parameters on 2024–Autumn 2026
matches and report Spring 2026 once. The inputs to each forecast come from the last
earlier season in which the player appeared in that same competition.
"""
import csv
import itertools
import json
import re
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
INDEX = json.loads((ROOT / 'data/archive/player-search.json').read_bytes())


def league_round(label):
    match = re.search(r'(autumn|winter|spring|summer)\s+(\d{4}|\d{2})(?!\d)', label, re.I)
    if not match:
        return None
    year = int(match[2])
    if year < 100:
        year += 2000 if year < 70 else 1900
    return year * 4 + ('autumn', 'winter', 'spring', 'summer').index(match[1].lower())


def division(row):
    label = row['sectionLabel'].lower()
    number = re.search(r'\b(?:a\s*)?(\d{1,2})\b', label)
    # Evaluate junior sections where there is an established cross-format order.
    if not number or row['competitionCode'] not in ('UA', 'AA'):
        return None
    if not label.startswith(('sets', 'rubbers', 'section')):
        return None
    return ('green' if 'green' in label else 'rubbers' if label.startswith('rubbers') else 'sets', int(number[1]))


def load_examples():
    sections = INDEX['sections']
    names = defaultdict(lambda: defaultdict(set))
    for player, section, team, *ids in INDEX['entries']:
        if ids and ids[0]:
            names[section][INDEX['players'][player]].add(ids[0])
    rounds = defaultdict(list)
    for i, row in enumerate(sections):
        season, tier = league_round(row['seasonLabel']), division(row)
        if season is None or tier is None:
            continue
        comp = row['competitionCode']
        folder = 'current' if row['isCurrent'] else 'archive'
        path = ROOT / 'data' / folder / 'sections' / row['sectionCode'] / 'singles.csv'
        if not path.exists():
            continue
        with path.open(encoding='utf-8-sig', newline='') as stream:
            for match in csv.DictReader(stream):
                if match.get('valid_for_rating', '').lower() != 'true':
                    continue
                home, away = match.get('home_player'), match.get('away_player')
                h, a = names[i].get(home, ()), names[i].get(away, ())
                if len(h) != 1 or len(a) != 1 or home == away or match.get('winning_player') not in (home, away):
                    continue
                try:
                    gf, ga = int(match['home_games']), int(match['away_games'])
                except (ValueError, KeyError):
                    continue
                if not gf + ga:
                    continue
                rounds[comp, season].append((next(iter(h)), next(iter(a)), tier, match['winning_player'] == home, gf, ga))
    green_base = {'AA': 10, 'UA': 22}
    rubbers_base = {'AA': 2, 'UA': 3}
    previous = defaultdict(dict)
    examples = []
    for (comp, season), matches in sorted(rounds.items()):
        stats = defaultdict(lambda: defaultdict(lambda: np.zeros(4)))
        for home, away, tier, won, gf, ga in matches:
            h, a = previous[comp].get(home), previous[comp].get(away)
            if h and a and season // 4 >= 2024 and season - min(h[0], a[0]) <= 8:
                examples.append((season, won, h[1], a[1]))
            stats[home][tier] += [1, int(won), gf, ga]
            stats[away][tier] += [1, 1 - int(won), ga, gf]
        for player, tiers in stats.items():
            samples = []
            for (kind, number), (count, wins, gf, ga) in sorted(tiers.items()):
                level = 1 - number
                if kind == 'rubbers':
                    level += rubbers_base[comp]
                if kind == 'green':
                    level -= green_base[comp]
                samples.append((level, kind == 'green', count, wins / count - .5, gf / (gf + ga) - .5))
            previous[comp][player] = season, samples
    return examples


def benchmark(examples):
    profiles = list(dict.fromkeys(tuple(profile) for _, _, a, b in examples for profile in (a, b)))
    indices = {profile: i for i, profile in enumerate(profiles)}
    years, winners, left, right = map(np.asarray, zip(*(
        (year, won, indices[tuple(a)], indices[tuple(b)]) for year, won, a, b in examples
    )))
    values = np.zeros((len(profiles), max(map(len, profiles)), 5))
    for i, profile in enumerate(profiles):
        values[i, :len(profile)] = profile
    levels, green, count, win, games = values.transpose(2, 0, 1)
    weights = count.sum(axis=1)
    validation, holdout = years < 2026 * 4 + 2, years >= 2026 * 4 + 2
    best = None
    green_overlap = np.any(green[left] != green[right], axis=1)
    print('Green / non-green previous records in validation / holdout:', (green_overlap & validation).sum(), (green_overlap & holdout).sum())

    def measure(coeff, shrink, win_weight, cap, temperature):
        form = coeff * (win_weight * win + (1 - win_weight) * games) * count / (count + shrink)
        scores = ((levels + (cap * np.tanh(form / cap) if cap else form)) * count).sum(axis=1) / weights
        margin = (scores[left] - scores[right]) / temperature
        losses = np.logaddexp(0, np.where(winners, -margin, margin))
        return float(losses[validation].mean()), float(losses[holdout].mean())

    search = itertools.product((8, 16, 28, 40, 60, 80), (2, 5, 10), (.2, .4, .6, .8, 1), (3, 5, 8, 12), (4, 8, 12, 18, 24, 32))
    for settings in search:
        score = measure(*settings)
        if best is None or score[0] < best[0][0]:
            best = score, settings
    baseline = min((measure(3.56, 5, .6, 0, temp) for temp in (4, 8, 12, 18, 24, 32, 48)), key=lambda score: score[0])
    print('Validation / held-out matches:', validation.sum(), holdout.sum())
    print('Previous form (with common green scale), log loss:', baseline)
    print('Calibrated, log loss:', best[0])
    print('Parameters (form, shrinkage, win weight, form cap, prediction temperature):', best[1])


if __name__ == '__main__':
    benchmark(load_examples())
