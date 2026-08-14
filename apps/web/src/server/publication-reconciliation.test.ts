import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PublishedManifest } from "@cobblemon-kinetics/domain";
import { createLocalPublicationBundle } from "./publication-bundle";
import {
  fetchManifestAtCommit,
  isGitCommitSha,
  isPublicationId,
  parseReconciliationResult,
  validateManifestForBundle,
  verifyCommitOnPublicationBranch,
  verifyManifestFilesAtCommit,
} from "./publication-reconciliation";

async function matchingManifest(): Promise<{
  bundle: Awaited<ReturnType<typeof createLocalPublicationBundle>>;
  manifest: PublishedManifest;
}> {
  const bundle = await createLocalPublicationBundle("publication-20260814-hydro-slice");
  return {
    bundle,
    manifest: {
      manifest_version: 1,
      schema_version: bundle.schema_version,
      batch_id: bundle.batch_id,
      bundle_content_sha256: bundle.integrity.content_sha256,
      files: [
        {
          path: "assets/manifest.json",
          sha256: "a".repeat(64),
          kind: "asset_manifest",
          record_count: 0,
        },
        { path: "jobs/hydro-operator.json", sha256: "b".repeat(64), kind: "job", record_count: 1 },
        {
          path: "machines/hydro-coupler.json",
          sha256: "c".repeat(64),
          kind: "machine",
          record_count: 1,
        },
        {
          path: "pokemon/gen1.json",
          sha256: "d".repeat(64),
          kind: "pokemon_collection",
          record_count: 1,
        },
        {
          path: "work_profiles/hydro_operator.json",
          sha256: "e".repeat(64),
          kind: "work_profile",
          record_count: 1,
        },
      ],
    },
  };
}

describe("publication reconciliation", () => {
  it("fetches a manifest only from an exact GitHub commit", async () => {
    const { manifest } = await matchingManifest();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(manifest), { status: 200 }));
    const sha = "1".repeat(40);
    await expect(fetchManifestAtCommit("studio/project", sha, fetcher)).resolves.toEqual(manifest);
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      `https://raw.githubusercontent.com/studio/project/${sha}/data/published/manifest.json`,
    );
  });

  it("rejects unsafe repositories and non-exact commit references", async () => {
    const fetcher = vi.fn();
    await expect(fetchManifestAtCommit("../project", "1".repeat(40), fetcher)).rejects.toThrow(
      /owner\/repository/u,
    );
    await expect(fetchManifestAtCommit("studio/project", "main", fetcher)).rejects.toThrow(
      /40 lowercase/u,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(isGitCommitSha("a".repeat(40))).toBe(true);
    expect(isGitCommitSha("A".repeat(40))).toBe(false);
    expect(isPublicationId("publication-20260814-squirtle-hydro-r13-abcdef0123456789")).toBe(true);
    expect(isPublicationId("../../publication")).toBe(false);
  });

  it("requires the exact batch hash, identity, and generated file set", async () => {
    const { bundle, manifest } = await matchingManifest();
    expect(validateManifestForBundle(manifest, bundle)).toEqual(manifest);
    expect(() =>
      validateManifestForBundle({ ...manifest, bundle_content_sha256: "f".repeat(64) }, bundle),
    ).toThrow(/approved publication bundle/u);
    expect(() =>
      validateManifestForBundle({ ...manifest, files: manifest.files.slice(1) }, bundle),
    ).toThrow(/complete publication output/u);
    expect(() => validateManifestForBundle({ ...manifest, private_note: "leak" }, bundle)).toThrow(
      /private or quarantined/u,
    );
  });

  it("accepts only a commit reachable from the repository default branch", async () => {
    const sha = "a".repeat(40);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ahead",
            base_commit: { sha },
            merge_base_commit: { sha },
          }),
        ),
      );
    await expect(
      verifyCommitOnPublicationBranch("studio/project", sha, undefined, fetcher),
    ).resolves.toBe("main");
    expect(fetcher.mock.calls[1]?.[0].toString()).toContain(`/compare/${sha}...main?per_page=1`);
  });

  it("rejects an unmerged or divergent commit", async () => {
    const sha = "a".repeat(40);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "diverged",
            base_commit: { sha },
            merge_base_commit: { sha: "b".repeat(40) },
          }),
        ),
      );
    await expect(
      verifyCommitOnPublicationBranch("studio/project", sha, undefined, fetcher),
    ).rejects.toThrow(/not reachable/u);
  });

  it("rejects published bytes that do not match their manifest hash", async () => {
    const { bundle, manifest } = await matchingManifest();
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    await expect(
      verifyManifestFilesAtCommit("studio/project", "a".repeat(40), manifest, bundle, fetcher),
    ).rejects.toThrow(/manifest hash/u);
  });

  it("also rejects correctly hashed JSON that differs from the frozen bundle", async () => {
    const { bundle, manifest } = await matchingManifest();
    const wrongBytes = JSON.stringify({ assets: [{ private_note: "not the frozen manifest" }] });
    const wrongHash = createHash("sha256").update(wrongBytes).digest("hex");
    const alteredManifest = {
      ...manifest,
      files: [{ ...manifest.files[0], sha256: wrongHash }, ...manifest.files.slice(1)],
    } as PublishedManifest;
    const fetcher = vi.fn().mockResolvedValue(new Response(wrongBytes));
    await expect(
      verifyManifestFilesAtCommit(
        "studio/project",
        "a".repeat(40),
        alteredManifest,
        bundle,
        fetcher,
      ),
    ).rejects.toThrow(/frozen publication bundle/u);
  });

  it("accepts only the exact published batch and commit from reconciliation", () => {
    const publicationId = "publication-20260814-squirtle-hydro-r13-abcdef0123456789";
    const commitSha = "a".repeat(40);
    const result = {
      publication: {
        public_id: publicationId,
        state: "published",
        git_commit_sha: commitSha,
        published_at: "2026-08-14T20:10:00.000Z",
      },
      manifest: {},
    };
    expect(parseReconciliationResult(result, publicationId, commitSha)).toEqual({
      publicationId,
      commitSha,
      publishedAt: "2026-08-14T20:10:00.000Z",
    });
    expect(() =>
      parseReconciliationResult(
        {
          ...result,
          publication: { ...result.publication, git_commit_sha: "b".repeat(40) },
        },
        publicationId,
        commitSha,
      ),
    ).toThrow(/inconsistent/u);
  });
});
