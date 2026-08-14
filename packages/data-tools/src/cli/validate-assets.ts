#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import type { AssetManifest } from "@cobblemon-kinetics/domain";

import {
  readAssetPolicy,
  validateAssetsAgainstPolicy,
  validatePublicAssetProjection,
} from "../assets/asset-policy.js";
import { assertAllowedArgs, optionalFlag, parseArgs } from "../lib/args.js";
import { repositoryDefaultPath } from "../lib/repository-paths.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, { flags: ["policy", "manifest"] });
  const policy = await readAssetPolicy(
    repositoryDefaultPath(optionalFlag(args, "policy"), "data/asset-policy.yml"),
  );
  const manifest = JSON.parse(
    await readFile(
      repositoryDefaultPath(optionalFlag(args, "manifest"), "data/published/assets/manifest.json"),
      "utf8",
    ),
  ) as AssetManifest;
  const errors = [
    ...validateAssetsAgainstPolicy(manifest, policy),
    ...validatePublicAssetProjection(manifest),
  ];
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Asset manifest verified: ${manifest.assets.length} approved entries.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
