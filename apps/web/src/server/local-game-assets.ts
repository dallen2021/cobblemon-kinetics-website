import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { getAppBaseUrl, isProductionDeployment } from "@/lib/env";
import {
  isSafeLocalGameAssetPath,
  type LocalGameAssetEntry,
  type LocalGameAssetManifest,
  validateLocalGameAssetManifest,
} from "@/server/local-game-assets.shared";

export * from "@/server/local-game-assets.shared";

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isPathInside(parent: string, candidate: string): boolean {
  const child = relative(resolve(parent), resolve(candidate));
  return child.length > 0 && !child.startsWith("..") && !isAbsolute(child);
}

function configuredManifestRoot(): string | null {
  const configured = process.env.LOCAL_GAME_ASSET_ROOT?.trim();
  if (!configured) return null;
  return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

async function canonicalManifestRoot(): Promise<string | null> {
  const configured = configuredManifestRoot();
  if (!configured) return null;
  const privateRoot = resolve(configured, "..");
  const privateStats = await lstat(privateRoot);
  const rootStats = await lstat(configured);
  if (
    privateStats.isSymbolicLink() ||
    !privateStats.isDirectory() ||
    rootStats.isSymbolicLink() ||
    !rootStats.isDirectory()
  ) {
    throw new Error("Local game asset directories must be regular directories.");
  }
  const canonicalPrivateRoot = await realpath(privateRoot);
  const canonicalRoot = await realpath(/* turbopackIgnore: true */ configured);
  if (!isPathInside(canonicalPrivateRoot, canonicalRoot)) {
    throw new Error("Local game asset root escaped its private workspace.");
  }
  return canonicalRoot;
}

export function localGameAssetPreviewAvailable(): boolean {
  const base = getAppBaseUrl();
  return (
    !isProductionDeployment() &&
    Boolean(configuredManifestRoot() && base && isLoopbackHostname(base.hostname))
  );
}

export async function readLocalGameAssetManifest(): Promise<LocalGameAssetManifest | null> {
  if (!localGameAssetPreviewAvailable()) return null;
  try {
    const manifestRoot = await canonicalManifestRoot();
    if (!manifestRoot) return null;
    return validateLocalGameAssetManifest(
      JSON.parse(await readFile(resolve(manifestRoot, "manifest.json"), "utf8")) as unknown,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readLocalGameAsset(
  provider: string,
  pathSegments: readonly string[],
): Promise<{ bytes: Buffer; asset: LocalGameAssetEntry } | null> {
  if (!localGameAssetPreviewAvailable()) return null;
  if (provider !== "create" && provider !== "cobblemon") return null;
  const path = pathSegments.join("/");
  if (!isSafeLocalGameAssetPath(path)) return null;
  const manifest = await readLocalGameAssetManifest();
  const asset = manifest?.assets.find(
    (entry) => entry.provider === provider && entry.path === path,
  );
  if (!asset) return null;

  const manifestRoot = await canonicalManifestRoot();
  if (!manifestRoot) return null;
  const providerRoot = resolve(manifestRoot, "files", provider);
  const providerStats = await lstat(providerRoot);
  if (providerStats.isSymbolicLink() || !providerStats.isDirectory()) return null;
  const canonicalProviderRoot = await realpath(providerRoot);
  if (!isPathInside(manifestRoot, canonicalProviderRoot)) return null;
  const file = resolve(canonicalProviderRoot, ...pathSegments);
  if (!isPathInside(canonicalProviderRoot, file)) return null;
  const stats = await lstat(file);
  if (stats.isSymbolicLink() || !stats.isFile() || stats.size !== asset.byte_size) return null;
  const canonicalFile = await realpath(file);
  if (!isPathInside(canonicalProviderRoot, canonicalFile)) return null;
  const bytes = await readFile(canonicalFile);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) return null;
  return { bytes, asset };
}
