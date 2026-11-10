# TROLS watcher

The Worker polls the published section result indexes for scheduled matches
and missing results from today through four calendar days after play in
Melbourne. The first observation queues one sync to establish a baseline.
Afterward, changed tables trigger a targeted GitHub sync. The Worker saves
their fingerprints after GitHub reports success. A failed run gets retried.
The daily full sync continues to cover older results, detailed scorecard
corrections that leave the index unchanged, and season rollover.

Cloudflare Free runs the trigger once a minute. The watcher checks up to 24
sections per tick in groups of three and rotates through larger batches. It
pauses while a targeted sync is in progress. Worker logs show each check even
when no new data is published. GitHub and Pages take additional time.

## Deploy

1. In a terminal in this directory, run `npx wrangler login` and then
   `npx wrangler kv namespace create brta-trols-watch`.
2. Put the returned namespace ID in the `WATCH_STATE` entry in a local copy
   of `wrangler.jsonc`.
3. Run `npx wrangler deploy`. On GitHub, create a fine-grained token restricted
   to `affluendo1/brta-power-ratings` with **Actions: Read and write**. Run
   `npx wrangler secret put GITHUB_DISPATCH_TOKEN` and enter the token at its
   prompt.
4. Check `npx wrangler tail` for scheduled invocations and confirm the first
   targeted run appears in GitHub Actions. If no sections are due, the watcher
   logs zero checks until a fixture reaches its Melbourne match date.

The Worker has no public HTTP route. Keep credentials in Worker secrets.
