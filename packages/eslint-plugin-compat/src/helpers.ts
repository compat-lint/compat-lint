/* eslint no-nested-ternary: off */
import browserslist from "browserslist";
import globals from "globals";
import { AstNodeTypes, TargetNameMappings } from "./constants";
import {
  AstMetadataApiWithTargetsResolver,
  BrowserListConfig,
  BrowsersListOpts,
  Context,
  ESLintNode,
  HandleFailingRule,
  SourceCode,
  Target,
} from "./types";

/*
3) Figures out which browsers user is targeting

- Uses browserslist config and/or targets defined eslint config to discover this
- For every API ecnountered during traversal, gets compat record for that
- Protochain (e.g. 'document.querySelector')
  - All of the rules have compatibility info attached to them
- Each API is given to versioning.ts with compatibility info
*/

/**
 * Check if a node (IfStatement consequent) contains a return or throw statement,
 * indicating an early exit guard.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsEarlyExit(node: any): boolean {
  if (!node) return false;
  if (node.type === "ReturnStatement" || node.type === "ThrowStatement")
    return true;
  if (node.type === "BlockStatement" && Array.isArray(node.body)) {
    return node.body.some(containsEarlyExit);
  }
  return false;
}

const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);

/**
 * Get the names of a member chain, ex. `window.navigator.serviceWorker` =>
 * ['window', 'navigator', 'serviceWorker']. Returns undefined for other expressions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function memberChain(node: any): string[] | undefined {
  if (!node) return undefined;
  // ex. `navigator?.serviceWorker`
  if (node.type === "ChainExpression") return memberChain(node.expression);
  if (node.type === "Identifier") return [node.name];
  if (node.type !== "MemberExpression") return undefined;

  const object = memberChain(node.object);
  if (!object) return undefined;
  if (!node.computed && node.property.type === "Identifier") {
    return [...object, node.property.name];
  }
  // ex. `navigator['serviceWorker']`
  if (
    node.property.type === "Literal" &&
    typeof node.property.value === "string"
  ) {
    return [...object, node.property.value];
  }
  return undefined;
}

/**
 * Check if a member chain refers to the API of the rule. A leading global object
 * and `prototype` are ignored, ex. `window.Array.prototype.flat` refers to `Array.flat`
 */
function chainReferencesApi(
  chain: string[],
  rule: AstMetadataApiWithTargetsResolver
): boolean {
  // A global object on its own is the API itself, ex. `typeof globalThis`
  const names = chain.filter(
    (name, i) =>
      name !== "prototype" &&
      !(i === 0 && chain.length > 1 && GLOBAL_OBJECTS.has(name))
  );
  if (!rule.property) return names[0] === rule.object;
  // Rules can use the interface name (ex. `Crypto`) of a global (ex. `crypto`)
  if (names[0]?.toLowerCase() !== rule.object.toLowerCase()) return false;
  // Checking the object itself guards its members, ex. `typeof WebAssembly` for
  // `WebAssembly.compile`, but checking another member does not
  return names.length === 1 || names[1] === rule.property;
}

/**
 * Recursively check if an expression references the API identified by the rule,
 * ex. `navigator.serviceWorker` or `'serviceWorker' in navigator` for
 * `navigator.serviceWorker`, but not `navigator.onLine`
 */
function expressionReferencesApi(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  rule: AstMetadataApiWithTargetsResolver
): boolean {
  if (!node) return false;
  // ex. `'serviceWorker' in navigator`
  if (
    node.type === "BinaryExpression" &&
    node.operator === "in" &&
    node.left.type === "Literal" &&
    typeof node.left.value === "string"
  ) {
    const object = memberChain(node.right);
    return !!object && chainReferencesApi([...object, node.left.value], rule);
  }
  const chain = memberChain(node);
  if (chain) return chainReferencesApi(chain, rule);
  if (node.type === "UnaryExpression") {
    return expressionReferencesApi(node.argument, rule);
  }
  if (node.type === "BinaryExpression" || node.type === "LogicalExpression") {
    return (
      expressionReferencesApi(node.left, rule) ||
      expressionReferencesApi(node.right, rule)
    );
  }
  if (node.type === "CallExpression") {
    return expressionReferencesApi(node.callee, rule);
  }
  return false;
}

/**
 * What the result of a feature check guarantees about the API of a rule:
 * - whenTrue: the API exists if the check is truthy, ex. `'fetch' in window`
 * - whenFalse: the API exists if the check is falsy, ex. `typeof fetch === 'undefined'`
 */
type Guarantee = { whenTrue: boolean; whenFalse: boolean };

const NO_GUARANTEE: Guarantee = { whenTrue: false, whenFalse: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingValue(node: any): boolean {
  return (
    (node.type === "Identifier" && node.name === "undefined") ||
    (node.type === "Literal" && node.value === null && node.raw === "null")
  );
}

/**
 * Get the guarantee of a comparison, ex. `typeof fetch !== 'undefined'`,
 * `window.fetch === undefined` or `document.hidden === false`
 */
function comparisonGuarantee(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  rule: AstMetadataApiWithTargetsResolver
): Guarantee {
  const equal = node.operator === "===" || node.operator === "==";
  if (!equal && node.operator !== "!==" && node.operator !== "!=") {
    return NO_GUARANTEE;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compare = (checked: any, other: any): Guarantee | undefined => {
    let missing: boolean;
    if (checked.type === "UnaryExpression" && checked.operator === "typeof") {
      if (other.type !== "Literal" || typeof other.value !== "string") {
        return undefined;
      }
      checked = checked.argument;
      missing = other.value === "undefined";
    } else {
      missing = isMissingValue(other);
    }
    if (!expressionReferencesApi(checked, rule)) return undefined;
    // An API that equals a value other than undefined exists
    const existsWhenTrue = equal !== missing;
    return { whenTrue: existsWhenTrue, whenFalse: !existsWhenTrue };
  };
  return (
    compare(node.left, node.right) ??
    compare(node.right, node.left) ??
    NO_GUARANTEE
  );
}

/**
 * Determine what a feature check guarantees about the API of the rule
 */
function checkGuarantee(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  rule: AstMetadataApiWithTargetsResolver
): Guarantee {
  if (!node) return NO_GUARANTEE;
  if (node.type === "UnaryExpression" && node.operator === "!") {
    const { whenTrue, whenFalse } = checkGuarantee(node.argument, rule);
    return { whenTrue: whenFalse, whenFalse: whenTrue };
  }
  if (node.type === "LogicalExpression") {
    const left = checkGuarantee(node.left, rule);
    const right = checkGuarantee(node.right, rule);
    if (node.operator === "&&") {
      return {
        whenTrue: left.whenTrue || right.whenTrue,
        whenFalse: left.whenFalse && right.whenFalse,
      };
    }
    if (node.operator === "||") {
      return {
        whenTrue: left.whenTrue && right.whenTrue,
        whenFalse: left.whenFalse || right.whenFalse,
      };
    }
    return NO_GUARANTEE;
  }
  if (node.type === "BinaryExpression" && node.operator !== "in") {
    return comparisonGuarantee(node, rule);
  }
  // ex. `fetch`, `window.fetch` or `'fetch' in window`
  return expressionReferencesApi(node, rule)
    ? { whenTrue: true, whenFalse: false }
    : NO_GUARANTEE;
}

/**
 * Check if the API is used rather than checked, ex. `fetch()` or
 * `navigator.serviceWorker.register()`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isCalled(node: any): boolean {
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    return true;
  }
  let current = node;
  while (
    (current.parent?.type === "MemberExpression" &&
      current.parent.object === current) ||
    current.parent?.type === "ChainExpression"
  ) {
    current = current.parent;
  }
  const { parent } = current;
  return (
    (parent?.type === "CallExpression" || parent?.type === "NewExpression") &&
    parent.callee === current
  );
}

/**
 * Check if the API is assigned to, ex. by a polyfill: `window.Promise = Polyfill`
 */
function isAssigned(node: ESLintNode): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parent: any = node.parent;
  return parent?.type === "AssignmentExpression" && parent.left === node;
}

/**
 * Check if a node is guarded by a feature check of the API of the rule:
 *
 *   if (document.currentScript) {}          // <-- the check itself
 *   if ('fetch' in window) { fetch(); }     // <-- in the branch where the API exists
 *   if (!fetch) { polyfill(); } else { fetch(); }
 *   window.fetch ? fetch() : polyfill();
 *   window.fetch && fetch();
 *
 *   if (!('fetch' in window)) { return; }   // <-- after an early exit when it is missing
 *   fetch();
 *
 * Checks of unrelated conditions, ex. `if (isLoggedIn) { fetch(); }`, do not guard.
 */
function isGuardedByFeatureCheck(
  node: ESLintNode,
  rule: AstMetadataApiWithTargetsResolver
): boolean {
  // A call is a use of the API even inside a condition, ex. `if (fetch()) {}`
  const isCheck = !isCalled(node);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = node;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parent: any = node.parent;

  while (parent) {
    if (
      parent.type === "IfStatement" ||
      parent.type === "ConditionalExpression"
    ) {
      if (current === parent.test) {
        if (isCheck && expressionReferencesApi(parent.test, rule)) return true;
      } else {
        const { whenTrue, whenFalse } = checkGuarantee(parent.test, rule);
        if (current === parent.consequent ? whenTrue : whenFalse) return true;
      }
    }
    if (parent.type === "LogicalExpression") {
      if (current === parent.left) {
        // ex. `window.fetch || polyfill`
        if (isCheck && expressionReferencesApi(parent.left, rule)) return true;
      } else {
        // ex. `window.fetch && fetch()` or `!window.fetch || fetch()`
        const { whenTrue, whenFalse } = checkGuarantee(parent.left, rule);
        if (parent.operator === "&&" && whenTrue) return true;
        if (parent.operator === "||" && whenFalse) return true;
      }
    }
    if (
      (parent.type === "BlockStatement" || parent.type === "Program") &&
      Array.isArray(parent.body)
    ) {
      const stmtIndex = parent.body.indexOf(current);
      for (let i = 0; i < stmtIndex; i++) {
        const stmt = parent.body[i];
        if (
          stmt.type === "IfStatement" &&
          containsEarlyExit(stmt.consequent) &&
          checkGuarantee(stmt.test, rule).whenFalse
        ) {
          return true;
        }
      }
    }
    current = parent;
    parent = parent.parent;
  }

  return false;
}

function reportUnlessGuarded(
  context: Context,
  handleFailingRule: HandleFailingRule,
  failingRule: AstMetadataApiWithTargetsResolver,
  node: ESLintNode
) {
  if (isAssigned(node)) return;
  if (
    context.settings?.ignoreConditionalChecks === true ||
    !isGuardedByFeatureCheck(node, failingRule)
  ) {
    handleFailingRule(failingRule, node);
  }
}

export type RuleMap = Map<string, AstMetadataApiWithTargetsResolver>;

export function lintCallExpression(
  context: Context,
  handleFailingRule: HandleFailingRule,
  rulesMap: RuleMap,
  sourceCode: SourceCode,
  node: ESLintNode
) {
  if (!node.callee) return;
  const calleeName = node.callee.name;
  if (!calleeName) return;
  const failingRule = rulesMap.get(calleeName);
  if (failingRule)
    reportUnlessGuarded(context, handleFailingRule, failingRule, node);
}

export function lintNewExpression(
  context: Context,
  handleFailingRule: HandleFailingRule,
  rulesMap: RuleMap,
  sourceCode: SourceCode,
  node: ESLintNode
) {
  if (!node.callee) return;
  const calleeName = node.callee.name;
  if (!calleeName) return;
  const failingRule = rulesMap.get(calleeName);
  if (failingRule)
    reportUnlessGuarded(context, handleFailingRule, failingRule, node);
}

export function lintExpressionStatement(
  context: Context,
  handleFailingRule: HandleFailingRule,
  rulesMap: RuleMap,
  sourceCode: SourceCode,
  node: ESLintNode
) {
  if (!node?.expression?.name) return;
  const failingRule = rulesMap.get(node.expression!.name);
  if (failingRule)
    reportUnlessGuarded(context, handleFailingRule, failingRule, node);
}

function checkRegexpLiteral(node: ESLintNode): boolean {
  return (
    node.type === AstNodeTypes.Literal &&
    (!!node.regex || node.parent?.callee?.name === "RegExp")
  );
}

export function lintLiteral(
  context: Context,
  handleFailingRule: HandleFailingRule,
  rulesMap: RuleMap,
  sourceCode: SourceCode,
  node: ESLintNode
) {
  const isRegexpLiteral = checkRegexpLiteral(node);
  if (!isRegexpLiteral) return;
  for (const [syntax, rule] of rulesMap) {
    if (node.raw.includes(syntax)) {
      handleFailingRule(rule, node);
      return;
    }
  }
}

function isStringLiteral(node: ESLintNode): boolean {
  return node.type === AstNodeTypes.Literal && typeof node.value === "string";
}

function protoChainFromMemberExpression(node: ESLintNode): string[] {
  if (!node.object) return [node.name];
  const protoChain = (() => {
    if (
      node.object.type === "NewExpression" ||
      node.object.type === "CallExpression"
    ) {
      return protoChainFromMemberExpression(node.object.callee!);
    } else if (node.object.type === "ArrayExpression") {
      return ["Array"];
    } else if (isStringLiteral(node.object)) {
      return ["String"];
    } else {
      return protoChainFromMemberExpression(node.object);
    }
  })();
  return [...protoChain, node.property!.name];
}

const browserGlobals = new Set(Object.keys(globals.browser));

/**
 * Secondary lookup for built-in `obj.prop` when the map was keyed with different
 * casing for `object` (e.g. `Document` in metadata vs `document` in the AST). The
 * property name must still match the source exactly.
 */
function findMemberRuleByGlobalObjectCasing(
  rulesMap: RuleMap,
  objectName: string,
  propertyName: string
): AstMetadataApiWithTargetsResolver | undefined {
  for (const [k, rule] of rulesMap) {
    const dot = k.indexOf(".");
    if (dot === -1) continue;
    const kObj = k.slice(0, dot);
    const kProp = k.slice(dot + 1);
    if (
      kObj.toLowerCase() === objectName.toLowerCase() &&
      kProp === propertyName
    ) {
      return rule;
    }
  }
  return undefined;
}

export function lintMemberExpression(
  context: Context,
  handleFailingRule: HandleFailingRule,
  rulesMap: RuleMap,
  sourceCode: SourceCode,
  node: ESLintNode
) {
  if (!node.object || !node.property) return;
  if (
    !node.object.name ||
    node.object.name === "window" ||
    node.object.name === "globalThis"
  ) {
    // `globalThis` is skipped to find the API it is used for, but is an API itself
    const globalThisRule =
      node.object.name === "globalThis" && rulesMap.get("globalThis");
    if (globalThisRule) {
      reportUnlessGuarded(
        context,
        handleFailingRule,
        globalThisRule,
        node.object
      );
    }
    const rawProtoChain = protoChainFromMemberExpression(node);
    const [firstObj] = rawProtoChain;
    const protoChain =
      firstObj === "window" || firstObj === "globalThis"
        ? rawProtoChain.slice(1)
        : rawProtoChain;
    const protoChainId = protoChain.join(".");
    const failingRule = rulesMap.get(protoChainId);
    if (failingRule) {
      reportUnlessGuarded(context, handleFailingRule, failingRule, node);
    }
  } else {
    const objectName = node.object.name;
    const propertyName = node.property.name;
    if (!objectName || !propertyName) return;
    const isBrowserGlobal = browserGlobals.has(objectName);
    let failingRule =
      rulesMap.get(`${objectName}.${propertyName}`) ??
      rulesMap.get(objectName);

    if (!failingRule && isBrowserGlobal) {
      failingRule = findMemberRuleByGlobalObjectCasing(
        rulesMap,
        objectName,
        propertyName
      );
    }
    if (
      failingRule &&
      !isBrowserGlobal &&
      failingRule.object !== objectName
    ) {
      failingRule = undefined;
    }
    if (failingRule)
      reportUnlessGuarded(context, handleFailingRule, failingRule, node);
  }
}

export function reverseTargetMappings<K extends string, V extends string>(
  targetMappings: Record<K, V>
): Record<V, K> {
  const reversedEntries = Object.entries(targetMappings).map((entry) =>
    entry.reverse()
  );
  return Object.fromEntries(reversedEntries);
}

/**
 * Determine the targets based on the browserslist config object
 * Get the targets from the eslint config and merge them with targets in browserslist config
 * Eslint target config will be deprecated in 4.0.0
 *
 * @param configPath - The file or a directory path to look for the browserslist config file
 */
export function determineTargetsFromConfig(
  configPath: string,
  config?: BrowserListConfig,
  browserslistOptsFromConfig?: BrowsersListOpts
): Array<string> {
  const browserslistOpts = { path: configPath, ...browserslistOptsFromConfig };

  const eslintTargets = (() => {
    // Get targets from eslint settings
    if (Array.isArray(config) || typeof config === "string") {
      return browserslist(config, browserslistOpts);
    }
    if (config && typeof config === "object") {
      return browserslist(
        [...(config.production || []), ...(config.development || [])],
        browserslistOpts
      );
    }
    return [];
  })();

  if (browserslist.findConfig(configPath)) {
    // If targets are defined in ESLint and browerslist configs, merge the targets together
    if (eslintTargets.length) {
      const browserslistTargets = browserslist(undefined, browserslistOpts);
      return Array.from(new Set(eslintTargets.concat(browserslistTargets)));
    }
  } else if (eslintTargets.length) {
    return eslintTargets;
  }

  // Get targets fron browserslist configs
  return browserslist(undefined, browserslistOpts);
}

/**
 * Parses the versions that are given by browserslist and sorts them by target
 * name and then version number in descending order
 */
function parseAndSortTargets(targetslist: Array<string>): Array<Target> {
  return (
    targetslist
      .map((e: string): Target => {
        const [target, version] = e.split(" ") as [
          keyof TargetNameMappings,
          number | string,
        ];

        const parsedVersion: number = (() => {
          if (typeof version === "number") return version;
          if (version === "all") return 0;
          return version.includes("-")
            ? parseFloat(version.split("-")[0])
            : parseFloat(version);
        })();

        return {
          target,
          version,
          parsedVersion,
        };
      }) // Sort the targets by target name and then version number in descending order
      // ex. [a@3, b@3, a@1] => [a@3, a@1, b@3]
      .sort((a: Target, b: Target): number => {
        if (b.target === a.target) {
          // If any version === 'all', return 0. The only version of op_mini is 'all'
          // Otherwise, compare the versions
          return typeof b.parsedVersion === "string" ||
            typeof a.parsedVersion === "string"
            ? 0
            : b.parsedVersion - a.parsedVersion;
        }
        return b.target > a.target ? 1 : -1;
      })
  );
}

/**
 * Parses the versions that are given by browserslist. They're
 *
 * ```ts
 * parseBrowsersListVersion(['chrome 50'])
 *
 * {
 *   target: 'chrome',
 *   parsedVersion: 50,
 *   version: '50'
 * }
 * ```
 * @param targetslist - List of targest from browserslist api
 * @returns - The lowest version version of each target
 */
export function parseBrowsersListVersion(
  targetslist: Array<string>
): Array<Target> {
  return parseAndSortTargets(targetslist).filter(
    (e: Target, i: number, items: Array<Target>): boolean =>
      // Check if the current target is the last of its kind.
      // If it is, then it's the lowest version.
      i + 1 === items.length || e.target !== items[i + 1].target
  );
}

/**
 * Parses the versions that are given by browserslist like `parseBrowsersListVersion`,
 * but returns every version of each target. An API is not only missing in the lowest
 * version if it was added later: it can also be removed in a higher version, or be
 * missing in versions in between.
 *
 * @param targetslist - List of targest from browserslist api
 * @returns - All versions of each target, starting with its lowest version
 */
export function parseBrowsersListVersions(
  targetslist: Array<string>
): Array<Target> {
  const targets = parseAndSortTargets(targetslist);
  const versions: Array<Target> = [];
  // Targets of the same kind follow each other with the highest version first
  let end = targets.length;
  while (end > 0) {
    let start = end - 1;
    while (start > 0 && targets[start - 1].target === targets[end - 1].target) {
      start -= 1;
    }
    versions.unshift(...targets.slice(start, end).reverse());
    end = start;
  }
  return versions;
}

/**
 * Get the names of the targets that do not support the API of the rule. Only the
 * first unsupported version of each target is named, which is the lowest version
 * for targets from `parseBrowsersListVersions`.
 */
export function getUnsupportedTargetNames(
  rule: AstMetadataApiWithTargetsResolver,
  targets: Array<Target>
): Array<string> {
  const unsupported = new Set<string>();
  return targets.flatMap((target) => {
    if (unsupported.has(target.target)) return [];
    const names = rule.getUnsupportedTargets(rule, [target]);
    if (names.length) unsupported.add(target.target);
    return names;
  });
}
