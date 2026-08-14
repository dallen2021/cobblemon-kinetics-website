import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  importWorkbook,
  validatePrivateImportOutput,
} from "../src/import-workbook/import-workbook.js";
import { workbookSheetSpecs } from "../src/import-workbook/workbook-spec.js";

function sampleValue(field: string): string | number | null {
  const values: Record<string, string | number | null> = {
    current_primary: "Psychic",
    current_secondary: "Fairy",
    national_dex: 122,
    pokemon: "Mr. Mime",
    api_slug: "mr-mime",
    current_typing: "Psychic / Fairy",
    original_gen1_typing: "Psychic",
    type_changed: "Yes",
    pokedex_entry: "Quarantined test prose",
    pokeapi_source: "https://pokeapi.co/api/v2/pokemon/122/",
    type: "Psychic",
    membership: "Primary",
    system_id: "MACH-001",
    idea_id: "IDEA-001",
    source: "PokéAPI",
    url: "https://pokeapi.co/",
    checked: "Yes",
  };
  return values[field] ?? null;
}

async function syntheticWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const spec of workbookSheetSpecs) {
    const sheet = workbook.addWorksheet(spec.name);
    if (!spec.headerRow || !spec.fields) {
      sheet.getCell("A1").value = `${spec.name} reference`;
      continue;
    }
    sheet.getRow(spec.headerRow).values = spec.fields.map(([header]) => header);
    sheet.getRow(spec.headerRow + 1).values = spec.fields.map(([, field]) => sampleValue(field));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function prefixWorkbookNamespace(buffer: Buffer): Promise<Buffer> {
  const archive = await JSZip.loadAsync(buffer);
  const entry = archive.file("xl/workbook.xml");
  if (!entry) throw new Error("Synthetic workbook has no workbook.xml entry.");
  const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const xml = await entry.async("string");
  const prefixed = xml
    .replace(`xmlns="${namespace}"`, `xmlns:x="${namespace}"`)
    .replace(
      /<(\/?)((?:workbook|sheets|sheet|definedNames|definedName|bookViews|workbookView|workbookPr|calcPr))(?=[\s>])/gu,
      "<$1x:$2",
    );
  archive.file("xl/workbook.xml", prefixed);
  return Buffer.from(await archive.generateAsync({ type: "uint8array" }));
}

describe("workbook importer", () => {
  it("keeps ExcelJS compatible with the security-patched CommonJS uuid v4 API", () => {
    const require = createRequire(import.meta.url);
    const requireFromExcelJs = createRequire(require.resolve("exceljs/package.json"));
    const uuid = requireFromExcelJs("uuid") as { v4?: () => string };
    expect(uuid.v4?.()).toMatch(/^[a-f0-9-]{36}$/u);
  });

  it("audits all nine sheets, preserves ownership neutrality, and quarantines flavor text", async () => {
    const result = await importWorkbook(await syntheticWorkbook(), {
      sourceName: "/private/example.xlsx",
      allowCountDrift: true,
    });
    expect(result.document.sheet_inventory).toHaveLength(9);
    const roster = result.document.rows["02 Gen 1 Roster"]?.[0];
    expect(roster?.fields).not.toHaveProperty("pokedex_entry");
    expect(roster?.derived).toMatchObject({
      cobblemon_id: "cobblemon:mrmime",
      current_types: ["psychic", "fairy"],
      original_gen1_types: ["psychic"],
      type_changed: true,
    });
    expect(result.document.quarantine).toEqual([
      expect.objectContaining({
        sheet: "02 Gen 1 Roster",
        field: "pokedex_entry",
        value: "Quarantined test prose",
      }),
    ]);
    const backlog = result.document.rows["07 Idea Backlog"]?.[0];
    expect(backlog?.fields.explicit_owner).toBeNull();
    expect(result.report.counts.invalid).toBe(0);
  });

  it("reports an exact-header failure instead of silently dropping a column", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(asArrayBuffer(await syntheticWorkbook()));
    workbook.getWorksheet("02 Gen 1 Roster")!.getCell("A5").value = "Renamed Type";
    const result = await importWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()), {
      sourceName: "changed.xlsx",
      allowCountDrift: true,
    });
    expect(result.report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "invalid", sheet: "02 Gen 1 Roster", row: 5 }),
      ]),
    );
  });

  it("normalizes artifact-tool-style x:-prefixed workbook XML in memory", async () => {
    const result = await importWorkbook(await prefixWorkbookNamespace(await syntheticWorkbook()), {
      sourceName: "prefixed.xlsx",
      allowCountDrift: true,
    });
    expect(result.document.sheet_inventory.map((sheet) => sheet.name)).toHaveLength(9);
    expect(result.report.counts.invalid).toBe(0);
  });

  it("refuses to write quarantined workbook data into tracked repository paths", async () => {
    const repository = fileURLToPath(new URL("../../../", import.meta.url));
    await expect(
      validatePrivateImportOutput(resolve(repository, ".private/migration/import-test")),
    ).resolves.toBe(resolve(repository, ".private/migration/import-test"));
    await expect(
      validatePrivateImportOutput(resolve(repository, "data/migration")),
    ).rejects.toThrow(/private\/quarantined data/);
  });
});
