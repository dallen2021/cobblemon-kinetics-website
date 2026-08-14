import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import addFormatsImport from "ajv-formats";
import assetManifestSchema from "@cobblemon-kinetics/domain/schemas/asset-manifest.schema.json";
import publicationBundleSchema from "@cobblemon-kinetics/domain/schemas/publication-bundle.schema.json";
import publishedManifestSchema from "@cobblemon-kinetics/domain/schemas/published-manifest.schema.json";
import publicNamedRecordSchema from "@cobblemon-kinetics/domain/schemas/public-named-record.schema.json";
import publicPokemonSchema from "@cobblemon-kinetics/domain/schemas/public-pokemon.schema.json";
import resourceLocationSchema from "@cobblemon-kinetics/domain/schemas/resource-location.schema.json";
import workProfileSchema from "@cobblemon-kinetics/domain/schemas/work-profile.schema.json";

const forbiddenPublicKeys = new Set([
  "actor_id",
  "approved_by",
  "comment",
  "comments",
  "editor",
  "editor_id",
  "explicit_owner",
  "import_row",
  "owner",
  "ownership_handoff_notes",
  "pokedex_entry",
  "private_note",
  "private_notes",
  "suggested_by",
  "team_notes",
  "user_id",
]);

const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
const addFormats = addFormatsImport as unknown as FormatsPlugin;
addFormats(ajv);
for (const schema of [
  resourceLocationSchema,
  publicNamedRecordSchema,
  publicPokemonSchema,
  workProfileSchema,
  assetManifestSchema,
  publicationBundleSchema,
  publishedManifestSchema,
]) {
  ajv.addSchema(schema);
}

const validate =
  ajv.getSchema("https://cobblemonkinetics.dev/schemas/publication-bundle.schema.json") ??
  (() => {
    throw new Error("Publication bundle schema was not registered.");
  })();

const validateManifest =
  ajv.getSchema("https://cobblemonkinetics.dev/schemas/published-manifest.schema.json") ??
  (() => {
    throw new Error("Published manifest schema was not registered.");
  })();

function unsafePaths(value: unknown): string[] {
  const findings: string[] = [];
  function visit(current: unknown, path: string): void {
    if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, `${path}/${index}`));
      return;
    }
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      const childPath = `${path}/${key}`;
      if (forbiddenPublicKeys.has(key.toLocaleLowerCase())) findings.push(childPath);
      visit(child, childPath);
    }
  }
  visit(value, "");
  return findings;
}

export function assertPublicSafe(value: unknown): void {
  const findings = unsafePaths(value);
  if (findings.length) {
    throw new Error(`Public data contains private or quarantined fields: ${findings.join(", ")}`);
  }
}

export function assertPublicationBundleSchema(value: unknown): void {
  if (validate(value)) return;
  const errors = (validate.errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
  throw new Error(`Publication bundle schema is invalid: ${errors}`);
}

export function assertPublishedManifestSchema(value: unknown): void {
  assertPublicSafe(value);
  if (validateManifest(value)) return;
  const errors = (validateManifest.errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
  throw new Error(`Published manifest schema is invalid: ${errors}`);
}
