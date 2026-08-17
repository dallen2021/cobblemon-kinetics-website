import { describe, expect, it } from "vitest";

import {
  localGameAssetPreviewAvailable,
  readLocalGameAsset,
  readLocalGameAssetManifest,
} from "./local-game-assets.disabled";

describe("production local game asset boundary", () => {
  it("has no filesystem-backed preview behavior", async () => {
    expect(localGameAssetPreviewAvailable()).toBe(false);
    await expect(readLocalGameAssetManifest()).resolves.toBeNull();
    await expect(readLocalGameAsset("cobblemon", ["textures/example.png"])).resolves.toBeNull();
  });
});
