import { createHash } from "node:crypto";
import type { PublicationBundle, PublishedManifest } from "@cobblemon-kinetics/domain";
import { compactCanonicalJson } from "./publication-bundle";
import { assertPublishedManifestSchema } from "./publication-validation";

const repositoryPattern =
  /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})$/u;
const commitPattern = /^[a-f0-9]{40}$/u;
const publicationIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const branchPattern =
  /^(?!\/)(?!.*\.\.)(?!.*[~^:?*\[\\\u0000-\u001f\u007f])[A-Za-z0-9._\/-]{1,200}$/u;
const maximumManifestFiles = 32;
const maximumPublishedFileBytes = 2 * 1024 * 1024;
const maximumPublishedTotalBytes = 16 * 1024 * 1024;
const maximumGithubJsonBytes = 512 * 1024;

export interface ReconciledPublication {
  publicationId: string;
  commitSha: string;
  publishedAt: string;
}

export function isGitCommitSha(value: string): boolean {
  return commitPattern.test(value);
}

export function isPublicationId(value: string): boolean {
  return publicationIdPattern.test(value);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  return value as Record<string, unknown>;
}

export function parseReconciliationResult(
  value: unknown,
  expectedPublicationId: string,
  expectedCommitSha: string,
): ReconciledPublication {
  const response = objectValue(value, "Reconciliation result");
  const publication = objectValue(response.publication, "Reconciled publication");
  const publishedAt = publication.published_at;
  if (
    publication.public_id !== expectedPublicationId ||
    publication.git_commit_sha !== expectedCommitSha ||
    publication.state !== "published" ||
    typeof publishedAt !== "string" ||
    !Number.isFinite(Date.parse(publishedAt))
  ) {
    throw new Error("Reconciliation returned inconsistent publication metadata.");
  }
  return {
    publicationId: expectedPublicationId,
    commitSha: expectedCommitSha,
    publishedAt,
  };
}

function profilePath(id: string): string {
  const name = id.split("/").at(-1)?.split(":").at(-1);
  if (!name || !/^[a-z0-9_.-]+$/u.test(name)) {
    throw new Error("Work profile has no safe published filename.");
  }
  return `work_profiles/${name}.json`;
}

function validateRepository(repository: string): void {
  if (!repositoryPattern.test(repository) || repository.includes("..")) {
    throw new Error("GITHUB_REPOSITORY must be an owner/repository pair.");
  }
}

function githubApiHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "cobblemon-kinetics-publication-reconciler",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function responseBytes(
  response: Response,
  maximumBytes: number,
  unavailableMessage: string,
): Promise<Uint8Array> {
  if (!response.ok) throw new Error(unavailableMessage);
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maximumBytes) {
      throw new Error("GitHub returned an invalid or oversized response.");
    }
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error("GitHub returned an oversized response.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function githubJson(url: URL, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  const response = await fetcher(url, {
    headers: githubApiHeaders(),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  const bytes = await responseBytes(
    response,
    maximumGithubJsonBytes,
    "GitHub repository metadata is unavailable.",
  );
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    return objectValue(value, "GitHub response");
  } catch (error) {
    if (error instanceof Error && error.message.endsWith("is not an object.")) throw error;
    throw new Error("GitHub returned invalid repository metadata.");
  }
}

export async function verifyCommitOnPublicationBranch(
  repository: string,
  commitSha: string,
  publicationBranch?: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  validateRepository(repository);
  if (!isGitCommitSha(commitSha)) {
    throw new Error("Git commit SHA must contain exactly 40 lowercase hexadecimal characters.");
  }

  let branch = publicationBranch;
  if (!branch) {
    const metadata = await githubJson(
      new URL(`https://api.github.com/repos/${repository}`),
      fetcher,
    );
    branch = typeof metadata.default_branch === "string" ? metadata.default_branch : undefined;
  }
  if (!branch || !branchPattern.test(branch) || branch.endsWith("/") || branch.endsWith(".lock")) {
    throw new Error("The publication branch is missing or invalid.");
  }

  const comparison = await githubJson(
    new URL(
      `https://api.github.com/repos/${repository}/compare/${encodeURIComponent(`${commitSha}...${branch}`)}?per_page=1`,
    ),
    fetcher,
  );
  const mergeBase = objectValue(comparison.merge_base_commit, "GitHub merge base");
  const baseCommit = objectValue(comparison.base_commit, "GitHub base commit");
  if (
    !["ahead", "identical"].includes(String(comparison.status)) ||
    mergeBase.sha !== commitSha ||
    baseCommit.sha !== commitSha
  ) {
    throw new Error("The commit is not reachable from the publication branch.");
  }
  return branch;
}

function expectedFileCounts(bundle: PublicationBundle): Map<string, number> {
  return new Map([
    ["assets/manifest.json", bundle.asset_manifest.assets.length],
    ...bundle.records.jobs.map((record) => [`jobs/${record.slug}.json`, 1] as const),
    ...bundle.records.machines.map((record) => [`machines/${record.slug}.json`, 1] as const),
    ["pokemon/gen1.json", bundle.records.pokemon.length],
    ...(bundle.records.blueprints
      ? ([["blueprints/records.json", bundle.records.blueprints.length] as const] as const)
      : []),
    ...bundle.records.work_profiles.map((record) => [profilePath(record.id), 1] as const),
  ]);
}

function expectedPublishedValues(bundle: PublicationBundle): Map<string, unknown> {
  return new Map<string, unknown>([
    ["assets/manifest.json", bundle.asset_manifest],
    ...bundle.records.jobs.map((record) => [`jobs/${record.slug}.json`, record] as const),
    ...bundle.records.machines.map((record) => [`machines/${record.slug}.json`, record] as const),
    [
      "pokemon/gen1.json",
      {
        format_version: 1,
        generation: 1,
        pokemon: bundle.records.pokemon,
      },
    ],
    ...(bundle.records.blueprints
      ? ([
          [
            "blueprints/records.json",
            { format_version: 1, records: bundle.records.blueprints },
          ] as const,
        ] as const)
      : []),
    ...bundle.records.work_profiles.map((record) => [profilePath(record.id), record] as const),
  ]);
}

export function validateManifestForBundle(
  value: unknown,
  bundle: PublicationBundle,
): PublishedManifest {
  assertPublishedManifestSchema(value);
  const manifest = value as PublishedManifest;
  if (
    manifest.schema_version !== bundle.schema_version ||
    manifest.batch_id !== bundle.batch_id ||
    manifest.bundle_content_sha256 !== bundle.integrity.content_sha256
  ) {
    throw new Error("Git manifest does not identify the approved publication bundle.");
  }

  const expected = expectedFileCounts(bundle);
  if (manifest.files.length !== expected.size) {
    throw new Error("Git manifest does not list the complete publication output.");
  }
  const seen = new Set<string>();
  for (const file of manifest.files) {
    if (seen.has(file.path) || expected.get(file.path) !== file.record_count) {
      throw new Error("Git manifest has a duplicate, unexpected, or miscounted file.");
    }
    seen.add(file.path);
  }
  return manifest;
}

export async function verifyManifestFilesAtCommit(
  repository: string,
  commitSha: string,
  manifest: PublishedManifest,
  bundle: PublicationBundle,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  validateRepository(repository);
  if (!isGitCommitSha(commitSha)) {
    throw new Error("Git commit SHA must contain exactly 40 lowercase hexadecimal characters.");
  }
  if (manifest.files.length > maximumManifestFiles) {
    throw new Error("The publication manifest contains too many files.");
  }

  const expectedValues = expectedPublishedValues(bundle);
  const verificationDeadline = AbortSignal.timeout(15_000);
  let totalBytes = 0;
  let previousPath = "";
  for (const file of manifest.files) {
    if (previousPath && file.path <= previousPath) {
      throw new Error("Publication manifest paths are not uniquely sorted.");
    }
    previousPath = file.path;
    const expectedValue = expectedValues.get(file.path);
    if (expectedValue === undefined) {
      throw new Error("Publication manifest contains an unexpected file.");
    }
    const url = new URL(
      `https://raw.githubusercontent.com/${repository}/${commitSha}/data/published/${file.path}`,
    );
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: verificationDeadline,
    });
    const bytes = await responseBytes(
      response,
      maximumPublishedFileBytes,
      "A published data file is unavailable at that commit.",
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > maximumPublishedTotalBytes) {
      throw new Error("The publication output exceeds the total verification size limit.");
    }
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== file.sha256) {
      throw new Error("A published data file does not match its manifest hash.");
    }
    let actualValue: unknown;
    try {
      actualValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    } catch {
      throw new Error("A published data file is not valid UTF-8 JSON.");
    }
    if (compactCanonicalJson(actualValue) !== compactCanonicalJson(expectedValue)) {
      throw new Error("A published data file does not match the frozen publication bundle.");
    }
  }
}

export async function fetchManifestAtCommit(
  repository: string,
  commitSha: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  validateRepository(repository);
  if (!isGitCommitSha(commitSha)) {
    throw new Error("Git commit SHA must contain exactly 40 lowercase hexadecimal characters.");
  }
  const url = new URL(
    `https://raw.githubusercontent.com/${repository}/${commitSha}/data/published/manifest.json`,
  );
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  const bytes = await responseBytes(
    response,
    262_144,
    "The published manifest is not available at that commit.",
  );
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("The published manifest is not valid JSON.");
  }
}
