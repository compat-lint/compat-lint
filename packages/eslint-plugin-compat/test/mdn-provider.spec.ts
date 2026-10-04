import {
  determineTargetsFromConfig,
  parseBrowsersListVersion,
} from "../src/helpers";
import { getUnsupportedTargets } from "../src/providers/mdn-provider";
import { AstMetadataApiWithTargetsResolver } from "../src/types";

function unsupportedTargets(protoChainId: string, browsers: string[]) {
  const node = { protoChainId } as AstMetadataApiWithTargetsResolver;
  // Keep every version instead of only the lowest one of each browser
  const targets = determineTargetsFromConfig(".", browsers).flatMap((target) =>
    parseBrowsersListVersion([target])
  );
  return getUnsupportedTargets(node, targets);
}

describe("MdnProvider", () => {
  it("should support Safari TP", () => {
    const node = {
      protoChainId: "AbortController",
    } as AstMetadataApiWithTargetsResolver;
    const config = determineTargetsFromConfig(".", ["safari tp"]);
    const targets = parseBrowsersListVersion(config);
    const result = getUnsupportedTargets(node, targets);
    expect(result).toEqual([]);
  });

  it("should support versions covered by an earlier implementation", () => {
    // Firefox: added in 60, and before that from 1 to 59 on HTMLDocument only
    expect(
      unsupportedTargets("document.body", ["firefox 38", "firefox 60"])
    ).toEqual([]);
    // Safari: added in 12.1, and partially implemented from 11.1
    expect(
      unsupportedTargets("AbortController", [
        "safari 11",
        "safari 11.1",
        "safari 12.1",
      ])
    ).toEqual(["Safari 11"]);
    // Node.js: several implementations between 14.17.0 and 17.2.0
    expect(
      unsupportedTargets("AbortController.abort", [
        "node 14.16",
        "node 14.17",
        "node 16.14",
        "node 17.0",
        "node 18.0",
      ])
    ).toEqual(["Node.js 14.16.0"]);
  });

  it("should not support versions after an API was removed", () => {
    // Firefox: added in 43 and removed in 52
    expect(
      unsupportedTargets("BatteryManager", [
        "firefox 42",
        "firefox 43",
        "firefox 51",
        "firefox 52",
        "firefox 100",
      ])
    ).toEqual(["Firefox 100", "Firefox 52", "Firefox 42"]);
  });

  it("should not support implementations that are prefixed, renamed or behind a flag", () => {
    // IE 11: only as `msFullscreenElement`
    expect(unsupportedTargets("document.fullscreenElement", ["ie 11"])).toEqual(
      ["IE 11"]
    );
    // Opera: renamed to `Coordinates` in 16, after the implementation from 10.6 to 12.1
    expect(
      unsupportedTargets("GeolocationCoordinates", ["opera 12.1", "opera 100"])
    ).toEqual(["Opera 100"]);
    // Firefox: only behind a preference
    expect(unsupportedTargets("PaymentRequest", ["firefox 100"])).toEqual([
      "Firefox 100",
    ]);
  });
});
