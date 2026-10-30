# BRTA Power Ratings

**Current version: 8.2.3**

Match tiebreaks use bracketed point scores when available. Legacy TROLS outcome-only
deciders use `[TB W]` / `[TB L]` from the home side’s perspective, with no invented
point scores. Ordinary games, official fixture totals and rating evidence stay separate.
The correction covers current and historical 2026 junior Rubbers sections.
Adult third sets are retained unless the source or verified rules identify a match tiebreak.

Player Lab includes close-set/tiebreak records and, for multi-set matches, first-set
recoveries, straight sets and deciding matches. Doubles-only sections omit Singles
and Overall views. Team Explorer expands to show the full fixture list.

Returning visitors see the changelog once after a newer release. The Ratings
star opens Following management, including the followed-player filter.

[Open the live site](https://affluendo1.github.io/brta-power-ratings/)

The [8.2.1.2 audit report](docs/audit-8.2.1.2.md) records the repaired failure paths, validation and remaining test limits.

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
split by the share of points won when recorded, or assigned by the known outcome
when points are unavailable. RM3 instead uses 1 fixed outcome unit per deciding
match tiebreak. Neither model adds tiebreak points to ordinary games; extended
tiebreaks retain the same bounded weight. Parameters live in `model.py`,
`scraper/score_formats.py` and `web/models/custom-section-model.js`. The deciding
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

BRTA Power Ratings is an unofficial analytics site for BRTA Saturday AM/PM, Sunday AM, Tuesday AM/Night, Wednesday AM and Thursday AM tennis. It is not affiliated with BRTA, Tennis Australia or UTR. Match records come from TROLS and are treated as official-as-entered records; the site does not claim that a nominated player was necessarily the player who physically took the court.

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
- **Club Zone** is under maintenance while the logistics and map experience is prepared.
- **Rounds** combines round highlights with your team’s week-by-week calendar, published no-play dates, starting times and calendar downloads.
- **Settings** contains display preferences, Theme Studio, methodology and BRTA rules. The section picker also links directly to past seasons. A separate control exports the selected section's match and fixture data as CSV.

## Competition and historical coverage

The live scraper discovers the active seasons across all seven published BRTA competitions from TROLS and follows the season IDs TROLS marks as current. Routine checks update those active seasons only; they do not repeatedly fetch finished seasons. The 8.2 live snapshot contains 79 sections: 44 junior morning sections and 35 afternoon/weekday sections. Future section counts depend on what TROLS publishes.

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

Display settings includes a saved match display order for scorecards, labs, predictions and exports. Player Lab lists the selected player first in partnerships; team contexts use lineup order.
Player Lab charts have independent Rating/Ranking tabs. Display also offers rounded graph lines; changing one chart's tab redraws only that chart. Match Explorer uses bold opponent names, italic partner names, and green/red performance comparisons against the relevant context's rating.

The fixture pipeline also maintains a source-attributed club directory in
`data/current/clubs.json`, merged across current Saturday and Sunday sections.
This prepares future Club Zone work; the directory is not displayed in the site.
Venue and contact variations are retained with their original section context.

### Theme Studio and search commands

Settings → Theme Studio creates themes and single-colour schemes with three live
section previews on desktop. Mobile editing is supported with a preview notice.
Saved designs stay in this browser; use the tinted custom lists to reorder, edit,
delete, or double-click a name to rename it. Custom themes accept the built-in and
custom colour schemes. Black + retains its own palette in More Settings.

Ratings → Options lists the rating, record and game-percentage search commands.
Plural rating commands return up to ten rows; singular extremes include ties.
Records compare win percentage, then most wins (best) or most losses (worst).
Game percentage is games won / games played. The history command index preserves
season and section context, qualification and all ties without loading every
section into the browser. Historical command ratings use published RM3 snapshots.

The background Clubs collector stores the full TROLS directory in
`data/current/club-directory.json`, alongside the fixture-derived network. The
dormant `BRTAClubMap.mountNetwork(container, clubs, onClubSelect)` adapter uses
Leaflet 1.9.4 and OpenStreetMap tiles, limits navigation to metropolitan Melbourne,
and passes a club identity to the future Club Zone navigation callback. It is not
mounted anywhere yet and makes no tile requests until explicitly mounted. Leaflet
is vendored under its BSD-2-Clause licence. Its original marker, retina and
layer-control images are now bundled for future map development.

Additional dormant preparation assets, sources and integration notes are listed
in [Club Zone preparation](docs/club-zone-preparation.md). Official-source logos
for all twelve TROLS directories are stored under `assets/associations/`, with
checksums and provenance in `assets/associations/manifest.json`. These assets do
not activate Club Zone or any new homepage, account system or navigation.

### Rounds, Following and Share Cards (8.2)

**Rounds** replaces Latest Round. The overview works with official and custom
sections. Choose a team beside it to see home/away fixtures, published starting
times, no-play weeks and conditional finals dates. Open predictions or results
without leaving Rounds; venue links open the Club Zone maintenance screen.
Download a single fixture or all remaining scheduled fixtures as `.ics` to add
them to a phone or desktop calendar. Times resolve Australia/Melbourne DST per
date. Unknown starting times become all-day events. Calendar files are snapshots,
not subscriptions: re-export after a draw change.

Use **Follow** in Player Lab or Team Lab, then **★ Following** in Ratings. Pins,
preferences and result baselines are stored in this browser. On return, an in-site
overlay reports new or corrected scorecards for those entries. There are no push
notifications or accounts. A pin belongs to one source season and section;
historical snapshots do not silently switch into the next season.

Every result card offers **Share**, including the opened scorecard. Player Lab
and Team Lab offer player and lineup cards too. The editor provides a live preview,
aspect ratios, built-in/custom accent schemes, light/dark backgrounds, and match
display order. Result cards can show full or compact names and optional totals.
Download the exact preview as PNG, or use native file sharing where supported.

Current results now include all seven competitions exposed by TROLS: AA, AP, UA,
TA, TN, WA and HA (79 sections at this release). The Colin and Lin Price Award is
excluded. Additional competitions use observed scorecard match counts and set
lengths, including doubles-only days, eight-game singles, ten-game doubles and
multi-set doubles. Their published ladders and points remain authoritative;
junior washout/forfeit allocations are not applied. Adult predictions describe
observed formats and do not project competition points. Historical coverage
remains the seasons already imported; this release does not claim a new full
backfill of adult competitions.

`web/models/matchday.js` owns calendar dates, ICS generation, scoped following
identities and result-change comparisons. Separate feature modules own Rounds,
Following and canvas share cards. `web/future/club-zone-shell.html` is an unmounted
design template and does not enable Club Zone.

### 8.2.1 presentation and archive expansion

Rounds opens from the header as an overlay. Its month calendar expands individual
fixtures, breaks and conditional finals dates; the round overview remains beside it.
Share images use a balanced scoreboard layout, and every aspect ratio fits fully
inside the preview. Share is available from the small arrow in an opened scorecard.
Following uses gold star controls, beside the player name and in Ratings.

The historical importer supports all seven competition codes and observed adult
formats. The history workflow resumes missing sections and publishes each completed
competition separately. It retains the existing archive and excludes the award
competition. Only successfully imported and fitted sections appear in History.

### Multi-association TROLS collector

The repository can collect public competition data from all twelve TROLS
association directories, including legacy MDJTA. The website's existing BRTA
ratings and scheduled sync remain separate from this source collection.

```sh
# All associations, all published seasons, every section, scorecard and team draw.
python -m scraper.trols_collect --associations all --history all

# Current data for selected associations.
python -m scraper.trols_collect --associations wdta bdta --history current

# Explicit small validation run: partial, never marked complete.
python -m scraper.trols_collect --associations all --history current --limit-sections 1 --limit-matches 1 --limit-clubs 1
```

The output is `data/trols/<association>/`: namespaced JSON records for sections,
scorecards and clubs, plus the original source HTML and request metadata.
Results retain published points/statuses, ladders retain their exact columns,
and team draws retain dates, starting times, venues, no-play weeks and finals.
Historical draws require explicit season confirmation; otherwise only the
fixtures published in that season’s Results are retained, with a recorded gap.
Public club details and special award ladders are included. Credentials and
protected Club Zone pages are outside this public-data collector.

The default covers current and historical seasons. `--history past` collects
only archives. Native season labels and IDs are preserved without assuming
Spring/Autumn or four-digit years. Each association has its own request session.

Interrupted runs resume from verified cached pages; re-run the same command.
Use `--refresh` when you want updated source snapshots. `--workers` controls
association concurrency (default 2, maximum 4). Each manifest records scope,
limits, fetched/cached pages, errors and completion. Failed collections exit
nonzero while keeping completed work. Unknown scorecard layouts retain raw HTML
and table data, with an explicit normalisation warning instead of silent loss.
Generated datasets are ignored by git and do not change the live site's menus.

`python -m scraper.probe_associations --association wdta` remains available for
quick selector-only inspection. See `internal/association/trols-expansion.md`
for source differences and the boundary between collection and rating integration.

### 8.2.2 — partnerships, cards and club foundations

Doubles pairs support section, all-section and historical searches. Search either
partner, then open the partnership in its original section and season. Optional
ratings views keep their selected model when filtering by team.

Share-card previews and PNG downloads support five system fonts and four aspect
ratios. Landscape uses a two-column match layout; square, portrait and story cards
use their own spacing. Player and team cards follow the same chosen presentation.

Team Explorer sits alongside the selected team's lineup and opens its fixtures
without leaving Teams. Prediction Centre uses the compact squad/pair checkbox
style from Custom Section Creator; projected players and partnerships open labs.

Club logistics preparation joins `data/current/club-directory.json` and fixture
observations into `data/current/club-foundation.json`. Club, team and venue IDs
are separate. Reviewed aliases, source provenance, unknown facility fields,
multiple-ground review flags and fixture-specific venue overrides are preserved.
The opt-in BRTA pilot (`?club-pilot=1`) uses a lazy map and an accessible club list,
with separate Logistics and Past stats tabs. It does not enable the general Club
Zone rollout or accounts. Existing historical club statistics remain the source
for the pilot's Past stats view; generated venue data does not rewrite history.

Unlocked Black + has an accent control in normal Display settings. Kâvąc mode
has a floating translator for loaded site text and names. Optional-view additions
remain deliberately vague in the public changelog.

Additional regression suite:

```sh
NODE_PATH=/tmp/brta-ui-tests/node_modules node tests/browser/refinement.cjs
```

### RM4 development

The [RM4 proposal](docs/rm4-proposal.md) describes the next offline model experiments.
RM4 is not a released rating model. To repeat the historical score correction, run
`python -m scraper.migrate_match_tiebreaks --build`, then regenerate current data
and the archive search indexes. The migration is idempotent and preserves source scores.
