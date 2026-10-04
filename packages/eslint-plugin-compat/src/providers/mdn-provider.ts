import apiMetadata from "@compat-lint/ast-metadata-inferer";
import memoize from "lodash.memoize";
import semver from "semver";
import { ApiMetadata } from "@compat-lint/ast-metadata-inferer/lib/types";
import { reverseTargetMappings } from "../helpers";
import { STANDARD_TARGET_NAME_MAPPING } from "../constants";
import { AstMetadataApiWithTargetsResolver, Target } from "../types";

const apis = apiMetadata as ApiMetadata[];

// @TODO Import this type from ast-metadata-inferer after migrating this project to TypeScript
const mdnRecords: Map<string, ApiMetadata> = new Map(
  apis.map((e) => [e.protoChainId, e])
);

interface TargetIdMappings {
  chrome: "chrome";
  firefox: "firefox";
  opera: "opera";
  safari: "safari";
  safari_ios: "ios_saf";
  ie: "ie";
  edge: "edge";
  opera_android: "op_mob";
  chrome_android: "and_chr";
  firefox_android: "and_ff";
  webview_android: "android";
  samsunginternet_android: "samsung";
  nodejs: "node";
}

/**
 * Map ids of mdn targets to the browser ids browserslist returns.
 * MDN has no data for the other browserslist targets (ex. op_mini, ie_mob, kaios),
 * so APIs are treated as supported there.
 */
const targetIdMappings: Readonly<TargetIdMappings> = {
  chrome: "chrome",
  firefox: "firefox",
  opera: "opera",
  safari: "safari",
  safari_ios: "ios_saf",
  ie: "ie",
  edge: "edge",
  opera_android: "op_mob",
  chrome_android: "and_chr",
  firefox_android: "and_ff",
  webview_android: "android",
  samsunginternet_android: "samsung",
  nodejs: "node",
};

const reversedTargetMappings = reverseTargetMappings(targetIdMappings);

/**
 * Take a target's id and return it's full name by using `targetNameMappings`
 * ex. {target: and_ff, version: 40} => 'Android FireFox 40'
 */
function formatTargetNames(target: Target): string {
  return `${STANDARD_TARGET_NAME_MAPPING[target.target]} ${target.version}`;
}

/**
 * Convert '9' => '9.0.0'
 */
function customCoerce(version: string): string {
  return version.length === 1 ? [version, 0, 0].join(".") : version;
}

// The same few versions are compared for every API and target
const coerceVersion = memoize((version: string): semver.SemVer | undefined => {
  return semver.coerce(customCoerce(version)) ?? undefined;
});

type SupportStatement = NonNullable<
  ApiMetadata["compat"]["support"][keyof ApiMetadata["compat"]["support"]]
>;
type SimpleSupportStatement = Exclude<SupportStatement, unknown[]>;

/**
 * An implementation that is prefixed, has another name or is behind a flag
 * can not be used under the name of the API
 */
function isUsable(statement: SimpleSupportStatement): boolean {
  return !statement.prefix && !statement.alternative_name && !statement.flags;
}

/**
 * Check if the version is in the range of versions the statement describes: from
 * the version the API was added in up to the version it was removed in, if any.
 *
 * @param semverCurrent - undefined for Safari TP, which is gte than any other release
 */
function coversVersion(
  statement: SimpleSupportStatement,
  semverCurrent: semver.SemVer | undefined,
  node: AstMetadataApiWithTargetsResolver,
  target: string
): boolean {
  const { version_added: versionAdded, version_removed: versionRemoved } =
    statement;

  if (versionRemoved) {
    const semverRemoved =
      typeof versionRemoved === "string"
        ? coerceVersion(versionRemoved)
        : undefined;
    if (!semverCurrent || !semverRemoved) return false;
    if (semver.gte(semverCurrent, semverRemoved)) return false;
  }

  // If a version is true then it is supported but version is unsure
  if (typeof versionAdded === "boolean") return versionAdded;
  if (versionAdded === null) return true;
  if (!semverCurrent) return true;
  if (!versionAdded) {
    // eslint-disable-next-line no-console
    console.warn(
      `eslint-plugin-compat: The feature ${node.protoChainId} is supported since a non-semver target "${target} ${versionAdded}", skipping. You're welcome to submit this log to https://github.com/amilajack/eslint-plugin-compat/issues for analysis.`
    );
    return true;
  }

  // A browser supports an API if its version is greater than or equal
  // to the first version of the browser that API was added in
  const semverAdded = coerceVersion(versionAdded);
  // ex. `preview`, which is not released yet
  if (!semverAdded) return false;

  return semver.gte(semverCurrent, semverAdded);
}

/*
 * Return if MDN supports the API or not
 */
export function isSupportedByMDN(
  node: AstMetadataApiWithTargetsResolver,
  { version, target: mdnTarget }: Target
): boolean {
  // @ts-expect-error Expected
  const target = reversedTargetMappings[mdnTarget];
  // If no record could be found, return true. Rules might not
  // be found because they could belong to another provider
  if (!mdnRecords.has(node.protoChainId)) return true;
  const record = mdnRecords.get(node.protoChainId);
  if (!record || !record.compat.support) return true;
  const compatRecord: SupportStatement | undefined =
    record.compat.support[target as keyof typeof record.compat.support];
  if (!compatRecord) return true;
  const statements = (
    Array.isArray(compatRecord) ? compatRecord : [compatRecord]
  ).filter((statement) => "version_added" in statement);
  if (!statements.length) return true;

  // Special case for Safari TP: TP is always gte than any other releases
  const isSafariTP = target === "safari" && version === "TP";
  const semverCurrent = coerceVersion(String(version));

  // semver.coerce() might be null for non-semvers (other than Safari TP)
  // Just warn and treat features as supported here for now to avoid lint from
  // crashing
  if (!semverCurrent && !isSafariTP) {
    // eslint-disable-next-line no-console
    console.warn(
      `eslint-plugin-compat: A non-semver target "${target} ${version}" matched for the feature ${node.protoChainId}, skipping. You're welcome to submit this log to https://github.com/amilajack/eslint-plugin-compat/issues for analysis.`
    );
    return true;
  }

  // BCD lists several statements if the support changed over time, ex. an API that
  // was implemented partially at first. Any of them can cover the version.
  return statements.some(
    (statement) =>
      isUsable(statement) &&
      coversVersion(statement, semverCurrent, node, target)
  );
}

/**
 * Return an array of all unsupported targets
 */
export function getUnsupportedTargets(
  node: AstMetadataApiWithTargetsResolver,
  targets: Target[]
): string[] {
  return targets
    .filter((target) => !isSupportedByMDN(node, target))
    .map(formatTargetNames);
}

function getMetadataName(metadata: ApiMetadata) {
  switch (metadata.protoChain.length) {
    case 1: {
      return metadata.protoChain[0];
    }
    default:
      return `${metadata.protoChain.join(".")}()`;
  }
}

const MdnProvider: Array<AstMetadataApiWithTargetsResolver> = apis
  // Create entries for each ast node type
  .map((metadata) =>
    metadata.astNodeTypes.map((astNodeType) => ({
      ...metadata,
      name: getMetadataName(metadata),
      id: metadata.protoChainId,
      protoChainId: metadata.protoChainId,
      astNodeType,
      object: metadata.protoChain[0],
      // @TODO Handle cases where 'prototype' is in protoChain
      property: metadata.protoChain[1],
    }))
  )
  // Flatten the array of arrays
  .flat()
  // Add rule and target support logic for each entry
  .map((rule) => ({
    ...rule,
    getUnsupportedTargets,
  }));

export default MdnProvider;
