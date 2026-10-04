---
"@compat-lint/eslint-plugin-compat": minor
---

Check every targeted version of each browser instead of only the lowest one, so an API is also reported if it was removed (e.g. `navigator.getBattery()` with Firefox 51 and Firefox 100) or is missing in versions in between (e.g. `AbortSignal.abort()` in Node.js 15.0 to 15.11). Messages still name one version per browser: the lowest unsupported one
