import { describe, expect, it } from "vitest";

import { validateLocalGameAssetManifest } from "./local-game-assets";

const source = (provider: "create" | "cobblemon") => ({
  provider,
  version: "1.0.0",
  archive_name: `${provider}.jar`,
  archive_sha256: "a".repeat(64),
  asset_count: 1,
  license_url: "https://example.com/license",
  rights_status: "private_evaluation_only",
});

const asset = (provider: "create" | "cobblemon") => ({
  provider,
  path: "textures/example.png",
  sha256: "b".repeat(64),
  byte_size: 32,
  width: 16,
  height: 16,
  media_type: "image/png",
});

describe("local game asset manifest", () => {
  it("accepts an exact private two-provider manifest", () => {
    expect(
      validateLocalGameAssetManifest({
        manifest_version: 1,
        generated_at: "2026-08-14T00:00:00.000Z",
        notice: "Private evaluation only.",
        sources: [source("create"), source("cobblemon")],
        assets: [asset("create"), asset("cobblemon")],
      }).assets,
    ).toHaveLength(2);
  });

  it("rejects traversal and public-style manifest drift", () => {
    expect(() =>
      validateLocalGameAssetManifest({
        manifest_version: 1,
        generated_at: "2026-08-14T00:00:00.000Z",
        notice: "Private evaluation only.",
        sources: [source("create"), source("cobblemon")],
        assets: [asset("create"), { ...asset("cobblemon"), path: "../public/squirtle.png" }],
      }),
    ).toThrow("malformed");
  });

  it("rejects image metadata that exceeds the private decode budget", () => {
    expect(() =>
      validateLocalGameAssetManifest({
        manifest_version: 1,
        generated_at: "2026-08-14T00:00:00.000Z",
        notice: "Private evaluation only.",
        sources: [source("create"), source("cobblemon")],
        assets: [asset("create"), { ...asset("cobblemon"), width: 8192, height: 8192 }],
      }),
    ).toThrow("malformed");
  });
});
