# RM4 proposal — research, not a released rating model

RM4 should estimate ability at a date, account for uncertainty and match-day
variation, and explain the observed tennis score using the actual format.
RM4a and RM4b should be observation models inside that shared framework:
single sets and multi-set Rubbers respectively. Adult formats must be selected
per match; the word “Rubbers” alone does not specify the scoring rules.

## Evidence now available

The initial study used 2026 junior singles, with Autumn for development and
Spring for temporal testing. Each prediction used earlier rounds only. The
test contained 4,041 single-set matches and 239 Rubbers matches. After fair
development-only calibration, RM3 log loss was 0.5748 / 0.5653 for the two
formats; RM3b was 0.5805 / 0.5558. A prototype allowing shared match-day
variation effectively tied calibrated RM3 in single sets. Match-wins-only
models performed worse. The five Rubbers test sections are too few for a
confident release decision, and their players can overlap across competitions.

The 8.2.3 score correction changes the evidence and establishes explicit RM3
and RM3b match-tiebreak parameters. Re-run all baselines on the corrected
canonical data before selecting RM4. Previous benchmark values are historical
research results, not certified performance of the corrected release.

## Observation model

Use the joint probability of the ordinary-set scores and the deciding event,
with the real stopping rules. Match and set wins are consequences of those
scores, not independent extra samples. A deciding match tiebreak with unknown
points supplies its known outcome only. Actual points, where recorded, can
support a point-level likelihood. A genuine full third set remains a full set.

For six-game sets, final 7–5 and 7–6 scores identify sets that reached 5–5.
A joint score model can therefore test a separate closing-stage probability
from that state without inventing the earlier game order. It must model both
reaching 5–5 and what follows; fitting only a selected list of close matches
would confound playing strength and exposure. Serve-specific explanations
still require serve order.

Learn a separate, strongly pooled link between ability difference and
match-tiebreak probability. Do not assume that an ordinary-game probability
is automatically the correct point or tiebreak probability. Include set-level
and match-level performance variation so a long, tight match does not create
the certainty of many independent matches.

## Close sets, recoveries and repeatable pressure performance

A 7–5 set necessarily passes through 5–5. Its final two games can involve a
hold followed by a break, or a break followed by a hold, depending on service
order. The terminal score does not identify break points, prior leads, injury,
fatigue, tactical adaptation or psychological cause. Similarly, losing the
first set and winning a rubber is observable; attributing it to one player's
mental strength or the other's choking requires additional evidence.

Record close sets, set tiebreaks, deciding match tiebreaks, outcomes after
winning/losing the first set, and straight-set results. Show denominators and
historical cutoffs. Descriptive records are useful even if they never improve
ratings. The Player Lab displays these in 8.2.3.

Test a hierarchical pressure component using only prior results. Condition on
opponent strength, format, exposure and available context. Compare actual
close-event outcomes with their model expectations. Shrink players with few
events strongly toward the population; avoid a separate free parameter for
every kind of pressure. Evaluate whether the component improves subsequent
close events and ordinary matches, rather than rewarding a good-looking
retrospective record. Compare alternatives without a pressure term.

Close matches are a selected sample: equally strong players reach them more
often. Raw close-win percentage confounds opponent strength, sampling and
possibly ability. Player-specific context effects require repeated exposures,
not two fortunate tiebreaks. Future optional game-order and point data would
allow much better tests, but missing sequences must remain missing.

## Ability, uncertainty and context

Separate stable ability, evolution over time, match-day performance and
uncertainty about all three. Test a pooled state-space/random-walk model
against RM3's fixed recency weighting. Inactivity increases uncertainty;
cross-season priors require verified identities. Do not independently centre
disconnected opponent groups and then pretend their relative order was
identified by results. Singles and doubles may share a population prior while
retaining different learned abilities. Doubles additionally needs a strongly
shrunk partnership interaction and explicit identification limits.

Start contextual testing with one pooled home effect. Surface requires the
actual venue/court used, not a club's list of possible surfaces. Nearby
washouts may indicate disruption but are not confirmed rain measurements.
Same-day final statuses are unavailable to a pre-match forecast and would
leak future information. Test historical weather separately from forecasts
available before play. Context may change match variance more than the mean.

## Evaluation and release gate

1. Freeze canonical scores, source provenance, identity rules and format rules.
2. Reproduce corrected RM3 and RM3b as baselines; fit calibration independently.
3. Add typed score likelihood, posterior predictive uncertainty, match-day
   variation, dynamic ability, and then pressure/context, one at a time.
4. Use nested temporal development and untouched future rounds. Check log
   loss, Brier score, calibration, accuracy, close-event subsets, cold starts,
   weak/disconnected networks, adult formats and doubles separately.
5. Quantify uncertainty with fixture/date/player dependence in mind. Include
   feature ablations, several seasons and realistic missing-data tests.
6. Run shadow predictions before changing the public rankings. Retain the
   stronger existing model for any format where RM4 has not earned adoption.

Primary research inspirations: [Ingram's dynamic paired comparisons](https://arxiv.org/abs/1902.07378),
[Klaassen and Magnus on point dependence](https://www.janmagnus.nl/papers/JRM057.pdf),
[Kovalchik and Reid on clutch-weighted performance](https://www.sa-ijas.org/ojs/index.php/sa-ijas/article/view/30-11),
[Glicko-2](https://glicko.net/glicko/glicko2.pdf) and
[TrueSkill](https://proceedings.neurips.cc/paper/2006/file/f44ee263952e65b3610b8ba51229d1f9-Paper.pdf).
These motivate hypotheses; professional-tennis coefficients do not transfer
automatically to BRTA juniors or club doubles.
