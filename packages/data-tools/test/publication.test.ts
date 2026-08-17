import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  AssetManifest,
  PublicationBundlePayload,
  PublicBlueprintRecord,
  PublicNamedRecord,
  PublicPokemon,
  WorkProfile,
} from "@cobblemon-kinetics/domain";

import {
  applyPublicationBundle,
  createPublicationBundle,
  exportModWorkProfiles,
  validateModExportOutputRoot,
  validatePublicationOutputRoot,
  verifyPublishedData,
  verifyPublicationBundleIntegrity,
} from "../src/export-publication/publication.js";
import { sha256 } from "../src/lib/canonical-json.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixtureRoot = resolve(repositoryRoot, "data/published");
const sandboxRoot = resolve(repositoryRoot, ".private/test-sandboxes/publication-tests");
const sourceRepository = "cobblemon-kinetics/studio";
const sourceCommit = "a".repeat(40);

async function fixture<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(fixtureRoot, path), "utf8")) as T;
}

async function sandbox(label: string): Promise<string> {
  await mkdir(sandboxRoot, { recursive: true });
  return mkdtemp(resolve(sandboxRoot, `${label}-`));
}

async function payload(): Promise<PublicationBundlePayload> {
  const collection = await fixture<{ pokemon: PublicPokemon[] }>("pokemon/gen1.json");
  const formPublicId = collection.pokemon[0]!.form.public_id;
  const blueprints: PublicBlueprintRecord[] = [
    {
      format_version: 1,
      public_id: formPublicId,
      record_kind: "pokemon_form",
      name: "Squirtle",
      status: "approved",
      species_public_id: collection.pokemon[0]!.public_id,
      form_key: "default",
      aspects: [],
    },
    {
      format_version: 1,
      public_id: "cobblemon_kinetics:capability/water-flow",
      record_kind: "capability",
      name: "Water Flow",
      status: "approved",
      category: "fluid_handling",
      description: "Direct a bounded Water-type flow.",
      tier_min: 1,
      tier_max: 4,
    },
    {
      format_version: 1,
      public_id: "cobblemon_kinetics:relationship/squirtle-water-flow",
      record_kind: "relationship",
      name: "Squirtle has Water Flow",
      status: "approved",
      source_public_id: formPublicId,
      target_public_id: "cobblemon_kinetics:capability/water-flow",
      relationship_kind: "has_capability",
      metadata: { tier: 1 },
      inheritance_decision: "add",
      parent_relationship_public_id: null,
    },
  ];
  return {
    bundle_version: 1,
    schema_version: "1.0.0",
    batch_id: "cobblemon_kinetics:test_publication",
    records: {
      pokemon: collection.pokemon,
      jobs: [await fixture<PublicNamedRecord>("jobs/hydro-operator.json")],
      machines: [await fixture<PublicNamedRecord>("machines/hydro-coupler.json")],
      work_profiles: [await fixture<WorkProfile>("work_profiles/hydro_operator.json")],
      blueprints,
    },
    asset_manifest: await fixture<AssetManifest>("assets/manifest.json"),
  };
}

describe("publication pipeline", () => {
  it("requires a valid signature and applies byte-stable canonical published data only", async () => {
    const key = "test-signing-key-that-is-not-a-production-secret";
    const bundle = createPublicationBundle(await payload(), key);
    expect(() => verifyPublicationBundleIntegrity(bundle, { signingKey: key })).not.toThrow();
    expect(() => verifyPublicationBundleIntegrity(bundle, { signingKey: "wrong" })).toThrow(
      /signature/,
    );

    const root = await sandbox("apply");
    try {
      const published = resolve(root, "published");
      const first = await applyPublicationBundle(bundle, {
        publishedRoot: published,
        signingKey: key,
      });
      const firstManifest = await readFile(resolve(published, "manifest.json"), "utf8");
      const second = await applyPublicationBundle(bundle, {
        publishedRoot: published,
        signingKey: key,
      });
      expect(second).toEqual(first);
      expect(await readFile(resolve(published, "manifest.json"), "utf8")).toBe(firstManifest);
      expect(await verifyPublishedData(published)).toMatchObject({ ok: true, errors: [] });
      expect(
        JSON.parse(await readFile(resolve(published, "blueprints/records.json"), "utf8")),
      ).toMatchObject({ format_version: 1, records: bundle.records.blueprints });
      await expect(readFile(resolve(root, "work_profiles/hydro_operator.json"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a published Blueprint relationship whose endpoint is absent", async () => {
    const unsafePayload = await payload();
    const relationship = unsafePayload.records.blueprints!.find(
      (record) => record.record_kind === "relationship",
    );
    expect(relationship?.record_kind).toBe("relationship");
    if (!relationship || relationship.record_kind !== "relationship") return;
    relationship.target_public_id = "cobblemon_kinetics:capability/missing";
    const root = await sandbox("missing-blueprint-endpoint");
    try {
      await expect(
        applyPublicationBundle(createPublicationBundle(unsafePayload, "test-key"), {
          publishedRoot: resolve(root, "published"),
          signingKey: "test-key",
        }),
      ).rejects.toThrow(/missing target/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates a deterministic, portable mod export with provenance", async () => {
    const key = "test-signing-key-that-is-not-a-production-secret";
    const bundle = createPublicationBundle(await payload(), key);
    const root = await sandbox("mod-export");
    try {
      const published = resolve(root, "published");
      const output = resolve(root, "mod-export");
      await applyPublicationBundle(bundle, { publishedRoot: published, signingKey: key });

      const first = await exportModWorkProfiles({
        publishedRoot: published,
        outputRoot: output,
        sourceRepository,
        sourceCommit,
      });
      const firstManifestRaw = await readFile(resolve(output, "manifest.json"), "utf8");
      const firstProfileRaw = await readFile(
        resolve(output, "work_profiles/hydro_operator.json"),
        "utf8",
      );
      const second = await exportModWorkProfiles({
        publishedRoot: published,
        outputRoot: output,
        sourceRepository,
        sourceCommit,
      });

      expect(second).toEqual(first);
      expect(await readFile(resolve(output, "manifest.json"), "utf8")).toBe(firstManifestRaw);
      expect(await readFile(resolve(output, "work_profiles/hydro_operator.json"), "utf8")).toBe(
        firstProfileRaw,
      );
      expect(first).toMatchObject({
        manifest_version: 1,
        source: {
          repository: sourceRepository,
          commit_sha: sourceCommit,
          publication_manifest_sha256: sha256(
            await readFile(resolve(published, "manifest.json"), "utf8"),
          ),
        },
        publication: {
          batch_id: bundle.batch_id,
          schema_version: bundle.schema_version,
          bundle_content_sha256: bundle.integrity.content_sha256,
        },
        files: [
          {
            path: "work_profiles/hydro_operator.json",
            profile_id: "cobblemon_kinetics:hydro_operator",
            format_version: 1,
            sha256: sha256(firstProfileRaw),
          },
        ],
      });
      expect(firstProfileRaw).toBe(
        await readFile(resolve(published, "work_profiles/hydro_operator.json"), "utf8"),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects public-data drift before verification or mod export", async () => {
    const key = "test-signing-key-that-is-not-a-production-secret";
    const bundle = createPublicationBundle(await payload(), key);
    const root = await sandbox("drift");
    try {
      const published = resolve(root, "published");
      await applyPublicationBundle(bundle, { publishedRoot: published, signingKey: key });
      await writeFile(resolve(published, "jobs/hydro-operator.json"), "{}\n", "utf8");
      const verification = await verifyPublishedData(published);
      expect(verification.ok).toBe(false);
      expect(verification.errors.join(" ")).toMatch(/SHA-256|invalid job/);
      await expect(
        exportModWorkProfiles({
          publishedRoot: published,
          outputRoot: resolve(root, "mod-export"),
          sourceRepository,
          sourceCommit,
        }),
      ).rejects.toThrow(/must verify/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects format-only manifest drift so provenance remains byte-deterministic", async () => {
    const key = "test-signing-key-that-is-not-a-production-secret";
    const root = await sandbox("manifest-format");
    try {
      const publishedRoot = resolve(root, "published");
      await applyPublicationBundle(createPublicationBundle(await payload(), key), {
        publishedRoot,
        signingKey: key,
      });
      const manifestPath = resolve(publishedRoot, "manifest.json");
      const canonicalManifest = await readFile(manifestPath, "utf8");
      await writeFile(manifestPath, ` ${canonicalManifest}`, "utf8");

      const verification = await verifyPublishedData(publishedRoot);
      expect(verification.ok).toBe(false);
      expect(verification.errors).toContain("Published manifest is not in canonical JSON format.");
      await expect(
        exportModWorkProfiles({
          publishedRoot,
          outputRoot: resolve(root, "mod-export"),
          sourceRepository,
          sourceCommit,
        }),
      ).rejects.toThrow(/must verify/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects later-generation records without replacing canonical data", async () => {
    const key = "test-signing-key-that-is-not-a-production-secret";
    const root = await sandbox("generation");
    try {
      const publishedRoot = resolve(root, "published");
      await applyPublicationBundle(createPublicationBundle(await payload(), key), {
        publishedRoot,
        signingKey: key,
      });
      const previousManifest = await readFile(resolve(publishedRoot, "manifest.json"), "utf8");

      const unsafePayload = await payload();
      unsafePayload.records.pokemon[0] = {
        ...unsafePayload.records.pokemon[0]!,
        generation: 2,
        national_dex: 152,
      };
      const bundle = createPublicationBundle(unsafePayload, key);

      await expect(
        applyPublicationBundle(bundle, { publishedRoot, signingKey: key }),
      ).rejects.toThrow(/accepts only Generation I species/u);
      expect(await readFile(resolve(publishedRoot, "manifest.json"), "utf8")).toBe(
        previousManifest,
      );
      expect(await verifyPublishedData(publishedRoot)).toMatchObject({ ok: true, errors: [] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restricts generated outputs to named directories inside the website repository", async () => {
    const safePublished = resolve(sandboxRoot, "path-safety/published");
    const safeModExport = resolve(sandboxRoot, "path-safety/mod-export");
    await expect(validatePublicationOutputRoot(safePublished)).resolves.toBe(safePublished);
    await expect(validateModExportOutputRoot(safeModExport)).resolves.toBe(safeModExport);
    await expect(validatePublicationOutputRoot("/")).rejects.toThrow(/broad/);
    await expect(validatePublicationOutputRoot(homedir())).rejects.toThrow(/broad/);
    await expect(validatePublicationOutputRoot(repositoryRoot)).rejects.toThrow(/broad/);
    await expect(
      validatePublicationOutputRoot(resolve(repositoryRoot, "../published")),
    ).rejects.toThrow(/inside the repository/);
    await expect(
      validateModExportOutputRoot(resolve(repositoryRoot, "../mod-export")),
    ).rejects.toThrow(/inside the repository/);
    await expect(
      validateModExportOutputRoot(resolve(repositoryRoot, "packages/data-tools/mod-export")),
    ).rejects.toThrow(/ignored \.private directory/);
    await expect(validatePublicationOutputRoot(resolve(sandboxRoot, "wrong-name"))).rejects.toThrow(
      /must be named published/,
    );
    await expect(
      validateModExportOutputRoot(resolve(sandboxRoot, "work_profiles")),
    ).rejects.toThrow(/must be named mod-export/);

    const key = "test-signing-key-that-is-not-a-production-secret";
    const root = await sandbox("nested-output");
    try {
      const publishedRoot = resolve(root, "published");
      await applyPublicationBundle(createPublicationBundle(await payload(), key), {
        publishedRoot,
        signingKey: key,
      });
      await expect(
        exportModWorkProfiles({
          publishedRoot,
          outputRoot: resolve(publishedRoot, "mod-export"),
          sourceRepository,
          sourceCommit,
        }),
      ).rejects.toThrow(/distinct and non-nested/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires explicit, stable source provenance without mutating an existing export", async () => {
    const key = "test-signing-key-that-is-not-a-production-secret";
    const root = await sandbox("provenance");
    try {
      const publishedRoot = resolve(root, "published");
      const outputRoot = resolve(root, "mod-export");
      await applyPublicationBundle(createPublicationBundle(await payload(), key), {
        publishedRoot,
        signingKey: key,
      });
      await exportModWorkProfiles({
        publishedRoot,
        outputRoot,
        sourceRepository,
        sourceCommit,
      });
      const previousManifest = await readFile(resolve(outputRoot, "manifest.json"), "utf8");

      await expect(
        exportModWorkProfiles({
          publishedRoot,
          outputRoot,
          sourceRepository: "../mod-repository",
          sourceCommit,
        }),
      ).rejects.toThrow(/source repository/);
      await expect(
        exportModWorkProfiles({
          publishedRoot,
          outputRoot,
          sourceRepository,
          sourceCommit: "deadbeef",
        }),
      ).rejects.toThrow(/40-character/);
      expect(await readFile(resolve(outputRoot, "manifest.json"), "utf8")).toBe(previousManifest);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
