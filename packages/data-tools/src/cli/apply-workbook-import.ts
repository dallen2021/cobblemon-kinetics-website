#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { assertAllowedArgs, optionalFlag, parseArgs } from "../lib/args.js";
import { repositoryDefaultPath, repositoryRootPath } from "../lib/repository-paths.js";
import { validatePrivateImportOutput } from "../import-workbook/import-workbook.js";
import type { WorkbookImportDocument } from "../import-workbook/types.js";

function validatedSupabaseOrigin(rawValue: string): string {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid origin URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS outside local development.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must contain only the Supabase origin.");
  }
  return url.origin;
}

function isLoopbackOrigin(origin: string): boolean {
  return ["http://localhost", "http://127.0.0.1", "http://[::1]"].some(
    (prefix) => origin === prefix || origin.startsWith(`${prefix}:`),
  );
}

async function requirePrivateBackup(pathValue: string | undefined, origin: string): Promise<void> {
  if (isLoopbackOrigin(origin)) return;
  if (!pathValue) {
    throw new Error(
      "Hosted workbook application requires --backup-manifest <ignored .private/backups manifest> created immediately before the import.",
    );
  }
  const manifest = repositoryDefaultPath(pathValue, pathValue);
  const root = resolve(repositoryRootPath(), ".private", "backups");
  if (!manifest.startsWith(`${root}/`) && manifest !== root) {
    throw new Error("The backup manifest must stay under the ignored .private/backups directory.");
  }
  await access(manifest);
}

function readDocument(value: unknown): WorkbookImportDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The input is not a workbook import document.");
  }
  const document = value as WorkbookImportDocument;
  if (document.import_format_version !== 1 || typeof document.source?.sha256 !== "string") {
    throw new Error("The import document has an unsupported format or no source SHA-256.");
  }
  return document;
}

function safeSummary(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "Workbook import applied.";
  const result = value as Record<string, unknown>;
  if (result.already_applied === true) return "Workbook was already applied; no records changed.";
  const summary = result.summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return "Workbook import applied.";
  }
  const values = summary as Record<string, unknown>;
  return ["imported", "updated", "unchanged", "manual_review", "quarantined"]
    .filter((key) => typeof values[key] === "number")
    .map((key) => `${values[key]} ${key.replaceAll("_", " ")}`)
    .join(", ");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, {
    flags: ["input", "expect-source-sha256", "backup-manifest", "confirm-apply"],
    maxPositionals: 0,
  });
  if (optionalFlag(args, "confirm-apply") !== "yes") {
    throw new Error(
      "Refusing to mutate a database. Pass --confirm-apply yes after reviewing the dry-run report.",
    );
  }
  const inputFlag = optionalFlag(args, "input");
  const expectedSha = optionalFlag(args, "expect-source-sha256");
  if (!inputFlag || !expectedSha || !/^[a-f0-9]{64}$/u.test(expectedSha)) {
    throw new Error(
      "Usage: pnpm data:apply-import -- --input .private/migration/<hash>/import.json --expect-source-sha256 <sha256> --confirm-apply yes [--backup-manifest .private/backups/<manifest>]",
    );
  }
  const input = repositoryDefaultPath(inputFlag, inputFlag);
  await validatePrivateImportOutput(dirname(input));
  const document = readDocument(JSON.parse(await readFile(input, "utf8")) as unknown);
  if (document.source.sha256 !== expectedSha) {
    throw new Error("The requested source SHA-256 does not match the reviewed import document.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for controlled import application.",
    );
  }
  const origin = validatedSupabaseOrigin(url);
  await requirePrivateBackup(optionalFlag(args, "backup-manifest"), origin);
  const response = await fetch(`${origin}/rest/v1/rpc/apply_gen1_workbook_import`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_document: document, p_expected_source_sha256: expectedSha }),
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(
      `Workbook import RPC failed with HTTP ${response.status}. No partial import was committed.`,
    );
  }
  console.log(safeSummary(body));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
