"""Small read-only source probe. Output never enters production ratings/catalogues."""
from __future__ import annotations
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from .trols_sources import ASSOCIATIONS, SourceClient, inspect_controls, scorecard_layout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--association', required=True, choices=ASSOCIATIONS)
    parser.add_argument('--competition', help='Exact value observed in #daytime')
    parser.add_argument('--section', help='Exact value observed in #section')
    parser.add_argument('--match', help='Exact published match identifier; inspect layout only')
    parser.add_argument('--season', default='', help='Exact TROLS season identifier, if applicable')
    args = parser.parse_args()
    if args.section and not args.competition:
        parser.error('--section requires --competition')
    client = SourceClient(args.association)
    try:
        report = client.inventory()
        if args.competition:
            discovery_page = 'p_results.php' if args.season else 'results.php'
            options = {o['value'] for s in report['pages'][discovery_page]['selectors'] if s['id'] == 'daytime' for o in s['options']}
            if args.competition not in options:
                parser.error('Competition must be an observed selector value')
            controls = {'which': '0', 'style': '', 'daytime': args.competition}
            page = 'p_results.php' if args.season else 'results.php'
            html = client.read(page, controls=controls)
            if args.season:
                seasons = {o['value'] for s in inspect_controls(html)['selectors'] if s['id'] == 'season' for o in s['options']}
                if args.season not in seasons:
                    parser.error('Season must be an observed selector value')
                controls['season'] = args.season
                html = client.read(page, controls=controls)
            report['competition_controls'] = inspect_controls(html)
            if args.section:
                sections = {o['value'] for s in report['competition_controls']['selectors'] if s['id'] == 'section' for o in s['options']}
                if args.section not in sections:
                    parser.error('Section must be an observed selector value')
                html = client.read(page, controls={**controls, 'which': '1', 'section': args.section})
                report['section_controls'] = inspect_controls(html)
        if args.match:
            html = client.read('match_popup.php', params={'matchid': args.match, 'seasonid': args.season})
            report['scorecard_layout'] = scorecard_layout(html)
        report['observed_at_utc'] = datetime.now(timezone.utc).isoformat()
        # Fixed separate destination; never data/current, data/site or data/archive.
        out = Path('debug/trols-associations') / args.association / 'inventory.json'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(json.dumps({'output': str(out), 'association': args.association, 'published': False}))
    finally:
        client.close()


if __name__ == '__main__':
    main()
