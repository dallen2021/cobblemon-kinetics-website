#!/usr/bin/env node
import { assertAllowedArgs, parseArgs } from "../lib/args.js";
import {
  validatePublicationOutputRoot,
  verifyPublishedData,
} from "../export-publication/publication.js";
import { repositoryDefaultPath } from "../lib/repository-paths.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, {
    flags: [],
  });
  const publishedRoot = await validatePublicationOutputRoot(
    repositoryDefaultPath(undefined, "data/published"),
  );
  const result = await verifyPublishedData(publishedRoot);
  if (!result.ok) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Published data verified: ${result.manifest?.files.length ?? 0} generated files.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
