# UI regression audit

This suite loads the real page and feature scripts into jsdom, supplies browser
capability shims and local section responses, and exercises nested dialogs and
keyboard behavior. It complements the model tests; jsdom cannot verify pixel
layout or GPU animation smoothness. Check those in a real browser as well.

Install the test dependency outside the repository, then run:

```sh
npm install --prefix /tmp/brta-ui-tests --no-save --ignore-scripts jsdom@26.1.0
NODE_PATH=/tmp/brta-ui-tests/node_modules node tests/browser/audit.cjs
```
