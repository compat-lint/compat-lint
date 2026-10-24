import path from "path";
import { determineTargetsFromConfig } from "../src/helpers";
import multiEnvPackageJSON from "./multi-config.package.json";
import singleArrayEnvPackageJSON from "./single-array-config.package.json";

// Echo the queries instead of resolving them against the rolling caniuse data,
// so these tests don't change with every browserslist or caniuse-lite release
jest.mock("browserslist", () => {
  const actual = jest.requireActual("browserslist");
  return Object.assign(
    (queries?: string | Array<string>, opts: { path?: string } = {}) =>
      [queries ?? actual.loadConfig(opts) ?? actual.defaults].flat(),
    actual
  );
});

describe("determineTargetsFromConfig", () => {
  it("should support multi env config in browserslist package.json", () => {
    expect(determineTargetsFromConfig(".", multiEnvPackageJSON.browsers))
      .toMatchInlineSnapshot(`
      [
        ">1%",
        "last 4 versions",
        "Firefox ESR",
        "not ie < 9",
        "last 1 chrome version",
      ]
    `);
  });

  it("should support resolving browserslist config in subdirectory", () => {
    // This should resolve the ./test/.browserslistrc config
    const relativeConfig = determineTargetsFromConfig(
      path.join(__dirname, ".browserslistrc")
    );
    expect(relativeConfig).toMatchInlineSnapshot(`
      [
        "chrome 70",
      ]
    `);
    const rootConfig = determineTargetsFromConfig(
      require.resolve("../package.json")
    );
    expect(rootConfig).toMatchInlineSnapshot(`
      [
        "> 0.5%",
        "last 2 versions",
        "Firefox ESR",
        "not dead",
      ]
    `);
  });

  it("should support single array config in browserslist package.json", () => {
    expect(determineTargetsFromConfig(".", singleArrayEnvPackageJSON.browsers))
      .toMatchInlineSnapshot(`
      [
        ">1%",
        "last 4 versions",
        "last 10 chrome version",
        "Firefox ESR",
        "not ie < 9",
      ]
    `);
  });

  it("should support string config in rule option", () => {
    expect(determineTargetsFromConfig(".", "defaults, not ie < 9"))
      .toMatchInlineSnapshot(`
      [
        "defaults, not ie < 9",
      ]
    `);
  });
});
