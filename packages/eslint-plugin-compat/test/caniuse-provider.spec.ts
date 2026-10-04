import {
  determineTargetsFromConfig,
  parseBrowsersListVersion,
} from "../src/helpers";
import { getUnsupportedTargets } from "../src/providers/caniuse-provider";
import { AstMetadataApiWithTargetsResolver } from "../src/types";
import expectRangeResultJSON from "./expect-range-result-config.json";

describe("CanIUseProvider", () => {
  it("should return unsupported iOS targets with range value for Fetch API", () => {
    const node = { caniuseId: "fetch" } as AstMetadataApiWithTargetsResolver;
    const config = determineTargetsFromConfig(
      ".",
      expectRangeResultJSON.browsers
    );
    const targets = parseBrowsersListVersion(config);
    const result = getUnsupportedTargets(node, targets);
    expect(result).toEqual(["iOS Safari 10.0-10.2"]);
  });

  it("should match targets that are within a caniuse version range", () => {
    const node = { caniuseId: "fetch" } as AstMetadataApiWithTargetsResolver;
    // caniuse groups these as 10.0-10.2 (unsupported) and 11.3-11.4 (supported)
    expect(
      getUnsupportedTargets(node, [
        { target: "ios_saf", version: "10.0-10.1", parsedVersion: 10 },
      ])
    ).toEqual(["iOS Safari 10.0-10.1"]);
    expect(
      getUnsupportedTargets(node, [
        { target: "ios_saf", version: "10.1", parsedVersion: 10.1 },
      ])
    ).toEqual(["iOS Safari 10.1"]);
    expect(
      getUnsupportedTargets(node, [
        { target: "ios_saf", version: "11.4", parsedVersion: 11.4 },
      ])
    ).toEqual([]);
  });

  it("should treat targets without a caniuse record as supported", () => {
    const node = { caniuseId: "fetch" } as AstMetadataApiWithTargetsResolver;
    expect(
      getUnsupportedTargets(node, [
        { target: "chrome", version: "9999", parsedVersion: 9999 },
      ])
    ).toEqual([]);
  });
});
