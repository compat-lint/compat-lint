import * as lite from "caniuse-lite";
import memoize from "lodash.memoize";
import { AstNodeTypes, STANDARD_TARGET_NAME_MAPPING } from "../constants";
import { AstMetadataApiWithTargetsResolver, Target } from "../types";

/**
 * Take a target's id and return it's full name by using `targetNameMappings`
 * ex. {target: and_ff, version: 40} => 'Android FireFox 40'
 */
function formatTargetNames(target: Target): string {
  const name = STANDARD_TARGET_NAME_MAPPING[target.target] || target.target;
  return `${name} ${target.version}`;
}

/**
 * Check if a browser version is in the range format
 * ex. 10.0-10.2
 */
function versionIsRange(version: string): boolean {
  return version.includes("-");
}

/**
 * Check if the parsed version from browserslist is covered by a version from
 * caniuse. A caniuse version is either a range or a single version:
 *
 * - range, ex. "10.0-10.2": covers every version from 10.0 up to and including 10.2
 * - single version, ex. "10.3": only covers 10.3
 * - not a number, ex. "all" or "TP": covers nothing
 */
function isVersionInRange(
  targetVersion: number,
  statsVersion: string
): boolean {
  if (!versionIsRange(statsVersion)) {
    return targetVersion === parseFloat(statsVersion);
  }

  const [lowerBound, upperBound] = statsVersion.split("-").map(parseFloat);
  return lowerBound <= targetVersion && targetVersion <= upperBound;
}

// Unpacking the data of a feature is expensive and every target needs it
const getFeature = memoize((caniuseId: string) =>
  lite.feature(lite.features[caniuseId])
);

/*
 * Check the CanIUse database to see if targets are supported
 *
 * If no record could be found, return true. Rules might not
 * be found because they could belong to another provider
 */
function isSupportedByCanIUse(
  node: AstMetadataApiWithTargetsResolver,
  { version, target, parsedVersion }: Target
): boolean {
  if (!node.caniuseId) return false;

  const data = getFeature(node.caniuseId);

  if (!data) return true;
  const { stats } = data;
  if (!(target in stats)) return true;

  const targetStats = stats[target];

  // Versions are grouped differently between caniuse-lite versions (ex. 10.0-10.2
  // vs 10.0-10.3), so fall back to the record that the target's lowest version is in
  const statsVersion =
    version in targetStats
      ? version
      : Object.keys(targetStats).find((key: string): boolean =>
          isVersionInRange(parsedVersion, key)
        );

  // @TODO: This assumes that all versions are included in the cainuse db. If this is incorrect,
  //        this will return false negatives.
  //        Ex. given query for 50 and only version 40 exists in db records, return true
  if (statsVersion === undefined || !targetStats[statsVersion]) return true;

  return targetStats[statsVersion].includes("y");
}

/**
 * Return an array of all unsupported targets
 */
export function getUnsupportedTargets(
  node: AstMetadataApiWithTargetsResolver,
  targets: Target[]
): string[] {
  return targets
    .filter((target) => !isSupportedByCanIUse(node, target))
    .map(formatTargetNames);
}

const CanIUseProvider: Array<AstMetadataApiWithTargetsResolver> = [
  // new ServiceWorker()
  {
    caniuseId: "serviceworkers",
    astNodeType: AstNodeTypes.NewExpression,
    object: "ServiceWorker",
  },
  {
    caniuseId: "serviceworkers",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "navigator",
    property: "serviceWorker",
  },
  // document.querySelector()
  {
    caniuseId: "queryselector",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "document",
    property: "querySelector",
  },
  // IntersectionObserver
  {
    caniuseId: "intersectionobserver",
    astNodeType: AstNodeTypes.NewExpression,
    object: "IntersectionObserver",
  },
  // ResizeObserver
  {
    caniuseId: "resizeobserver",
    astNodeType: AstNodeTypes.NewExpression,
    object: "ResizeObserver",
  },
  // PaymentRequest
  {
    caniuseId: "payment-request",
    astNodeType: AstNodeTypes.NewExpression,
    object: "PaymentRequest",
  },
  // Promises
  {
    caniuseId: "promises",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Promise",
  },
  {
    caniuseId: "promises",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "Promise",
    property: "resolve",
  },
  {
    caniuseId: "promises",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "Promise",
    property: "all",
  },
  {
    caniuseId: "promises",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "Promise",
    property: "race",
  },
  {
    caniuseId: "promises",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "Promise",
    property: "reject",
  },
  // fetch
  {
    caniuseId: "fetch",
    astNodeType: AstNodeTypes.CallExpression,
    object: "fetch",
  },
  // document.currentScript()
  {
    caniuseId: "document-currentscript",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "document",
    property: "currentScript",
  },
  // URL
  {
    caniuseId: "url",
    astNodeType: AstNodeTypes.NewExpression,
    object: "URL",
  },
  // URLSearchParams
  {
    caniuseId: "urlsearchparams",
    astNodeType: AstNodeTypes.NewExpression,
    object: "URLSearchParams",
  },
  // performance.now()
  {
    caniuseId: "high-resolution-time",
    astNodeType: AstNodeTypes.MemberExpression,
    object: "performance",
    property: "now",
  },
  // requestIdleCallback()
  {
    caniuseId: "requestidlecallback",
    astNodeType: AstNodeTypes.CallExpression,
    object: "requestIdleCallback",
  },
  // requestAnimationFrame()
  {
    caniuseId: "requestanimationframe",
    astNodeType: AstNodeTypes.CallExpression,
    object: "requestAnimationFrame",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "TypedArray",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Int8Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Uint8Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Uint8ClampedArray",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Int16Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Uint16Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Int32Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Uint32Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Float32Array",
  },
  {
    caniuseId: "typedarrays",
    astNodeType: AstNodeTypes.NewExpression,
    object: "Float64Array",
  },
  {
    caniuseId: "js-regexp-lookbehind",
    astNodeType: AstNodeTypes.Literal,
    name: "Lookbehind",
    object: "RegExp",
    syntaxes: ["?<=", "?<!"],
  },
].map((rule) => ({
  ...rule,
  getUnsupportedTargets,
  id: rule.property ? `${rule.object}.${rule.property}` : rule.object,
  protoChainId: rule.property ? `${rule.object}.${rule.property}` : rule.object,
  protoChain: rule.property ? [rule.object, rule.property] : [rule.object],
}));

export default CanIUseProvider;
