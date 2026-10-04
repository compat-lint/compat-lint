---
"@compat-lint/ast-metadata-inferer": minor
"@compat-lint/eslint-plugin-compat": minor
---

Check the members of instance globals such as `localStorage.getItem()`, `caches.open()`, `customElements.define()` or `indexedDB.databases()`. Compat data lists them by interface (`Storage.getItem`), so the interface of each global is now inferred from the WebIDL definitions in `@webref/idl`. Messages name these APIs as in the code (`crypto.randomUUID()` instead of `Crypto.randomUUID()`); the interface names still work in the `polyfills` setting. Looking up members of browser globals is also much faster
