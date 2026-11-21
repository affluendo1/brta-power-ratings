# Preparing for associations beyond BRTA

Observed 29 October 2026. All twelve directories are supported by the standalone public-data collector.
This does not add other associations to the ratings website.
Current public version remains 8.2.1.1.

## Research scope

Started at https://www.trols.org.au/ and followed its association links.
Inspected public Results and Past Results controls for all 12 directories:
brta, bdta, bdnta, dvta, erta, hdta, ldnta, metro, mdjta, nejta, nentg, wdta.
The directory describes MDJTA as moving to Bayside from 2026; its old pages
still show 2025 data. Treat it as a separate legacy archive, not a new current
association and not an automatic alias for BRTA's historical player identities.
The accompanying trols-inventory.json contains selector values/labels, not a
bulk copy of results, contacts or player details.

## Observed differences

| Association | Current competition codes | Source considerations |
| --- | --- | --- |
| BRTA | AA AP UA TA TN WA HA | Existing production collector, seven competitions. Award XX appears in Ladders, not regular Results. |
| Waverley / WDTA | AA AP UA UP MN TN WA HA | Summer 26/27, G Series Term 4, Season2 2026, 2026 Season 2. President's Cup, Challenge Cup, Rubbers and Triples sections. |
| Berwick / BDTA | AA UA | Summer 26-27 uses a hyphen, unlike slash labels elsewhere. |
| Blackburn / BDNTA | MN TN WN HN | Night competitions; sample three-player mixed singles/doubles card. |
| Diamond Valley / DVTA | MN TN WN HA HN FN | Friday Night is an additional code; rules/Info are separate navigation content. |
| Eastern Region / ERTA | AA AP UA UP | Sunday PM; green-ball sample has three-player teams and interleaved singles/doubles. |
| Heidelberg / HDTA | TA | Single competition already selected; sections visible immediately. |
| Lilydale / LDNTA | MN TN WN HN | Numbered seasons such as 2026-3; sample card has four players, six doubles rows, some blank scores. |
| Metro Masters | HP | Thursday PM; single competition preselected. |
| NEJTA | AA | Preselected; Girls/Boys, Doubles and JPL sections. Do not infer format just from the code. |
| NENTG | MN TN WN HN | Night competitions; different competition-specific match formats remain to be audited. |
| MDJTA legacy | AA | July-Dec / Feb-June seasons; keep original association and season identity. |

A shared navigation shell does not guarantee identical scorecard markup.
Five real scorecards were inspected and anonymised structural fixtures saved:

| Sample | Main table width | Named roster sizes | Singles / doubles rows |
| --- | --- | --- | --- |
| WDTA Boys Triples C Special 1, round 3 | 97% | 3 / 3 | 3 / 3 |
| WDTA Open S/D Rubbers A 1, round 3 | 97% | 2 / 2 | 2 / 1 |
| BDNTA Thurs Sec 1 S/D, round 10 | 97% | 3 / 3 | 3 / 3 |
| ERTA JDC S/D 1 Green, round 3 | 99% | 3 / 3 | 3 / 3 |
| LDNTA Ladies Sect 1, round 7 | 97% | 4 / 4 | 0 / 6 |

Rows are observed schedule rows, not necessarily completed matches. The Lilydale
sample contains empty scores: retain them as incomplete, never invent a result.
WDTA Rubbers includes multi-set scores. BDNTA's live sample includes 5-6;
its overview explains a tiebreak at five-all. Do not normalize that to 6-7.
Scoring, point allocation, tiebreaks, penalties and qualification must be
verified separately per competition/season before rating integration.

## Working collector

Run `python -m scraper.trols_collect --associations all --history all` to collect
all source-published current and historical seasons, sections, match scorecards,
results, ladders, team draws, public clubs and special award ladders. All twelve
profiles permit collection, including the MDJTA legacy directory. Only BRTA is
currently enabled for the separate public ratings pipeline.

The collector preserves native labels, opaque IDs, roster codes, emergency
markers, row order, raw scores, incomplete rows, merged table cells and links.
It reads the three-table scorecard family structurally at either width without
padding a two- or three-player roster to four. Other layouts are retained as
source tables and HTML with an explicit normalisation warning.

Output lives under `data/trols/<association>/`. Association + competition +
season namespaces prevent cross-source entity collisions. Original HTML, URL,
request controls, hash and fetched time are recorded for every collected page.
Historical draws require explicit season confirmation. If TROLS exposes only
current Fixtures, retain the old season’s Results fixtures and report the gap.
Generic table documents preserve official ladder columns and published fixture
information without applying BRTA scoring, name corrections or colour stripping.

Requests run sequentially within each association (two associations by default,
maximum four), with bounded retries and Retry-After handling. Atomic checkpoints
and hash-verified snapshots let an interrupted run resume. `--refresh` obtains a
new source snapshot. Manifests report failures and explicit validation limits;
partial runs never claim complete coverage. A failed scope does not discard
other associations or sections. All public club selections are enumerated.
Awards discovered in Ladders are stored independently of match competitions.

Use `--history current` or `--history past` to restrict the source scope. Optional
`--limit-competitions`, `--limit-seasons`, `--limit-sections`, `--limit-matches`
and `--limit-clubs` create explicit validation subsets. Limits apply within their
parent scope; omit every limit for a complete collection. A root manifest links
each association manifest. No generated dataset is automatically pushed into
BRTA's current/archive ratings store, and no protected entry workflow is used.

The old selector-only probe remains available:
`python -m scraper.probe_associations --association wdta`.

## Before publishing non-BRTA ratings

Collection now preserves these sources. Before rating them, verify competition
rules and add rating-specific regression fixtures for incomplete/forfeited/retired
outcomes and finals. Replace BRTA-only
section/match-ID validation in that adapter, not globally. Avoid BRTA's four-player
roster assumptions, junior point fallbacks, emergency rules, name corrections,
club aliases and colour stripping. Preserve raw source names and native IDs.
Decide how numbered/term/half-year seasons sort for each association. Keep new
payloads separate until the UI and rating pipeline consume association-scoped
identities. Do not silently merge identically named players or similarly named
clubs across associations.

Sources: each association's public index.php, results.php, p_results.php and
sample match_popup.php; links below are research entry points, not external
APIs or credentialed Club Zone endpoints.
https://www.trols.org.au/wdta/results.php
https://www.trols.org.au/bdnta/results.php
https://www.trols.org.au/erta/results.php
https://www.trols.org.au/ldnta/results.php

## Collector validation — 29 October 2026

Live bounded runs covered every current competition in all twelve directories,
using the first section and one linked scorecard from each. Totals: 43 sections,
43 scorecards, 311 team draws and 12 public club-detail records; zero errors.
A second pass collected the first available past season/section/card for each
association: 12 historical sections/cards and 12 club records, again without errors.
Historical fixture requests could not confirm the requested season; the collector
correctly retained fixtures from the historical Results instead of attaching
current-season team draws. The manifest explicitly states this source limitation.
A Berwick run without a match limit collected all 20 linked scorecards across
two selected sections. These bounded checks are not a full-database download.
Machine-readable counts/scopes are in `trols-collection-validation.json`.
Offline tests cover all twelve observed scorecard structures plus failures,
unknown layouts, cache corruption, refresh, resume, identity collisions,
current/past selection, blank scores and partial-run completeness reporting.
