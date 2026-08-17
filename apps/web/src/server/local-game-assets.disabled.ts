import type {
  LocalGameAssetEntry,
  LocalGameAssetManifest,
} from "@/server/local-game-assets.shared";

export * from "@/server/local-game-assets.shared";

export function localGameAssetPreviewAvailable(): boolean {
  return false;
}

export async function readLocalGameAssetManifest(): Promise<LocalGameAssetManifest | null> {
  return null;
}

export async function readLocalGameAsset(
  provider: string,
  pathSegments: readonly string[],
): Promise<{ bytes: Buffer; asset: LocalGameAssetEntry } | null> {
  void provider;
  void pathSegments;
  return null;
}
