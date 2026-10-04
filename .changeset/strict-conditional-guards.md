---
"@compat-lint/eslint-plugin-compat": minor
---

Only suppress errors inside an `if` when it checks the reported API. Previously any `if` hid errors, e.g. `if (isLoggedIn) { fetch() }` or the `else` branch of `if (window.fetch)`. Errors are suppressed in the branch where the check guarantees the API (e.g. `else` of `if (!window.fetch)`, or `typeof fetch === 'function'`), in the check itself, and after an early exit when the API is missing, including in callbacks. Use `// eslint-disable-next-line compat/compat` where the API is checked elsewhere
