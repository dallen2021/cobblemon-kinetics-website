import { describe, expect, it } from "vitest";

import type { AssetManifest } from "@cobblemon-kinetics/domain";

import {
  validateAssetsAgainstPolicy,
  validatePublicAssetProjection,
  type AssetPolicy,
} from "../src/assets/asset-policy.js";

const denyPolicy: AssetPolicy = {
  version: 1,
  default_action: "deny",
  providers: {
    project_original: { enabled: true, allow_public: true, note: "Reviewed original work." },
    create: { enabled: false, allow_public: false, note: "Not cleared." },
  },
};

describe("asset policy", () => {
  it("accepts an empty deny-by-default manifest", () => {
    expect(validateAssetsAgainstPolicy({ manifest_version: 1, assets: [] }, denyPolicy)).toEqual(
      [],
    );
  });

  it("rejects publication from a disabled provider", () => {
    const manifest: AssetManifest = {
      manifest_version: 1,
      assets: [
        {
          asset_key: "cobblemon_kinetics:test",
          bound_record_id: "cobblemon_kinetics:hydro_coupler",
          provider: "create",
          source_mod: "Create",
          source_version: "test",
          source_archive_url: "https://example.invalid/create.jar",
          source_archive_sha256: "a".repeat(64),
          archive_path: "assets/create/example.png",
          input_sha256: "b".repeat(64),
          output_sha256: "c".repeat(64),
          transform: "none",
          license_id: "ARR",
          license_url: "https://example.invalid/license",
          attribution: "Example",
          reviewer: "Test reviewer",
          review_date: "2026-08-14",
          rights_status: "approved",
          permitted_visibility: "public",
          publication_state: "published",
        },
      ],
    };
    expect(validateAssetsAgainstPolicy(manifest, denyPolicy).join(" ")).toMatch(
      /provider create is disabled/,
    );
  });

  it("keeps draft or private asset records out of Git-published projections", () => {
    const manifest: AssetManifest = {
      manifest_version: 1,
      assets: [
        {
          asset_key: "cobblemon_kinetics:draft",
          bound_record_id: "cobblemon_kinetics:hydro_coupler",
          provider: "project_original",
          source_mod: "Cobblemon Kinetics",
          source_version: "test",
          source_archive_url: "https://example.invalid/original.zip",
          source_archive_sha256: "a".repeat(64),
          archive_path: "brand/draft.png",
          input_sha256: "b".repeat(64),
          output_sha256: "c".repeat(64),
          transform: "none",
          license_id: "Project contribution",
          license_url: "https://example.invalid/license",
          attribution: "Test fixture",
          reviewer: "Test reviewer",
          review_date: "2026-08-14",
          rights_status: "needs_review",
          permitted_visibility: "private",
          publication_state: "draft",
        },
      ],
    };
    expect(validateAssetsAgainstPolicy(manifest, denyPolicy)).toEqual([]);
    expect(validatePublicAssetProjection(manifest).join(" ")).toMatch(
      /Git-published asset projections/,
    );
  });
});
