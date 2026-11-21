# Association hub preparation — not released

Checked 29 October 2026 (Melbourne). This is preparation for an unofficial
competition-information hub, not a claim of BRTA endorsement.

## Colin & Lyn Price Award / Shield

Sources:
- BRTA 2026 Junior By-Laws, clause 19.9, page 10:
  https://www.baysidetennis.asn.au/wp-content/uploads/2026/01/BRTA-By-Laws-Weekend-Junior-Final-18.1.26.pdf
  Indexed text verified; direct PDF retrieval returned 404 on this check.
- Live TROLS Ladders → Colin & Lyn Price Award (cloud browser):
  https://www.trols.org.au/brta/ladders.php
  Selector `daytime=XX`, iframe `awards.php`.

The by-laws call it the Colin & Lyn Price Shield. It covers Saturday AM juniors.
Use final home-and-away ladder positions, not finals results or Power ratings.
First earns 8 points, second 7, down to eighth 1. Sum all team awards for a club
and divide by its number of entered teams. Highest average wins.
Example: positions 1, 3 and 6 yield (8+6+3)/3 = 5.6667.

The live TROLS award page explicitly requires at least THREE Junior Saturday
teams for eligibility. This condition is not stated in clause 19.9's indexed
text; preserve both sources and verify current rules before release.
The live table has Place, Club Name, Teams, Points. Points is the averaged
score, displayed to four decimals. Shared positions are shown as `=1`, `=5`, etc.
Snapshot: Parkdale and St Pauls each have 3 teams and 6.6667, sharing first.
This is a current-season snapshot, not a declared final winner.

## Future data contract

Keep `XX` outside normal competitions and rating fitting. Store award standings
separately, with source URL, observed time, season, display place, club,
entered-team count, decimal score, eligibility and provisional/final status.
Retain source club names and map to a canonical club identity separately.
Use published award standings as authoritative; any locally derived estimate
must be labelled provisional and reconciled against the published source.
Do not infer withdrawal/bye treatment, fewer-than-eight-team adjustments,
section exclusions, rounding tie-breaks or historical rule changes yet.

## Future hub

`associationHubTemplate` is an inert HTML template. The logo's
`data-association-hub-target` identifies the future mount point. No event
listener, keyboard action, link, button styling or route enables it today.
Future release should add an accessible button and the normal dialog handling.
Planned areas: competition overview, club award standings, honours/rules.
Use existing theme tokens, overlays and responsive layout.

Other research leads in the same by-laws: Phyl Crowther, Ron Cummins and
Larraine (Larry) McLean shields. Verify eligibility, competition and season
before integrating; do not apply the club-award formula to player awards.
