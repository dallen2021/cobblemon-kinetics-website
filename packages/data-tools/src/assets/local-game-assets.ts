import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { crc32 } from "node:zlib";

import { PNG } from "pngjs";
import { type Entry, openPromise, type ZipFile } from "yauzl";

import {
  canonicalDirectoryTarget,
  isPathInside,
  repositoryRootPath,
} from "../lib/repository-paths.js";

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

interface ImportSource {
  provider: LocalGameAssetProvider;
  version: string;
  jarPath: string;
  licenseUrl: string;
}

const LOCAL_ASSET_ROOT = ".private/local-game-assets";
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 100_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 128 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_777_216;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function pngDimensions(bytes: Buffer): { width: number; height: number } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("A selected image entry is not a valid PNG file.");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (
    width < 1 ||
    height < 1 ||
    width > 16_384 ||
    height > 16_384 ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(`PNG dimensions are outside the local preview limit: ${width}x${height}.`);
  }
  const decoded = PNG.sync.read(bytes, { checkCRC: true });
  if (decoded.width !== width || decoded.height !== height) {
    throw new Error("PNG metadata changed while validating the local preview image.");
  }
  return { width, height };
}

function safeArchiveAssetPath(provider: LocalGameAssetProvider, entryName: string): string | null {
  const prefix = `assets/${provider}/`;
  if (!entryName.startsWith(prefix) || !entryName.toLowerCase().endsWith(".png")) return null;
  const path = entryName.slice(prefix.length).replaceAll("\\", "/");
  const segments = path.split("/");
  if (
    !path ||
    path.startsWith("/") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe ${provider} archive path: ${entryName}`);
  }
  return path;
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function assertRegularJar(path: string, provider: LocalGameAssetProvider): Promise<string> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${provider} source must be a regular JAR file.`);
  }
  if (!path.toLowerCase().endsWith(".jar") || stats.size < 1 || stats.size > MAX_ARCHIVE_BYTES) {
    throw new Error(`${provider} source is not a supported JAR file.`);
  }
  return hashFile(path);
}

async function selectedEntries(
  zip: ZipFile,
  provider: LocalGameAssetProvider,
): Promise<Array<{ entry: Entry; path: string }>> {
  if (zip.entryCount < 1 || zip.entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new Error(`${provider} archive entry count exceeds the local preview safety limit.`);
  }
  const selected: Array<{ entry: Entry; path: string }> = [];
  let declaredBytes = 0;
  for await (const entry of zip.eachEntry()) {
    const path = safeArchiveAssetPath(provider, entry.fileName);
    if (!path) continue;
    if (
      entry.isEncrypted() ||
      !entry.canDecodeFileData() ||
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.uncompressedSize < 1 ||
      entry.uncompressedSize > MAX_IMAGE_BYTES
    ) {
      throw new Error(`${provider} image entry exceeds the local preview safety limit: ${path}`);
    }
    declaredBytes += entry.uncompressedSize;
    if (declaredBytes > MAX_TOTAL_IMAGE_BYTES) {
      throw new Error(`${provider} image payload exceeds the local preview safety limit.`);
    }
    selected.push({ entry, path });
  }
  return selected.sort((left, right) => left.path.localeCompare(right.path));
}

async function readEntry(
  zip: ZipFile,
  entry: Entry,
  provider: LocalGameAssetProvider,
): Promise<Buffer> {
  const stream = await zip.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  let actualBytes = 0;
  let checksum = 0;
  for await (const value of stream) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
    actualBytes += chunk.length;
    if (actualBytes > entry.uncompressedSize || actualBytes > MAX_IMAGE_BYTES) {
      stream.destroy();
      throw new Error(`${provider} image stream exceeded its declared size.`);
    }
    checksum = crc32(chunk, checksum);
    chunks.push(chunk);
  }
  if (actualBytes !== entry.uncompressedSize || checksum >>> 0 !== entry.crc32 >>> 0) {
    throw new Error(`${provider} image stream failed size or CRC validation.`);
  }
  return Buffer.concat(chunks, actualBytes);
}

async function importSource(
  source: ImportSource,
  stagingRoot: string,
): Promise<{ source: LocalGameAssetSource; assets: LocalGameAssetEntry[] }> {
  const archiveSha256 = await assertRegularJar(source.jarPath, source.provider);
  const zip = await openPromise(source.jarPath, {
    autoClose: false,
    decodeStrings: true,
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  try {
    const entries = await selectedEntries(zip, source.provider);
    if (entries.length === 0) {
      throw new Error(`${source.provider} JAR contains no namespaced PNG assets.`);
    }

    const assets: LocalGameAssetEntry[] = [];
    let totalBytes = 0;
    for (const { entry, path } of entries) {
      const bytes = await readEntry(zip, entry, source.provider);
      totalBytes += bytes.length;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw new Error(`${source.provider} image payload exceeds the local preview safety limit.`);
      }
      const dimensions = pngDimensions(bytes);
      const output = resolve(stagingRoot, "files", source.provider, ...path.split("/"));
      if (!isPathInside(stagingRoot, output)) {
        throw new Error(`Refusing local asset path outside the staging directory: ${path}`);
      }
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes, { flag: "wx" });
      assets.push({
        provider: source.provider,
        path,
        sha256: sha256(bytes),
        byte_size: bytes.length,
        width: dimensions.width,
        height: dimensions.height,
        media_type: "image/png",
      });
    }

    return {
      source: {
        provider: source.provider,
        version: source.version,
        archive_name: basename(source.jarPath),
        archive_sha256: archiveSha256,
        asset_count: assets.length,
        license_url: source.licenseUrl,
        rights_status: "private_evaluation_only",
      },
      assets,
    };
  } finally {
    zip.close();
  }
}

export async function importLocalGameAssets(options: {
  createJar: string;
  createVersion: string;
  cobblemonJar: string;
  cobblemonVersion: string;
  generatedAt?: string;
  repositoryRoot?: string;
}): Promise<{ root: string; manifest: LocalGameAssetManifest }> {
  const repositoryRoot = await canonicalDirectoryTarget(
    options.repositoryRoot ?? repositoryRootPath(),
    "repository root",
  );
  const privateRoot = await canonicalDirectoryTarget(
    resolve(repositoryRoot, ".private"),
    "private asset root",
  );
  const finalRoot = await canonicalDirectoryTarget(
    resolve(repositoryRoot, LOCAL_ASSET_ROOT),
    "local game asset root",
  );
  if (!isPathInside(repositoryRoot, finalRoot) || !isPathInside(privateRoot, finalRoot)) {
    throw new Error("Local game assets must remain under the repository's ignored .private tree.");
  }

  await mkdir(privateRoot, { recursive: true });
  const stagingRoot = await mkdtemp(resolve(privateRoot, "local-game-assets.stage-"));
  if (!isPathInside(await realpath(privateRoot), await realpath(stagingRoot))) {
    throw new Error("Local game asset staging directory escaped the private workspace.");
  }
  try {
    const sources: ImportSource[] = [
      {
        provider: "create",
        version: options.createVersion,
        jarPath: resolve(options.createJar),
        licenseUrl:
          "https://github.com/Creators-of-Create/Create/blob/ac0c444d9828da3453ae8cc65338e8de063286fb/LICENSE.md",
      },
      {
        provider: "cobblemon",
        version: options.cobblemonVersion,
        jarPath: resolve(options.cobblemonJar),
        licenseUrl: "https://gitlab.com/cable-mc/cobblemon/-/blob/1.7.3/LICENSE",
      },
    ];
    const imported = [];
    for (const source of sources) imported.push(await importSource(source, stagingRoot));

    const manifest: LocalGameAssetManifest = {
      manifest_version: 1,
      generated_at: options.generatedAt ?? new Date().toISOString(),
      notice:
        "Private local evaluation only. These source files are not approved for Git, Vercel, public Storage, publication bundles, or mod redistribution.",
      sources: imported.map((result) => result.source),
      assets: imported
        .flatMap((result) => result.assets)
        .sort((left, right) =>
          `${left.provider}/${left.path}`.localeCompare(`${right.provider}/${right.path}`),
        ),
    };
    await writeFile(
      resolve(stagingRoot, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      {
        flag: "wx",
      },
    );

    const previousRoot = `${finalRoot}.previous`;
    await rm(previousRoot, { recursive: true, force: true });
    try {
      await rename(finalRoot, previousRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await rename(stagingRoot, finalRoot);
    await rm(previousRoot, { recursive: true, force: true });
    return { root: finalRoot, manifest };
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

export function localAssetRootRelativeToRepository(path: string): string {
  return relative(repositoryRootPath(), path).split(sep).join("/");
}
