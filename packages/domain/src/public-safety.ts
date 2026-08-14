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

export interface UnsafePublicField {
  path: string;
  key: string;
}

export function findUnsafePublicFields(value: unknown): UnsafePublicField[] {
  const findings: UnsafePublicField[] = [];

  function visit(current: unknown, path: string): void {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }

    if (!current || typeof current !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(current)) {
      const childPath = `${path}/${key}`;
      if (forbiddenPublicKeys.has(key.toLowerCase())) {
        findings.push({ path: childPath, key });
      }
      visit(child, childPath);
    }
  }

  visit(value, "");
  return findings;
}

export function assertPublicSafe(value: unknown): void {
  const findings = findUnsafePublicFields(value);
  if (findings.length > 0) {
    throw new Error(
      `Public data contains private or quarantined fields: ${findings
        .map((finding) => finding.path)
        .join(", ")}`,
    );
  }
}
