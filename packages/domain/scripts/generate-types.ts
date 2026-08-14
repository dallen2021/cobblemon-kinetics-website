import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(packageRoot, "src/generated/domain.ts");
const generated = await compileFromFile(
  resolve(packageRoot, "schemas/domain-catalog.schema.json"),
  {
    bannerComment: [
      "/* eslint-disable */",
      "/** Generated from JSON Schema. Do not edit by hand. */",
    ].join("\n"),
    cwd: resolve(packageRoot, "schemas"),
    style: { singleQuote: false, semi: true, tabWidth: 2, useTabs: false },
  },
);

const compatibilityAliases = `
/** Stable application-facing aliases for schema-titled generated declarations. */
export type ResourceLocation = MinecraftResourceLocation;
export type PokemonType = TypeList[number];
export type PublicNamedRecord = PublishedNamedRecord;
export type PublicPokemon = PublishedPokemonRecord;
export type WorkProfile = CobblemonKineticsWorkProfile;
export type AssetManifestEntry = CobblemonKineticsAssetManifest["assets"][number];
export type AssetManifest = CobblemonKineticsAssetManifest;
export type PublicationBundlePayload = Omit<ApprovedPublicationBundle, "integrity">;
export type PublicationBundle = ApprovedPublicationBundle;
export type PublishedManifestFile = GitPublishedContentManifest["files"][number];
export type PublishedManifest = GitPublishedContentManifest;
export type ModExportManifestFile = ModWorkProfileExportManifest["files"][number];
export type ModExportManifest = ModWorkProfileExportManifest;
`;

const next = `${generated.trim()}\n${compatibilityAliases.trim()}\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== next) {
    console.error("Generated schema types are out of date. Run generate:types.");
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, next, "utf8");
}
