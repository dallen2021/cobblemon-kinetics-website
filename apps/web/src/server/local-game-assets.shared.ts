import { basename } from "node:path";

export type LocalGameAssetProvider = "cobblemon" | "create";

export interface LocalGameAssetEntry {
  provider: LocalGameAssetProvider;
  path: string;
  sha256: string;
  byte_size: number;
  width: number;
  height: number;
  media_type: "image/png";
}

export interface LocalGameAssetSource {
  provider: LocalGameAssetProvider;
  version: string;
  archive_name: string;
  archive_sha256: string;
  asset_count: number;
  license_url: string;
  rights_status: "private_evaluation_only";
}

export interface LocalGameAssetManifest {
  manifest_version: 1;
  generated_at: string;
  notice: string;
  sources: LocalGameAssetSource[];
  assets: LocalGameAssetEntry[];
}

const sha256Pattern = /^[a-f0-9]{64}$/u;
const maxImageBytes = 8 * 1024 * 1024;
const maxImagePixels = 16_777_216;

function safeRelativeAssetPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path.toLowerCase().endsWith(".png") &&
    path.split("/").every((segment) => segment && segment !== "." && segment !== "..")
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function validateLocalGameAssetManifest(value: unknown): LocalGameAssetManifest {
  const manifest = record(value);
  if (
    manifest?.manifest_version !== 1 ||
    typeof manifest.generated_at !== "string" ||
    typeof manifest.notice !== "string" ||
    !Array.isArray(manifest.sources) ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error("Local game asset manifest is malformed.");
  }

  const providers = new Set<LocalGameAssetProvider>();
  const sources = manifest.sources.map((value) => {
    const source = record(value);
    if (!source) throw new Error("Local game asset source metadata is malformed.");
    const provider = source.provider;
    if (
      (provider !== "create" && provider !== "cobblemon") ||
      providers.has(provider) ||
      typeof source.version !== "string" ||
      !source.version ||
      typeof source.archive_name !== "string" ||
      !source.archive_name.endsWith(".jar") ||
      typeof source.archive_sha256 !== "string" ||
      !sha256Pattern.test(source.archive_sha256) ||
      typeof source.asset_count !== "number" ||
      !Number.isSafeInteger(source.asset_count) ||
      source.asset_count < 1 ||
      typeof source.license_url !== "string" ||
      source.rights_status !== "private_evaluation_only"
    ) {
      throw new Error("Local game asset source metadata is malformed.");
    }
    const license = new URL(source.license_url);
    if (license.protocol !== "https:" || license.username || license.password) {
      throw new Error("Local game asset source license URL is unsafe.");
    }
    providers.add(provider);
    return source as unknown as LocalGameAssetSource;
  });

  const seen = new Set<string>();
  const assets = manifest.assets.map((value) => {
    const asset = record(value);
    if (!asset) throw new Error("Local game asset entry is malformed.");
    const provider = asset.provider;
    const path = asset.path;
    if (
      (provider !== "create" && provider !== "cobblemon") ||
      typeof path !== "string" ||
      !safeRelativeAssetPath(path) ||
      typeof asset.sha256 !== "string" ||
      !sha256Pattern.test(asset.sha256) ||
      typeof asset.byte_size !== "number" ||
      !Number.isSafeInteger(asset.byte_size) ||
      asset.byte_size < 1 ||
      asset.byte_size > maxImageBytes ||
      typeof asset.width !== "number" ||
      !Number.isSafeInteger(asset.width) ||
      asset.width < 1 ||
      asset.width > 16_384 ||
      typeof asset.height !== "number" ||
      !Number.isSafeInteger(asset.height) ||
      asset.height < 1 ||
      asset.height > 16_384 ||
      asset.width * asset.height > maxImagePixels ||
      asset.media_type !== "image/png"
    ) {
      throw new Error("Local game asset entry is malformed.");
    }
    const key = `${provider}/${path}`;
    if (seen.has(key)) throw new Error(`Duplicate local game asset entry: ${key}`);
    seen.add(key);
    return asset as unknown as LocalGameAssetEntry;
  });

  for (const source of sources) {
    if (
      assets.filter((asset) => asset.provider === source.provider).length !== source.asset_count
    ) {
      throw new Error(`Local ${source.provider} asset count does not match its source metadata.`);
    }
  }
  if (providers.size !== 2) throw new Error("Local preview requires both source providers.");

  return {
    manifest_version: 1,
    generated_at: manifest.generated_at,
    notice: manifest.notice,
    sources,
    assets,
  };
}

export function localGameAssetUrl(asset: LocalGameAssetEntry): string {
  return `/api/local-game-assets/${asset.provider}/${asset.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function localGameAssetLabel(asset: LocalGameAssetEntry): string {
  return basename(asset.path, ".png")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function isSafeLocalGameAssetPath(path: string): boolean {
  return safeRelativeAssetPath(path);
}
