import fs from "fs";
import path from "path";
import providers from "./providers";
import astNodeTypesTester from "./helpers/ast-node-types-tester";
import splitIntoChunks from "./helpers/split-into-chunks";
import { ProviderApiMetadata } from "./types";

const API_BLACKLIST = ["close", "confirm", "print"];

export default async function astMetadataInferer(): Promise<
  ProviderApiMetadata[]
> {
  const providerResults = await providers();
  const records = providerResults.filter(
    (metadata) => !API_BLACKLIST.includes(metadata.name)
  );
  const file = path.join(__dirname, "..", "metadata.json");

  if (fs.existsSync(file)) {
    await fs.promises.unlink(file);
  }

  const parallelisim = 4;
  const recordsWithMetadata = await Promise.all(
    splitIntoChunks(records, parallelisim).map((chunk) =>
      astNodeTypesTester(chunk)
    )
  ).then((res) => res.flat());

  await fs.promises.writeFile(file, JSON.stringify(recordsWithMetadata));

  return recordsWithMetadata;
}
