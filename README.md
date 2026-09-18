# BRTA Power Ratings V3

An unofficial BRTA singles power-rating site. The model is opponent-adjusted, scoreline-sensitive, time-weighted and uncertainty-aware.

## V3 model

For player strength `theta`:

- Game probability: `p(i,j) = logistic((theta_i - theta_j) / 0.75)`
- Score likelihood: `L_m = g_i*log(p) + g_j*log(1-p)`
- Real-time decay: `w_m = 2^(-age_days / 365)`
- Regularization: `(5/2) * sum(theta_i^2)`
- Objective: `sum_m w_m*L_m - (5/2)*sum(theta_i^2)`
- Display: `Power_i = 1000 + 250*theta_i`
- Uncertainty: Laplace approximation, `Cov(theta) ≈ H^-1`
- Publication threshold: 4 completed singles matches

V3 deliberately removes V2's separate match-win likelihood because the scoreline already contains the match outcome. This avoids double-counting the same evidence.

Low-data opponents are handled through shrinkage and wider posterior uncertainty rather than a hand-built opponent-reliability multiplier. Expected mismatches also have lower information curvature naturally under the logistic likelihood.

### Parameter selection

The 365-day half-life and `lambda=5` shrinkage were selected using walk-forward development validation over five BRTA section datasets. Earlier rounds were used to fit the model and later rounds were predicted.

On those development folds:

- per-game negative log loss: V2 `0.6640` → V3 `0.6406`
- match-outcome Brier score: V2 `0.1683` → V3 `0.1632`

These are development-validation figures, not an independent external benchmark.

## Site

GitHub Pages can publish the root of `main`. `index.html`, `style.css` and `data.js` are static, so a push to the configured publishing branch updates the site automatically.

## Included baselines

- Section 6, Spring 2026, through Round 9
- Section 9, Autumn 2026, completed season

What-if scoreline experiments are excluded from the baseline site.

## Note

This is an unofficial statistical project and is not affiliated with BRTA, Tennis Australia or UTR.
