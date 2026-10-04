// The parts of the WebIDL definitions that are used, as parsed by webidl2
type IdlType = {
  idlType: string | IdlType[];
  generic: string;
  nullable: boolean;
  union: boolean;
};

type IdlDefinition = {
  type: string;
  name?: string;
  // `Window includes WindowLocalStorage;` => target: Window, includes: WindowLocalStorage
  target?: string;
  includes?: string;
  members?: { type: string; name?: string; idlType?: IdlType }[];
};

type WebrefIdl = {
  // Parse the WebIDL definitions of all specifications, by name of the specification
  parseAll(): Promise<Record<string, IdlDefinition[]>>;
};

// @webref/idl has no type declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseAll }: WebrefIdl = require("@webref/idl");

/**
 * Get the name of the type if it is a single type, ex. `Storage` or `long`.
 * A union with `undefined` is the type that can be missing, ex. `Event` for
 * `(Event or undefined)`
 */
function singleTypeName({
  idlType,
  generic,
  union,
}: IdlType): string | undefined {
  if (typeof idlType === "string") return generic ? undefined : idlType;
  if (!union) return undefined;
  const types = idlType.filter((type) => type.idlType !== "undefined");
  return types.length === 1 ? singleTypeName(types[0]) : undefined;
}

/**
 * Get the globals of a window that are an instance of an interface, with the name
 * of that interface. ex. `localStorage` => `Storage`
 *
 * WebIDL defines them as attributes of `Window` and of the mixins it includes:
 *
 *   interface mixin WindowLocalStorage {
 *     readonly attribute Storage localStorage;
 *   };
 *   Window includes WindowLocalStorage;
 */
export default async function getInstanceGlobals(): Promise<
  Map<string, string>
> {
  const definitions = Object.values(await parseAll()).flat();
  const interfaces = new Set(
    definitions
      .filter((definition) => definition.type === "interface")
      .map((definition) => definition.name)
  );
  const windowMixins = new Set(
    definitions
      .filter(
        (definition) =>
          definition.type === "includes" && definition.target === "Window"
      )
      .map((definition) => definition.includes)
  );

  const instanceGlobals = new Map<string, string>();
  definitions
    .filter(
      ({ type, name }) =>
        (type === "interface" && name === "Window") ||
        (type === "interface mixin" && windowMixins.has(name))
    )
    .flatMap((definition) => definition.members ?? [])
    .forEach(({ type, name, idlType }) => {
      if (type !== "attribute" || !name || !idlType) return;
      // Only interfaces, ex. not `long innerWidth` or `WindowProxy self`
      const typeName = singleTypeName(idlType);
      if (!typeName || !interfaces.has(typeName)) return;
      instanceGlobals.set(name, typeName);
    });

  return instanceGlobals;
}
