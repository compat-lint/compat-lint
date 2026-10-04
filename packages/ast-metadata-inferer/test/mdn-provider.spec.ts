import browserCompatData from "@mdn/browser-compat-data";
import mdnCompatDataProvider from "../src/providers/mdn";

describe("MDN provider", () => {
  const records = mdnCompatDataProvider();
  const recordsWithId = (protoChainId: string) =>
    records.filter((record) => record.protoChainId === protoChainId);

  it("should name static members as they are used in code", () => {
    expect(recordsWithId("AbortSignal.timeout")).toEqual([
      expect.objectContaining({
        name: "timeout",
        protoChain: ["AbortSignal", "timeout"],
        compat: browserCompatData.api.AbortSignal.timeout_static.__compat,
      }),
    ]);
    expect(
      records.filter((record) => record.protoChainId.endsWith("_static"))
    ).toEqual([]);
  });

  it("should include the WebAssembly namespace as a web API", () => {
    const { api } = browserCompatData.webassembly;
    expect(recordsWithId("WebAssembly")).toEqual([
      expect.objectContaining({
        kind: "web",
        protoChain: ["WebAssembly"],
        compat: api.__compat,
      }),
    ]);
    expect(recordsWithId("WebAssembly.compile")).toEqual([
      expect.objectContaining({
        kind: "web",
        protoChain: ["WebAssembly", "compile"],
        compat: api.compile_static.__compat,
      }),
    ]);
    expect(recordsWithId("WebAssembly.Module")).toEqual([
      expect.objectContaining({
        kind: "web",
        protoChain: ["WebAssembly", "Module"],
        compat: api.Module.__compat,
      }),
    ]);
  });

  it("should prefer the static member when a prototype member has the same name", () => {
    expect(recordsWithId("Response.json")).toEqual([
      expect.objectContaining({
        compat: browserCompatData.api.Response.json_static.__compat,
      }),
    ]);
  });
});
