"""Independent Rating 1.0 reference; run with numpy/scikit-learn installed.

Expands each game into a separate +/- player observation, exactly as in the
supplied specification. Fixture values are independent of the JS solver.
"""
import json
from pathlib import Path
import numpy as np
import sklearn
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
SCORES = [('A', 'B', 6, 2), ('A', 'B', 6, 1), ('B', 'C', 6, 0),
          ('C', 'A', 4, 6), ('D', 'A', 7, 6), ('C', 'B', 6, 4),
          ('E', 'F', 6, 0)]
names = sorted({p for a, b, _, _ in SCORES for p in (a, b)})
rows, targets = [], []
for a, b, hg, ag in SCORES:
    x = np.zeros(len(names))
    x[names.index(a)], x[names.index(b)] = 1, -1
    rows.extend([x] * (hg + ag))
    targets.extend([1] * hg + [0] * ag)
fit = LogisticRegression(C=0.5, penalty='l2', fit_intercept=False,
                         solver='lbfgs', tol=1e-12, max_iter=1000).fit(rows, targets)
output = dict(source=f'scikit-learn {sklearn.__version__}; expanded per-game rows',
              C=0.5, fit_intercept=False,
              matches=[dict(home=[a], away=[b], hg=h, ag=v, type='Singles',
                            round=i+1, date=f'2026-09-{i+1:02}',
                            winner='home' if h > v else 'away')
                       for i, (a, b, h, v) in enumerate(SCORES)],
              strength=dict(zip(names, fit.coef_[0].tolist())))
path = ROOT / 'tests/fixtures/rm1-sklearn.json'
path.write_text(json.dumps(output, indent=2) + '\n')
print(f'Wrote independent {len(names)}-player, {len(rows)}-game reference to {path.name}')
