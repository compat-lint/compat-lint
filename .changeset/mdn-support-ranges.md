---
"@compat-lint/eslint-plugin-compat": minor
---

Use all MDN support statements of a browser instead of only the first one. An API is supported in the versions between `version_added` and `version_removed` of any statement that is not prefixed, renamed or behind a flag. This no longer reports APIs with an earlier implementation (e.g. `document.body` in Firefox before 60, `AbortController` in Safari 11.1), and now reports APIs that were removed (e.g. `navigator.getBattery()` in Firefox since 52) or only exist prefixed (e.g. `SpeechRecognition` in Safari)
