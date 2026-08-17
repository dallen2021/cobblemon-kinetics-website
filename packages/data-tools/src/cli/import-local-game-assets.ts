#!/usr/bin/env node
import {
  importLocalGameAssets,
  localAssetRootRelativeToRepository,
} from "../assets/local-game-assets.js";
import { assertAllowedArgs, parseArgs, requiredFlag } from "../lib/args.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, {
    flags: ["create-jar", "create-version", "cobblemon-jar", "cobblemon-version"],
  });
  const result = await importLocalGameAssets({
    createJar: requiredFlag(args, "create-jar"),
    createVersion: requiredFlag(args, "create-version"),
    cobblemonJar: requiredFlag(args, "cobblemon-jar"),
    cobblemonVersion: requiredFlag(args, "cobblemon-version"),
  });
  console.log(
    `Local source preview ready: ${result.manifest.assets.length} PNG assets from ${result.manifest.sources.length} installed JARs.`,
  );
  console.log(`Private output: ${localAssetRootRelativeToRepository(result.root)}`);
  console.log("Nothing was added to Git or the public website bundle.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
