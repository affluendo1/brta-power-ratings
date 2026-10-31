# Accuracy experiment 01 — fixed design before execution

Selection data: current Spring 2026 AA/UA section IDs not divisible by three,
rounds 4–7. These development data were used earlier; old 960 assessment targets
are excluded from this experiment. Section-grouped 3-fold cross-validation.

Final transfer assessment, not used to select candidates: all available AA55
(Autumn 2026) and UA37 (Spring 2025) archive sections, rounds 4–14. These are
historical seasons, earlier than development, not prospective future evidence.
All strengths and experience features use strictly earlier dates AND rounds
within each section-season. Common previously-seen discipline support only.

Foundation grid: latent L2 1.5, 2.8125, 3.25, 4.5; half-life 180 or 365 days.
Melody grid: stopped-score share .25, .5, .75; L2 3, 5.5, 8; rho .75; 365-day
half-life and 24-game evidence cap. Doubles pair correction shares 0, .25, .5.
Direct pair strengths use a fixed RM4b pair fit. Both pairs must have appeared;
correction weight is further shrunk by min(pair counts)/(min(pair counts)+4).
Singles have no pair correction. No player-specific tuning.

Calibrations use existing symmetric five-feature temperature model, trained
within each section fold. Primary selection: most correct winners among models
within .005 OOF log loss of the best candidate in their family. Tie: lower log
loss, then predefined candidate order. No selection from final assessment.
Freeze winning definitions and full-development calibration before archive run.

Report accuracy, log loss, Brier, calibration bins, singles/doubles and format
subgroups; paired section-bootstrap intervals for winner and log-loss changes.
Compare original RM3, RM4b, frozen RM4.1, current Foundation/Melody and the new
selected candidates. No public promotion based on a small aggregate gain alone.
