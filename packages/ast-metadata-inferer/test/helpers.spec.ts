import interceptAndNormalize from "../src/helpers/normalize-protochain";
import splitIntoChunks from "../src/helpers/split-into-chunks";

describe("Helpers", () => {
  it("should map APIs to correct protochain", () => {
    expect(interceptAndNormalize("NavigatorPlugins")).toEqual("navigator");
  });

  it("should split items into chunks without dropping any", () => {
    expect(splitIntoChunks([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    // Items that do not divide evenly by the number of chunks
    for (const length of [0, 1, 3, 5, 9, 10, 11]) {
      const items = Array.from({ length }, (_, i) => i);
      const chunks = splitIntoChunks(items, 4);
      expect(chunks).toHaveLength(4);
      expect(chunks.flat()).toEqual(items);
    }
  });
});
