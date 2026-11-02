# Association format audit and import preparation

Release 8.4.4.1 adds explicit format machinery, selected-model export handling and Automatic/Ensemble rating parity. The corrected 8.4.4 entry no longer advertises the removed extra.

## Source audit

`association-score-inventory.json` audits every section in the retained 1 November 2026 current-selector collection: 570 sections, 13,144 retained scorecards plus five newly referenced scorecards fetched on 2 November (13,149 total), 12 association directories and zero missing referenced scorecards. Each section has a competition/season/native identifier, its source section label, numerical score-pattern frequencies by discipline, and evidence counts. Legacy MDJTA remains explicitly separate. It contains no player names, teams, contacts or raw HTML.

These are **observed score patterns**, not 570 independently verified scoring contracts. Zero scores, unfinished play, forfeits and source-specific deciding-tiebreak codes can appear in them. An association name or the phrase “eight-game set” is insufficient to select a mathematical model. `audit.py snapshot.zip output.json` reproduces this audit.

The fresh 2 November selector/section refresh finished without errors in all 12 directories and independently found the same 570 sections. `current-section-coverage.json` records that comparison. Five ERTA result links were absent from the retained archive; `collect_supplement.py` fetched and parsed all five separately. The initial selector-only collector manifests correctly remain marked incomplete because clubs and bulk match downloads were disabled. The combined score audit covers retained scorecards plus those five new links; it does not claim a fresh download of every old scorecard or detect edits to old scorecards. Current listings and fresh match-page coverage are different measures.

## Explicit mechanics

`web/models/competition-formats.js` is an independent DOM-free scoring engine. It supports declared game targets 1–12, first-to sets, win-by-two sets, set tiebreaks at target or target minus one, best-of 1/3/5, fixed counts of 1–5 sets, full deciding sets with a different target, deciding match tiebreaks to 7 or 10, and fixed total-game sets (including 4–4 after eight total games). Each forecast requires a game-win probability and, where relevant, separately supplied set- and match-tiebreak probabilities. It does not silently equate point-winning chance with game-winning chance.

The score engine returns distributions of total games and sets, not ordered exact score sequences. Advantage sets have an exact match-winning probability calculation but an unbounded score space: finite score-distribution requests are explicitly rejected. Timed/handicap formats, unsupported targets and unknown rule fields are rejected. This prevents unimplemented rules from quietly receiving an ordinary six-game forecast. Fixed-game drawn sets use half-set credits internally and require the fixedSets contract; that credit is for comparison, not an assumed association points award.

`fixtureOutcome` accepts the competition's declared deciding order (rubbers, sets, games) and permits draws. It assumes conditional independence and refuses excessive state spaces. `fixturePoints` supports explicitly declared additive game/set/rubber points and win/draw bonuses. It does not supply ladder percentages, finals eligibility, lineup order, washout or forfeit policy: those are separate association rules and must be supplied before public association integration.

`web/models/association-import.js` converts normalized source match components to typed observations only with explicit rules and valid participant counts. It rejects incomplete/illegal scores, duplicate participants, unsupported disciplines and unsupported source encodings. The `fitBaseline` API reuses original RM3 game evidence and accepts drawn matches without inventing a win/loss table. It requires strictly earlier dates and rounds. Original core latent skills can feed its scoring forecast bridge. This is mechanical support, not evidence that existing calibration transfers to a new format or association. The import API now also exposes `fitModels`, using original RM3, RM3b, RM4a and RM4b fitting code, and forecasts RM4a, RM4b or RM4.1 with explicit contracts. Native RM4a recognizes the declared tiebreak threshold and deciding-set rule. Draws remain draws in model records, evidence and Elo. For the new explicit-contract Ensemble path, the frozen ML component is excluded because its features/calibration have not been validated on arbitrary native formats; eligible frozen component weights are renormalized. This reduced configuration is unvalidated and is marked in its response. Original-format Ensemble calls retain the full frozen implementation. New formats are not activated on public section pages automatically.

## Why eight-game variants remain separate

Waverley Tennis's published weekend by-laws distinguish first-to-six sets; three eight-game doubles sets in which eight games are played in total and 4–4 is a draw; and midweek eight-game doubles with a tiebreak at seven-all. Junior and senior rubbers, triples and other competitions also differ. Older seasonal by-laws can differ from the current web page, including junior first-to-six versus tiebreak sets.

Sources consulted on 2 November 2026:
- https://www.waverleytennis.asn.au/weekend-by-laws.html
- https://assets.cdn.thewebconsole.com/S3WEB3217/images/2025-26_Summer_By-laws.pdf?m=f40431be8050614e889a5a97aa3e9270
- https://www.trols.org.au/ (native selectors, section scorecards)

Do not automatically map a source label to these contracts without confirming the competition and season. Future import integration must attach provenance, effective season, singles/doubles match contracts, fixture composition and team-result/points rules. Collected source HTML remains private.

## Checks

`node tests/test_competition_formats.js` checks normalization, side reversal, finite distribution versus an independent match-win calculation, eight-total-game draws, distinct tiebreak thresholds, legal/illegal scorecards, fixed-set draws, unsupported rules, advantage-set boundaries and source-input isolation. Original RM4/prediction tests must also pass. The rating worker also accepts an explicit `associationForecast` request with typed history, target and scoring rules. These checks verify mechanics; they do not validate predictive performance on new association formats.

## Import interface

The worker accepts `{action: 'associationForecast', model, history, target, rules}`. Supported model values are `RM3`, `RM3b`, `RM4a`, `RM4b`, `RM4.1 Ensemble`. Normalize source components with `BRTAAssociationImport.observation(source, rules)`, then attach genuine ISO dates and round numbers. History must strictly precede both the target date and round; contradictory score totals/outcomes and invalid dates are rejected. A fitted state may only forecast its declared cutoff. `BRTARM4.distribution(eta, {formatRules: rules}, outcome)` produces aggregate score distributions with calibrated home/away/draw mass; it must not be labelled an ordered exact-score forecast.

`format-compatibility.json` contains 100 candidate contracts and compatibility diagnostics for all 570 sections. Compatibility ranks do not choose native rules: a 6–2 score can belong to several formats. Legacy MDJTA's 16 sections remain separate. Public activation still requires independently confirmed current competition rules, fixture composition, and association-specific result/points policies.

Reproduction (private source paths supplied by the operator):

```sh
python3 validation/formats/refresh_coverage.py snapshot.zip current-directory validation/formats/current-section-coverage.json
PYTHONPATH=/tmp/trols-deps:. python3 -m validation.formats.collect_supplement snapshot.zip current-directory private-supplement-directory
python3 validation/formats/audit.py snapshot.zip validation/formats/association-score-inventory.json private-supplement-directory
node validation/formats/diagnose.js
```

## 8.4.4.1 verification

Automatic previously combined RM3 rating tables with Ensemble forecasts. It now uses exactly the same RM4b rating tables, 2000 centre and 765 probability/display scale as manual RM4.1 Ensemble. The automatic policy version is 2. Manual original model calculations remain available.

Complete-section export resolves the selected model from the retained source payload before building the report, preventing repeated display rescaling or stale model data. Both section export buttons are disabled while a section/model update is pending. Exports are abandoned if the user switches the section or model during export calculation. Result CSV remains a results-only export; it does not pretend to contain a ratings table.

New-format tests cover six explicit contracts for RM4a/RM4b/Ensemble, tiebreak-native likelihood and finite-difference gradient, draw records/Elo, side reversal, probability normalization, score distribution calibration, ML exclusion and invalid/future evidence. Original Python-reference RM4 component/feature/Ensemble parity remains passing. No accuracy improvement or transferred calibration validity is claimed by these mechanical checks.

All JavaScript `tests/test_*.js` suites and 30 targeted Python tests passed on 2 November. The DOM integration test also passed: model changes, selected-model report contents and export-button locking, ordinary forecasts/simulations, legacy model settings, calendar/dialog regressions. Stale methodology-page selectors in that test were updated to the existing compact model settings overlay. These are DOM integration checks, not a visual-device inspection.
