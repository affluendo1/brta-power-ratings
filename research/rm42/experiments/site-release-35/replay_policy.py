"""Replay frozen release recipes on saved Study34 predictions.

This reuses three-year research diagnostics already used to select routes.
It does not evaluate the six-year history extension or independent accuracy.
"""
import argparse
import gzip
import json
import math
from pathlib import Path


def logit(p):
    p = max(1e-8, min(1 - 1e-8, p))
    return math.log(p / (1 - p))


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    rows = json.loads(gzip.decompress(args.source.read_bytes()))
    bundle = json.loads(Path('web/models/orchestra-bundle.json').read_text())
    metrics = {n: [] for n in ['RM4a', 'RM4b', 'RM4.1 Ensemble', 'Orchestra Study34 recipe', 'Orchestra release guard']}
    ledger = []
    for row in rows:
        history = row['history']['0.08']
        partial = 0 < history['linked'] < (2 if row['type'] == 'Singles' else 4)
        config = bundle['ordinary'][row['type']]
        beta = config['partialCap'] if partial else 1
        ps = [sigmoid(logit(row['predictions'][n + '/reset']) + beta * history['prior'])
              for n in ['Foundation', 'Melody', 'Orchestra']] + [row['baseline']['RM4b']]
        p = sigmoid(config['temperature'] * logit(sum(w * v for w, v in zip(config['weights'], ps))))
        guarded = row['baseline']['RM4a'] if row['type'] == 'Singles' and partial else p
        for name in metrics:
            value = row['baseline'].get(name, p if name == 'Orchestra Study34 recipe' else guarded)
            metrics[name].append((value, row['y']))
        ledger.append({'id': row['id'], 'type': row['type'], 'partial': partial, 'y': row['y'], 'p': guarded})
    summary = {name: {'n': len(values),
                     'correct': sum((p >= .5 - 1e-12) == bool(y) for p, y in values),
                     'logLoss': sum(-y * math.log(p) - (1 - y) * math.log1p(-p) for p, y in values) / len(values)}
               for name, values in metrics.items()}
    output = {'interpretation': __doc__, 'tiePolicy': 'Home choice at 0.5 within 1e-12', 'metrics': summary, 'ledger': ledger}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
