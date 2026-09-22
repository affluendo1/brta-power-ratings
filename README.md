# BRTA Power Ratings V3

An unofficial BRTA tennis analytics site covering **every Saturday AM and Sunday AM section in Spring 2026**. It is not affiliated with BRTA, Tennis Australia or UTR.

## Coverage

The automated database discovers sections directly from TROLS rather than keeping a hand-written list. The current season contains:

- Saturday AM: Rubbers, Sets, Green Ball and Girls sections
- Sunday AM: Rubbers 1–3, Sets 1–22 and Green Ball
- official results, scorecards, player order and individual rubbers
- the complete official future draw from TROLS's Fixtures pages

The interface remembers the selected competition and section. Its Results tab reproduces each round and scorecard in a compact mobile-friendly view. Latest Round and Player Lab matches link directly to the corresponding Results panel.

The Ratings page can also search **all current sections** for an individual player. Cross-section search adds the competition/section to every result and opens that player's actual section when selected. It is a discovery tool, not a combined ladder: each section's rating network is fitted independently.

## V3 model

For player strength `theta`:

- Game probability: `p(i,j) = logistic((theta_i - theta_j) / 0.75)`
- Score likelihood: `L_m = g_i*log(p) + g_j*log(1-p)`
- Match-date weighting: `w_m = 2^(-age_days / 365)`
- Regularization: `(5/2) * sum(theta_i^2)`
- Display: `Power_i = 1500 + 600*theta_i`
- Uncertainty: centred Laplace approximation
- Singles publication threshold: 4 completed rubbers

V3 uses one scoreline likelihood rather than separately counting the same result as both games and a win/loss. Rubbers-format multi-set singles count as one contest in the public record while all officially recorded games contribute to the likelihood.

Malformed or incomplete TROLS rows remain visible in Results but are excluded from ratings when a player identity or completed score cannot be established without guessing.


The Analytics page publishes the generated analytical structures:

- **Matchup Lab**: a dense current-model player-v-player singles projection matrix using the section's actual scoring format;
- **Results vs expectation**: a pre-round ledger for every valid singles rubber, plus player-level actual wins, expected wins and expected-versus-actual game share;
- **Section leaders**: within-section dominance against the common 1500 display centre.

Expectation rows use only rating information that existed before the round being evaluated. Players without an earlier rating snapshot enter that match at the neutral 1500 section centre. Public expectation ranks require four singles matches, matching the Singles Power publication threshold.

Historical rating snapshots cover every published round in the official draw. A washout/no-evidence round carries the previous fitted state forward so round timelines remain continuous.

## Cross-section leaders

Sections are disconnected opponent networks, so their raw leader ratings are not presented as proof that one section's player would beat another's. The Analytics **Section Leaders** table ranks **within-section dominance**:

`expected game share vs the section-average 1500 player = logistic((leader_power - 1500) / 450)`

It also displays the leader's gap to the next qualified player. This is a relative dominance comparison, not an absolute cross-section ability ranking.

## Doubles

- **Doubles pairs** rate a recurring pairing as one unit.
- **Doubles players** use `theta_pair = (theta_A + theta_B) / 2`.
- Individual doubles remains experimental. Ranking requires four appearances, two partners and no exact unresolved identifiability direction.
- Overall is the transparent 50/50 average of Singles Power and established Individual Doubles Power.

## Automatic TROLS sync

`scraper/sync_trols.py`:

1. discovers both target competitions and every listed section;
2. loads all result indexes and completed scorecards;
3. loads every team's official TROLS fixture page and deduplicates the section draw;
4. validates match IDs, scorecard teams, duplicate positions, winners and fixture game arithmetic;
5. writes per-section source files under `data/current/sections/<section-code>/`.

The scraper supports standard six-rubber Sets scorecards, Green Ball and Rubbers sections with multi-set singles. TROLS's published team scoring totals are retained. Predictions use format-specific contest logic: ordinary Sets use the standard tiebreak path, Green Ball is first to six games with no tiebreak, and Rubbers singles uses the two-set plus match-tiebreak projection.

`generate_site_data.py` fits every section independently, builds the cross-section summary and writes lazy-loaded site JSON to `data/site/sections/`. Section 6 is embedded in `data.js` as the fast default; other sections load only when selected.

The GitHub Actions workflow runs Sunday, Monday and Wednesday at 7:17 PM Australia/Melbourne time and can also be run manually. Every completed check creates a heartbeat, and the site shows a plain-English one-time toast on a browser's first visit after that check.

## Development

```bash
python -m pip install -r requirements.txt
python scraper/sync_trols.py
python generate_site_data.py
python -m unittest discover -s tests -v
node tests/test_prediction.js
```

The full sync currently covers 44 sections, so the workflow uses a 45-minute timeout and concurrent, retrying HTTP requests.
