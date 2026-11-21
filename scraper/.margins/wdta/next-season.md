# wdta, next time

checked 21 nov 2026. this is for figuring out the import. none of it switches on wdta in the site.

## the selectors

- [live results](https://www.trols.org.au/wdta/results.php) and [fixtures](https://www.trols.org.au/wdta/fixture.php) both listed 42 sunday morning sections for summer 26/27. the field is still called `section` even though the menu says things like `S/D Open Rubbers A Reserve 2`.
- `UA001` was sunday president's cup, `UA009` was A Reserve 2, `UA029` was Triples C 1, `UA037` was Green Ball 1. those codes mean something else in BRTA. keep association, competition, native season and native section ID together.
- leave the source label alone. keep grade, division, format and draw category separate if we can actually identify them. cups, colour of the ball and boys/girls/open can all be in the label. saturday pm can have A 10 and A 2, so use the source order or sort the subdivision as a number.
- [past ladders](https://www.trols.org.au/wdta/p_ladders.php) listed 33 sunday morning season choices including `UA37` Current Season, `UA36` Winter 2026 and `UA4` Summer 10/11. it's a list of available choices, not a coverage guarantee. don't count up the codes to infer missing seasons. `UP` is also present for [G Series](https://www.waverleytennis.asn.au/g-series.html), a term pilot with its own schedule.
- the existing `scraper/trols_collect.py` already keeps association cookies separate and checks the selected season after a form submission. use that; don't copy the BRTA live scraper. match popups use the native scorecard ID and season parameter. historical fixture pages that won't confirm the requested season can't fill in a historical draw.

## scoring bits that actually need different rules

| competition | what to import |
| --- | --- |
| weekend junior singles/doubles rubbers | two singles rubbers and one doubles rubber. two normal sets; a split goes to a 10-point match tiebreak, win by two. the third `7-6` or `6-7` on a card is a marker for that decider, never 13 ordinary games. the team outcome uses rubbers won. |
| weekend yellow triples | three singles and three doubles sets. set tiebreak at 6-6. decide the tie by sets, then games. |
| weekend green triples | same six slots. first to six games, so `6-5` can be a finished set. keep the ball category in the format key. |
| junior L series | three doubles sets of eight **total** games, so `4-4` is a valid draw. sudden-death deuce, no tiebreak. |
| wednesday mid-week men's doubles | six doubles sets aiming for eight games **won**, tiebreak at 7-7. don't reuse the L series rule. |
| night competitions | period and discipline matter. the current overview lists Monday Open Doubles and Tuesday Open Triples as six six-game sets. it also documents a mixed-length singles/doubles format. inspect actual sections before assigning it. |

sources: [summer 26/27 weekend by-laws, especially §§9, 21 and 25](https://www.waverleytennis.asn.au/weekend-by-laws.html), [night competition formats](https://www.waverleytennis.asn.au/nights.html), [night rules](https://www.waverleytennis.asn.au/night-tennis-rules.html), [weekend handbook](https://www.waverleytennis.asn.au/online-handbook.html). older seasons need their own evidence.

## actual cards i checked

three round-four cards per section, 8 nov 2026, nine cards total. all three cup cards had two singles plus one doubles. one had a singles line `6-3 1-6 7-6`; another showed `6-7 4-2`. preserve that latter line and check status separately before deciding what counts. all six C and Green Ball cards had three singles and three doubles. C included `7-5` and `5-7`; Green Ball included `6-5` and `5-6`.

next pass: add small de-identified fixtures for these three families, plus missing rows, emergency players, partial sets, walkovers and washouts. assert the published team totals separately from the sets admitted to the rating engine. the weekend ladder awards points by sets, with a separate tie bonus and partial-play rules, even where match wins are decided by rubbers. check current senior/daytime scorecards, then at least one older season before turning on ratings. the [aggregate checkpoint](../../../data/associations/wdta/README.md) has score frequencies but can't establish who played or which rules applied.
