# BRTA Power Ratings V3

An unofficial BRTA singles power-rating site. The model is opponent-adjusted, scoreline-sensitive, time-weighted and uncertainty-aware.

## V3 model

For player strength `theta`:

- Game probability: `p(i,j) = logistic((theta_i - theta_j) / 0.75)`
- Score likelihood: `L_m = g_i*log(p) + g_j*log(1-p)`
- Match-date recency weighting: `w_m = 2^(-age_days / 365)`, relative to the newest recorded match
- Regularization: `(5/2) * sum(theta_i^2)`
- Objective: `sum_m w_m*L_m - (5/2)*sum(theta_i^2)`
- Display: `Power_i = 1500 + 600*theta_i`
- Uncertainty: centred Laplace approximation, `Cov(P theta) ≈ P H^-1 P^T`, where `P = I - 11^T/n`
- Publication threshold: 4 completed singles matches

V3 deliberately removes V2's separate match-win likelihood because the scoreline already contains the match outcome. This avoids double-counting the same evidence.

The wider 1500-centred display scale is an affine rescaling only; it does not alter match probabilities, ranking order, or predictive calibration. Low-data opponents are handled through shrinkage and wider posterior uncertainty rather than a hand-built opponent-reliability multiplier. Expected mismatches also have lower information curvature naturally under the logistic likelihood.

### Validation

`validation/validate_v2_v3.py` provides a reproducible walk-forward harness for comparing V2 and V3 by game log loss and match-outcome Brier score. Historical development datasets are not currently committed to this public repository, so numerical tuning claims are intentionally not presented as independently reproducible until their input manifest is included.

## Site

GitHub Pages can publish the root of `main`. `index.html`, `style.css` and `data.js` are static, so a push to the configured publishing branch updates the site automatically.

## Included baselines

- Section 6, Spring 2026, through Round 9
What-if scoreline experiments and removed historical datasets are excluded from the live baseline site.

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
- Validates fixture/rubber counts, teams, scorelines, roster consistency and fixture arithmetic before allowing repository data to be replaced
- Commits only when the result CSVs actually change

The sync refuses to guess missing TROLS match IDs. A source-layout change therefore fails loudly instead of fetching a plausible but incorrect scorecard.


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

## Doubles interpretation

The site has two different doubles views:

- **Doubles pairs** rate a recurring pairing as one unit.
- **Individual doubles** estimates partner-adjusted player contribution through an additive pair model. It is experimental: a ranked entry needs at least four appearances, two distinct partners, and no exact non-identifiable direction in the present doubles network.

The individual model still fits all completed doubles results, including provisional players. Repeated pairs also receive an exploratory residual pair signal, conditional on individual ratings and strongly regularised with `lambda=50`; it never changes a leaderboard and is not a causal chemistry claim.

Team Power uses all modelled singles players rather than the public four-match publication cutoff. Low-sample ratings are already regularised toward the 1500 section centre, so this avoids a roster average jumping merely because a player reaches appearance four.

## Development checks

Install the pinned dependencies and run the local regression suite:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python generate_site_data.py
```

The workflow also commits `data/current/last_check.json` on every scheduled check. This intentionally creates a small heartbeat push even when TROLS has not changed, allowing GitHub's built-in repository push-email notifications to report every check. Result-change commits use the message `NEW BRTA RESULTS OUT: ...`; no-change checks use `TROLS check: no new results ...`.

The site header includes a Latest Round button. Its overlay is generated from the newest published round and includes all four fixtures plus top performance, biggest upset, most dominant singles win and closest singles result.
