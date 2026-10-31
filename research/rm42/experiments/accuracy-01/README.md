# Accuracy experiment 01 — results and next step

35 candidate configurations were tested: eight Foundation definitions and 27
Melody/pair-correction combinations. Selection used section-grouped three-fold
out-of-fold forecasts on 1,797 early-round development targets. The PLAN was
written before execution. Candidate definitions and calibration were frozen in
selection.json before the separate archive assessment ran.

Assessment: 7,196 completed rubbers (4,916 singles, 2,280 doubles), 40 sections
from AA55 Autumn 2026 and UA37 Spring 2025. Target players had already appeared
in the relevant discipline. Fits only use earlier rounds AND earlier dates.
These seasons were excluded from this experiment's selection, but are older
than development data: this is historical season-transfer evidence, not a
prospective time-forward guarantee. Individuals can recur across seasons;
no identity-specific coefficients are learned. Source hashes are recorded.

## Frozen selection

- Foundation: L2 1.5 rather than 3.25, with 365-day decay. Calibrated separately.
- Melody: 25% stopped-score / 75% composite loss rather than 50/50; L2 3 rather
  than 5.5. Correlation .75, evidence cap 24 and 365-day decay are retained.
- Pair correction share: zero. Simply blending a separately fitted pair rating
  did not win development selection. Some alternatives tied winner counts but
  had worse probability scores.
- The existing research defaults/bundle are NOT overwritten. Selection files
  describe the next candidates. No public website model or default changes.

| Model | Correct / 7,196 | Accuracy | Log loss ↓ | Brier ↓ |
|---|---:|---:|---:|---:|
| RM3 | 5,127 | 71.25% | .582682 | .198513 |
| Current Foundation-3 | 5,132 | 71.32% | .556601 | .188736 |
| Selected Foundation | 5,137 | 71.39% | .558604 | .189477 |
| RM4b | 5,226 | 72.62% | .544961 | .183410 |
| RM4.1 Ensemble | 5,220 | 72.54% | .549165 | .185145 |
| Current Melody / 4.2 Ensemble | 5,209 | 72.39% | .538740 | .181350 |
| Selected Melody | 5,246 | 72.90% | .538976 | .181430 |

The original fixed Ensemble still uses 100% current Melody; no new blend was
selected on this assessment. Its equal scores are not an independent result.

## What changed, and what did not

Selected Melody improves winner accuracy by 37 results (+0.51 percentage points)
over current Melody. Section-bootstrap 95% interval: +0.11 to +0.89 points.
Its probability scores are marginally worse than current Melody; log-loss
difference +.000236 has interval [-.000870, +.001348].

Against RM4b it gains 20 correct (+0.28 points), but the accuracy interval spans
zero: [-0.14, +0.74] points. The probability-score improvement is clearer:
log-loss difference -.005985, interval [-.008562, -.003668].

Against frozen RM4.1 it gains 26 correct (+0.36 points); accuracy interval
[-0.08, +0.82] points, log-loss difference -.010188 with interval
[-.012962, -.007685]. Intervals resample whole sections, 2,000 deterministic
replicates. They do not account for every possible dependence across sections
or substitute for prospective validation.

Foundation's lighter shrinkage gains only five winners over current Foundation
and worsens log loss by .002003 (interval [.000711, .003349]). Do not promote
that change as a general improvement. Positive temperature calibration preserves
the winner at .5; probability calibration alone cannot improve winner ordering.

## Where the remaining accuracy work is

All 250 winner-pick differences between selected Melody and RM4b occur in
matches where RM4b's favourite had 50–60% probability: 135 rescued and 115 spoiled.
There were no winner changes in the >60% groups, although probabilities changed.
Net winner gains were 16/4,916 singles and 4/2,280 doubles. Green Ball doubles
lost one correct result in only 102 examples; multi-set singles had only 65
examples, so neither supports a strong format-specific claim.

The next step is to validate the frozen selected Melody on additional seasons
reserved in advance and upcoming rounds. Then investigate ranking errors in
near-even matchups using development-only tests: outcome/game evidence balance,
recent performance residuals with strong pooling, and opponent-network support.
Do not manufacture more extreme probabilities: that cannot fix a wrong ordering.
The simple pair-rating blend was rejected; pair interactions need a better pooled
model and more repeated-pair evidence before another attempt. A more elaborate
Ensemble needs genuinely complementary errors, not forced nonzero weights.

## Reproduction

Run from repository root, with the full source-data checkout as the argument:

```sh
node research/rm42/experiments/accuracy-01/run.js /path/to/repo/data
node research/rm42/experiments/accuracy-01/analyse.js
node research/rm42/experiments/accuracy-01/check.js
node research/rm42/test.js
node tests/test_rm4.js
```

The archived forecast record is gzip-compressed JSON encoded as base64. It
supports metric and interval reproduction without the original scorecards.
Calibration bins, format breakdowns and hashes are in assessment.json. The
selection file includes every candidate's development metrics, not only winners.
