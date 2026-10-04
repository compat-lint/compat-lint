---
"@compat-lint/eslint-plugin-compat": patch
---

Fix polyfills of instance methods that are named with `.prototype.` as documented, e.g. `polyfills: ["Array.prototype.flat"]`. Before, only the name without it (`Array.flat`) had an effect, which still works
