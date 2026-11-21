# player history stuff to sort out

snapshot: `data/archive/player-search.json` at BRTA commit `e8939b3` (21 nov 2026 melbourne time).

- 22,920 display names across 1,674 sections and seven competition codes. 95,135 rows mean **name + section + team**, not matches or people. 76,419 rows had a group key.
- 15,937 linked groups. 15,446 spanned more than one season label and 1,413 spanned more than one competition code. 2,441 display names were already split across more than one group. that last number is a reason to show choices in the UI, not a count of confirmed namesakes.
- the current index links normalized full names and club keys when their recorded dates don't clash and the gap is at most 550 days. reviewed aliases cover some name or club changes. one full name alone is weak evidence, and a same-day clash can be a genuine second competition. the index can still show a name that only appears in an incomplete or forfeited result, even if there's no evidence to link it.
- a group key is currently a short hash of its oldest matched appearance. an older backfill or a corrected record can change the anchor. keep these keys inside the current index until durable links can survive those changes.

## first pass for the next update

1. start from the existing section URLs and display appearances in a timeline. keep season and club on every row. if there are several possible groups with the same name, show them separately.
2. keep the source match reference, played date, competition, section, team and recorded player slot for each appearance. record whether the evidence came from an actual score or a roster/result listing. dedupe current vs archive copies before counting totals.
3. namespace WDTA and BRTA identities. preserve a source player ID if a public results endpoint really supplies a stable one. otherwise use reviewed, source-backed links for a confirmed transfer or spelling change. never infer across associations by matching a name. no need to scrape club zone or collect birth dates, emails or other private information.
4. build a review set for same-name players, team colours, changes of club, different dates, same-day conflicts and roster-only matches. test that a corrected or backfilled appearance doesn't silently move a saved profile, and that a WDTA section ID can't attach itself to a BRTA record.

[TROLS' UTR notes](https://trols.org.au/trols_utr_faq.html) describe duplicate names, missing emergency-player details and the gap between ladder scores and match play. [WDTA's public archive selector](https://www.trols.org.au/wdta/p_ladders.php) gives section and season context. neither is a verified cross-association identity directory.
