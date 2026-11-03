"""Rebuild release history snapshots from the preserved Study33/34 source.

Only the eligibility window changes; the frozen section prior, likelihood,
collision rejection, half-life and regularisation remain the same.
"""
import argparse
import calendar
import collections
import datetime as dt
import gzip
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.sparse import csr_matrix
from scipy.special import expit


def oldest_date(start, years):
    date = dt.date.fromisoformat(start)
    year = date.year - years
    return date.replace(year=year, day=min(date.day, calendar.monthrange(year, date.month)[1])).isoformat()


def eligible_rows(rows, season, snapshot, years):
    oldest = oldest_date(snapshot['start'], years)
    history = [r for r in rows if r['competition'] == snapshot['competition']
               and r['season'] != season and r.get('level') is not None
               and oldest <= r['date'] < snapshot['cutoffExclusive']]
    conflicts = collections.defaultdict(set)
    for row in history:
        for person in row['homePeople'] + row['awayPeople']:
            conflicts[row['date'], person['name']].add(person['team'])
    bad = {name for (_, name), teams in conflicts.items() if len(teams) > 1}
    history = [r for r in history if all(p['usable'] and not p['abbreviated']
               and not re.search(r'unnamed|unknown|emergency|fill.?in', p['name'], re.I)
               and p['name'] not in bad for p in r['homePeople'] + r['awayPeople'])]
    return history, oldest, len(bad)


def fit_discipline(rows, start):
    names = sorted({p['name'] for r in rows for p in r['homePeople'] + r['awayPeople']})
    if not names:
        return {}, {'converged': True, 'maxGradient': 0}
    indices = {name: i for i, name in enumerate(names)}
    rr, cc, vv, wins, totals = [], [], [], [], []
    levels, denominator, counts = np.zeros(len(names)), np.zeros(len(names)), np.zeros(len(names))
    for i, row in enumerate(rows):
        age = (dt.date.fromisoformat(start) - dt.date.fromisoformat(row['date'])).days
        weight = 2 ** (-age / 365)
        total = row['hg'] + row['ag']
        if total <= 0:
            raise ValueError('History contains a nonpositive game total')
        evidence = min(total, 12) * weight
        wins.append(evidence * row['hg'] / total)
        totals.append(evidence)
        for side, sign in [('homePeople', 1), ('awayPeople', -1)]:
            for person in row[side]:
                j = indices[person['name']]
                rr.append(i); cc.append(j); vv.append(sign / len(row[side]))
                levels[j] += weight * row['level']
                denominator[j] += weight
                counts[j] += 1
    design = csr_matrix((vv, (rr, cc)), shape=(len(rows), len(names)))
    centre = -.08 * (levels / np.maximum(denominator, 1e-10) - 10)
    h, total = np.array(wins), np.array(totals)

    def objective(theta):
        eta, delta = design @ theta, theta - centre
        return (float(np.sum(total * np.logaddexp(0, eta) - h * eta) + 1.5 * delta @ delta),
                np.asarray(design.T @ (total * expit(eta) - h)).ravel() + 3 * delta)

    fit = minimize(objective, centre, jac=True, method='L-BFGS-B',
                   options={'maxiter': 350, 'gtol': 1e-7, 'ftol': 1e-12})
    if not fit.success or not np.isfinite(fit.x).all():
        raise ValueError(f'History fit failed: {fit.message}')
    return ({name: {'skill': float(fit.x[i]), 'count': int(counts[i])}
             for i, name in enumerate(names)},
            {'converged': bool(fit.success), 'maxGradient': float(np.max(abs(fit.jac)))})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--template', type=Path, default=Path('web/models/orchestra-history.json'))
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--years', type=int, default=6)
    args = parser.parse_args()
    if args.years < 1:
        parser.error('--years must be positive')
    source = args.source.read_bytes()
    rows = json.loads(gzip.decompress(source))['rows']
    result = json.loads(args.template.read_text())
    result['sourceSha256'] = hashlib.sha256(source).hexdigest()
    result['eligibilityYears'] = args.years
    result['policy'] = (f'Same competition, full-name hypotheses; {args.years}-year source window; '
                        '365-day half-life; L2=3; section slope .08. Identity truth and source '
                        'publication timing not independently verified.')
    for season, snapshot in result['seasons'].items():
        history, oldest, conflicts = eligible_rows(rows, season, snapshot, args.years)
        if not history:
            raise ValueError(f'No eligible history for {season}')
        snapshot.update(oldestEligibleDate=oldest, oldestHistoryDate=min(r['date'] for r in history),
                        latestHistoryDate=max(r['date'] for r in history), rows=len(history),
                        conflictingNames=conflicts, eligibilityYears=args.years, players={}, fitDiagnostics={})
        for discipline in ['Singles', 'Doubles']:
            snapshot['players'][discipline], snapshot['fitDiagnostics'][discipline] = fit_discipline(
                [r for r in history if r['type'] == discipline], snapshot['start'])
        print(season, json.dumps({k: v for k, v in snapshot.items() if k != 'players'}), flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()
