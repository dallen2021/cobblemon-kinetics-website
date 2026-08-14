import { readFileSync } from "node:fs";
import type { ErrorObject, ValidateFunction } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import addFormatsImport from "ajv-formats";

import type {
  AssetManifest,
  ModExportManifest,
  PublishedManifest,
  PublicationBundle,
  PublicNamedRecord,
  PublicPokemon,
  WorkProfile,
} from "./generated/domain.js";

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: ErrorObject[];
}

const schemaNames = [
  "resource-location.schema.json",
  "public-named-record.schema.json",
  "public-pokemon.schema.json",
  "work-profile.schema.json",
  "asset-manifest.schema.json",
  "publication-bundle.schema.json",
  "published-manifest.schema.json",
  "mod-export-manifest.schema.json",
] as const;

const schemas = schemaNames.map((name) =>
  JSON.parse(readFileSync(new URL(`../schemas/${name}`, import.meta.url), "utf8")),
);

const addFormats = addFormatsImport as unknown as FormatsPlugin;

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
addFormats(ajv);
for (const schema of schemas) {
  ajv.addSchema(schema);
}

function validator<T>(schemaId: string): (value: unknown) => ValidationResult<T> {
  const validate = ajv.getSchema(schemaId) as ValidateFunction<T> | undefined;
  if (!validate) {
    throw new Error(`Schema was not registered: ${schemaId}`);
  }

  return (value: unknown) => {
    const ok = validate(value);
    return ok
      ? { ok: true, value: value as T, errors: [] }
      : { ok: false, errors: [...(validate.errors ?? [])] };
  };
}

export const validatePublicPokemon = validator<PublicPokemon>(
  "https://cobblemonkinetics.dev/schemas/public-pokemon.schema.json",
);

export const validatePublicNamedRecord = validator<PublicNamedRecord>(
  "https://cobblemonkinetics.dev/schemas/public-named-record.schema.json",
);

export const validateWorkProfile = validator<WorkProfile>(
  "https://cobblemonkinetics.dev/schemas/work-profile.schema.json",
);

export const validateAssetManifest = validator<AssetManifest>(
  "https://cobblemonkinetics.dev/schemas/asset-manifest.schema.json",
);

export const validatePublicationBundle = validator<PublicationBundle>(
  "https://cobblemonkinetics.dev/schemas/publication-bundle.schema.json",
);

export const validatePublishedManifest = validator<PublishedManifest>(
  "https://cobblemonkinetics.dev/schemas/published-manifest.schema.json",
);

export const validateModExportManifest = validator<ModExportManifest>(
  "https://cobblemonkinetics.dev/schemas/mod-export-manifest.schema.json",
);

export function formatValidationErrors(errors: readonly ErrorObject[]): string {
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}
