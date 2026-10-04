import * as eslint from "eslint";
import { parser } from "typescript-eslint";
import rule from "../src/rules/compat";

// Detect ESLint version
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eslintMod = eslint as any;
const eslintVersion = parseInt(
  (eslintMod.Linter?.version || eslintMod.version || "9").split(".")[0],
  10
);

// Create RuleTester with appropriate config for ESLint version
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any =
  eslintVersion >= 9
    ? {
        // ESLint 9+ flat config
        languageOptions: {
          parser,
          parserOptions: { ecmaVersion: 2020, sourceType: "module" },
        },
        settings: {
          lintAllEsApis: true,
        },
      }
    : {
        // ESLint 8 and below
        parser: require.resolve("@typescript-eslint/parser"),
        parserOptions: { ecmaVersion: 2020, sourceType: "module" },
        settings: {
          lintAllEsApis: true,
        },
      };

const ruleTester = new eslint.RuleTester(config);

ruleTester.run("compat", rule, {
  valid: [
    // Ignore ES APIs if config detected
    {
      code: `
        Array.from()
      `,
      settings: { browsers: ["ExplorerMobile 10"] },
    },
    // Feature detection Cases
    {
      code: `
        if (fetch) {
          fetch()
        }
      `,
      settings: { browsers: ["ExplorerMobile 10"] },
    },
    {
      code: `
        if (Array.prototype.flat) {
          [1, [2]].flat()
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        if (fetch && otherConditions) {
          fetch()
        }
      `,
      settings: { browsers: ["ExplorerMobile 10"] },
    },
    {
      code: `
        if (window.fetch) {
          fetch()
        }
      `,
      settings: { browsers: ["ExplorerMobile 10"] },
    },
    {
      code: `
        if ('fetch' in window) {
          fetch()
        }
      `,
      settings: { browsers: ["ExplorerMobile 10"] },
    },
    {
      code: `
        if (!window.fetch) {
          polyfill()
        } else {
          fetch()
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        if (typeof fetch === 'function') {
          fetch()
        }
        if (window.fetch !== undefined) {
          fetch()
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        if (document.currentScript && document.currentScript.async) {
          load()
        }
      `,
      // The check itself is not reported
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        if ('IntersectionObserver' in window) {
          if (isReady) {
            button.addEventListener('click', () => {
              new IntersectionObserver(callback)
            })
          }
        }
      `,
      // Nested statements and callbacks in a guarded branch are guarded
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        function load(urls) {
          if (!window.fetch) return;
          urls.forEach((url) => {
            fetch(url)
          });
        }
      `,
      // An early exit also guards callbacks after it
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        const load = window.fetch ? (url) => fetch(url) : polyfill;
        const data = !window.fetch ? polyfill('/api') : fetch('/api');
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        window.fetch && fetch('/api/data');
        !window.fetch || fetch('/api/data');
        typeof IntersectionObserver !== 'undefined' && new IntersectionObserver(callback);
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        if (!window.Promise) {
          window.Promise = Polyfill;
        }
        window.requestAnimationFrame = window.requestAnimationFrame || fallback;
      `,
      // Polyfills assign to the API
      settings: { browsers: ["ie 9"] },
    },
    {
      code: "window",
      settings: { browsers: ["ExplorerMobile 10"] },
    },
    // Early return guard patterns
    {
      code: `
        function setup() {
          if (!('serviceWorker' in navigator)) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
    },
    {
      code: `
        function setup() {
          if (!navigator.serviceWorker) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
    },
    {
      code: `
        function init() {
          if (!window.fetch) {
            throw new Error('fetch not supported');
          }
          fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        function init() {
          if (!fetch) return;
          fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        function setup() {
          if (typeof navigator.serviceWorker === 'undefined') return;
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
    },
    {
      code: `
        function setup() {
          if (!window.navigator?.['serviceWorker']) return;
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
    },
    {
      code: `
        function flatten(items) {
          if (!('flat' in Array.prototype)) return items;
          return [items].flat();
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        function uuid() {
          if (!crypto.randomUUID) return;
          return crypto.randomUUID();
        }
      `,
      // The rule uses the interface name `Crypto`
      settings: { browsers: ["chrome 52"] },
    },
    {
      code: `
        function load(bytes) {
          if (typeof WebAssembly !== 'object') return;
          return WebAssembly.compile(bytes);
        }
      `,
      // Checking the namespace guards its members
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        function load(bytes) {
          if (!('WebAssembly' in window)) throw new Error('No WebAssembly');
          return new WebAssembly.Module(bytes);
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        function wrap(fn) {
          if (!WebAssembly.promising) return fn;
          return WebAssembly.promising(fn);
        }
      `,
      settings: { browsers: ["safari 26.5"] },
    },
    {
      code: "document.fonts()",
      settings: { browsers: ["edge 79"] },
    },
    {
      code: `
        import * as serviceWorker from './serviceWorker';
        serviceWorker.register(false);
      `,
      // Opera Mini has never supported service workers, so a match on `ServiceWorker` would report
      settings: { browsers: ["chrome 52", "op_mini all"] },
    },
    {
      code: `
        navigator.permissions
          .query({ name: 'local-network-access' })
          .then((permissionStatus) => {
            permissionStatus.addEventListener('change', () => {});
          });
      `,
      // The Android WebView has never supported `PermissionStatus`, so a match on it would report.
      // `navigator.permissions` has the same support, so it is polyfilled to keep only that check.
      settings: {
        browsers: ["chrome 52", "android 4.4"],
        polyfills: ["navigator.permissions"],
      },
    },
    {
      code: `
        const abortController = new AbortController();
        abortController.abort();
      `,
      settings: { browsers: ["chrome 70"] },
    },
    {
      code: `
        const mutationObserver = new MutationObserver(() => {});
        mutationObserver.observe(document.body, { childList: true });
      `,
      settings: { browsers: ["chrome 52"] },
    },
    {
      code: `
        const intersectionObserver = new IntersectionObserver(() => {});
        intersectionObserver.observe(document.body);
      `,
      settings: { browsers: ["chrome 70"] },
    },
    {
      code: `
        const IntersectionObserver = "test";
        IntersectionObserver.trim();
      `,
      settings: { browsers: ["chrome 30"] },
    },
    // Import cases
    {
      code: `
        import { Set } from 'immutable';
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const { Set } = require('immutable');
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const { Set } = require('immutable');
        new Set();
      `,
      settings: { browsers: ["current node"] },
    },
    {
      code: `
        const { Set } = require('immutable');
        new Set();
      `,
      settings: { browsers: ["ie 9", "current node"] },
    },
    {
      code: `
        const Set = require('immutable').Set;
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        Promise.resolve()
      `,
      settings: { browsers: ["node 10"] },
    },
    {
      code: `
        const { Set } = require('immutable');
        (() => {
          new Set();
        })();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        import Set from 'immutable';
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        function Set() {}
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const Set = () => {};
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const bar = () => {
          const Set = () => {};
          new Set();
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const bar = () => {
          class Set {}
          new Set()
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const bar = () => {
          const Set = {}
          new Set()
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const bar = () => {
          function Set() {}
          new Set()
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    // Arrow function parameter shadowing
    {
      code: `
        const items = [1, 2, 3];
        items.map(fetch => fetch.toString());
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: `
        const schedulers = [{ id: '1', name: 'A' }];
        schedulers.map(scheduler => scheduler.name);
      `,
      settings: { browsers: ["safari 15.6"] },
    },
    {
      code: `
        const schedulers = [{ id: '1', name: 'A' }];
        schedulers.flatMap(scheduler => scheduler.managedByRoleIds);
      `,
      settings: { browsers: ["safari 15.6"] },
    },
    // Function expression parameter shadowing
    {
      code: `
        const items = [1, 2, 3];
        items.map(function(fetch) { return fetch.toString(); });
      `,
      settings: { browsers: ["ie 9"] },
    },
    // Declarations that are visible from the usage
    {
      code: `
        import { Map } from 'immutable';
        new Map().size;
      `,
      settings: { browsers: ["ie 8"] },
    },
    {
      code: `
        function load({ fetch }) {
          return fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        try {
          run();
        } catch (fetch) {
          fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 11"] },
    },
    {
      code: `
        class Set {}
        function create() {
          return [new Set(), () => new Set()];
        }
      `,
      settings: { browsers: ["ie 9"] },
    },
    {
      code: "document.documentElement()",
      settings: { browsers: ["Safari 11", "Opera 57", "Edge 17"] },
    },
    {
      code: "document.getElementsByTagName()",
      settings: { browsers: ["Safari 11", "Opera 57", "Edge 17"] },
    },
    {
      code: "navigator.getBattery()",
      // Firefox supported the Battery Status API from 43 to 51
      settings: { browsers: ["firefox 43", "firefox 51"] },
    },
    {
      code: "document.body.appendChild(element)",
      // Firefox supported `document.body` before 60 on HTMLDocument
      settings: { browsers: ["firefox 38"] },
    },
    {
      code: 'Promise.resolve("foo")',
      settings: { polyfills: ["Promise"], browsers: ["ie 8"] },
    },
    {
      code: "history.back()",
      settings: { browsers: ["Safari 11", "Opera 57", "Edge 17"] },
    },
    "document.querySelector()",
    {
      code: "new ServiceWorker()",
      settings: { browsers: ["chrome 57", "firefox 50"] },
    },
    {
      code: "document.currentScript()",
      settings: {
        browsers: ["chrome 57", "firefox 50", "safari 10", "edge 14"],
      },
    },
    {
      code: "document.querySelector()",
      settings: {
        browsers: ["ChromeAndroid 80"],
      },
    },
    {
      code: "document.hasFocus()",
      settings: {
        browsers: ["Chrome 34"],
      },
    },
    {
      code: "new URL()",
      settings: {
        browsers: ["ChromeAndroid 78", "ios 11"],
      },
    },
    {
      code: "document.currentScript('some')",
      settings: {
        browsers: ["chrome 57", "firefox 50", "safari 10", "edge 14"],
      },
    },
    {
      code: "WebAssembly.compile()",
      settings: {
        browsers: ["chrome 56"],
        polyfills: ["WebAssembly"],
      },
    },
    {
      code: "WebAssembly.compile(); new WebAssembly.Module(bytes)",
      settings: { browsers: ["chrome 57", "safari 11", "firefox 52"] },
    },
    {
      code: "new IntersectionObserver(() => {}, {});",
      settings: { browsers: ["chrome 58"] },
    },
    {
      code: "new URL('http://example')",
      settings: {
        browsers: ["chrome 32", "safari 7.1", "firefox 26"],
      },
    },
    {
      code: "new URLSearchParams()",
      settings: {
        browsers: ["chrome 49", "safari 10.1", "firefox 44"],
      },
    },
  ],
  invalid: [
    {
      code: `
        if (fetch) {
          fetch()
        }
      `,
      settings: {
        browsers: ["ExplorerMobile 10"],
        ignoreConditionalChecks: true,
      },
      errors: [
        {
          message: "fetch is not supported in IE Mobile 10",
        },
      ],
    },
    {
      code: "window?.fetch?.('example.com')",
      settings: { browsers: ["ie 9"] },
      errors: [
        {
          message: "fetch is not supported in IE 9",
        },
      ],
    },
    // Early return with unrelated guard should NOT suppress
    {
      code: `
        function setup() {
          if (!someCondition) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
      errors: [
        {
          message:
            "navigator.serviceWorker() is not supported in Safari 10.1",
        },
      ],
    },
    // Early return guarding another API of the same object should NOT suppress
    {
      code: `
        function setup() {
          if (!navigator.onLine) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
      errors: [
        {
          message: "navigator.serviceWorker() is not supported in Safari 10.1",
        },
      ],
    },
    {
      code: `
        function setup() {
          if (!('onLine' in navigator)) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
      errors: [
        {
          message: "navigator.serviceWorker() is not supported in Safari 10.1",
        },
      ],
    },
    // Early return guarding the same property of another object should NOT suppress
    {
      code: `
        function setup(worker) {
          if (!worker.serviceWorker) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: { browsers: ["safari 10.1"] },
      errors: [
        {
          message: "navigator.serviceWorker() is not supported in Safari 10.1",
        },
      ],
    },
    {
      code: `
        function wrap(fn) {
          if (!WebAssembly.compile) return fn;
          return WebAssembly.promising(fn);
        }
      `,
      settings: { browsers: ["safari 26.5"] },
      errors: [
        {
          message: "WebAssembly.promising() is not supported in Safari 26.5",
        },
      ],
    },
    {
      code: `
        function load() {
          if (!window.Promise) { return; }
          fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "fetch is not supported in IE 11",
        },
      ],
    },
    // Conditions that do not check the API should NOT suppress
    {
      code: `
        if (isLoggedIn) {
          fetch('/api/data')
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: `
        if (typeof module === 'object') {
          module.exports = () => fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: `
        if (isReady(fetch('/api/data'))) {
          start()
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    // Branches where the check does not guarantee the API should NOT suppress
    {
      code: `
        if (window.fetch) {
          load()
        } else {
          fetch('/api/data')
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: `
        if (!window.fetch) {
          fetch('/api/data')
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: `
        if (window.fetch || hasPolyfill) {
          fetch('/api/data')
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: `
        function load() {
          if (window.fetch) return;
          fetch('/api/data');
        }
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: "window.fetch ? load() : fetch('/api/data')",
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: "isReady && fetch('/api/data')",
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: "window.fetch || fetch('/api/data')",
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    // Calling the API in a condition is a use, not a check
    {
      code: `
        if (fetch('/api/data')) {
          done()
        }
        fetch('/api/data') && done();
      `,
      settings: { browsers: ["ie 11"] },
      errors: [
        { message: "fetch is not supported in IE 11" },
        { message: "fetch is not supported in IE 11" },
      ],
    },
    // ignoreConditionalChecks overrides early return guards
    {
      code: `
        function setup() {
          if (!('serviceWorker' in navigator)) { return; }
          navigator.serviceWorker.register('/sw.js');
        }
      `,
      settings: {
        browsers: ["safari 10.1"],
        ignoreConditionalChecks: true,
      },
      errors: [
        {
          message:
            "navigator.serviceWorker() is not supported in Safari 10.1",
        },
      ],
    },
    {
      settings: {
        browsers: ["ie 9"],
      },
      code: `
        navigator.hardwareConcurrency;
        navigator.serviceWorker;
        new SharedWorker();
      `,
      errors: [
        {
          message: "navigator.hardwareConcurrency() is not supported in IE 9",
        },
        {
          message: "navigator.serviceWorker() is not supported in IE 9",
        },
        {
          message: "SharedWorker is not supported in IE 9",
        },
      ],
    },
    {
      settings: {
        browsers: ["ie 8"],
      },
      code: `
        // it should throw an error here, but it doesn't
        const event = new CustomEvent("cat", {
          detail: {
            hazcheeseburger: true
          }
        });
        window.dispatchEvent(event);
      `,
      errors: [
        {
          message: "CustomEvent is not supported in IE 8",
        },
      ],
    },
    {
      code: "Array.from()",
      settings: {
        browsers: ["ie 8"],
      },
      errors: [
        {
          message: "Array.from() is not supported in IE 8",
        },
      ],
    },
    {
      code: "Promise.allSettled()",
      settings: {
        browsers: [
          "Chrome >= 72",
          "Firefox >= 72",
          "Safari >= 12",
          "Edge >= 79",
        ],
      },
      errors: [
        {
          message:
            "Promise.allSettled() is not supported in Safari 12, Chrome 72",
        },
      ],
    },
    {
      code: "location.origin",
      settings: { browsers: ["ie 10"] },
      errors: [
        {
          message: "location.origin() is not supported in IE 10",
        },
      ],
    },
    {
      code: "navigator.getBattery()",
      // Firefox removed the Battery Status API in 52
      settings: { browsers: ["firefox 100"] },
      errors: [
        {
          message: "navigator.getBattery() is not supported in Firefox 100",
        },
      ],
    },
    {
      code: "navigator.getBattery()",
      // The lowest version supports it, but it is removed in the higher versions
      settings: { browsers: ["firefox 51", "firefox 60", "firefox 100"] },
      errors: [
        {
          message: "navigator.getBattery() is not supported in Firefox 60",
        },
      ],
    },
    {
      code: "fetch('/api/data')",
      // Only the lowest unsupported version of a browser is named
      settings: { browsers: ["ie 9", "ie 11", "chrome 41", "chrome 100"] },
      errors: [
        {
          message: "fetch is not supported in IE 9, Chrome 41",
        },
      ],
    },
    {
      code: "AbortSignal.abort()",
      // Node.js supports it from 14.17.0 to 14.x and since 15.12.0, but not in between
      settings: { browsers: ["node 14.17", "node 15.5", "node 16.0"] },
      errors: [
        {
          message: "AbortSignal.abort() is not supported in Node.js 15.5.0",
        },
      ],
    },
    {
      code: "new AnimationEvent('start')",
      // Opera supports it from 12.1 to 14 and since 30
      settings: {
        browsers: ["opera 12.1", "opera 20", "opera 25", "opera 30"],
      },
      errors: [
        {
          message: "AnimationEvent is not supported in Opera 20",
        },
      ],
    },
    {
      code: "new SpeechRecognition()",
      // Safari only has `webkitSpeechRecognition`
      settings: { browsers: ["safari 17"] },
      errors: [
        {
          message: "SpeechRecognition is not supported in Safari 17.0",
        },
      ],
    },
    {
      code: `
          import { Map } from 'immutable';
          new Set()
        `,
      settings: { browsers: ["ie 9"] },
      errors: [
        {
          message: "Set is not supported in IE 9",
        },
      ],
    },
    // Declarations of the same name that are not visible from the usage
    {
      code: `
        function stub(fetch) {}
        fetch('/api/data');
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: `
        function outer() {
          const Set = stub;
        }
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
      errors: [{ message: "Set is not supported in IE 9" }],
    },
    {
      code: `
        items.map(Set => Set.id);
        new Set();
      `,
      settings: { browsers: ["ie 9"] },
      errors: [{ message: "Set is not supported in IE 9" }],
    },
    // Names that are used but not declared
    {
      code: `
        const options = { fetch: true };
        const load = fetch;
        const get = () => fetch;
        fetch('/api/data');
      `,
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: "fetch('/api/data')",
      // A global from the config is not a declaration in the file
      languageOptions: { globals: { fetch: "readonly" } },
      settings: { browsers: ["ie 11"] },
      errors: [{ message: "fetch is not supported in IE 11" }],
    },
    {
      code: "new Set()",
      settings: { browsers: ["ie 9"] },
      errors: [
        {
          message: "Set is not supported in IE 9",
        },
      ],
    },
    {
      code: "new TypedArray()",
      settings: { browsers: ["ie 9"] },
      errors: [
        {
          message: "TypedArray is not supported in IE 9",
        },
      ],
    },
    {
      code: "new Int8Array()",
      settings: { browsers: ["ie 9"] },
      errors: [
        {
          message: "Int8Array is not supported in IE 9",
        },
      ],
    },
    {
      code: "new AnimationEvent",
      settings: { browsers: ["chrome 40"] },
      errors: [
        {
          message: "AnimationEvent is not supported in Chrome 40",
        },
      ],
    },
    {
      code: "Object.values({})",
      settings: { browsers: ["safari 9"] },
      errors: [
        {
          message: "Object.values() is not supported in Safari 9",
        },
      ],
    },
    {
      code: "new ServiceWorker()",
      settings: { browsers: ["chrome 31"] },
      errors: [
        {
          message: "ServiceWorker is not supported in Chrome 31",
        },
      ],
    },
    {
      code: "new IntersectionObserver(() => {}, {});",
      settings: { browsers: ["chrome 49"] },
      errors: [
        {
          message: "IntersectionObserver is not supported in Chrome 49",
        },
      ],
    },
    {
      code: "WebAssembly.compile()",
      settings: {
        browsers: [
          "Samsung 4",
          "Safari 10.1",
          "Opera 12.1",
          "OperaMini all",
          "iOS 10.3",
          "ExplorerMobile 10",
          "IE 10",
          "Edge 14",
          "Blackberry 7",
          "Baidu 7.12",
          "UCAndroid 11.8",
          "QQAndroid 1.2",
        ],
      },
      errors: [
        {
          message:
            "WebAssembly.compile() is not supported in Samsung Browser 4, Safari 10.1, Opera 12.1, iOS Safari 10.3, IE 10, Edge 14",
        },
      ],
    },
    {
      code: "new PaymentRequest(methodData, details, options)",
      settings: { browsers: ["chrome 57"] },
      errors: [
        {
          message: "PaymentRequest is not supported in Chrome 57",
        },
      ],
    },
    {
      code: "navigator.serviceWorker",
      settings: { browsers: ["safari 10.1"] },
      errors: [
        {
          message: "navigator.serviceWorker() is not supported in Safari 10.1",
        },
      ],
    },
    {
      code: "window.document.fonts()",
      settings: { browsers: ["ie 8"] },
      errors: [
        {
          message: "document.fonts() is not supported in IE 8",
        },
      ],
    },
    {
      code: "new Map().size",
      settings: { browsers: ["ie 8"] },
      errors: [
        {
          message: "Map.size() is not supported in IE 8",
        },
        {
          message: "Map is not supported in IE 8",
        },
      ],
    },
    {
      code: "new window.Map().size",
      settings: { browsers: ["ie 8"] },
      errors: [
        {
          message: "Map.size() is not supported in IE 8",
        },
        {
          message: "Map is not supported in IE 8",
        },
      ],
    },
    {
      code: "new Array().flat",
      settings: { browsers: ["ie 8"] },
      errors: [
        {
          message: "Array.flat() is not supported in IE 8",
        },
      ],
    },
    {
      code: "globalThis.fetch()",
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "fetch is not supported in IE 11",
        },
      ],
    },
    {
      code: "fetch()",
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "fetch is not supported in IE 11",
        },
      ],
    },
    {
      code: "Promise.resolve()",
      settings: { browsers: ["ie 10"] },
      errors: [
        {
          message: "Promise.resolve() is not supported in IE 10",
        },
      ],
    },
    {
      code: "Promise.all()",
      settings: { browsers: ["ie 10"] },
      errors: [
        {
          message: "Promise.all() is not supported in IE 10",
        },
      ],
    },
    {
      code: "Promise.race()",
      settings: { browsers: ["ie 10"] },
      errors: [
        {
          message: "Promise.race() is not supported in IE 10",
        },
      ],
    },
    {
      code: "Promise.reject()",
      settings: { browsers: ["ie 10"] },
      errors: [
        {
          message: "Promise.reject() is not supported in IE 10",
        },
      ],
    },
    {
      code: "new URL('http://example')",
      settings: {
        browsers: ["chrome 31", "safari 7", "firefox 25"],
      },
      errors: [
        {
          message: "URL is not supported in Safari 7, Firefox 25, Chrome 31",
        },
      ],
    },
    {
      code: "new URLSearchParams()",
      settings: {
        browsers: ["chrome 48", "safari 10", "firefox 28"],
      },
      errors: [
        {
          message:
            "URLSearchParams is not supported in Safari 10, Firefox 28, Chrome 48",
        },
      ],
    },
    {
      code: "performance.now()",
      settings: { browsers: ["ie 9"] },
      errors: [
        {
          message: "performance.now() is not supported in IE 9",
        },
      ],
    },
    {
      code: "new ResizeObserver()",
      settings: {
        browsers: ["ie 11", "safari 12"],
      },
      errors: [
        {
          message: "ResizeObserver is not supported in Safari 12, IE 11",
        },
      ],
    },
    {
      code: "'foo'.at(5)",
      settings: {
        browsers: ["ie 11", "safari 12"],
      },
      errors: [
        {
          message: "String.at() is not supported in Safari 12, IE 11",
        },
      ],
    },
    {
      code: "[].at(5)",
      settings: {
        browsers: ["ie 11", "safari 12"],
      },
      errors: [
        {
          message: "Array.at() is not supported in Safari 12, IE 11",
        },
      ],
    },
    // @TODO: Fix this edge case
    // {
    //   code: `window?.fetch`,
    //   settings: { browsers: ["ie 9"] },
    //   errors: [
    //     {
    //       message: "fetch is not supported in IE 9",
    //     },
    //   ],
    // },
    {
      code: "Object.entries({}), Object.values({})",
      settings: {
        browsers: ["Android >= 4", "iOS >= 7"],
      },
      errors: [
        {
          message:
            "Object.entries() is not supported in iOS Safari 7.0-7.1, Android Browser 4",
        },
        {
          message:
            "Object.values() is not supported in iOS Safari 7.0-7.1, Android Browser 4",
        },
      ],
    },
    {
      code: "globalThis.requestIdleCallback(() => {})",
      settings: {
        browsers: ["safari 12"],
      },
      errors: [
        {
          message: "requestIdleCallback is not supported in Safari 12",
        },
      ],
    },
    {
      code: "window.requestIdleCallback(() => {})",
      settings: {
        browsers: ["safari 12"],
      },
      errors: [
        {
          message: "requestIdleCallback is not supported in Safari 12",
        },
      ],
    },
    // https://github.com/amilajack/eslint-plugin-compat/issues/670
    {
      code: "requestIdleCallback(() => {})",
      settings: {
        browsers: ["iOS >= 11.3", "android >= 63"],
      },
      errors: [
        {
          message:
            "requestIdleCallback is not supported in iOS Safari 11.3-11.4",
        },
      ],
    },
    {
      code: "window.requestIdleCallback(() => {})",
      settings: {
        browsers: ["ios_saf 12"],
      },
      errors: [
        {
          message:
            "requestIdleCallback is not supported in iOS Safari 12.0-12.1",
        },
      ],
    },
    {
      code: "window.requestAnimationFrame(() => {})",
      settings: {
        browsers: ["OperaMini all"],
      },
      errors: [
        {
          message: "requestAnimationFrame is not supported in Opera Mini all",
        },
      ],
    },
    {
      code: "window.requestAnimationFrame(() => {})",
      settings: {
        browsers: ["ie 9"],
      },
      errors: [
        {
          message: "requestAnimationFrame is not supported in IE 9",
        },
      ],
    },
    {
      code: "globalThis.requestAnimationFrame(() => {})",
      settings: {
        browsers: ["ie 9"],
      },
      errors: [
        {
          message: "requestAnimationFrame is not supported in IE 9",
        },
      ],
    },
    {
      code: "/(?<=y)x/, new RegExp('(?<!y)x'), 'x', true, false, null, 1, 0n",
      settings: {
        browsers: ["Safari >= 16.3", "iOS >= 16.3"],
      },
      errors: [
        {
          message:
            "Lookbehind is not supported in Safari 16.3, iOS Safari 16.3",
        },
        {
          message:
            "Lookbehind is not supported in Safari 16.3, iOS Safari 16.3",
        },
      ],
    },
    {
      code: "crypto.randomUUID()",
      settings: { browsers: ["chrome 52", "safari 14"] },
      errors: [
        {
          message:
            "Crypto.randomUUID() is not supported in Safari 14, Chrome 52",
        },
      ],
    },
    {
      code: "[].includes()",
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "Array.includes() is not supported in IE 11",
        },
      ],
    },
    {
      code: "'strsd'.includes()",
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "String.includes() is not supported in IE 11",
        },
      ],
    },
    {
      code: "[1, 2, [3, 4]].flat()",
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "Array.flat() is not supported in IE 11",
        },
      ],
    },
    {
      code: "[1,2,3].flatMap(x => [x, x])",
      settings: { browsers: ["chrome 68"] },
      errors: [
        {
          message: "Array.flatMap() is not supported in Chrome 68",
        },
      ],
    },
    {
      code: "Object.fromEntries([])",
      settings: { browsers: ["chrome 72"] },
      errors: [
        {
          message: "Object.fromEntries() is not supported in Chrome 72",
        },
      ],
    },
    {
      code: "'text'.replaceAll('x', 's')",
      settings: { browsers: ["chrome 84"] },
      errors: [
        {
          message: "String.replaceAll() is not supported in Chrome 84",
        },
      ],
    },
    {
      code: `navigator.serviceWorker.register("/service_worker.js");`,
      settings: { browsers: ["chrome 39"] },
      errors: [
        {
          message: "navigator.serviceWorker() is not supported in Chrome 39",
        },
      ],
    },
    {
      code: `
        const abortController = new AbortController();
        abortController.abort();
      `,
      settings: { browsers: ["chrome 65"] },
      errors: [
        {
          message: "AbortController is not supported in Chrome 65",
        },
      ],
    },
    {
      code: `
        const mutationObserver = new MutationObserver(() => {});
        mutationObserver.observe(document.body, { childList: true });
      `,
      settings: { browsers: ["chrome 25"] },
      errors: [
        {
          message: "MutationObserver is not supported in Chrome 25",
        },
      ],
    },
    {
      code: `
        const intersectionObserver = new IntersectionObserver(() => {});
        intersectionObserver.observe(document.body);
      `,
      settings: { browsers: ["chrome 50"] },
      errors: [
        {
          message: "IntersectionObserver is not supported in Chrome 50",
        },
      ],
    },
    {
      code: `
        navigator.permissions
          .query({ name: 'local-network-access' })
          .then((permissionStatus) => {
            permissionStatus.addEventListener('change', () => {});
          });
      `,
      settings: { browsers: ["chrome 41"] },
      errors: [
        {
          message: "navigator.permissions() is not supported in Chrome 41",
        },
      ],
    },
    {
      code: `
        navigator.permissions
          .query({ name: 'local-network-access' })
          .then((permissionStatus) => {
            permissionStatus.addEventListener('change', () => {});
          });
      `,
      // The Android WebView has never supported `navigator.permissions` or `PermissionStatus`
      settings: { browsers: ["chrome 52", "android 4.4"] },
      errors: [
        {
          message:
            "navigator.permissions() is not supported in Android Browser 4.4",
        },
      ],
    },
    {
      code: "[1, 2, [3, 4]].flat()",
      settings: { browsers: ["samsung 4", "op_mob 12", "android 4.4"] },
      errors: [
        {
          message:
            "Array.flat() is not supported in Samsung Browser 4, Opera Mobile 12, Android Browser 4.4",
        },
      ],
    },
    {
      code: "WebAssembly.compile(bytes)",
      settings: { browsers: ["ie 11"] },
      errors: [
        {
          message: "WebAssembly.compile() is not supported in IE 11",
        },
      ],
    },
    {
      code: "new WebAssembly.Module(bytes)",
      settings: { browsers: ["chrome 56"] },
      errors: [
        {
          message: "WebAssembly.Module() is not supported in Chrome 56",
        },
      ],
    },
    {
      code: "WebAssembly.promising(fn)",
      settings: { browsers: ["chrome 136", "firefox 140", "safari 26.5"] },
      errors: [
        {
          message:
            "WebAssembly.promising() is not supported in Safari 26.5, Firefox 140, Chrome 136",
        },
      ],
    },
  ],
});
