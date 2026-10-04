---
"@compat-lint/eslint-plugin-compat": patch
---

Only name an API as a method in error messages when it is called: `Array.from()` for `Array.from([])`, but `location.origin`, `navigator.serviceWorker` and `WebAssembly.Module` instead of `location.origin()`, `navigator.serviceWorker()` and `WebAssembly.Module()`
