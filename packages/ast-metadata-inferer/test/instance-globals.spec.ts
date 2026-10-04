import browserCompatData from "@mdn/browser-compat-data";
import getInstanceGlobals from "../src/helpers/instance-globals";
import providers, { instanceGlobalRecords } from "../src/providers";
import mdnCompatDataProvider from "../src/providers/mdn";

describe("Instance globals", () => {
  it("should infer the interface of instance globals from WebIDL", async () => {
    const instanceGlobals = await getInstanceGlobals();
    // Attributes of `Window` and of the mixins it includes
    expect(instanceGlobals.get("customElements")).toEqual(
      "CustomElementRegistry"
    );
    expect(instanceGlobals.get("localStorage")).toEqual("Storage");
    expect(instanceGlobals.get("sessionStorage")).toEqual("Storage");
    expect(instanceGlobals.get("caches")).toEqual("CacheStorage");
    expect(instanceGlobals.get("crypto")).toEqual("Crypto");
    expect(instanceGlobals.get("indexedDB")).toEqual("IDBFactory");
    expect(instanceGlobals.get("document")).toEqual("Document");
    // Nullable attributes
    expect(instanceGlobals.get("visualViewport")).toEqual("VisualViewport");
    // Attributes that can be undefined: `(Event or undefined) event`
    expect(instanceGlobals.get("event")).toEqual("Event");
  });

  it("should not infer an interface for other globals", async () => {
    const instanceGlobals = await getInstanceGlobals();
    // long, DOMString, WindowProxy, any, EventHandler
    ["innerWidth", "name", "self", "opener", "onload"].forEach((name) => {
      expect(instanceGlobals.has(name)).toBe(false);
    });
    // Operations and names that are not part of Window
    ["fetch", "alert", "Storage"].forEach((name) => {
      expect(instanceGlobals.has(name)).toBe(false);
    });
  });

  it("should name the members of an interface as members of its globals", () => {
    const records = instanceGlobalRecords(
      mdnCompatDataProvider(),
      new Map([
        ["localStorage", "Storage"],
        ["sessionStorage", "Storage"],
        ["crypto", "Crypto"],
      ])
    );
    const ids = records.map((record) => record.protoChainId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "localStorage.getItem",
        "sessionStorage.getItem",
        "crypto.randomUUID",
      ])
    );
    expect(ids.filter((id) => id.endsWith(".__compat"))).toEqual([]);
    expect(
      records.find((record) => record.protoChainId === "localStorage.getItem")
    ).toEqual(
      expect.objectContaining({
        id: "localStorage.getItem",
        name: "getItem",
        kind: "web",
        protoChain: ["localStorage", "getItem"],
        instanceOf: "Storage",
        compat: browserCompatData.api.Storage.getItem.__compat,
      })
    );
  });

  it("should not add members for interfaces that are named as their global", () => {
    // `Document.querySelector` is already `document.querySelector`
    expect(
      instanceGlobalRecords(
        mdnCompatDataProvider(),
        new Map([["document", "Document"]])
      )
    ).toEqual([]);
  });

  it("should use the members of an interface that is named as another global", () => {
    // `Navigator.share` is named `navigator.share`
    const records = instanceGlobalRecords(
      mdnCompatDataProvider(),
      new Map([["clientInformation", "Navigator"]])
    );
    expect(
      records.find(
        (record) => record.protoChainId === "clientInformation.share"
      )
    ).toEqual(
      expect.objectContaining({
        instanceOf: "Navigator",
        compat: browserCompatData.api.Navigator.share.__compat,
      })
    );
  });

  it("should provide the members of instance globals without duplicates", async () => {
    const records = await providers();
    const ids = records.map((record) => record.protoChainId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "caches.open",
        "customElements.define",
        "indexedDB.open",
        "Storage.getItem",
        "document.querySelector",
      ])
    );
    expect(ids).toHaveLength(new Set(ids).size);
    // The global itself keeps its own compat data
    expect(records.find((record) => record.protoChainId === "caches")).toEqual(
      expect.objectContaining({
        compat: browserCompatData.api.caches.__compat,
      })
    );
  });
});
