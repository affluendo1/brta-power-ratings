# RM1 — Section 6 Rating 1.0

Source: the original methodology supplied by Jayden on 31 October 2026.
This predates the website-launch model saved in the repository as RM2.
The first 8.3.2 restoration inferred RM1 from the website launch; this supplied
specification corrects that identification.

## Fit

Completed singles only. For players i and j, p = sigmoid(beta_i - beta_j).
A score of 6–2 contributes 6 log(p) + 2 log(1-p). All player coefficients are
fitted jointly, without an intercept. Repeat opponents count each time.

The fixed regularisation is scikit-learn L2 logistic regression C=0.5 with
one observation per game. The equivalent sum-form minimisation is:

    sum_m [(home_games + away_games) * log(1 + exp(beta_home - beta_away))
           - home_games * (beta_home - beta_away)]
    + sum_i beta_i^2 / (2 * C)

The JS Newton solver aggregates identical game observations by match, which
preserves this objective exactly. The independent reference in
`validation/check_rm1.py` expands all games and fits scikit-learn directly;
`tests/fixtures/rm1-sklearn.json` records its coefficients. Regression checks
compare coefficients, including a repeat pairing, sparse player and
disconnected group, to an absolute tolerance of 1e-7.

No doubles, match-win term, team result, lineup-position bonus, prior season,
date decay, serve information, game order or contextual adjustment enters
the fit. There are no estimated uncertainty intervals. Modern valid-score
filtering remains: unfinished/retired/forfeited results do not enter, and
deciding match-tiebreak points are not ordinary games.

## Display and publication

Original scale: R = 1500 + (400 / ln(10)) * beta. Therefore:

    P(i wins a game against j) = 1 / (1 + 10^(-(R_i - R_j) / 400))

The site's 2000 default and optional 1500 centre replace only the origin,
while preserving the scale, gaps and probabilities. Ratings are rounded for
display. Four completed singles matches qualify a player for publication;
players with fewer matches still enter the mathematical network and can be
shown as provisional. Average opponent Power counts each singles meeting
and is a diagnostic, never an additional rating adjustment.

Doubles, Overall and fixture forecasts are unavailable under RM1. Its Player
Lab comparison labels the logistic probability **Predicted game share**,
rather than presenting it as a match-win chance. History is recomputed using
only scorecards through the selected round.

## Original reported experiment

Jayden's supplied report describes 57 players and 136 completed singles
through Round 9. It reports shuffled eight-fold cross-validation over whole
matches, scored using held-out per-game log loss:

| C | Reported game log loss |
|---|---:|
| 0.03 | 0.66673 |
| 0.05 | 0.65694 |
| 0.10 | 0.64325 |
| 0.20 | 0.63274 |
| 0.30 | 0.62950 |
| 0.50 | 0.62843 |
| 1 | 0.63207 |
| 2 | 0.63904 |
| 5 | 0.64918 |
| 10 | 0.65582 |

These figures are supplied historical results, not an experiment rerun in
this release. They selected C=0.5 for game-strength estimation; random folds
are not a chronological forecast evaluation. The supplied leading published
ratings were Elliot Doukas 1699, Athharv Balachandar 1694, Ari Lohia 1664,
Jayden Bone 1649 and Olivia Hansen 1637.

The restored model applies the fixed formula to the selected section's
available scorecards. The available Sets 6 scorecards through Round 9 contain the same 136
singles and 57 players, and reproduce the five leading supplied ratings
exactly. A few later displayed entries differ by one point. Their exact
historical solver settings are unavailable; the restoration keeps the stated
C=0.5 objective and converges tightly rather than hardcoding the supplied
ratings. The independent sklearn coefficient check verifies that objective.
