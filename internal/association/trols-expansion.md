# Preparing for associations beyond BRTA

Observed 29 October 2026. This is source research and read-only infrastructure,
not an announcement that another association is supported in the ratings site.
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

## Development now included

- Association profiles with explicit production enablement; only BRTA enabled.
- BRTA endpoints now come from its fixed profile, preserving existing URLs.
- Landing-directory discovery reports unknown associations without enabling them.
- Per-client sessions isolate cookies and association URLs.
- Opaque native competition/season IDs and namespaced entity identities prevent
  AA001 or AA001031 from colliding across associations or seasons.
- Public selector inspection handles preselected competitions and preserves
  unusual season labels without guessing dates or chronological order.
- Structural scorecard diagnostics identify the three-table layout at either
  width and report observed roster/match counts. Unknown/ambiguous layouts fail
  visibly. Recognition does not mark rating/scoring rules as verified.
- A manual probe saves only to ignored debug/trols-associations/<association>/.
  It never changes data/current, data/archive, rating fits or website menus.

Run from repository root:

```sh
python -m scraper.probe_associations --association wdta
python -m scraper.probe_associations --association wdta --competition AA --section AA021 --match AA021031
```

Identifiers in the second example were observed, not inferred; select current
values from the first report as seasons change. Use --season with an observed
archive-season value. Keep probes small and manual. Do not schedule a full
cross-association crawl yet.

## Before enabling any association

Implement an adapter and regression fixtures for results, ladders, fixtures,
scorecards, incomplete/forfeited/retired outcomes and finals. Replace BRTA-only
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
