# 9.0.1.3 · Committee rehearsal

This package rehearses the committee decision process with repeatable scenarios.
Use it to inspect agenda sequencing, ballot disposition, and report integrity
before preparing a session record. The runner requires Node.js.

```sh
node rehearse.mjs
node rehearse.mjs scenarios/rain-delay.json
```

The output contains proposed motions, simulated ballots, minutes, and a
manifest of the reports. A seed makes the meeting repeatable.
