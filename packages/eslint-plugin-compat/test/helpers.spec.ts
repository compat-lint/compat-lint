import {
  determineTargetsFromConfig,
  parseBrowsersListVersion,
  parseBrowsersListVersions,
} from "../src/helpers";
import singleVersionEnvPackageJSON from "./single-version-config.package.json";

describe("Versioning", () => {
  it("should support single version config in browserslist package.json", () => {
    const config = determineTargetsFromConfig(
      ".",
      singleVersionEnvPackageJSON.browsers
    );
    const result = parseBrowsersListVersion(config);
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "parsedVersion": 8,
          "target": "safari",
          "version": "8",
        },
        {
          "parsedVersion": 9,
          "target": "ie",
          "version": "9",
        },
        {
          "parsedVersion": 20,
          "target": "firefox",
          "version": "20",
        },
        {
          "parsedVersion": 32,
          "target": "chrome",
          "version": "32",
        },
      ]
    `);
  });

  it("should get lowest target versions", () => {
    const versions = [
      "chrome 20",
      "chrome 30",
      "node 7",
      "chrome 30.5",
      "firefox 50.5",
    ];
    expect(parseBrowsersListVersion(versions)).toMatchSnapshot();
  });

  it("should get all target versions starting with the lowest", () => {
    const versions = [
      "chrome 20",
      "chrome 30",
      "node 7",
      "chrome 30.5",
      "firefox 50.5",
    ];
    expect(
      parseBrowsersListVersions(versions).map(
        ({ target, version }) => `${target} ${version}`
      )
    ).toEqual([
      "node 7",
      "firefox 50.5",
      "chrome 20",
      "chrome 30",
      "chrome 30.5",
    ]);
  });

  it("should fail on incorrect browserslist target version", () => {
    expect(() => {
      determineTargetsFromConfig(".", "edge 100000");
    }).toThrow("Unknown version 100000 of edge");
  });
});
