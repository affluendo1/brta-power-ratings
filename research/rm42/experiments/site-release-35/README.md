# Study35 release integration

Orchestra is the owner-authorized 8.5 default. The release criterion is working
website integration; no claim of statistically established superiority is made.
Private report and full result package remain outside the public repository.

The browser and worker share web/models/orchestra.js, orchestra-fit.js and the
frozen orchestra-bundle.json. The original rm4.js and rm4-frozen.json remain
unchanged. Choir shares Melody joint player fitting; it is not an independent
recovered predictor. Frozen context delegations retain 4a/4b where appropriate.

Historical snapshots use pre-season, same-competition full-name hypotheses and
are restricted to ordinary junior Sets. No target outcomes enter a live prefix.
Known Study33/34 calibration-training exposure remains documented and corrected.
The 862-target Study35 replay is reused development evidence after delegation
selection, not fresh independent confirmation.

Run node tests/test_orchestra85.js and the existing tests/*.js suites. Browser
harnesses use jsdom 26.1.0: tests/browser/orchestra85.cjs checks the default family,
while rm4.cjs retains manual original regression paths. Their shared worker fixture
executes the real worker import graph. Frontend path checks cover offline shell
versions. Keep production defaults and research evidence conclusions separate.

## Six year history extension

Release 8.5.1 expands eligibility to six calendar years before the season start.
The seven-day pre-season cutoff, same-competition identity policy, 365-day
half-life, section slope and regularisation are unchanged. The recovered
Study34 source SHA matches the public snapshot source SHA. Rebuilding with
three years reproduces every released name, count and strength exactly.

Rebuild from the private preserved Study34 `source.json.gz` with:

```sh
python3 research/rm42/experiments/site-release-35/build_history.py \
  --source /path/to/source.json.gz --years 6 \
  --output web/models/orchestra-history.json
node research/rm42/experiments/site-release-35/audit_current.js /tmp/current-audit.json
python3 -m unittest discover -s tests -p 'test_orchestra_history.py'
```

The two current-season snapshots retain 67,639 observations and 9,388
player-discipline records. These are source coverage totals, not distinct
people or a predictive improvement claim. Saturday history has incomplete
archive coverage. Historical priors remain limited to ordinary junior Sets;
specialists for other formats do not yet consume historical priors.
