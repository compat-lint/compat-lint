## [7.0.2](https://github.com/amilajack/eslint-plugin-compat/compare/v7.0.1...v7.0.2) (2026-04-29)

## 8.1.1

### Patch Changes

- 477b251: Remove the find-up dependency; the babel config and `package.json` lookups walk up the directories with `fs` directly
- @compat-lint/ast-metadata-inferer@8.1.1

## 8.1.0

### Minor Changes

- 7f3dc63: Check MDN compat data for Android targets (`android`, `and_chr`, `and_ff`, `samsung`, `op_mob`), which were never matched before
- 05dea93: Check every targeted version of each browser instead of only the lowest one, so an API is also reported if it was removed (e.g. `navigator.getBattery()` with Firefox 51 and Firefox 100) or is missing in versions in between (e.g. `AbortSignal.abort()` in Node.js 15.0 to 15.11). Messages still name one version per browser: the lowest unsupported one
- 393cebd: Check the members of instance globals such as `localStorage.getItem()`, `caches.open()`, `customElements.define()` or `indexedDB.databases()`. Compat data lists them by interface (`Storage.getItem`), so the interface of each global is now inferred from the WebIDL definitions in `@webref/idl`. Messages name these APIs as in the code (`crypto.randomUUID()` instead of `Crypto.randomUUID()`); the interface names still work in the `polyfills` setting. Looking up members of browser globals is also much faster
- d410509: Use all MDN support statements of a browser instead of only the first one. An API is supported in the versions between `version_added` and `version_removed` of any statement that is not prefixed, renamed or behind a flag. This no longer reports APIs with an earlier implementation (e.g. `document.body` in Firefox before 60, `AbortController` in Safari 11.1), and now reports APIs that were removed (e.g. `navigator.getBattery()` in Firefox since 52) or only exist prefixed (e.g. `SpeechRecognition` in Safari)
- 908436e: Only suppress errors inside an `if` when it checks the reported API. Previously any `if` hid errors, e.g. `if (isLoggedIn) { fetch() }` or the `else` branch of `if (window.fetch)`. Errors are suppressed in the branch where the check guarantees the API (e.g. `else` of `if (!window.fetch)`, or `typeof fetch === 'function'`), in the check itself, and after an early exit when the API is missing, including in callbacks. Use `// eslint-disable-next-line compat/compat` where the API is checked elsewhere
- 3f63070: Report the `WebAssembly` JS API (e.g. `WebAssembly.compile()`, `WebAssembly.promising()`), which BCD lists in its own `webassembly` category and was therefore never checked

### Patch Changes

- 41582a3: Fix caniuse-based rules not being reported for targets with a version range (e.g. `ios_saf 11.3-11.4`)
- a9fa049: Recognize feature checks in conditional and logical expressions (e.g. `window.fetch ? fetch() : polyfill()`, `window.fetch && fetch()`, `window.fetch || polyfill`), and do not report assignments to an API (e.g. the polyfill `window.Promise = Polyfill`). Calling an API inside a condition (e.g. `if (fetch()) {}`) is reported as a use
- aee3e2b: Do not report `Promise` and typed arrays when ES APIs are polyfilled, that is with `polyfills: ["es:all"]` or a detected Babel config. Their rules use caniuse data and were not treated as ES APIs, unlike e.g. `Array.from()` or `Promise.allSettled()`
- 5d53ae0: Only name an API as a method in error messages when it is called: `Array.from()` for `Array.from([])`, but `location.origin`, `navigator.serviceWorker` and `WebAssembly.Module` instead of `location.origin()`, `navigator.serviceWorker()` and `WebAssembly.Module()`
- c3d223e: Test-only change: enable the test for an API that is accessed with optional chaining on `window` (`window?.fetch`), which is reported correctly
- 40564dc: Fix polyfills of instance methods that are named with `.prototype.` as documented, e.g. `polyfills: ["Array.prototype.flat"]`. Before, only the name without it (`Array.flat`) had an effect, which still works
- 7f3dc63: Show browser names instead of browserslist ids in error messages (e.g. `Opera Mini` instead of `op_mini`, `Android Browser` instead of `android`)
- 330eacf: Report `globalThis` itself when it is used to access another API, e.g. `globalThis.fetch()` in IE 11. Before, only the accessed API was checked
- a62b0d5: Use scope analysis to decide if a name refers to a local declaration instead of the global API. A declaration that is not visible from the usage (e.g. a parameter `fetch` of another function), or a mere use of the name (e.g. the object key in `{ fetch: true }`), no longer hides errors for the whole file. Declarations such as `catch (fetch)` or `import { Map }` followed by `new Map().size` are now recognized
- bf03a41: Only treat an early return as a feature check when it tests the reported API: `if (!navigator.onLine) return;` no longer hides an unsupported `navigator.serviceWorker`. Guards using optional chaining (e.g. `if (!navigator?.serviceWorker) return;`) are now recognized
- 4787acb: Test-only changes: run the previously ignored `helpers.spect.ts` as `helpers.spec.ts`, and assert the caniuse range result inline instead of with a snapshot
- Updated dependencies [393cebd]
- Updated dependencies [28c6f4e]
- Updated dependencies [f33c853]
- Updated dependencies [78369c4]
- Updated dependencies [4787acb]
- Updated dependencies [3f63070]
  - @compat-lint/ast-metadata-inferer@8.1.0

## 8.0.1

### Patch Changes

- 5127571: Update release flow
- Updated dependencies [5127571]
  - @compat-lint/ast-metadata-inferer@8.0.1

## 8.0.0

### Major Changes

- a951a22: Published from the `compat-lint/compat-lint` monorepo under the `@compat-lint` scope, with a shared version. The metadata now includes static members such as `AbortSignal.timeout` and is generated with a current Chrome and `@mdn/browser-compat-data` 8.

### Patch Changes

- Updated dependencies [a951a22]
  - @compat-lint/ast-metadata-inferer@8.0.0


### Performance Improvements

* Use `Map` instead of `AstMetadataApiWithTargetsResolver[]` for faster matching ([#679](https://github.com/amilajack/eslint-plugin-compat/issues/679)) ([fecdcc6](https://github.com/amilajack/eslint-plugin-compat/commit/fecdcc6613bf95cbed0a1cfd35e503c3612f1d32))

## [7.0.1](https://github.com/amilajack/eslint-plugin-compat/compare/v7.0.0...v7.0.1) (2026-03-02)


### Bug Fixes

* Case-insensitive globals matching ([#684](https://github.com/amilajack/eslint-plugin-compat/issues/684)) ([#685](https://github.com/amilajack/eslint-plugin-compat/issues/685)) ([90ceb71](https://github.com/amilajack/eslint-plugin-compat/commit/90ceb71b6d2bcacdfbdf1e8ab37a21643ff52e51))

# [7.0.0](https://github.com/amilajack/eslint-plugin-compat/compare/v6.2.1...v7.0.0) (2026-02-25)


* feat!: drop support for ESLint 4-8 ([259bc2e](https://github.com/amilajack/eslint-plugin-compat/commit/259bc2e89ef908a9f7eea4edd11ccbdd020cb7aa))


### BREAKING CHANGES

* Minimum supported ESLint version is now 9.0.0.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

## [6.2.1](https://github.com/amilajack/eslint-plugin-compat/compare/v6.2.0...v6.2.1) (2026-02-25)


### Bug Fixes

* case-insensitive match for lowercase browser globals ([#649](https://github.com/amilajack/eslint-plugin-compat/issues/649)) ([#681](https://github.com/amilajack/eslint-plugin-compat/issues/681)) ([367fc02](https://github.com/amilajack/eslint-plugin-compat/commit/367fc025ba41a9e117f1b589961bf2134015a7ef))
* format test files with prettier ([4f47dd4](https://github.com/amilajack/eslint-plugin-compat/commit/4f47dd4168194185148a20d3c6524675c1b177a8))


### Performance Improvements

* compat ([#680](https://github.com/amilajack/eslint-plugin-compat/issues/680)) ([9c21fdd](https://github.com/amilajack/eslint-plugin-compat/commit/9c21fdd266732dd76be434634e4519fae52a8cc4))

# [6.2.0](https://github.com/amilajack/eslint-plugin-compat/compare/v6.1.0...v6.2.0) (2026-02-18)


### Features

* eslint 10 support ([#677](https://github.com/amilajack/eslint-plugin-compat/issues/677)) ([6aaec34](https://github.com/amilajack/eslint-plugin-compat/commit/6aaec34a74f302db93ab4122c9057aceffc0519c))

# [6.1.0](https://github.com/amilajack/eslint-plugin-compat/compare/v6.0.2...v6.1.0) (2026-01-23)


### Bug Fixes

* correct event name check in release workflow ([1b573c6](https://github.com/amilajack/eslint-plugin-compat/commit/1b573c6aeb6e531689cd1197af867e42cd10ab8d))
* fix CI failures and improve test/release workflow separation ([#662](https://github.com/amilajack/eslint-plugin-compat/issues/662)) ([2b62f0e](https://github.com/amilajack/eslint-plugin-compat/commit/2b62f0e1f00ffd211419ea9e2fdfcaf82cfe3caf))


### Features

* add ignoreConditionalChecks setting ([#676](https://github.com/amilajack/eslint-plugin-compat/issues/676)) ([4c3f730](https://github.com/amilajack/eslint-plugin-compat/commit/4c3f730e74e370ac07e69ae15aba9070dcd63043))
* add semantic-release automation ([#661](https://github.com/amilajack/eslint-plugin-compat/issues/661)) ([ae98059](https://github.com/amilajack/eslint-plugin-compat/commit/ae980599942c66cc0b5fdeddfa6527d1159f1b8c))
* added support for regexp literal ([#644](https://github.com/amilajack/eslint-plugin-compat/issues/644)) ([ee71626](https://github.com/amilajack/eslint-plugin-compat/commit/ee716260e27aa2b6d2bd8ff64268c832f588d2df))

# [6.1.0](https://github.com/amilajack/eslint-plugin-compat/compare/v6.0.2...v6.1.0) (2026-01-23)


### Bug Fixes

* correct event name check in release workflow ([1b573c6](https://github.com/amilajack/eslint-plugin-compat/commit/1b573c6aeb6e531689cd1197af867e42cd10ab8d))
* fix CI failures and improve test/release workflow separation ([#662](https://github.com/amilajack/eslint-plugin-compat/issues/662)) ([2b62f0e](https://github.com/amilajack/eslint-plugin-compat/commit/2b62f0e1f00ffd211419ea9e2fdfcaf82cfe3caf))


### Features

* add ignoreConditionalChecks setting ([#676](https://github.com/amilajack/eslint-plugin-compat/issues/676)) ([4c3f730](https://github.com/amilajack/eslint-plugin-compat/commit/4c3f730e74e370ac07e69ae15aba9070dcd63043))
* add semantic-release automation ([#661](https://github.com/amilajack/eslint-plugin-compat/issues/661)) ([ae98059](https://github.com/amilajack/eslint-plugin-compat/commit/ae980599942c66cc0b5fdeddfa6527d1159f1b8c))
* added support for regexp literal ([#644](https://github.com/amilajack/eslint-plugin-compat/issues/644)) ([ee71626](https://github.com/amilajack/eslint-plugin-compat/commit/ee716260e27aa2b6d2bd8ff64268c832f588d2df))

# [6.1.0](https://github.com/amilajack/eslint-plugin-compat/compare/v6.0.2...v6.1.0) (2026-01-23)


### Bug Fixes

* correct event name check in release workflow ([1b573c6](https://github.com/amilajack/eslint-plugin-compat/commit/1b573c6aeb6e531689cd1197af867e42cd10ab8d))
* fix CI failures and improve test/release workflow separation ([#662](https://github.com/amilajack/eslint-plugin-compat/issues/662)) ([2b62f0e](https://github.com/amilajack/eslint-plugin-compat/commit/2b62f0e1f00ffd211419ea9e2fdfcaf82cfe3caf))


### Features

* add ignoreConditionalChecks setting ([#676](https://github.com/amilajack/eslint-plugin-compat/issues/676)) ([4c3f730](https://github.com/amilajack/eslint-plugin-compat/commit/4c3f730e74e370ac07e69ae15aba9070dcd63043))
* add semantic-release automation ([#661](https://github.com/amilajack/eslint-plugin-compat/issues/661)) ([ae98059](https://github.com/amilajack/eslint-plugin-compat/commit/ae980599942c66cc0b5fdeddfa6527d1159f1b8c))
* added support for regexp literal ([#644](https://github.com/amilajack/eslint-plugin-compat/issues/644)) ([ee71626](https://github.com/amilajack/eslint-plugin-compat/commit/ee716260e27aa2b6d2bd8ff64268c832f588d2df))

# [6.1.0](https://github.com/amilajack/eslint-plugin-compat/compare/v6.0.2...v6.1.0) (2026-01-23)


### Bug Fixes

* correct event name check in release workflow ([1b573c6](https://github.com/amilajack/eslint-plugin-compat/commit/1b573c6aeb6e531689cd1197af867e42cd10ab8d))
* fix CI failures and improve test/release workflow separation ([#662](https://github.com/amilajack/eslint-plugin-compat/issues/662)) ([2b62f0e](https://github.com/amilajack/eslint-plugin-compat/commit/2b62f0e1f00ffd211419ea9e2fdfcaf82cfe3caf))


### Features

* add ignoreConditionalChecks setting ([#676](https://github.com/amilajack/eslint-plugin-compat/issues/676)) ([4c3f730](https://github.com/amilajack/eslint-plugin-compat/commit/4c3f730e74e370ac07e69ae15aba9070dcd63043))
* add semantic-release automation ([#661](https://github.com/amilajack/eslint-plugin-compat/issues/661)) ([ae98059](https://github.com/amilajack/eslint-plugin-compat/commit/ae980599942c66cc0b5fdeddfa6527d1159f1b8c))
* added support for regexp literal ([#644](https://github.com/amilajack/eslint-plugin-compat/issues/644)) ([ee71626](https://github.com/amilajack/eslint-plugin-compat/commit/ee716260e27aa2b6d2bd8ff64268c832f588d2df))

# v3.8.0

### Added
- Support for feature detection of APIs ([#327](https://github.com/amilajack/eslint-plugin-compat/pull/327))
- Implement expected behavior when defining targets in `eslintrc` and `browserslist` (this might be deprecated in the future)

### Internal
- Migrated from Flow to Typescript
- Created performance benchmarks of popular repositories
- Create E2E linting tests
- Internal refactors

# v3.7.0

### Updates

- Allow ESLint `peerDependency` version `7.0.0`

### Fixed
- Fixed many bugs reporting incorrect linter errors

# v3.6.0

### Fixed
- Update dependencies
- Remove `fixable` and add `meta.type` ([305](https://github.com/amilajack/eslint-plugin-compat/pull/305))

# v3.5.1

### Fixed
- Support Safari TP as a target ([#285](https://github.com/amilajack/eslint-plugin-compat/pull/285))

# v3.5.0

### Fixed
- Allow targets not caniuse db ([#280](https://github.com/amilajack/eslint-plugin-compat/pull/280)
- Added missing browser mapping and default fallback ([#272](https://github.com/amilajack/eslint-plugin-compat/pull/272))
- Support Node >=8 ([#281](https://github.com/amilajack/eslint-plugin-compat/pull/281))

### Added
- Bump all deps to latest semver

# v3.4.0

### Added
- Add schema to support browserlist as a second paramenter in eslintrc ([#265](https://github.com/amilajack/eslint-plugin-compat/pull/265))
- Bumped all dependencies to latest semver

# v3.3.0

### Performance
- Filter and sort rules before node traversal ([https://github.com/amilajack/eslint-plugin-compat/pull/246](https://github.com/amilajack/eslint-plugin-compat/pull/246))
- Optimize core loop to run ~50% faster ([https://github.com/amilajack/eslint-plugin-compat/pull/245](https://github.com/amilajack/eslint-plugin-compat/pull/245))

# v3.2.0

### Added
- Support for `eslint@6`

# v3.1.2

### Fixed
- Remove npm restriction from engines

# v3.1.1

### Fixed
- Resolving browserslist config correctly despite being called from a cwd that is not the root of the project. (#217)

# v3.1.0

### Added
- Support detecting locally defined polyfills (#207)  bb3be6e

# v3.0.2

### Fixed
- Handle entire API polyfill case (#190)  e784b3d

# v3.0.1

### Fixed
- Bug when returning unsupported when mdn compat data has null record

# v3.0.0

### Added
- Support for ~4000 JS API's using [ast-metadata-inferer](https://github.com/amilajack/ast-metadata-inferer)

### Deprecated
- Using caniuse id's for polyfills is no longer supported

# v2.7.0

### Added
- `Object.values()` support

# v2.6.1

### Fixed
- Removed `console.log` statement

# v2.4.0

### Updated
- Updated all deps to latest semver
### Fixed
- Fixed recommendation config

# v2.3.0

### Updated
- Updated browserslist

# v2.2.0

### Updated
- Bumped all dependencies to latest semver

# v2.1.0

### Added
- Promise support

# v2.0.1

### Fixed
- Corrected incorrect babel exports config that prevented plugin from being loaded

# v2.0.0

### Updated
- Bumped all dependencies to latest semver

### Infra
- Removed boilerplate from `.eslintrc`
- Run CI against node 8
- Removed flow-typed definitions
- Updated tests to reflect dependency changes

# v1.0.4

### Fixed
- Required `peerDependency` of `eslint>=4.0.0`

# v1.0.3

### Updated
- Bumped all dependencies to latest semver

# v1.0.2

### Added
- Range implementation
