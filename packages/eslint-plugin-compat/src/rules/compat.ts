/*
 * Step 2) Logic that handles AST traversal
 * Does not handle looking up the API
 * Handles checking what kinds of eslint nodes should be linted
 *   Tells eslint to lint certain nodes  (lintCallExpression, lintMemberExpression, lintNewExpression)
 *   Gets protochain for the ESLint nodes the plugin is interested in
 */
import { Rule } from "eslint";
import findUp from "find-up";
import fs from "fs";
import memoize from "lodash.memoize";
import path from "path";
import {
  determineTargetsFromConfig,
  getUnsupportedTargetNames,
  lintCallExpression,
  lintExpressionStatement,
  lintLiteral,
  lintMemberExpression,
  lintNewExpression,
  parseBrowsersListVersions,
  type RuleMap,
} from "../helpers"; // will be deprecated and introduced to this file
import { nodes } from "../providers";
import {
  AstMetadataApiWithTargetsResolver,
  BrowserListConfig,
  BrowsersListOpts,
  Context,
  ESLintNode,
  HandleFailingRule,
} from "../types";

type ESLint = {
  [astNodeTypeName: string]: (node: ESLintNode) => void;
};

/**
 * Get the identifier a node starts with, ex. `Map` for `new Map().size`
 */
function getRootIdentifier(
  node: ESLintNode | undefined
): ESLintNode | undefined {
  switch (node?.type) {
    case "Identifier":
      return node;
    case "MemberExpression":
      return getRootIdentifier(node.object);
    case "CallExpression":
    case "NewExpression":
      return getRootIdentifier(node.callee);
    case "ExpressionStatement":
    case "ChainExpression":
      return getRootIdentifier(node.expression);
    default:
      return undefined;
  }
}

/**
 * Check if the name a node starts with is declared in the file and visible from the
 * node, ex. as an import, variable, parameter, function or class. It then does not
 * refer to the global API of that name.
 */
function isDeclaredInFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceCode: any,
  node: ESLintNode
): boolean {
  const identifier = getRootIdentifier(node);
  if (!identifier) return false;
  for (
    let scope = sourceCode.getScope(identifier);
    scope;
    scope = scope.upper
  ) {
    const variable = scope.set.get(identifier.name);
    // Globals are not defined in the file
    if (variable) return variable.defs.length > 0;
  }
  return false;
}

function generateErrorName(
  rule: AstMetadataApiWithTargetsResolver,
  node: ESLintNode
): string {
  const name =
    rule.name ??
    (rule.property ? `${rule.object}.${rule.property}` : rule.object);
  // Only a member that is called is named as a method, ex. `Array.from()` in
  // `Array.from([])`, but `location.origin` or `new WebAssembly.Module()`
  const isCalled =
    node.parent?.type === "CallExpression" && node.parent.callee === node;
  return rule.property && isCalled ? `${name}()` : name;
}

const getPolyfillSet = memoize(
  (polyfillArrayJSON: string): Set<string> =>
    new Set(JSON.parse(polyfillArrayJSON))
);

function isPolyfilled(
  context: Context,
  rule: AstMetadataApiWithTargetsResolver
): boolean {
  if (!context.settings?.polyfills) return false;
  const polyfills = getPolyfillSet(JSON.stringify(context.settings.polyfills));
  return (
    // v2 allowed users to select polyfills based off their caniuseId. This is
    polyfills.has(rule.id) || // no longer supported. Keeping this here to avoid breaking changes.
    polyfills.has(rule.protoChainId) || // Check if polyfill is provided (ex. `Promise.all`)
    polyfills.has(rule.protoChain[0]) || // Check if entire API is polyfilled (ex. `Promise`)
    // Check if the interface of an instance global is polyfilled
    // (ex. `Crypto.randomUUID` or `Crypto` for `crypto.randomUUID`)
    (!!rule.instanceOf &&
      (polyfills.has(`${rule.instanceOf}.${rule.property}`) ||
        polyfills.has(rule.instanceOf)))
  );
}

const babelConfigs = [
  "babel.config.json",
  "babel.config.js",
  "babel.config.cjs",
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
  ".babelrc.cjs",
];

/**
 * Determine if a user has a babel config, which we use to infer if the linted code is polyfilled.
 * Memoized by directory so multiple files in the same project reuse the result.
 */
const isUsingTranspiler = memoize(
  (filePath: string): boolean => {
    const dir = path.dirname(filePath);
    const configPath = findUp.sync(babelConfigs, {
      cwd: dir,
    });
    if (configPath) return true;
    const pkgPath = findUp.sync("package.json", {
      cwd: dir,
    });
    // Check if babel property exists
    if (pkgPath) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath).toString());
      return !!pkg.babel;
    }
    return false;
  },
  (filePath: string) => path.resolve(path.dirname(filePath))
);

type RuleMapsForTargets = {
  callExpression: RuleMap;
  newExpression: RuleMap;
  expressionStatement: RuleMap;
  memberExpression: RuleMap;
  literal: RuleMap;
};

/**
 * A small optimization that only lints APIs that are not supported by targeted browsers.
 * For example, if the user is targeting chrome 50, which supports the fetch API, it is
 * wasteful to lint calls to fetch.
 * Returns Maps for O(1) rule lookup per node (first match wins).
 */
const getRulesForTargets = memoize(
  (targetsJSON: string, lintAllEsApis: boolean): RuleMapsForTargets => {
    const byType = {
      CallExpression: [] as AstMetadataApiWithTargetsResolver[],
      NewExpression: [] as AstMetadataApiWithTargetsResolver[],
      MemberExpression: [] as AstMetadataApiWithTargetsResolver[],
      ExpressionStatement: [] as AstMetadataApiWithTargetsResolver[],
      Literal: [] as AstMetadataApiWithTargetsResolver[],
    };
    const targets = JSON.parse(targetsJSON);

    nodes
      .filter((node) => (lintAllEsApis ? true : node.kind !== "es"))
      .forEach((node) => {
        if (!getUnsupportedTargetNames(node, targets).length) return;
        byType[node.astNodeType].push(node);
      });

    const callExpression = new Map<string, AstMetadataApiWithTargetsResolver>();
    for (const rule of byType.CallExpression) {
      if (!callExpression.has(rule.object)) callExpression.set(rule.object, rule);
    }
    const newExpression = new Map<string, AstMetadataApiWithTargetsResolver>();
    for (const rule of byType.NewExpression) {
      if (!newExpression.has(rule.object)) newExpression.set(rule.object, rule);
    }
    const expressionStatement = new Map<string, AstMetadataApiWithTargetsResolver>();
    for (const rule of [...byType.MemberExpression, ...byType.CallExpression]) {
      if (!expressionStatement.has(rule.object))
        expressionStatement.set(rule.object, rule);
    }
    const memberExpression = new Map<string, AstMetadataApiWithTargetsResolver>();
    for (const rule of [
      ...byType.MemberExpression,
      ...byType.CallExpression,
      ...byType.NewExpression,
    ]) {
      if (!memberExpression.has(rule.protoChainId))
        memberExpression.set(rule.protoChainId, rule);
      const key = rule.property
        ? `${rule.object}.${rule.property}`
        : rule.object;
      if (!memberExpression.has(key)) memberExpression.set(key, rule);
    }
    const literal = new Map<string, AstMetadataApiWithTargetsResolver>();
    for (const rule of byType.Literal) {
      for (const syntax of rule.syntaxes ?? []) {
        if (!literal.has(syntax)) literal.set(syntax, rule);
      }
    }

    return {
      callExpression,
      newExpression,
      expressionStatement,
      memberExpression,
      literal,
    };
  },
  // lodash.memoize keys on the first argument only by default; include lintAllEsApis
  // so the cache does not return the wrong rules when targets match but ES filtering differs.
  (targetsJSON, lintAllEsApis) => `${targetsJSON}\0${lintAllEsApis}`
);

export default {
  meta: {
    docs: {
      description: "Ensure cross-browser API compatibility",
      category: "Compatibility",
      url: "https://github.com/amilajack/eslint-plugin-compat/blob/main/docs/rules/compat.md",
      recommended: true,
    },
    type: "problem",
    schema: [{ type: "string" }],
  },
  create(context: Context): ESLint {
    const sourceCode =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context as any).sourceCode ?? (context as any).getSourceCode();

    // Determine all targets from browserslist config, which reads user's
    // package.json config section. Use config from eslintrc for testing purposes
    const browserslistConfig: BrowserListConfig =
      context.settings?.browsers ||
      context.settings?.targets ||
      context.options[0];

    if (
      !context.settings?.browserslistOpts &&
      // @ts-expect-error Checking for accidental misspellings
      context.settings.browsersListOpts
    ) {
      // eslint-disable-next-line -- CLI
      console.error(
        'Please ensure you spell `browserslistOpts` with a lowercase "l"!'
      );
    }
    const browserslistOpts: BrowsersListOpts | undefined =
      context.settings?.browserslistOpts;

    const browserslistDir =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context as any).filename ?? (context as any).getFilename();
    const lintAllEsApis: boolean =
      context.settings?.lintAllEsApis === true ||
      // Attempt to infer polyfilling of ES APIs from babel config
      (!context.settings?.polyfills?.includes("es:all") &&
        !isUsingTranspiler(browserslistDir));
    const browserslistTargets = parseBrowsersListVersions(
      determineTargetsFromConfig(
        browserslistDir,
        browserslistConfig,
        browserslistOpts
      )
    );

    // Stringify to support memoization; browserslistConfig is always an array of new objects.
    const ruleMaps = getRulesForTargets(
      JSON.stringify(browserslistTargets),
      lintAllEsApis
    );

    // Cache getUnsupportedTargets per rule; targets are fixed for this context.
    const unsupportedTargetsByRule = new Map<string, string>();
    const getUnsupportedTargetsMessage = (
      rule: AstMetadataApiWithTargetsResolver
    ): string => {
      let message = unsupportedTargetsByRule.get(rule.id);
      if (message === undefined) {
        message = getUnsupportedTargetNames(rule, browserslistTargets).join(
          ", "
        );
        unsupportedTargetsByRule.set(rule.id, message);
      }
      return message;
    };

    const handleFailingRule: HandleFailingRule = (
      node: AstMetadataApiWithTargetsResolver,
      eslintNode: ESLintNode
    ) => {
      if (isPolyfilled(context, node)) return;
      // ex. `import { Set } from 'immutable'` or `items.map(fetch => fetch.id)`
      if (isDeclaredInFile(sourceCode, eslintNode)) return;
      context.report({
        node: eslintNode,
        message: [
          generateErrorName(node, eslintNode),
          "is not supported in",
          getUnsupportedTargetsMessage(node),
        ].join(" "),
      } as Rule.ReportDescriptor);
    };

    return {
      CallExpression: lintCallExpression.bind(
        null,
        context,
        handleFailingRule,
        ruleMaps.callExpression,
        sourceCode
      ),
      NewExpression: lintNewExpression.bind(
        null,
        context,
        handleFailingRule,
        ruleMaps.newExpression,
        sourceCode
      ),
      ExpressionStatement: lintExpressionStatement.bind(
        null,
        context,
        handleFailingRule,
        ruleMaps.expressionStatement,
        sourceCode
      ),
      MemberExpression: lintMemberExpression.bind(
        null,
        context,
        handleFailingRule,
        ruleMaps.memberExpression,
        sourceCode
      ),
      Literal: lintLiteral.bind(
        null,
        context,
        handleFailingRule,
        ruleMaps.literal,
        sourceCode
      ),
    };
  },
} as unknown as Rule.RuleModule;
