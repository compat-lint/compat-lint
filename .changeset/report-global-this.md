---
"@compat-lint/eslint-plugin-compat": patch
---

Report `globalThis` itself when it is used to access another API, e.g. `globalThis.fetch()` in IE 11. Before, only the accessed API was checked
