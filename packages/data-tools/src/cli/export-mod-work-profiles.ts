#!/usr/bin/env node
import { exportModWorkProfiles } from "../export-publication/publication.js";
import { assertAllowedArgs, optionalFlag, parseArgs } from "../lib/args.js";
import { verifyCleanGitPublicationSource } from "../lib/git-source.js";
import { repositoryDefaultPath, repositoryRootPath } from "../lib/repository-paths.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, {
    flags: ["output", "source-repository", "source-commit"],
  });
  const sourceRepository = optionalFlag(args, "source-repository") ?? process.env.GITHUB_REPOSITORY;
  const sourceCommit = optionalFlag(args, "source-commit") ?? process.env.GITHUB_SHA;
  if (!sourceRepository || !sourceCommit) {
    throw new Error(
      "Usage: pnpm data:export-mod -- --source-repository <owner/name> --source-commit <full-git-sha> [--output <path>]",
    );
  }

  const outputRoot = repositoryDefaultPath(optionalFlag(args, "output"), ".private/mod-export");
  const publishedRoot = repositoryDefaultPath(undefined, "data/published");
  const verifiedSource = await verifyCleanGitPublicationSource({
    repositoryRoot: repositoryRootPath(),
    publishedRoot,
    requestedRepository: sourceRepository,
    requestedCommit: sourceCommit,
  });
  const manifest = await exportModWorkProfiles({
    publishedRoot,
    outputRoot,
    sourceRepository: verifiedSource.repository,
    sourceCommit: verifiedSource.commit,
  });
  console.log(
    `Exported ${manifest.files.length} mod work profile${manifest.files.length === 1 ? "" : "s"} with provenance to ${outputRoot}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
