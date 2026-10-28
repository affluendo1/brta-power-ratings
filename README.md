# BRTA Power Ratings

**Current version: 8.0**

[Open the live site](https://affluendo1.github.io/brta-power-ratings/)

### Version and changelog

Open **Settings → Changelog** to see the latest website update or expand entries
in **Full history**. The Settings version and both views use `web/features/changelog-data.js`.
Entries contain concise user-facing changes; routine results checks are excluded,
and Easter-egg notes remain deliberately vague. Only substantial updates have titles.
Dates use Melbourne time and round to an hour for major/large updates, 30 minutes
for small updates, and 10 minutes for tiny updates. Release numbers use dotted levels: `7.0` is a major release, `7.1` is a feature
update, `7.1.1` is a smaller follow-up, and `7.1.1.1` is a further revision.
Each level counts independently, so `6.10` follows `6.9`. Older compact numbers
are now dotted too: `6.101` becomes `6.1.1` and `7.01` becomes `7.0.1`.
The work previously labelled `7.1`, `7.1.1` and `7.1.1.1` is consolidated into `8.0`.

To publish a website release, prepend an entry with its version, commit timestamp,
size and changes; add a short title only for a substantial update. Bump the data asset version
in `index.html` and `sw.js`, plus the service-worker cache version. Result-sync
commits do not change the website version.

### Custom Section Creator

Turn on **Settings → Show Extras**, then open **Custom Section Creator** above
the Extras toggle. No password is required. Sections are stored locally in your
browser; saving them does not publish them to the official site.

Create a section and choose its season, match counts, scoring format, and separate
singles/doubles set lengths. Add teams and named players in their registered order.
Players can also be unassigned emergency substitutes. Bulk entry accepts one
`Name | Team | Order | E` record per line.

**Teams & players → Edit current roster as text** loads the current active list
as `Name | Team | Order | E`. Edit or replace it, preview the changes, then apply
and save. Matching is by name (ignoring case and extra spaces), so moving a line
or changing registered order preserves the player's ID, matches and scores.
**Use pasted row order as registered order** numbers each team's players from
their order in the text, ignoring the old numbers. Otherwise the Order column
is used; blank orders are numbered automatically. The individual editor also
shows players by team and registered order, and reorders after an Order change.

Omitted players with saved match, squad or pair references move to **History-only
players**, retaining their old matches. Omitted unused players are removed.
Adding a historical name back reactivates the same ID. A changed name is a new
identity in bulk text: use the existing player's individual Name field first for
renames. Team transfers retain the registration attached to earlier appearances
without retroactively marking those appearances as emergencies. Roster previews
are atomic and report duplicates or invalid rows before changing the draft.

The custom **Teams** tab shows the active registered squad in its saved order, actual
round-by-round selections, doubles partnerships, emergencies and suggested lineups. Prediction Centre uses the section's
configured match counts, set lengths and best-of settings, with custom team
scoring. Club Zone entry points currently show a maintenance notice.

For each round, choose the date and fixtures. Tick the matchday squad checkboxes;
registered order is used automatically, and the up/down buttons adjust it.
**First N** and **Last round** shortcuts fill the squads quickly. Matchups are
created automatically once both sides are ready. Existing scores are preserved
unless you explicitly rebuild the matches. You can then edit every singles matchup, doubles pairing,
emergency marker, match position, playing order, score, and status. Set scores
are entered from the home team's perspective. Deciding match tiebreak points
do not count as games. Forfeits and unfinished/retired matches do not enter the
rating model. Quick-score buttons fill common one-set results from either side.
Typing scores automatically completes finished matches and fixtures unless you
turn off the automatic-status checkbox. Tab or Enter moves between score boxes.
Optional home/away competition-point overrides handle manual
adjustments without changing the scorecard or player ratings.

**Section setup → Rating calculation model** chooses RM3 (default) or RM3b for
that custom section. V3B retains V3's logistic scale (0.75), 365-day half-life,
L2 penalty (5), and displayed power scale (1500 + 600θ). Its composite likelihood
adds evidence in game-equivalent units: each normal game has weight 1, each set
win 2, and each match win 4. A deciding match tiebreak contributes 2 units total,
split by the share of points won, including extended tiebreaks. The deciding
tiebreak also counts as a set won. These are explicit initial model weights,
not tuned against a historical validation set. The components are correlated;
the Hessian uncertainty is an approximation for this composite objective.

Both models use only completed played matches. Singles, doubles pairs,
individual doubles, team power and all round snapshots are refitted with the
selected model after saving. Match counts, actual game totals, game percentages,
results and competition points stay unchanged. Match-tiebreak points contribute
to V3B ratings without becoming games. Backups retain the model selection.

**Section setup → Use surnames in doubles pairings** switches compact scorecard
labels from Novak / Andrey to Djokovic / Rublev. It is off by default, saved per
section, and keeps the full names for Player Lab links.

**Doubles pairs** sits beneath each matchday squad. Tick two selected squad
players for D1, D2, and so on; singles order stays independent. Existing pairings
appear automatically, and **Last round** copies the previous pairs too. Changing
a scored pair asks before clearing only that doubles match’s score.

**Save changes** stores the section in this browser. **View section** opens it in
the normal Results, Standings, Ratings, Teams, and Fixtures views under
**My sections**. The blue **Back to editor** button beside Settings returns to
the same editor tab, round, fixture, expanded panels and scroll position during
your visit. Singles, pair, and individual doubles ratings and as-of-round
history are calculated locally. Nothing is added to the official TROLS data.

**Rounds & fixtures → Import fixtures** accepts one round or multiple rounds
from plain text, a pasted spreadsheet table, CSV/TSV, or JSON. Use a header such
as `Round 1 | 2026-10-18`, then one `Home team v Away team` fixture per line.
Optional `S1 | Player A | Player B | 6-4` and
`D1 | Player A / Player C | Player B / Player D | 6-3` lines add matchups or scores.
Teams and players must already exist; they are matched by name without creating
extra teams. Preview the import, tick the desired rounds, and add them to the draft.
Existing rounds are preserved unless **Replace selected existing rounds** is
explicitly checked and confirmed. Save changes after applying an import.

Use **Export backup** or **Back up all** to download JSON copies. **Import backup**
restores or transfers them to another browser; matching section IDs are replaced
only after confirmation. Backups contain your custom competition data.
Clearing site data removes local sections, so keep backups.

BRTA Power Ratings is an unofficial analytics site for BRTA Saturday AM and Sunday AM junior tennis. It is not affiliated with BRTA, Tennis Australia or UTR. Match records come from TROLS and are treated as official-as-entered records; the site does not claim that a nominated player was necessarily the player who physically took the court.

## What the site does

The site lets you select a competition, season and section, then view that section's results, standings, ratings, team summaries and fixtures. Each section is fitted as its own opponent network. Ratings from different sections are not a combined ranking and should not be compared as if the players had all played one another.

The five main views are:

- **Results** — round-by-round fixture results and scorecards, including singles and doubles order where TROLS provides it. A bye occupies its own card in seven-team rounds.
- **Standings** — current-season ladder calculations, or the published final TROLS ladder for an archived season when one is available. The standings view also shows recorded or projected semifinals and grand finals.
- **Ratings** — singles, recurring doubles pairs, individual doubles and Overall tables. Player rows open Player Lab.
- **Teams** — sticky team tabs with compact lineups, doubles configurations, chronological selections, emergencies and suggested squads.
- **Fixtures** — the official TROLS draw, including completed and future fixtures. A recorded fixture opens its result; a scheduled fixture opens the Prediction Centre. Upcoming rounds have a button to simulate their scheduled ties.

Other views are opened from the header or player profiles:

- **Player Lab** includes the player's matchup outlook, actual-versus-expected results, schedule difficulty, form, rating history and doubles evidence. Historical Player Lab views use the selected round's ratings and results.
- **Club Zone** combines colour-suffixed teams into one club and shows its complete Saturday or Sunday AM archive, with club totals and filterable section-by-section standings.
- **Latest round** summarizes the latest round and links to its scorecards.
- **Settings** contains display preferences, season History, methodology and BRTA rules, plus a JSON model-audit export. The section picker also links directly to past seasons. A separate control exports the selected section's match and fixture data as CSV.

## Competition and historical coverage

The live scraper discovers the active Saturday AM and Sunday AM seasons from TROLS and follows the season IDs TROLS marks as current. Routine checks update those active seasons only; they do not repeatedly fetch finished seasons. The checked-in Spring 2026 live snapshot contains 44 sections. Future section counts depend on what TROLS publishes.

The History selector is backed by a separate archive catalogue and set of section files under `data/archive/`. The archive importer reads the past seasons and sections exposed by TROLS, including published scorecards, official fixture order, final ladders and playoffs. Only seasons successfully imported into that catalogue can be selected. TROLS' archive has gaps, so the feature does not imply a complete year-by-year record for both competitions. Missing results and dates are not fabricated.

Historical ratings are refitted from the archived match records using the site's current V3 model. They are retrospective estimates, not historical BRTA or TROLS ratings. Where TROLS publishes a final ladder, its recorded order and points are retained. Where the source has no date or an internal score discrepancy, the importer preserves the source record and records the limitation rather than silently correcting it.

Semifinals and grand finals are shown from TROLS when published. Before a semifinal draw is published, the site projects the 1-v-4 and 2-v-3 matchups only once all 14 regular rounds are present and resolved. Rescheduled or repeated grand-final entries remain separate records; unpublished dates stay blank.

## Ratings

### Singles

For each completed, valid singles rubber, the model treats games as scoreline evidence. If player `i` wins `g_i` games and player `j` wins `g_j` games:

```text
p_ij = logistic((theta_i - theta_j) / 0.75)

weight_m = 2^(-age_days / 365)

maximize  sum_m weight_m * [g_i * log(p_ij) + g_j * log(1 - p_ij)]
          - (5 / 2) * sum_i theta_i^2

Power_i = 1500 + 600 * theta_i
```

`age_days` is measured relative to the newest dated match in that fit, not to the date the site is opened. An undated source record is not assigned an invented postponement interval. The scoreline likelihood already includes whether the player won or lost, so the model does not add a separate win/loss likelihood.

A 100-point Power gap corresponds to a game probability of approximately 55.5% under the fitted model; in general, `p_ij = logistic((Power_i - Power_j) / 450)`. L2 regularization shrinks estimates toward the section centre when evidence is limited. Every valid player result contributes to the opponent network, but the public singles ranking requires four completed singles rubbers.

Displayed uncertainty uses a centred inverse-Hessian (Laplace) approximation. It is an estimate of rating uncertainty under this model, not a guaranteed range of future performance.

### Doubles and Overall

- **Doubles pairs** treat a recurring pair as one rated entity; a pair needs two recorded appearances to qualify for its table.
- **Individual doubles** assumes pair strength is the mean of its players' latent strengths: `theta_pair = (theta_A + theta_B) / 2`. It is experimental because partner patterns can leave some player strengths unidentifiable. In formats with enough partner diversity, publication requires four appearances, at least two partners and an identifiable position in the results network. Two-player Rubbers sections can only provide partner-dependent evidence, which is labelled as such.
- **Overall** is the arithmetic mean of Singles Power and Individual Doubles Power. A ranked Overall entry needs at least four singles rubbers and a publishable doubles contribution; below-threshold entries can be shown as provisional.
- **Team Power** uses every modelled singles rating for that team's average, including ratings below the individual publication threshold. The best-four figure is the mean of its four strongest modelled ratings.

Adaptive rating bands are calculated from qualified entries in the selected section and rating view. They are display groupings; they do not affect fitted Power or ranking order.

### Match predictions and round history

The Prediction Centre converts Power differences to game probabilities, then uses the competition format to estimate rubber and team outcomes. It distinguishes standard Sets, Green Ball and Rubbers singles scoring. Selected players' default singles order is inferred from continuity in previous official playing orders and average position, with TROLS emergency markers kept at the bottom; it is not simply sorted by rating. Users may replace the singles order and choose both doubles pairs from the drafted players. For Sets playoffs, each side may draft up to six players, use four in singles and independently choose four for doubles.

Run Simulation samples each rubber from those same game probabilities and displays one possible scorecard, game totals, set totals and estimated team points. The simulated score is illustrative and can change on every run; the projected win percentages are long-run averages, not a promise about any particular set of 100 runs. The round simulator samples each remaining scheduled fixture using its default lineup. These results do not alter the official TROLS data.

Round-by-round snapshots refit the ratings using results available through each round in the official draw. A round without new valid singles evidence carries the previous state forward. Results-versus-expectation calculations use pre-round ratings; players without an earlier snapshot start at the neutral 1500 section centre.

## Results, standings and BRTA scoring

TROLS is the source for entered fixture results, scorecards, fixture order and current published points. For the current season, the site reconstructs standings from the fixture data, retains published points where available, and applies the 2026 BRTA Weekend Junior By-Laws when a washout or full-team forfeit has no numeric points in the source. Under those rules, Sets and Green Ball use a 4-point team-win / 2-point team-draw base; Rubbers use 2 / 1. Set points are added separately. Current reconstructed ties are ordered by points, then game percentage (games won divided by games lost, multiplied by 100).

For archived seasons, a published TROLS final ladder takes precedence over a reconstructed table. If no final ladder is published, the site reconstructs the table from the available results and labels that limitation. Open **Settings → BRTA rules** for the rule summary and official by-law link.

## Settings and exports

Settings contains display choices, default competition and section selectors, and
separate Methodology and BRTA rules overlays. **RM3** is the default rating model;
**RM3b** is an experimental alternative using game, set, match and match-tiebreak
evidence. History is opened from the home page, alongside the current version.

**Export Section Results** downloads the results CSV without internal fixture IDs.
**Export Complete Section** downloads an HTML report containing ratings, bands,
round history, standings, fixtures and scorecards. Provisional entries can be
shown with the checkbox beside these export links. Rating-model selection lives
at the bottom of Methodology; enabling RM3b requires confirmation. Display also
offers persistent animation and system-font preferences. Custom sections can
choose the number of semifinal positions shown on the ladder.

Extras also reveals More Settings, with optional surprises saved on this device.

## Data flow and automation

```text
TROLS current results and fixture pages
            ↓
scraper/sync_trols.py
            ↓
data/current/
            ↓
generate_site_data.py  →  data/site/ and data.js
            ↓
static site on GitHub Pages
```

`scraper/sync_trols.py` discovers the active competitions and sections, downloads the results and scorecards, reads each team's official draw, validates the records, and writes the current-season source data. `generate_site_data.py` fits the section models and creates the data consumed by the website. The default section is embedded in `data.js`; other section payloads are loaded when selected.

The routine GitHub Actions sync runs daily at approximately 3:07 PM Australia/Melbourne time, and can also be started manually. It runs the regression tests, regenerates the current-season site data, and records a heartbeat. On a later first visit in a browser, the site shows a short plain-English notice describing whether that check found updated results.

Historical importing is separate from routine sync: `scraper/backfill_history.py` fetches the past seasons listed by TROLS, and `generate_archive_site_data.py` builds their rating payloads and History catalogue. The archive workflow is manually dispatchable and code-triggered; normal scheduled checks do not rescan the past.

The site is a static client-side app. Its manifest and service worker support installation on desktop and iOS and cache the app shell. Section data is loaded on demand, so offline access to every section or archived season is not guaranteed.

## Frontend architecture

The site is a static app with no build step. `index.html` declares dependency order;
`sw.js` caches that same release’s shell. Data files remain at their established
URLs so current and archived section payloads continue to load normally.

| Directory | Responsibility |
| --- | --- |
| `web/core/` | Application state, navigation, settings and progressive installation |
| `web/models/` | Pure rating, history, prediction, roster and lab computations |
| `web/features/` | Player/pair labs, Teams, custom editor, search, history and changelog |
| `web/workers/` | Background rating-model recalculation |
| `web/styles/` | Shared design, responsive layouts and feature presentation |
| `web/optional/` | Isolated optional presentation modules |
| `assets/` | Images, fonts and audio |
| `scraper/`, `generate_*.py`, `model.py` | Source ingestion and generated section data |
| `data/current/`, `data/site/`, `data/archive/` | Source records and published payloads |
| `tests/`, `validation/` | Regression checks and model validation |

Models expose small browser APIs and CommonJS exports for direct Node tests.
Feature scripts consume those APIs; the lab model scopes records and ratings to
the selected round before rendering. The background worker imports its model
scripts relative to `web/workers/`. Browser data and asset URLs stay relative to
the site root document. Optional modules are deliberately separate from normal
competition navigation.

## Run locally

Install the pinned Python dependencies, run the tests, then serve the static files over HTTP so the browser can load section JSON:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
node tests/test_prediction.js
python -m http.server 8000
```

Open `http://localhost:8000`. To fetch current data and rebuild its site payloads:

```bash
python scraper/sync_trols.py
python generate_site_data.py
```

To run the full historical backfill locally, use `python -m scraper.backfill_history` followed by `python generate_archive_site_data.py`. This is network-intensive and can take substantially longer than a current-season sync.

`validation/validate_v2_v3.py` contains a walk-forward comparison harness for game log loss and match Brier score. The development datasets used for tuning are not included in this repository, so those historical comparison results cannot be reproduced from the checked-in files alone.

## Disclaimer

This project is an independent statistical analysis of publicly entered competition data. BRTA, Tennis Australia and UTR do not endorse or operate it.

### Search every season

Ratings → Options offers **This section**, **All sections** in the selected season,
and **All history** across all published Saturday and Sunday AM seasons, including
the current season. History results keep each season and section separate; matching
names are not treated as proof of the same person. Select a result to open Player
Lab, then use **Switch to this section** at the top to show that section in the
correct season. The same action is available from existing all-section search.

`generate_player_search.py` builds the compact `data/archive/player-search.json`
index from published section payloads, including named doubles-only and unrated
scorecard participants. `generate_archive_site_data.py` rebuilds it during routine
catalogue refreshes and archive imports. Unpublished archive gaps are reported
rather than silently presented as searched. No new historical results are inferred.

### Team Lab

Choose a team tab to view its squad directly on the Teams page. Ladder position and points
lead the view; the roster shows appearances, usual singles position, frequent
doubles partner and singles Power. The selection grid marks each named player’s
singles/doubles roles for every recorded round, with emergency flags shown
separately. A player named in both disciplines counts once for that day’s
appearance total. Doubles partnership records use the individual doubles match
winner, not the result of the team tie.

Custom sections use active registered player order and retain former squad
members separately in historical selections. Official sections show an observed
squad and usual singles order inferred from scorecards, rather than claiming an
official registration list. Emergency participants are listed with their recorded
rounds and available Power, and are excluded from default main-squad suggestions.
Missing names, incomplete lineups and ambiguous pair-level emergency flags are
not resolved by guessing.

**Best Power lineup** selects the strongest singles players and then finds distinct
doubles pairings for that day. **Finals-style squad** permits one extra player, so
a doubles specialist can play without replacing a member of the singles lineup.
A fifth unused player is labelled Reserve. Pair estimates use mean individual
doubles Power plus the fitted partnership effect, weighted by `n / (n + 3)` where
`n` is that partnership’s recorded appearances; singles Power is an explicit
fallback when doubles Power is unavailable. Standard Sets and Rubbers pairings
are searched exhaustively; unusually large custom formats use a bounded search.
These suggestions follow the section’s match counts and indicate limited or
untested evidence. They do not establish player availability or finals eligibility.

### Player and pair labs

Player Lab combines singles, individual doubles and overall Power with section
ranks, round histories and match explorers. Each chart switches between Power and
ranking. Lineup cards open the team’s order without losing your place. The match
explorer includes doubles, compact opponent names and the player’s partner. If
Pair Power is unavailable, it uses the mean of the two individual doubles ratings
and marks that fallback. Clicking a partnership or the slash between pair members
opens Doubles Pair Lab.

Higher/lower-rated records compare opponents immediately before each match. Equal
pre-match ratings use the selected context’s later rating, then alphabetical
order if still tied. Historical labs never use rounds after their chosen cutoff.
Strength-of-schedule rankings exclude provisional players by default, with an
optional checkbox to include them. Close matches mean a two-game margin in Sets
or a deciding set/tiebreak in Rubbers.

Opening a scorecard layers it above the current view: it does not change tabs.
Team selection remains inline with sticky team tabs, compact registered/observed
lineups, emergencies, doubles configurations and round-selection tables.
