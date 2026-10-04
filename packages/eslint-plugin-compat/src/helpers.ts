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
function isInsideIfStatement(
  node: ESLintNode,
  sourceCode: SourceCode,
  context: Context
) {
  // Handle both ESLint 8 and 9 - getAncestors moved from context to sourceCode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ancestors: any;
  if ("getAncestors" in sourceCode) {
    // @ts-expect-error - ESLint 9+ uses sourceCode.getAncestors
    ancestors = sourceCode?.getAncestors?.(node);
  } else {
    // ESLint 8 uses context.getAncestors - cast to any for compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ancestors = (context as any).getAncestors?.();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ancestors?.some((ancestor: any) => {
    return ancestor.type === "IfStatement";
  });
}

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
  const names = chain.filter(
    (name, i) => name !== "prototype" && !(i === 0 && GLOBAL_OBJECTS.has(name))
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
 * Detect the early-return guard pattern:
 *
 *   if (!('foo' in window)) { return; }
 *   window.foo.bar();  // <-- this node is guarded
 *
 * Walks up from the node to the nearest block body, then checks preceding
 * sibling statements for an if-with-early-exit whose test references the
 * same API as the failing rule.
 */
function isGuardedByEarlyReturn(
  node: ESLintNode,
  failingRule: AstMetadataApiWithTargetsResolver
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = node;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parent: any = node.parent;

  while (parent) {
    if (
      (parent.type === "BlockStatement" || parent.type === "Program") &&
      Array.isArray(parent.body)
    ) {
      const stmtIndex = parent.body.indexOf(current);
      if (stmtIndex > 0) {
        for (let i = 0; i < stmtIndex; i++) {
          const stmt = parent.body[i];
          if (
            stmt.type === "IfStatement" &&
            containsEarlyExit(stmt.consequent) &&
            expressionReferencesApi(stmt.test, failingRule)
          ) {
            return true;
          }
        }
      }
      break;
    }
    current = parent;
    parent = parent.parent;
  }

  return false;
}

function checkNotInsideIfStatementAndReport(
  context: Context,
  handleFailingRule: HandleFailingRule,
  failingRule: AstMetadataApiWithTargetsResolver,
  sourceCode: SourceCode,
  node: ESLintNode
) {
  if (
    context.settings?.ignoreConditionalChecks === true ||
    (!isInsideIfStatement(node, sourceCode, context) &&
      !isGuardedByEarlyReturn(node, failingRule))
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
    checkNotInsideIfStatementAndReport(
      context,
      handleFailingRule,
      failingRule,
      sourceCode,
      node
    );
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
    checkNotInsideIfStatementAndReport(
      context,
      handleFailingRule,
      failingRule,
      sourceCode,
      node
    );
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
    checkNotInsideIfStatementAndReport(
      context,
      handleFailingRule,
      failingRule,
      sourceCode,
      node
    );
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
    const rawProtoChain = protoChainFromMemberExpression(node);
    const [firstObj] = rawProtoChain;
    const protoChain =
      firstObj === "window" || firstObj === "globalThis"
        ? rawProtoChain.slice(1)
        : rawProtoChain;
    const protoChainId = protoChain.join(".");
    const failingRule = rulesMap.get(protoChainId);
    if (failingRule) {
      checkNotInsideIfStatementAndReport(
        context,
        handleFailingRule,
        failingRule,
        sourceCode,
        node
      );
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
      checkNotInsideIfStatementAndReport(
        context,
        handleFailingRule,
        failingRule,
        sourceCode,
        node
      );
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
  return (
    // Sort the targets by target name and then version number in ascending order
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
      }) // First last target always has the latest version
      .filter(
        (e: Target, i: number, items: Array<Target>): boolean =>
          // Check if the current target is the last of its kind.
          // If it is, then it's the most recent version.
          i + 1 === items.length || e.target !== items[i + 1].target
      )
  );
}
