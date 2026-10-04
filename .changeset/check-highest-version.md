---
"@compat-lint/eslint-plugin-compat": minor
---

Check the highest targeted version of each browser in addition to the lowest one, so an API that was removed is reported even if the lowest version still supports it (e.g. `navigator.getBattery()` with Firefox 51 and Firefox 100). Messages still name one version per browser: the lowest unsupported one
