# @compat-lint/ast-metadata-inferer

## 8.1.1

No changes in this release.

## 8.1.0

### Minor Changes

- 393cebd: Check the members of instance globals such as `localStorage.getItem()`, `caches.open()`, `customElements.define()` or `indexedDB.databases()`. Compat data lists them by interface (`Storage.getItem`), so the interface of each global is now inferred from the WebIDL definitions in `@webref/idl`. Messages name these APIs as in the code (`crypto.randomUUID()` instead of `Crypto.randomUUID()`); the interface names still work in the `polyfills` setting. Looking up members of browser globals is also much faster
- 3f63070: Report the `WebAssembly` JS API (e.g. `WebAssembly.compile()`, `WebAssembly.promising()`), which BCD lists in its own `webassembly` category and was therefore never checked

### Patch Changes

- 28c6f4e: Fix up to three API records being dropped from `metadata.json` and `compat.json` when the number of records is not divisible by four
- f33c853: Remove the unused Microsoft API catalog provider and its data, which made up 4.4 MB of the published package
- 78369c4: Remove the unused `electron` dev dependency
- 4787acb: Test-only changes: run the previously ignored `helpers.spect.ts` as `helpers.spec.ts`, and assert the caniuse range result inline instead of with a snapshot

## 8.0.1

### Patch Changes

- 5127571: Update release flow

## 8.0.0

### Major Changes

- a951a22: Published from the `compat-lint/compat-lint` monorepo under the `@compat-lint` scope, with a shared version. The metadata now includes static members such as `AbortSignal.timeout` and is generated with a current Chrome and `@mdn/browser-compat-data` 8.
