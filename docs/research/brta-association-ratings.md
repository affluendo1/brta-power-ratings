# Association-wide BRTA ratings and player progression

## Decision under review

Build a BRTA-specific strength rating and ranking from linked match histories. Publish singles first, with an independent doubles model after validation. Use the rating to compare competition strength, interpret a player's season, and study promotion. The work in this draft is research.

UTR Sports is a useful product reference. Its public explanation compares the recorded score with the expected result against the opponent and weights recent eligible matches. A BRTA implementation should estimate its own scale from BRTA scorecards. For example, 1500 could represent a fixed historical reference cohort and 200 points could represent a calibrated difference in game-winning odds. The actual scale and odds conversion should be selected in the prototype and documented before release. [UTR Sports algorithm overview](https://www.utrsports.net/blogs/news/back-to-basics-what-is-utr-and-how-does-it-work)

## What the existing evidence supports

The 9.9 preview analysis previously covered 382,535 rating-eligible scorecard entries across 1,674 sections. Its simple crosswalk supported Saturday AM ↔ Sunday AM and Thursday AM ↔ Wednesday AM under that prototype's overlap checks. This is a prior snapshot, with neither an audit of today's data nor a demonstration that all seven competition families sit on a single identifiable scale.

The preview's playing-level measure uses match win rate, game share and relative section position. This is descriptive and useful as a baseline. A stronger model must learn the difference between adjacent sections from matches and linked players. Two ladders can have the same number of sections and very different distributions of skill. Club ladder finish reflects the whole team and can be shown as context.

Before fitting, inventory matches, dated scores, named sides, unique opponents, identity confidence and overlap by competition, division family, season and ball format. Count distinct bridge players and use their dates. Twenty repeats from the same person do not establish the same evidence as twenty independent players. Preserve historically supported club/team identities. Audit conflicting simultaneous appearances, ambiguous names, club transfers and score corrections before letting them connect large pools.

## Rating model

### Observations

| Input | Treatment |
| --- | --- |
| Completed singles | Main evidence. Validate completed formats and official scoring conventions. |
| Completed doubles | Fit a separate participant-strength model, with optional shrunk pair effects tested on recurring pairs. |
| Walkovers, byes, unplayed or unscored matches | Exclude from skill fitting. |
| Retirement and shortened rubbers | Exclude by default. Test completed sets from partial matches in a sensitivity run. |
| Match tiebreak | Retain as limited separate evidence where the format identifies it. |
| Green ball and materially different formats | Start in distinct calibration pools. Test bridges to standard ball longitudinally before any numeric conversion. |
| Late corrections and duplicates | Stable fixture and rubber identifiers, versioned revisions and deterministic rebuilds. |

### Model candidates

1. **Baselines.** Re-run section-local Power and the current ordinal section-plus-form index. Include a simple opponent-aware Elo baseline fitted globally within connected pools.
2. **Opponent-aware score model.** Start with the signed ability gap between the two players and a regularised game-share likelihood. Use game counts directly, with a cap on effective match weight, or a beta-binomial likelihood to reflect games from one match being correlated. Compare this with a format-aware score likelihood that accounts for the rules that stop a set. A gap of zero should predict an even match unless the data supports a format or side effect.
3. **Time-varying player strength.** Give each player a dated strength trajectory. Let the estimate update with new results and uncertainty grow across inactivity. Compare a rolling-window model with a state-space model. Anchor past and current estimates to the same named reference cohort so scale drift cannot masquerade as career improvement. [Glickman, Parameter Estimation in Large Dynamic Paired Comparison Experiments](https://www.glicko.net/ratings/glicko.pdf)
4. **Learn section strength.** Estimate each section's median and spread from its rated players. Apply a weak, learned section prior to new or provisional players if that improves forecasts. Once established, a player can exceed the average of any higher section by enough to outrank its players. Report section strength as a distribution.

A connected graph is necessary for a match-only alignment. Weak links can still make a connected graph unreliable. Fit by competition and era, inspect components, then add real bridge matches and nearby dated appearances of well-linked players. Report effective samples and uncertainty. If an offset depends on a handful of identities, suppress the cross-pool rank and show a comparable-pool rank. A numeric association-wide leaderboard should say exactly who qualified for comparison and provide a separate provisional cohort.

### Season performance

Use the player's pre-match rating, the opponent's pre-match rating, and a format-aware expected game or score distribution. Aggregate actual minus expected performance across each season with shrinkage and a minimum evidence rule. Show an uncertainty band so one excellent weekend cannot outweigh a full season by accident. Use chronological recomputation when browsing the archive.

Keep four different outputs visible in the specification.

| Output | Meaning |
| --- | --- |
| Rating | Estimated strength on the BRTA association scale for a dated snapshot. |
| Rank | Position among active, eligible, connected players, with a named discipline. |
| Season performance | How well the player performed over that season against the opponents they actually faced. |
| Improvement | Change in the player's estimated level over a stated period, with sample size and comparison-group context. |

### Illustrative interpretation

A 6–4 loss against a much stronger opponent can exceed the model's pre-match expectation even though the match is a loss. Finishing 10–1 against weak opposition can produce a lower estimated season performance than a 6–3 record against much stronger opponents. A player ranked near the top of a strong section usually starts with a good case for a high association rank, which their cross-section and opponent-adjusted evidence can confirm.

## Promotion and time to move up

Treat promotion as an observed move to a stronger competition tier, with section strength estimates checked against official section ordering. Distinguish a one-off emergency from a persistent move. For example, pre-register regular appearances across at least three ties as a candidate rule, then review sensitivity to stricter thresholds. Model formats such as a green-ball transition separately. Record both typical regular section and strongest regular section where a player splits their season.

- Cohort by starting tier, discipline and competition family. Follow players until a first qualifying move, end of available history, or loss to follow-up.
- Report median time only when enough of the cohort actually reaches the milestone. Otherwise report the share who moved by 6, 12 and 24 months with intervals and counts.
- Treat the end of archive coverage as right-censoring. Report follow-up loss and gaps explicitly. Missing a season could mean an absence, an unlinked appearance, or an archive gap.
- Show the first higher-section season and the next one. Compare match win rate and adjusted performance, plus the share who stayed in the new tier. Present descriptive patterns without claiming that promotion caused the changes.
- Compare alternative definitions for mid-season moves, new teams and ladder restructuring. Check whether conclusions change if the starting tier is defined by learned median rather than published section number.

## Competition strength comparisons

Treat the comparison as a season-dated many-to-many table. Compare medians, spreads and overlaps after fit. A section can overlap two neighbouring sections in another competition, and overlaps can move year to year. For each arrow publish the number of bridge players, date range, uncertainty band and typical equivalent tier. Split bridges by player for holdout so a person's other appearances cannot leak into their own test. Test whether historical competition bridges transfer to the following season. Suppress a comparison if the bridge data is too small, clustered in one club, or materially inconsistent across years.

## Validation and release criteria

| Check | Proposed method |
| --- | --- |
| Predicting future matches | Rolling season cutoff, fit on past data only, hold out the next round or season. |
| Calibration | Match log loss, Brier score, reliability plots and game-share error. Report by discipline, format and rating gap. |
| Cross-section predictions | Separately test people moving section, season newcomers and concurrent competitions. Score against section Power, Elo and the section-plus-form baseline. |
| Bridge stability | Withhold entire players, clubs and competition links. Bootstrap by player or tie to check offset reliability. |
| Fairness of evidence | Compare errors and uncertainty coverage across formats, competitions, activity levels and archive eras. |
| Identity robustness | Refit after dropping uncertain links and inspect the largest ranking movements. |
| Rank stability | Show interval and rank bands for sparse histories. Check weekly churn from individual results and import corrections. |
| Promotion validity | Review a sample by hand, then report sensitivity to the threshold and treatment of non-returners. |

Choose thresholds on earlier windows and publish them before the final holdout run. Set release gates using lift over baselines, acceptable calibration and adequate coverage within each published pool. A good overall average does not compensate for poor out-of-section predictions. Store model version, source revision, trained-through date and calibration tier alongside snapshots. [Temporal validation reference](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)

## Product shape

The player lab can show BRTA rating, active rank, discipline, estimate date, evidence and uncertainty. A season card can show its opponent-adjusted level and strongest/weakest evidence. Competition comparisons should explain how the bridges work and provide coverage. A promotion view can show observed probabilities with a cohort denominator. Persist common dated snapshots in small static payloads so section navigation and live predictions need no full-site refit in the browser.

## Open questions for the research branch

- Which identity links are strong enough for cross-competition estimates?
- How many real bridges exist after excluding same-name uncertainty and repeated club connections?
- Is one connected singles pool defensible for all standard-ball competitions, or only some of them?
- How much does a score model improve out-of-section forecasts over a game-weighted Elo baseline?
- What rank uncertainty is acceptable for the top end, and how much provisional coverage is useful?
- Can the initially selected parameters generalise to later seasons without retroactively moving the scale?
