# BRTA Power Ratings V3

An unofficial BRTA singles power-rating site. The model is opponent-adjusted, scoreline-sensitive, time-weighted and uncertainty-aware.

## V3 model

For player strength `theta`:

- Game probability: `p(i,j) = logistic((theta_i - theta_j) / 0.75)`
- Score likelihood: `L_m = g_i*log(p) + g_j*log(1-p)`
- Real-time decay: `w_m = 2^(-age_days / 365)`
- Regularization: `(5/2) * sum(theta_i^2)`
- Objective: `sum_m w_m*L_m - (5/2)*sum(theta_i^2)`
- Display: `Power_i = 1500 + 600*theta_i`
- Uncertainty: Laplace approximation, `Cov(theta) ≈ H^-1`
- Publication threshold: 4 completed singles matches

V3 deliberately removes V2's separate match-win likelihood because the scoreline already contains the match outcome. This avoids double-counting the same evidence.

The wider 1500-centred display scale is an affine rescaling only; it does not alter match probabilities, ranking order, or predictive calibration. Low-data opponents are handled through shrinkage and wider posterior uncertainty rather than a hand-built opponent-reliability multiplier. Expected mismatches also have lower information curvature naturally under the logistic likelihood.

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


## Automatic TROLS sync

The repository now fetches the public BRTA Sunday AM Spring 2026 / Sets 6 results directly from TROLS.

- Scraper: `scraper/sync_trols.py`
- Workflow: `.github/workflows/sync-trols.yml`
- Current source data: `data/current/`
- Runs Sunday, Monday and Wednesday at 7:17 PM Australia/Melbourne time
- Can also be run manually from GitHub Actions
- Re-downloads the whole section so late entries and score corrections are detected
- Validates fixture/rubber counts before allowing repository data to be replaced
- Commits only when the result CSVs actually change

The sync currently maintains the raw fixture, singles and doubles CSVs. Website rating regeneration from those CSVs is a separate pipeline step.


## Automatic site regeneration

Every TROLS check now runs the full data pipeline:

1. Fetch and validate the complete public Section 6 fixture, singles and doubles data.
2. Refit V3 singles ratings.
3. Refit recurring doubles-pair ratings.
4. Refit partner-adjusted individual doubles ratings.
5. Rebuild team power, ladder points, Player Lab match data and the latest-round overview.
6. Regenerate `data.js`.
7. Commit and push the result so GitHub Pages republishes automatically.

The generator is `generate_site_data.py`.

The workflow also commits `data/current/last_check.json` on every scheduled check. This intentionally creates a small heartbeat push even when TROLS has not changed, allowing GitHub's built-in repository push-email notifications to report every check. Result-change commits use the message `NEW BRTA RESULTS OUT: ...`; no-change checks use `TROLS check: no new results ...`.

The site header includes a Latest Round button. Its overlay is generated from the newest published round and includes all four fixtures plus top performance, biggest upset, most dominant singles win and closest singles result.
