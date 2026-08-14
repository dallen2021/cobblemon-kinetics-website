import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  formatValidationErrors,
  validateAssetManifest,
  type AssetManifest,
} from "@cobblemon-kinetics/domain";

export interface AssetProviderPolicy {
  enabled: boolean;
  allow_public: boolean;
  note: string;
}

export interface AssetPolicy {
  version: 1;
  default_action: "deny";
  providers: Record<string, AssetProviderPolicy>;
}

export async function readAssetPolicy(path: string): Promise<AssetPolicy> {
  const value = parseYaml(await readFile(resolve(path), "utf8")) as unknown;
  if (!value || typeof value !== "object") throw new Error("Asset policy must be an object.");
  const policy = value as Partial<AssetPolicy>;
  if (policy.version !== 1 || policy.default_action !== "deny" || !policy.providers) {
    throw new Error(
      "Asset policy must use version 1, default_action: deny, and an explicit providers map.",
    );
  }
  for (const [provider, rule] of Object.entries(policy.providers)) {
    if (!/^[a-z0-9_.-]+$/u.test(provider))
      throw new Error(`Invalid asset provider key: ${provider}`);
    if (
      !rule ||
      typeof rule.enabled !== "boolean" ||
      typeof rule.allow_public !== "boolean" ||
      typeof rule.note !== "string" ||
      !rule.note.trim()
    ) {
      throw new Error(`Asset provider ${provider} has an invalid rule.`);
    }
  }
  return policy as AssetPolicy;
}

export function validateAssetsAgainstPolicy(
  manifest: AssetManifest,
  policy: AssetPolicy,
): string[] {
  const errors: string[] = [];
  const schemaResult = validateAssetManifest(manifest);
  if (!schemaResult.ok) return [formatValidationErrors(schemaResult.errors)];
  const seen = new Set<string>();
  for (const asset of manifest.assets) {
    if (seen.has(asset.asset_key)) errors.push(`${asset.asset_key}: duplicate asset key.`);
    seen.add(asset.asset_key);
    const provider = policy.providers[asset.provider];
    if (!provider?.enabled)
      errors.push(`${asset.asset_key}: provider ${asset.provider} is disabled or undeclared.`);
    if (asset.archive_path.startsWith("/") || asset.archive_path.split(/[\\/]/u).includes("..")) {
      errors.push(`${asset.asset_key}: archive path is not relative and traversal-free.`);
    }
    if (asset.publication_state === "published") {
      if (asset.rights_status !== "approved")
        errors.push(`${asset.asset_key}: published assets require approved rights.`);
      if (asset.permitted_visibility !== "public")
        errors.push(`${asset.asset_key}: published assets require public visibility.`);
      if (!provider?.allow_public)
        errors.push(
          `${asset.asset_key}: provider ${asset.provider} does not permit public output.`,
        );
    }
    if (asset.permitted_visibility === "public" && asset.rights_status !== "approved") {
      errors.push(`${asset.asset_key}: public visibility requires approved rights.`);
    }
  }
  return errors;
}

export function validatePublicAssetProjection(manifest: AssetManifest): string[] {
  const schemaResult = validateAssetManifest(manifest);
  if (!schemaResult.ok) return [formatValidationErrors(schemaResult.errors)];
  const errors: string[] = [];
  for (const asset of manifest.assets) {
    if (
      asset.rights_status !== "approved" ||
      asset.permitted_visibility !== "public" ||
      asset.publication_state !== "published"
    ) {
      errors.push(
        `${asset.asset_key}: Git-published asset projections require approved rights, public visibility, and published state.`,
      );
    }
    for (const [field, value] of [
      ["source_archive_url", asset.source_archive_url],
      ["license_url", asset.license_url],
    ] as const) {
      const url = new URL(value);
      if (
        !(["http:", "https:"] as string[]).includes(url.protocol) ||
        url.username ||
        url.password
      ) {
        errors.push(
          `${asset.asset_key}: ${field} must be a public HTTP(S) URL without credentials.`,
        );
      }
    }
  }
  return errors;
}
