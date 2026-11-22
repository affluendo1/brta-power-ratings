# BRTA Power Ratings

An independent site for Bayside Regional Tennis Association results, standings,
fixtures and player ratings. [Open BRTA Power Ratings](https://affluendo1.github.io/brta-power-ratings/).

- Pick a competition and section to see scorecards, the ladder and upcoming fixtures.
- Use **Players** to browse section ratings or look up a player’s career.
- Use **Clubs** for venues, team stats and participation, or create your own
  section in **Custom Competitions**.
- See **Settings → Changelog** for release notes.

Melody powers the default ratings and Orchestra handles match predictions. The
[full site reference](BRTA-Power-Ratings-Reference.md) covers the models, data,
exports and development. It’s also downloadable from **Settings → Methodology**.

## Run locally

```sh
python -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). The site uses the checked-in data
and requires no frontend build. See the [reference](BRTA-Power-Ratings-Reference.md#run-locally)
for tests and data regeneration.

Results are sourced from TROLS as entered. BRTA, Tennis Australia and UTR do
not operate or endorse this project.