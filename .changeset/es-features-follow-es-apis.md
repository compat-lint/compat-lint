---
"@compat-lint/eslint-plugin-compat": patch
---

Do not report `Promise` and typed arrays when ES APIs are polyfilled, that is with `polyfills: ["es:all"]` or a detected Babel config. Their rules use caniuse data and were not treated as ES APIs, unlike e.g. `Array.from()` or `Promise.allSettled()`
