# BRTA Power Ratings

A static GitHub Pages site for an unofficial BRTA singles power-rating model.

## Publish with GitHub Pages

1. Create a public repository, for example `brta-power-ratings`.
2. Put `index.html` at the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.

The site has no build step and no JavaScript dependencies.

## Model

For each player `i`, latent strength is `theta_i`, centred so the section mean is zero.

- Game probability: `pG(i,j) = 1 / (1 + exp(-(theta_i-theta_j)/0.75))`
- Match probability: `pM(i,j) = 1 / (1 + exp(-(theta_i-theta_j)/0.55))`
- Recency: `w_r = 0.90^(R-r)`
- Objective: `sum_m w_m * (LG_m + 1.8*LM_m) - 0.75/2 * sum_i theta_i^2`
- Display scale: `Power_i = 1000 + 250*theta_i`
- Published leaderboard qualification: at least 4 completed singles matches.

Players with fewer than four matches remain in the fitted network; they are simply hidden from the published leaderboard.

## Included baselines

- Section 6, Spring 2026, through Round 9
- Section 9, Autumn 2026, completed season

What-if scoreline experiments are deliberately excluded from the baseline site.

## Note

This is an unofficial statistical project and is not affiliated with BRTA, Tennis Australia or UTR.
