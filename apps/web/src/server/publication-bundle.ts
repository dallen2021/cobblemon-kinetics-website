import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AssetManifest,
  PublicationBundle,
  PublicationBundlePayload,
} from "@cobblemon-kinetics/domain";
import { assertPublicationBundleSchema, assertPublicSafe } from "./publication-validation";

interface PublicationRpcEnvelope {
  publication: {
    public_id: string;
    state: string;
    schema_version: string;
    content_hash: string;
  };
  payload: unknown;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

export function compactCanonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value as JsonValue));
}

export function publicationContentHash(payload: PublicationBundlePayload): string {
  return createHash("sha256").update(compactCanonicalJson(payload)).digest("hex");
}

function safeHashEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function createPublicationBundle(
  payload: PublicationBundlePayload,
  signingKey?: string,
): PublicationBundle {
  assertPublicSafe(payload);
  const contentSha256 = publicationContentHash(payload);
  const bundle: PublicationBundle = {
    ...payload,
    integrity: {
      content_sha256: contentSha256,
      ...(signingKey
        ? {
            signature: {
              algorithm: "hmac-sha256" as const,
              value: createHmac("sha256", signingKey).update(contentSha256).digest("hex"),
            },
          }
        : {}),
    },
  };
  assertPublicationBundleSchema(bundle);
  return bundle;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(object: Record<string, unknown>, key: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Publication RPC field ${key} is invalid.`);
  }
  return value;
}

export function batchIdForPublication(publicationId: string): string {
  const path = publicationId.replace(/^publication-/u, "");
  return `cobblemon_kinetics:publication/${path}`;
}

function normalizeRpcEnvelope(value: unknown): PublicationRpcEnvelope {
  const envelope = objectValue(value, "Publication RPC result");
  const publication = objectValue(envelope.publication, "Publication metadata");
  return {
    publication: {
      public_id: stringValue(publication, "public_id"),
      state: stringValue(publication, "state"),
      schema_version: stringValue(publication, "schema_version"),
      content_hash: stringValue(publication, "content_hash"),
    },
    payload: envelope.payload,
  };
}

export function publicationIdFromRpc(value: unknown): string {
  return normalizeRpcEnvelope(value).publication.public_id;
}

export function createSignedPublicationBundleFromRpc(
  value: unknown,
  signingKey: string,
  expectedPublicationId: string,
): PublicationBundle {
  if (!signingKey) throw new Error("PUBLICATION_SIGNING_KEY is required.");
  const rpc = normalizeRpcEnvelope(value);
  if (rpc.publication.public_id !== expectedPublicationId) {
    throw new Error("Publication RPC returned the wrong batch.");
  }
  if (!["validated", "exported", "published"].includes(rpc.publication.state)) {
    throw new Error("Publication batch is not exportable.");
  }

  assertPublicSafe(rpc.payload);
  const payload = rpc.payload as PublicationBundlePayload;
  const unsigned = createPublicationBundle(payload);
  if (payload.schema_version !== rpc.publication.schema_version) {
    throw new Error("Publication schema version does not match the batch.");
  }
  if (payload.batch_id !== batchIdForPublication(rpc.publication.public_id)) {
    throw new Error("Publication payload has the wrong batch identifier.");
  }
  if (!safeHashEqual(unsigned.integrity.content_sha256, rpc.publication.content_hash)) {
    throw new Error("Publication payload hash does not match the approved batch.");
  }
  return createPublicationBundle(payload, signingKey);
}

async function readJson(file: string): Promise<JsonValue> {
  return JSON.parse(await fs.readFile(file, "utf8")) as JsonValue;
}

async function readDirectory(directory: string): Promise<JsonValue[]> {
  const names = (await fs.readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right, "en"));
  return Promise.all(names.map((name) => readJson(path.join(directory, name))));
}

function asObject(value: JsonValue): Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Published data contains a non-object record.");
  }
  return value;
}

function repositoryRoot(): string {
  return process.env.COBBLEMON_KINETICS_REPO_ROOT ?? path.resolve(process.cwd(), "../..");
}

export async function createLocalPublicationBundle(
  publicationId: string,
): Promise<PublicationBundle> {
  const root = path.join(repositoryRoot(), "data", "published");
  const pokemonCollection = asObject(await readJson(path.join(root, "pokemon", "gen1.json")));
  const pokemon = pokemonCollection.pokemon;
  if (!Array.isArray(pokemon))
    throw new Error("Published Gen 1 data does not contain a Pokémon collection.");
  const [jobs, machines, workProfiles, assetManifest] = await Promise.all([
    readDirectory(path.join(root, "jobs")),
    readDirectory(path.join(root, "machines")),
    readDirectory(path.join(root, "work_profiles")),
    readJson(path.join(root, "assets", "manifest.json")),
  ]);
  const payload: PublicationBundlePayload = {
    bundle_version: 1,
    schema_version: "1.0.0",
    batch_id: batchIdForPublication(publicationId),
    records: {
      pokemon: pokemon as unknown as PublicationBundlePayload["records"]["pokemon"],
      jobs: jobs as unknown as PublicationBundlePayload["records"]["jobs"],
      machines: machines as unknown as PublicationBundlePayload["records"]["machines"],
      work_profiles:
        workProfiles as unknown as PublicationBundlePayload["records"]["work_profiles"],
    },
    asset_manifest: assetManifest as unknown as AssetManifest,
  };
  return createPublicationBundle(payload);
}
