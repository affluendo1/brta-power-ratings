# RM4 release methodology

Version 8.3 releases RM4a, RM4b and RM4.1 Ensemble as experimental choices.
RM4.1 Ensemble is the default for visitors without a saved model preference.
Explicit RM3/RM3b preferences remain intact. Settings also offers a 2000 default
rating centre or 1500; a centre change adds a constant and changes no probability,
rank, gap, uncertainty width or rating movement.

## Rating cores

RM4a uses the stopped tennis score likelihood: ordinary terminal sets, set
tiebreak winners and deciding match tiebreaks are distinct observations. Known
match-tiebreak point scores use point log-odds 0.4 times the latent skill gap;
unknown point scores use only the known tiebreak winner. Its joint singles and
individual doubles Gaussian prior has correlation 0.75 and precision parameter 6.

RM4b uses ordinary games plus 0.25 times a composite signal of two units per set
won and four per match won. A match tiebreak contributes two total evidence units,
split by known point share, or allocated to its winner if points are unknown.
Its joint prior has correlation 0.95 and precision parameter 3. Both cores use a
365-day half-life. Individual doubles uses mean partner skill. Pair ratings fit
partnerships separately. Display is centre + 450 × latent skill; uncertainty is
an approximate centred Hessian estimate. Correlated composite evidence and sparse
partner networks limit its interpretation. Existing qualification rules remain.

RM3 remains the original logistic game model, scale 0.75, L2 5 and 365-day
half-life. Display is centre + 600 × its latent skill. RM3b adds set-win weight 2,
match-win weight 4 and bounded match-tiebreak weight 2; RM3 uses one deciding
tiebreak outcome unit. No match-tiebreak points become ordinary game totals.

## Frozen RM4.1 prediction layer

RM4.1 uses RM4b ratings, with a separately calibrated probability blend:

| Component | Weight |
| --- | ---: |
| RM3 | 48.6658615% |
| RM3b | 7.3120520% |
| RM4b | 3.9940740% |
| Native score core | effectively 0% |
| Experience-sensitive Elo | 2.4427601% |
| Frozen gradient boosting | 37.5852524% |

Exact weights, component temperatures, ML learning rate and 40 regression trees
are in `web/models/rm4-frozen.json`. This is a numeric local model, with no external
AI service, names as features, or training in the visitor’s browser. The native
score core has zero practical blend weight and remains for reproducibility.
The ML model was trained on the earlier adult BRTA research corpus, transferred
without retraining to WDTA, and calibrated on the earlier WDTA calibration season.
Additional home/form/context heads were tested but not selected.

Pre-match features include participation, recent game shares, home/away records,
opponent diversity, gaps between appearances and residual variation. Residuals
use forecasts made with strictly earlier rounds and dates. The first three rounds
do not produce learned residual observations. Same-day Elo changes are accumulated
before any are applied. Neither scorecard ordering nor a supposed earlier doubles
result supplies unavailable information. Real surface, injury, weather, service
order and psychological state are not inferred.

## Reserved evaluation and trade-offs

The private package collected 3,314 usable WDTA junior Rubbers across 32 sampled
section-seasons. Winter 2026 supplied the reserved evaluation: **751 forecasts**,
492 singles and 259 doubles, in **eight section-seasons**. Earlier seasons supplied
development and calibration. The sample is label-stratified, not comprehensive
or population-random. Historical source dates are not publication timestamps.
Some earlier BRTA model development occurred in 2026: this is an external
association transfer evaluation, not a claim the entire procedure existed before
all those historical matches.

| Model | Log loss ↓ | Brier ↓ | Correct winners |
| --- | ---: | ---: | ---: |
| RM3 | 0.594135 | 0.203977 | 512/751 (68.18%) |
| RM3b | 0.592807 | 0.202566 | 517/751 (68.84%) |
| RM4b | 0.587756 | 0.202063 | 502/751 (66.84%) |
| RM4.1 Ensemble | 0.582533 | 0.199529 | 511/751 (68.04%) |

The Ensemble improves probability scoring over RM3, **not correct-winner count**.
Its log-loss difference versus RM3 is −0.011602, with a whole-section bootstrap
95% interval [−0.016170, −0.005257]. Its advantage over RM4b remains uncertain:
[−0.017617, +0.005010]. There are only eight clusters; these intervals do not
cover every research choice or cross-season club overlap. The transferred ML
component alone had slightly better test log loss; it was not substituted into
the selected blend after inspecting the test results.

These numerical results apply to the documented WDTA junior sample. The release
does not claim the same gain for BRTA single sets, adults, Green Ball, custom
formats or every archived season. RM4a/RM4b gains individually are not established
universally. Prospective validation and additional untouched sections remain
necessary. No test outcomes were used to retune this release.

## Score distributions and team outlooks

The score generator enumerates legal stopped scores and integrates a shared
match-performance effect, SD 0.75. It adjusts winner mass to the chosen model’s
probability while preserving the conditional score shape. This improves set
correlation without inventing a mental, weather or injury mechanism. The same
generator is available with RM3. Simulations sample the distribution used by
the projections; unknown deciding-tiebreak point detail stays `[TB W]`/`[TB L]`.

On the reserved WDTA sample, the previous RM4b generator predicted 35.88%
deciders versus 24.23% observed. The selected Ensemble generator predicted 22.67%
(singles 21.69% versus 21.34%; doubles 24.53% versus 29.73%). Total-game MAE improved
from 2.482 to 2.321; signed-margin MAE did not improve. RM3 with the same score
calibration had score log loss 4.913937 versus Ensemble 4.908061. That small
advantage is uncertain; the large scoreline gain is mainly shared score modelling.
SD 0.75 was the edge of the tested grid and was retained, not retuned on test data.

Team outcomes combine selected rubber distributions and the section’s scoring
rules, assuming independence between rubbers. Availability and shared team-day
effects are not fully modelled. A single likely scoreline can disagree with the
overall favourite. It is neither a guaranteed result nor a confidence interval.
Order-of-play controls presentation and sampling sequence, without an unverified
same-day results adjustment.

## Integration and checks

Ratings and round snapshots are fitted in a worker. Source scorecards and official
standings are preserved. RM4 snapshots retain existing qualification flags;
missing-discipline evidence remains provisional. Source-generated RM3 expectation,
performance-highlight and matchup-matrix diagnostics are not relabelled RM4.
Player Lab builds its record views from scores and the selected snapshots.
Search indexes remain RM3 until matching individual sections are calculated.
All-history name search retains its identity/season boundaries.

`node tests/test_rm4.js` compares browser calculations against independent Python
research references, with anonymized identities, checks every ensemble component
and ML feature, verifies probability mass and legal scoring, checks seeded Monte
Carlo frequencies and centre invariance. Solver comparison tolerances are 1e-5
for component probabilities and 5e-5 for derived numeric features. Existing model,
source, dialog/navigation, custom-section and UI audits remain part of the checks.
The frozen tree export preserves scikit-learn’s float32 decision inputs.

## 8.3.1 display and band corrections

Ensemble Power is centre + 765 × RM4b latent skill, a 1.7× expansion relative
to RM4b. Uncertainty, interval endpoints, rating history, pair effects and
movement use the same scale. Probability calculations use the corresponding
765-point denominator or the original latent fits; enlarging numbers must not
change forecasts. The centre remains an independent 1500/2000 origin choice.

Eight bands use qualified ratings’ median and IQR / 1.349. Cutoffs in robust
spread units are +2, +1.25, +0.6, +0.1, −0.5, −1.1, −1.8; ties stay together.
Provisional entries use exactly those cutoffs and retain provisional status.
Empty extreme bands are allowed. If no entries qualify, all finite ratings
anchor the distribution. A zero IQR falls back to RMS deviation from the median,
then 100 points for a constant distribution.

RM2 is an optional Extras restoration from `6388eeb3cb0b42fb0a93a02e02b0df5051333baa`,
confirmed by the subsequent V3 upgrade `7055a2c`. Original game scale 0.75,
match scale 0.55, match weight 1.8, L2 0.75, round decay 0.90, display scale 250.
The selected centre replaces its original 1000 origin. Original singles likelihood
is preserved; doubles uses a documented extension to averaged partner strength
or pair identities. Modern valid-score filtering remains, and centred Hessian
uncertainty is added. This is not a claim that RM2 is more accurate.

The round-frozen BRTA diagnostic in `validation/model-check831.json` is generated
by `validation/compare_models.js`. It uses identical targets and strictly earlier
rounds/dates for every model, with at least three earlier rounds and both singles
players previously seen. Sets 6 favours RM3 on log loss but RM3b/RM4b on winner
count; Rubbers 1 favours RM4b on both in these small cohorts. This already-inspected
data was not used to retune coefficients and is not a fresh untouched holdout.
