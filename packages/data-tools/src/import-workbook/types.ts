import type { JsonValue } from "../lib/canonical-json.js";

export interface WorkbookFieldDisposition {
  sheet: string;
  column: string;
  field: string;
  disposition: "mapped" | "quarantined";
  reason?: string;
}

export interface ImportedWorkbookRow {
  sheet: string;
  row: number;
  stable_key: string;
  fingerprint: string;
  field_hashes: Record<string, string>;
  fields: Record<string, JsonValue>;
  derived?: Record<string, JsonValue>;
}

export interface QuarantinedWorkbookField {
  sheet: string;
  row: number;
  column: string;
  field: string;
  reason: string;
  value: JsonValue;
  value_sha256: string;
}

export interface ReferenceWorkbookCell {
  address: string;
  value: JsonValue;
  formula?: string;
}

export interface WorkbookIssue {
  category: "invalid" | "ambiguous" | "manual_review" | "duplicate" | "unsupported";
  sheet?: string;
  row?: number;
  message: string;
}

export interface WorkbookImportReport {
  counts: {
    imported: number;
    updated: number;
    unchanged: number;
    skipped: number;
    invalid: number;
    ambiguous: number;
    manual_review: number;
    quarantined: number;
    duplicate: number;
    unsupported: number;
  };
  per_sheet: Record<string, { rows: number; skipped: number }>;
  issues: WorkbookIssue[];
  transformations: string[];
  source_sha256: string;
  output_sha256: string;
}

export interface WorkbookImportDocument {
  import_format_version: 1;
  importer_version: "1.0.0";
  source: {
    file_name: string;
    sha256: string;
  };
  field_dispositions: WorkbookFieldDisposition[];
  sheet_inventory: Array<{ name: string; row_count: number; column_count: number }>;
  reference_sheets: Record<string, ReferenceWorkbookCell[]>;
  rows: Record<string, ImportedWorkbookRow[]>;
  quarantine: QuarantinedWorkbookField[];
  report: Omit<WorkbookImportReport, "output_sha256">;
}
