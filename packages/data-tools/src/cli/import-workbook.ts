#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalJson, type JsonValue } from "../lib/canonical-json.js";
import { assertAllowedArgs, booleanFlag, optionalFlag, parseArgs } from "../lib/args.js";
import { repositoryDefaultPath } from "../lib/repository-paths.js";
import {
  importWorkbook,
  renderImportReport,
  validatePrivateImportOutput,
} from "../import-workbook/import-workbook.js";
import type { WorkbookImportDocument } from "../import-workbook/types.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, {
    flags: ["workbook", "output-dir", "previous", "allow-count-drift", "dry-run"],
    maxPositionals: 1,
  });
  const allowCountDrift = booleanFlag(args, "allow-count-drift");
  booleanFlag(args, "dry-run");
  const workbookPath = optionalFlag(args, "workbook") ?? args.positional[0];
  if (!workbookPath) {
    throw new Error(
      "Usage: pnpm data:import -- --workbook <file.xlsx> [--output-dir <dir>] [--previous <import.json>] [--allow-count-drift] [--dry-run]",
    );
  }

  const absoluteWorkbookPath = repositoryDefaultPath(workbookPath, workbookPath);
  const buffer = await readFile(absoluteWorkbookPath);
  const previousPath = optionalFlag(args, "previous");
  const previous = previousPath
    ? (JSON.parse(
        await readFile(repositoryDefaultPath(previousPath, previousPath), "utf8"),
      ) as WorkbookImportDocument)
    : undefined;
  const result = await importWorkbook(buffer, {
    sourceName: absoluteWorkbookPath,
    ...(previous ? { previous } : {}),
    allowCountDrift,
  });
  const outputDir = await validatePrivateImportOutput(
    repositoryDefaultPath(
      optionalFlag(args, "output-dir"),
      `.private/migration/${result.document.source.sha256.slice(0, 12)}`,
    ),
  );
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    resolve(outputDir, "import.json"),
    canonicalJson(result.document as unknown as JsonValue),
    "utf8",
  );
  await writeFile(
    resolve(outputDir, "report.json"),
    canonicalJson(result.report as unknown as JsonValue),
    "utf8",
  );
  await writeFile(resolve(outputDir, "report.md"), renderImportReport(result.report), "utf8");

  console.log(`Workbook import report written to ${outputDir}`);
  console.log(
    `Rows: ${result.report.counts.imported} imported, ${result.report.counts.updated} updated, ${result.report.counts.unchanged} unchanged; ${result.report.counts.quarantined} quarantined fields.`,
  );
  if (result.report.counts.invalid > 0 || result.report.counts.duplicate > 0) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
