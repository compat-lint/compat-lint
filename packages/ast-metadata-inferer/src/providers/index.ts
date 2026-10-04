import mdnCompatData from "./mdn";
// @TODO: Needs to return compat records
// import MsApiCatalogProvider from "./MsApiCatalogProvider";
import getInstanceGlobals from "../helpers/instance-globals";
import interceptAndNormalize from "../helpers/normalize-protochain";
import type { ProviderApiMetadata } from "../types";

// BCD also lists values such as `Permissions.permission_clipboard-read` that code can't write as `a.b`
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Create the records for the members of instance globals. Compat data lists them
 * by interface, but code uses them with the name of the global.
 * ex. `Storage.getItem` => `localStorage.getItem` and `sessionStorage.getItem`
 */
export function instanceGlobalRecords(
  records: ProviderApiMetadata[],
  instanceGlobals: Map<string, string>
): ProviderApiMetadata[] {
  const membersByObject = new Map<string, ProviderApiMetadata[]>();
  records.forEach((record) => {
    // Only members with compat data of their own
    if (record.protoChain.length !== 2 || !record.compat?.support) return;
    const [object, member] = record.protoChain;
    // The compat data of the interface itself
    if (member === "__compat") return;
    membersByObject.set(object, [
      ...(membersByObject.get(object) ?? []),
      record,
    ]);
  });

  return Array.from(instanceGlobals).flatMap(([instanceGlobal, instanceOf]) => {
    // Some interfaces are already named as their global, ex. `Document` as `document`
    const object = interceptAndNormalize(instanceOf);
    if (object === instanceGlobal) return [];
    return (membersByObject.get(object) ?? []).map((record) => {
      const protoChain = [instanceGlobal, record.protoChain[1]];
      const protoChainId = protoChain.join(".");
      return {
        ...record,
        id: protoChainId,
        protoChain,
        protoChainId,
        instanceOf,
      };
    });
  });
}

export default async function Providers(): Promise<ProviderApiMetadata[]> {
  const [mdnRecords, instanceGlobals] = await Promise.all([
    mdnCompatData(),
    getInstanceGlobals(),
  ]);
  const map: Map<string, ProviderApiMetadata> = new Map<
    string,
    ProviderApiMetadata
  >(mdnRecords.map((record) => [record.protoChainId, record]));
  instanceGlobalRecords(mdnRecords, instanceGlobals).forEach((record) => {
    if (!map.has(record.protoChainId)) map.set(record.protoChainId, record);
  });

  return Array.from(map.values()).filter(
    (record) =>
      !record.protoChain.includes("RegExp") &&
      !record.protoChainId.includes("@@") &&
      record.protoChain.every((name) => IDENTIFIER.test(name))
  );
}
