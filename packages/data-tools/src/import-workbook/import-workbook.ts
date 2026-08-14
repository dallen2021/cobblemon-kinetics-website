import { basename, resolve } from "node:path";
import ExcelJS, { type Cell, type Row, type Worksheet } from "exceljs";
import JSZip from "jszip";

import { pokemonFormPublicId, pokemonPublicId } from "@cobblemon-kinetics/domain";

import {
  canonicalJson,
  compactCanonicalJson,
  sha256,
  type JsonValue,
} from "../lib/canonical-json.js";
import {
  canonicalDirectoryTarget,
  isPathInside,
  repositoryRootPath,
} from "../lib/repository-paths.js";
import type {
  ImportedWorkbookRow,
  QuarantinedWorkbookField,
  ReferenceWorkbookCell,
  WorkbookFieldDisposition,
  WorkbookImportDocument,
  WorkbookImportReport,
  WorkbookIssue,
} from "./types.js";
import { quarantinedWorkbookFields, workbookSheetSpecs, type SheetSpec } from "./workbook-spec.js";

export interface ImportWorkbookOptions {
  sourceName: string;
  previous?: WorkbookImportDocument;
  allowCountDrift?: boolean;
}

export async function validatePrivateImportOutput(outputDirectory: string): Promise<string> {
  const output = resolve(outputDirectory);
  const repository = await canonicalDirectoryTarget(repositoryRootPath(), "repository root");
  const privateMigration = await canonicalDirectoryTarget(
    resolve(repositoryRootPath(), ".private/migration"),
    "private migration root",
  );
  if (privateMigration !== resolve(repository, ".private/migration")) {
    throw new Error(
      "The repository .private/migration path must not redirect through symbolic links.",
    );
  }
  const canonicalOutput = await canonicalDirectoryTarget(output, "workbook import output");
  const insideRepository =
    canonicalOutput === repository || isPathInside(repository, canonicalOutput);
  const insidePrivateMigration =
    canonicalOutput === privateMigration || isPathInside(privateMigration, canonicalOutput);
  if (insideRepository && !insidePrivateMigration) {
    throw new Error(
      `Workbook imports contain private/quarantined data and must remain under .private/migration: ${output}`,
    );
  }
  return output;
}

type Scalar = string | number | boolean | null;

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/**
 * artifact-tool emits valid OOXML with an explicit `x:` prefix. ExcelJS 4.4.0's workbook
 * parser only recognizes the equivalent default namespace form. Normalize those element names
 * in memory, leaving the source workbook untouched. Other XML namespaces and attributes are
 * preserved exactly.
 */
export async function normalizeWorkbookForExcelJs(buffer: Buffer): Promise<ArrayBuffer> {
  const archive = await JSZip.loadAsync(buffer);
  let changed = false;
  await Promise.all(
    Object.values(archive.files).map(async (entry) => {
      if (entry.dir || !entry.name.endsWith(".xml")) return;
      const xml = await entry.async("string");
      const namespaceDeclaration = `xmlns:x="${spreadsheetNamespace}"`;
      if (!xml.includes(namespaceDeclaration) || !/<\/?x:[A-Za-z]/u.test(xml)) return;
      const normalized = xml
        .replace(namespaceDeclaration, `xmlns="${spreadsheetNamespace}"`)
        .replace(/<(\/?)x:/gu, "<$1");
      archive.file(entry.name, normalized);
      changed = true;
    }),
  );
  if (!changed) return asArrayBuffer(buffer);
  const normalized = await archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return normalized.buffer.slice(
    normalized.byteOffset,
    normalized.byteOffset + normalized.byteLength,
  ) as ArrayBuffer;
}

function cellScalar(cell: Cell): Scalar {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object" && "formula" in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (result === null || result === undefined) return null;
    if (result instanceof Date) return result.toISOString().slice(0, 10);
    if (typeof result === "string") return result.trim() || null;
    if (typeof result === "number" || typeof result === "boolean") return result;
    return String(result);
  }
  if (typeof value === "object" && "text" in value) {
    const text = String((value as { text: unknown }).text).trim();
    return text || null;
  }
  if (typeof value === "object" && "richText" in value) {
    const text = (value as ExcelJS.CellRichTextValue).richText
      .map((part) => part.text)
      .join("")
      .trim();
    return text || null;
  }
  return String(value).trim() || null;
}

function sourceCellScalar(cell: Cell): Scalar {
  if (cell.isMerged && cell.master.address !== cell.address) return null;
  return cellScalar(cell);
}

function referenceCells(worksheet: Worksheet): ReferenceWorkbookCell[] {
  const cells: ReferenceWorkbookCell[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const value = cellScalar(cell);
      if (value === null) return;
      const entry: ReferenceWorkbookCell = { address: cell.address, value };
      if (cell.type === ExcelJS.ValueType.Formula && cell.formula) entry.formula = cell.formula;
      cells.push(entry);
    });
  });
  return cells.sort((left, right) =>
    left.address.localeCompare(right.address, "en", { numeric: true }),
  );
}

function mergedReferenceCells(worksheet: Worksheet): ReferenceWorkbookCell[] {
  const cells: ReferenceWorkbookCell[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (!cell.isMerged || cell.master.address !== cell.address) return;
      const value = cellScalar(cell);
      if (value === null) return;
      cells.push({ address: cell.address, value });
    });
  });
  return cells.sort((left, right) =>
    left.address.localeCompare(right.address, "en", { numeric: true }),
  );
}

function headerValues(worksheet: Worksheet, rowNumber: number, width: number): string[] {
  const row = worksheet.getRow(rowNumber);
  return Array.from({ length: width }, (_, index) => {
    const value = cellScalar(row.getCell(index + 1));
    return value === null ? "" : String(value);
  });
}

function validateHeaders(worksheet: Worksheet, spec: SheetSpec, issues: WorkbookIssue[]): void {
  if (!spec.headerRow || !spec.fields) return;
  const expected = spec.fields.map(([header]) => header);
  const actual = headerValues(worksheet, spec.headerRow, expected.length);
  if (compactCanonicalJson(actual) !== compactCanonicalJson(expected)) {
    issues.push({
      category: "invalid",
      sheet: spec.name,
      row: spec.headerRow,
      message: `Header mismatch. Expected ${JSON.stringify(expected)} but found ${JSON.stringify(actual)}.`,
    });
  }
}

function cobblemonSlug(apiSlug: string): string {
  const explicit: Record<string, string> = {
    "mr-mime": "mrmime",
    "nidoran-f": "nidoranf",
    "nidoran-m": "nidoranm",
  };
  return explicit[apiSlug] ?? apiSlug.replaceAll("-", "");
}

function splitTyping(value: Scalar): JsonValue {
  if (typeof value !== "string") return [];
  return value
    .split(/[\/,+]/u)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function toBoolean(value: Scalar): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  if (value.toLowerCase() === "yes") return true;
  if (value.toLowerCase() === "no") return false;
  return null;
}

function deriveRosterFields(fields: Record<string, JsonValue>): Record<string, JsonValue> {
  const apiSlug = String(fields.api_slug ?? "");
  const slug = cobblemonSlug(apiSlug);
  const types = [fields.current_primary, fields.current_secondary]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase());
  return {
    public_id: pokemonPublicId(slug),
    form_public_id: pokemonFormPublicId(slug),
    cobblemon_id: `cobblemon:${slug}`,
    current_types: types,
    original_gen1_types: splitTyping(fields.original_gen1_typing as Scalar),
    type_changed: toBoolean(fields.type_changed as Scalar),
    legendary: toBoolean(fields.legendary as Scalar),
    mythical: toBoolean(fields.mythical as Scalar),
  };
}

function stableKey(spec: SheetSpec, fields: Record<string, JsonValue>, rowNumber: number): string {
  if (spec.name === "03 Type Membership") {
    return `${fields.type ?? "unknown"}:${fields.national_dex ?? rowNumber}:${fields.membership ?? "unknown"}`.toLowerCase();
  }
  const primaryField = spec.fields?.find(([header]) => header === spec.primaryColumn)?.[1];
  const primary = primaryField ? fields[primaryField] : null;
  if (primary !== null && primary !== undefined && primary !== "") {
    return `${spec.name}:${String(primary)}`.toLowerCase();
  }
  return `${spec.name}:sha256:${sha256(compactCanonicalJson(fields)).slice(0, 24)}`.toLowerCase();
}

function parseSheetRows(
  worksheet: Worksheet,
  spec: SheetSpec,
  quarantine: QuarantinedWorkbookField[],
  issues: WorkbookIssue[],
): { rows: ImportedWorkbookRow[]; skipped: number } {
  if (!spec.headerRow || !spec.fields) return { rows: [], skipped: 0 };
  const rows: ImportedWorkbookRow[] = [];
  let skipped = 0;
  const seen = new Map<string, number>();

  for (let rowNumber = spec.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rawValues = spec.fields.map((_, index) => sourceCellScalar(row.getCell(index + 1)));
    if (spec.name === "08 Sources & Lists") {
      const sourceUrl = rawValues[1];
      const hasSourceColumns = typeof sourceUrl === "string" && /^https?:\/\//u.test(sourceUrl);
      if (!hasSourceColumns) {
        for (let index = 0; index < 9; index += 1) rawValues[index] = null;
      }
    }
    if (rawValues.every((value) => value === null)) {
      skipped += 1;
      continue;
    }

    const mapped: Record<string, JsonValue> = {};
    spec.fields.forEach(([column, field], index) => {
      const value = rawValues[index] ?? null;
      const quarantineReason = quarantinedWorkbookFields.get(`${spec.name}/${column}`);
      if (quarantineReason) {
        quarantine.push({
          sheet: spec.name,
          row: rowNumber,
          column,
          field,
          reason: quarantineReason,
          value,
          value_sha256: sha256(compactCanonicalJson(value)),
        });
      } else {
        mapped[field] = value;
      }
    });

    const key = stableKey(spec, mapped, rowNumber);
    const previousRow = seen.get(key);
    if (previousRow !== undefined) {
      issues.push({
        category: "duplicate",
        sheet: spec.name,
        row: rowNumber,
        message: `Stable key ${key} duplicates row ${previousRow}.`,
      });
    } else {
      seen.set(key, rowNumber);
    }

    const fieldHashes = Object.fromEntries(
      Object.entries(mapped).map(([field, value]) => [field, sha256(compactCanonicalJson(value))]),
    );
    const imported: ImportedWorkbookRow = {
      sheet: spec.name,
      row: rowNumber,
      stable_key: key,
      fingerprint: sha256(compactCanonicalJson(mapped)),
      field_hashes: fieldHashes,
      fields: mapped,
    };
    if (spec.name === "02 Gen 1 Roster") imported.derived = deriveRosterFields(mapped);
    rows.push(imported);
  }

  return { rows, skipped };
}

function countIssues(issues: WorkbookIssue[], category: WorkbookIssue["category"]): number {
  return issues.filter((issue) => issue.category === category).length;
}

function addCountValidation(
  issues: WorkbookIssue[],
  sheet: string,
  actual: number,
  expected: number,
  allowCountDrift: boolean,
): void {
  if (actual === expected) return;
  issues.push({
    category: allowCountDrift ? "manual_review" : "invalid",
    sheet,
    message: `Expected ${expected} populated rows for the Generation I baseline, found ${actual}.`,
  });
}

function comparePrevious(
  rows: Record<string, ImportedWorkbookRow[]>,
  previous?: WorkbookImportDocument,
): { imported: number; updated: number; unchanged: number } {
  let imported = 0;
  let updated = 0;
  let unchanged = 0;
  const oldRows = new Map(
    Object.values(previous?.rows ?? {})
      .flat()
      .map((row) => [row.stable_key, row] as const),
  );
  for (const row of Object.values(rows).flat()) {
    const old = oldRows.get(row.stable_key);
    if (!old) imported += 1;
    else if (old.fingerprint === row.fingerprint) unchanged += 1;
    else updated += 1;
  }
  return { imported, updated, unchanged };
}

export async function importWorkbook(
  buffer: Buffer,
  options: ImportWorkbookOptions,
): Promise<{ document: WorkbookImportDocument; report: WorkbookImportReport }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await normalizeWorkbookForExcelJs(buffer), {
    // Tables are a presentation concern for this importer. artifact-tool uses valid absolute
    // OOXML relationship targets that ExcelJS 4.4.0 does not resolve into table models.
    ignoreNodes: ["tableParts"],
  });
  const sourceHash = sha256(buffer);
  const issues: WorkbookIssue[] = [];
  const quarantine: QuarantinedWorkbookField[] = [];
  const rows: Record<string, ImportedWorkbookRow[]> = {};
  const referenceSheets: Record<string, ReferenceWorkbookCell[]> = {};
  const perSheet: WorkbookImportReport["per_sheet"] = {};
  const expectedNames = workbookSheetSpecs.map((spec) => spec.name);
  const actualNames = workbook.worksheets.map((sheet) => sheet.name);

  for (const missing of expectedNames.filter((name) => !actualNames.includes(name))) {
    issues.push({ category: "invalid", sheet: missing, message: "Required sheet is missing." });
  }
  for (const extra of actualNames.filter((name) => !expectedNames.includes(name))) {
    issues.push({
      category: "unsupported",
      sheet: extra,
      message: "Unknown sheet is not imported.",
    });
  }

  for (const spec of workbookSheetSpecs) {
    const worksheet = workbook.getWorksheet(spec.name);
    if (!worksheet) continue;
    validateHeaders(worksheet, spec, issues);
    if (!spec.headerRow) referenceSheets[spec.name] = referenceCells(worksheet);
    else if (spec.name === "08 Sources & Lists") {
      referenceSheets[spec.name] = mergedReferenceCells(worksheet);
    }
    const parsed = parseSheetRows(worksheet, spec, quarantine, issues);
    if (spec.headerRow) rows[spec.name] = parsed.rows;
    perSheet[spec.name] = { rows: parsed.rows.length, skipped: parsed.skipped };
  }

  const allowCountDrift = options.allowCountDrift ?? false;
  addCountValidation(
    issues,
    "02 Gen 1 Roster",
    rows["02 Gen 1 Roster"]?.length ?? 0,
    151,
    allowCountDrift,
  );
  addCountValidation(
    issues,
    "03 Type Membership",
    rows["03 Type Membership"]?.length ?? 0,
    218,
    allowCountDrift,
  );
  addCountValidation(
    issues,
    "04 Type Workshop",
    rows["04 Type Workshop"]?.length ?? 0,
    18,
    allowCountDrift,
  );
  addCountValidation(
    issues,
    "05 Pokemon Ideas",
    rows["05 Pokemon Ideas"]?.length ?? 0,
    151,
    allowCountDrift,
  );
  addCountValidation(
    issues,
    "06 Create Catalog",
    rows["06 Create Catalog"]?.length ?? 0,
    11,
    allowCountDrift,
  );
  addCountValidation(
    issues,
    "07 Idea Backlog",
    rows["07 Idea Backlog"]?.length ?? 0,
    12,
    allowCountDrift,
  );

  const roster = rows["02 Gen 1 Roster"] ?? [];
  const changedTypes = roster.filter((row) => row.derived?.type_changed === true).length;
  if (changedTypes !== 7) {
    issues.push({
      category: allowCountDrift ? "manual_review" : "invalid",
      sheet: "02 Gen 1 Roster",
      message: `Expected seven modern/original type changes, found ${changedTypes}.`,
    });
  }

  const ownershipRows = Object.values(rows)
    .flat()
    .filter((row) => row.fields.explicit_owner !== null && row.fields.explicit_owner !== undefined);
  const allowedOwners = new Set(
    (rows["08 Sources & Lists"] ?? [])
      .map((row) => row.fields.owner_values)
      .filter((owner): owner is string => typeof owner === "string" && owner.length > 0),
  );
  for (const row of ownershipRows) {
    if (!allowedOwners.has(String(row.fields.explicit_owner))) {
      issues.push({
        category: "invalid",
        sheet: row.sheet,
        row: row.row,
        message: `Explicit owner ${String(row.fields.explicit_owner)} is not present in the workbook OWNER list.`,
      });
    }
  }

  const dispositions: WorkbookFieldDisposition[] = workbookSheetSpecs.flatMap((spec) =>
    (spec.fields ?? []).map(([column, field]) => {
      const reason = quarantinedWorkbookFields.get(`${spec.name}/${column}`);
      return reason
        ? { sheet: spec.name, column, field, disposition: "quarantined" as const, reason }
        : { sheet: spec.name, column, field, disposition: "mapped" as const };
    }),
  );
  const changes = comparePrevious(rows, options.previous);
  const skipped = Object.values(perSheet).reduce((total, sheet) => total + sheet.skipped, 0);
  const reportWithoutOutput: Omit<WorkbookImportReport, "output_sha256"> = {
    counts: {
      ...changes,
      skipped,
      invalid: countIssues(issues, "invalid"),
      ambiguous: countIssues(issues, "ambiguous"),
      manual_review: countIssues(issues, "manual_review"),
      quarantined: quarantine.length,
      duplicate: countIssues(issues, "duplicate"),
      unsupported: countIssues(issues, "unsupported"),
    },
    per_sheet: perSheet,
    issues,
    transformations: [
      "Trimmed surrounding whitespace and normalized empty cells to null.",
      "Normalized date cells to ISO yyyy-mm-dd values.",
      "Resolved formula cells to cached results while preserving formulas in reference sheets.",
      "Normalized explicit x:-prefixed SpreadsheetML elements in memory for ExcelJS compatibility; the source workbook was not modified.",
      "Ignored worksheet table presentation metadata while reading cell values because ExcelJS does not resolve artifact-tool's absolute table relationship targets.",
      "Separated merged methodology notes from source/list rows and retained them as reference cells.",
      "Mapped nidoran-f, nidoran-m, and mr-mime to Cobblemon registry slugs nidoranf, nidoranm, and mrmime.",
      "Derived default form IDs, Cobblemon IDs, type arrays, and boolean flags without changing source fields.",
      "Quarantined Pokédex flavor text outside all public and mod projections.",
      "Kept task ownership null unless an Explicit Owner cell contains a value from the workbook OWNER list.",
    ],
    source_sha256: sourceHash,
  };

  const document: WorkbookImportDocument = {
    import_format_version: 1,
    importer_version: "1.0.0",
    source: { file_name: basename(options.sourceName), sha256: sourceHash },
    field_dispositions: dispositions,
    sheet_inventory: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      row_count: sheet.rowCount,
      column_count: sheet.columnCount,
    })),
    reference_sheets: referenceSheets,
    rows,
    quarantine,
    report: reportWithoutOutput,
  };
  const outputHash = sha256(canonicalJson(document as unknown as JsonValue));
  return {
    document,
    report: { ...reportWithoutOutput, output_sha256: outputHash },
  };
}

export function renderImportReport(report: WorkbookImportReport): string {
  const lines = [
    "# Workbook migration report",
    "",
    `- Source SHA-256: \`${report.source_sha256}\``,
    `- Intermediate SHA-256: \`${report.output_sha256}\``,
    `- Imported: ${report.counts.imported}`,
    `- Updated: ${report.counts.updated}`,
    `- Unchanged: ${report.counts.unchanged}`,
    `- Skipped blank rows: ${report.counts.skipped}`,
    `- Invalid: ${report.counts.invalid}`,
    `- Ambiguous: ${report.counts.ambiguous}`,
    `- Manual review: ${report.counts.manual_review}`,
    `- Quarantined fields: ${report.counts.quarantined}`,
    `- Duplicates: ${report.counts.duplicate}`,
    `- Unsupported: ${report.counts.unsupported}`,
    "",
    "## Per-sheet totals",
    "",
    "| Sheet | Populated rows | Skipped blank rows |",
    "|---|---:|---:|",
    ...Object.entries(report.per_sheet).map(
      ([sheet, counts]) =>
        `| ${sheet.replaceAll("|", "\\|")} | ${counts.rows} | ${counts.skipped} |`,
    ),
    "",
    "## Issues",
    "",
  ];
  if (report.issues.length === 0) lines.push("No issues detected.");
  else {
    for (const issue of report.issues) {
      const location = [issue.sheet, issue.row ? `row ${issue.row}` : undefined]
        .filter(Boolean)
        .join(", ");
      lines.push(`- **${issue.category}**${location ? ` (${location})` : ""}: ${issue.message}`);
    }
  }
  lines.push("", "## Transformations", "");
  lines.push(...report.transformations.map((entry) => `- ${entry}`));
  return `${lines.join("\n")}\n`;
}
