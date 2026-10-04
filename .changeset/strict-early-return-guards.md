---
"@compat-lint/eslint-plugin-compat": patch
---

Only treat an early return as a feature check when it tests the reported API: `if (!navigator.onLine) return;` no longer hides an unsupported `navigator.serviceWorker`. Guards using optional chaining (e.g. `if (!navigator?.serviceWorker) return;`) are now recognized
