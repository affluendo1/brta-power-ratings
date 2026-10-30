"""Idempotent current/history correction with a reproducible audit.

Ordinary third sets in adult formats are deliberately left alone. Unknown
points are never reconstructed from legacy 7-6 outcome codes. Source fixture
totals and original score strings are retained independently.
"""
import argparse
import csv
import json
from pathlib import Path

from scraper.score_formats import parse_score, format_score, junior_decider_code


def migrate(root=Path('.'), *, build=False):
    affected = []
    scanned = 0
    for base in ('data/current/sections', 'data/archive/sections'):
        for path in sorted((root / base).glob('*/metadata.json')):
            scanned += 1
            meta = json.loads(path.read_text())
            changed, unknown, actual = 0, 0, 0
            for discipline in ('singles', 'doubles'):
                source = path.parent / (discipline + '.csv')
                with source.open(newline='') as handle:
                    reader = csv.DictReader(handle)
                    fields = list(reader.fieldnames)
                    rows = list(reader)
                dirty = False
                for row in rows:
                    sets = parse_score(row.get('score'), outcome_code=junior_decider_code(meta, discipline))
                    mt = [s for s in sets if s['mt']]
                    if not mt:
                        continue
                    unknown += sum(s['unknown'] for s in mt)
                    actual += sum(not s['unknown'] for s in mt)
                    normal = [s for s in sets if not s['mt']]
                    replacement = {'score': format_score(sets), 'source_score': row.get('source_score') or row['score'],
                                   'home_games': str(sum(s['h'] for s in normal)), 'away_games': str(sum(s['a'] for s in normal)),
                                   'home_sets': str(sum(s.get('winner') == 'home' for s in sets)),
                                   'away_sets': str(sum(s.get('winner') == 'away' for s in sets))}
                    if any(row.get(k) != v for k, v in replacement.items()):
                        row.update(replacement)
                        dirty = True
                        changed += 1
                if dirty:
                    if 'source_score' not in fields:
                        fields.append('source_score')
                    with source.open('w', newline='') as handle:
                        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
                        writer.writeheader()
                        writer.writerows(rows)
            if unknown or actual:
                affected.append({'directory': str(path.parent.relative_to(root)), 'changed_rows': changed,
                                 'unknown_point_deciders': unknown, 'actual_point_deciders': actual})
                if build and 'archive' in base:
                    from generate_site_data import build_section
                    destination = root / 'data/archive/site/sections' / (meta.get('asset_id', meta['section_code']) + '.json')
                    if not destination.exists() or json.loads(destination.read_text()).get('meta', {}).get('scoreSchema') != 2 or changed:
                        payload = build_section(meta, sections_dir=root / base)
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_text(json.dumps(payload, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n')
            if changed:
                print(f'{path.parent.name}: corrected {changed} score rows', flush=True)
    report = {'schema': 2, 'sections_scanned': scanned, 'affected_sections': affected,
              'ordinary_fixture_totals': 'Preserved from TROLS', 'unknown_points': 'Never inferred'}
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true', help='Refit affected historical sections as well as correcting raw rows')
    parser.add_argument('--report', help='Optional path for a local correction report')
    args = parser.parse_args()
    report = migrate(build=args.build)
    if args.report:
        destination = Path(args.report)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(report, indent=2) + '\n')
    print(f"Scanned {report['sections_scanned']} current/historical sections; {len(report['affected_sections'])} contain match tiebreaks")
