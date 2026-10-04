---
"@compat-lint/eslint-plugin-compat": patch
---

Recognize feature checks in conditional and logical expressions (e.g. `window.fetch ? fetch() : polyfill()`, `window.fetch && fetch()`, `window.fetch || polyfill`), and do not report assignments to an API (e.g. the polyfill `window.Promise = Polyfill`). Calling an API inside a condition (e.g. `if (fetch()) {}`) is reported as a use
