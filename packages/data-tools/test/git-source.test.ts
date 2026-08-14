import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  githubRepositoryFromRemote,
  repositoryPathIsIgnored,
  trackedFilesUnder,
  verifyCleanGitPublicationSource,
} from "../src/lib/git-source.js";

function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function repositoryFixture(): Promise<{
  root: string;
  publishedRoot: string;
  commit: string;
}> {
  const root = await mkdtemp(resolve(tmpdir(), "kinetics-git-source-"));
  const publishedRoot = resolve(root, "data/published");
  await mkdir(publishedRoot, { recursive: true });
  await writeFile(resolve(root, ".gitignore"), "/.private/\n", "utf8");
  await writeFile(resolve(publishedRoot, "manifest.json"), '{"manifest_version":1}\n', "utf8");
  git(root, "init", "--quiet");
  git(root, "config", "user.name", "Test Maintainer");
  git(root, "config", "user.email", "maintainer@example.test");
  git(root, "remote", "add", "origin", "https://github.com/studio/project.git");
  git(root, "add", ".gitignore", "data/published/manifest.json");
  git(root, "commit", "--quiet", "-m", "test fixture");
  return { root, publishedRoot, commit: git(root, "rev-parse", "HEAD") };
}

describe("Git publication source attestation", () => {
  it("normalizes supported GitHub origin forms", () => {
    expect(githubRepositoryFromRemote("https://github.com/studio/project.git")).toBe(
      "studio/project",
    );
    expect(githubRepositoryFromRemote("git@github.com:studio/project.git")).toBe("studio/project");
    expect(githubRepositoryFromRemote("ssh://git@github.com/studio/project.git")).toBe(
      "studio/project",
    );
    expect(() => githubRepositoryFromRemote("file:///tmp/project")).toThrow(/GitHub HTTPS or SSH/);
  });

  it("attests a clean checkout, matching origin, HEAD, and committed publication bytes", async () => {
    const fixture = await repositoryFixture();
    try {
      await expect(
        verifyCleanGitPublicationSource({
          repositoryRoot: fixture.root,
          publishedRoot: fixture.publishedRoot,
          requestedRepository: "studio/project",
          requestedCommit: fixture.commit,
        }),
      ).resolves.toEqual({ repository: "studio/project", commit: fixture.commit });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects mismatched provenance and any dirty checkout", async () => {
    const fixture = await repositoryFixture();
    try {
      await expect(
        verifyCleanGitPublicationSource({
          repositoryRoot: fixture.root,
          publishedRoot: fixture.publishedRoot,
          requestedRepository: "another/project",
          requestedCommit: fixture.commit,
        }),
      ).rejects.toThrow(/does not match this checkout's origin/);
      await expect(
        verifyCleanGitPublicationSource({
          repositoryRoot: fixture.root,
          publishedRoot: fixture.publishedRoot,
          requestedRepository: "studio/project",
          requestedCommit: "f".repeat(40),
        }),
      ).rejects.toThrow(/does not match this checkout's HEAD/);

      await writeFile(resolve(fixture.root, "uncommitted.txt"), "dirty\n", "utf8");
      await expect(
        verifyCleanGitPublicationSource({
          repositoryRoot: fixture.root,
          publishedRoot: fixture.publishedRoot,
          requestedRepository: "studio/project",
          requestedCommit: fixture.commit,
        }),
      ).rejects.toThrow(/completely clean/);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("compares publication bytes even when Git status is told to hide a change", async () => {
    const fixture = await repositoryFixture();
    try {
      git(fixture.root, "update-index", "--assume-unchanged", "data/published/manifest.json");
      await writeFile(resolve(fixture.publishedRoot, "manifest.json"), '{"manifest_version":2}\n');
      expect(git(fixture.root, "status", "--porcelain=v1")).toBe("");
      await expect(
        verifyCleanGitPublicationSource({
          repositoryRoot: fixture.root,
          publishedRoot: fixture.publishedRoot,
          requestedRepository: "studio/project",
          requestedCommit: fixture.commit,
        }),
      ).rejects.toThrow(/bytes do not match/);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("detects tracked targets and confirms ignored private outputs", async () => {
    const fixture = await repositoryFixture();
    try {
      const ignoredOutput = resolve(fixture.root, ".private/release/mod-export");
      expect(repositoryPathIsIgnored(fixture.root, ignoredOutput)).toBe(true);
      expect(trackedFilesUnder(fixture.root, ignoredOutput)).toEqual([]);

      const trackedOutput = resolve(fixture.root, ".private/tracked/mod-export");
      await mkdir(trackedOutput, { recursive: true });
      await writeFile(resolve(trackedOutput, "manifest.json"), "{}\n", "utf8");
      git(fixture.root, "add", "--force", ".private/tracked/mod-export/manifest.json");
      expect(trackedFilesUnder(fixture.root, trackedOutput)).toEqual([
        ".private/tracked/mod-export/manifest.json",
      ]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
