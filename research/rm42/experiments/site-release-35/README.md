# Orchestra release integration

Orchestra is the website's frontier family of rating and prediction models.
It brings more sophisticated analysis to player ratings, doubles and match
outlooks, with specialist handling for different formats and improved use
of available player history.

The browser and worker share the model implementations and configuration.
Model definitions, historical configuration and routing are maintained with
the executable model source. Previous model choices remain available.

## Development checks

```sh
node tests/test_orchestra85.js
node research/rm42/experiments/site-release-35/audit_current.js /tmp/current-audit.json
python3 -m unittest discover -s tests -p 'test_orchestra_history.py'
```
