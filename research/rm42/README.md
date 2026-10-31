# RM4.2 / RM Foundation-3 — Melody candidate build 2

These are working offline candidates, not released replacements or new defaults.
The proposed flagship pair is RM Foundation-3 (stable rating baseline) and RM4.2
Ensemble (format-aware forecasting). This build does not yet justify promoting either.
No site release number or public model selector changes accompany this branch.

## Implemented

- **RM Foundation-3:** the RM3 game-evidence core with slightly stronger shrinkage
  (latent-space L2 3.25 versus 2.8125), separate singles/doubles skills, no manual
  opponent-strength bonus and 365-day decay.
- **RM4.2 Melody:** one hybrid fitted model combining equal parts stopped-score
  negative log likelihood and composite game/set/match negative log likelihood.
  It solves for one shared set of singles/doubles latent strengths. This is not
  an average of two published rating tables or two forecast probabilities.
  L2 is 5.5; singles/doubles correlation is 0.75; decay is 365 days. A 24-game
  evidence cap limits longer scorecards. These fixed build-2 choices were set
  before rerunning; the assessment seasons have already been inspected.
- Symmetric regularised temperature calibration conditioned on discipline,
  Green Ball/multi-set format and the least-experienced selected player's prior
  appearances. There is no home intercept, player identity feature, or arbitrary
  switch at a particular round. Future rounds matter through prior evidence.
- **RM4.2 Ensemble:** convex probability blend of Foundation-3 and Melody with format/discipline weights
  pooled toward global weights by n/(n+200). Unseen formats fall back to global.
- Frozen serving: model fitting only uses earlier dates AND earlier rounds when
  forecasting a target. Calibration/weights are trained offline on development
  forecasts. Predicting never reads the target outcome.
- The CLI provides separate rating tables and conditional matchup probabilities.
  Ensemble ratings blend latent strengths using the relevant format weights;
  they are a prototype rating definition, not an inversion of match probability.
  Ensemble rating uncertainty is deliberately null because covariance among the
  component fits has not been established. Individual-core intervals remain
  approximate and need coverage testing.

`web/models/rm4.js` only gains optional fit parameters; default parameters and
all existing public model paths remain unchanged. No candidates train themselves
from a user's currently displayed results during serving.

## Evaluation fixed before fitting

44 Saturday/Sunday junior sections, all supported disciplines. Development uses
section IDs not divisible by three and rounds 4–7 (1,797 forecasts). Assessment
uses separate sections with IDs divisible by three and rounds 8–14 (960 forecasts,
15 sections). Every strength fit uses strictly earlier dates and rounds, and all
models share the same target support: every selected player previously appeared
in the relevant discipline. Unknown-player forecasts are therefore not evaluated.
The calibration model does not use round as a predictor; round is a cutoff.

This is retrospective evidence. Some sections appeared in earlier research, so
assessment is not a genuinely new prospective holdout. The new candidates were
specified before this run; no assessment-driven revisions were made. The existing
RM4.1 Ensemble is evaluated with its frozen bundle and pre-match residual features.
The results do not establish future superiority or external-association transfer.

| Model | Assessment log loss ↓ | Brier ↓ | Correct / 960 |
|---|---:|---:|---:|
| RM3 | 0.571569 | 0.194532 | 672 |
| RM Foundation-3 | 0.572104 | 0.194684 | 668 |
| RM4a | 0.559393 | 0.189201 | 679 |
| RM4b | 0.560047 | 0.189203 | 687 |
| RM4.1 Ensemble | 0.561445 | 0.190149 | 682 |
| RM4.2 Melody | 0.559771 | 0.189143 | 675 |
| RM4.2 Ensemble | 0.559771 | 0.189143 | 675 |

The new three-model family replaces the separate RM4.2a/b candidates. Old RM4a/b
remain comparison baselines, not newly renamed candidates.

RM4.2 Ensemble's log-loss difference versus 4.1 is -0.001674, with a
section-bootstrap 95% interval of [-0.012332, +0.009735], spanning zero.
Melody's interval versus RM4b also spans zero. Foundation-3 still worsens the
point estimates relative to RM3. The development fit selected 100% Melody for
all current Ensemble groups and the global fallback, so Melody and Ensemble
currently have identical forecasts and ratings. No minimum Foundation weight is
forced. The architecture can blend them when development evidence supports it;
it does not yet demonstrate an ensemble advantage. No public promotion is justified.

This is a rerun on already-inspected historical assessment data, not a new holdout.
The previous a/b build remains in Git history; its scores do not describe Melody.

## Reproduce and use

From the repository root (Node, no extra packages):

```sh
node research/rm42/test.js
node research/rm42/evaluate.js data/site/sections
node research/rm42/intervals.js
node research/rm42/predict.js data/site/sections/UA009.json 'RM4.2 Ensemble'
node research/rm42/predict.js data/site/sections/UA009.json 'RM Foundation-3' research/rm42/example-target.json
```

`evaluate.js` accepts an alternate source directory and output directory as its
first and second arguments. The committed bundle/results use full source data,
not the smaller local UI fixtures. Input SHA256 hashes are in `evaluation.json`;
source files change with TROLS sync, so exact reproduction needs matching inputs.
The committed `forecasts.json.gz.b64` (gzip compressed JSON, base64 encoded) retains every evaluated forecast so aggregate
metrics and intervals can be reproduced without those source files.

For a new target supply ISO date, numeric round, discipline, distinct home/away
player arrays, target games, best-of and tiebreak/Green Ball rules. The CLI removes
all same-round, same-day and future records before fitting. With no target it
prints current rating tables using all completed observations in that source.

## Next development gate

Use development-only, section-grouped folds to select Foundation shrinkage and
calibration complexity; then assess on additional seasons reserved beforehand.
Audit calibration and interval coverage, sparse pairs, newcomers and per-format
regressions. Add pair-specific experience if it survives that test. Keep the
current models available and publish a flagship only with explicit evidence and
format limitations. A higher version number is not the evaluation metric.

## Further research

[Accuracy experiment 01](experiments/accuracy-01/README.md) tests 35 configurations
with development-only selection and 7,196 additional archived forecasts. A
lower-shrinkage, composite-heavy Melody is a promising next candidate. These
experimental choices do not overwrite the bundle or public defaults.
