---
"@compat-lint/eslint-plugin-compat": patch
---

Use scope analysis to decide if a name refers to a local declaration instead of the global API. A declaration that is not visible from the usage (e.g. a parameter `fetch` of another function), or a mere use of the name (e.g. the object key in `{ fetch: true }`), no longer hides errors for the whole file. Declarations such as `catch (fetch)` or `import { Map }` followed by `new Map().size` are now recognized
