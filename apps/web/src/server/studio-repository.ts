import { fixtureRecordDetail, fixtureRecordList } from "@/data/gen1-fixture";
import type {
  StudioAssignee,
  StudioComment,
  StudioHead,
  StudioImportRun,
  StudioAuditEvent,
  StudioJson,
  StudioObject,
  StudioProvenance,
  StudioRecord,
  StudioRecordDetail,
  StudioRecordFilters,
  StudioRecordList,
  StudioRevision,
  StudioWorkItemLink,
} from "@/data/studio-types";
import { hasSupabaseEnvironment, isFixtureModeEnabled } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The studio RPC returned an invalid object.");
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function jsonObject(value: unknown): StudioObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as StudioObject;
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function workflow(value: unknown): StudioRecord["workflowState"] {
  return value === "in_review" || value === "approved" || value === "archived" ? value : "draft";
}

function recordKind(value: unknown): StudioRecord["recordKind"] {
  const allowed = new Set<StudioRecord["recordKind"]>([
    "pokemon_species",
    "pokemon_form",
    "registry_entry",
    "job",
    "machine",
    "work_profile",
    "work_item",
    "type_workshop",
    "pokemon_idea",
    "machine_research",
  ]);
  if (!allowed.has(value as StudioRecord["recordKind"])) {
    throw new Error("The Studio RPC returned an unsupported record kind.");
  }
  return value as StudioRecord["recordKind"];
}

export function normalizeStudioRecord(value: unknown): StudioRecord {
  const row = objectValue(value);
  const publicId = readString(row, "public_id");
  if (!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/u.test(publicId)) {
    throw new Error("The Studio RPC returned an invalid public ID.");
  }
  const revision = Number(row.revision ?? 0);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("The Studio RPC returned an invalid revision.");
  }
  return {
    publicId,
    slug: readString(row, "slug"),
    displayName: readString(row, "display_name"),
    recordKind: recordKind(row.record_kind),
    workflowState: workflow(row.workflow_state),
    revision,
    checksum: readString(row, "checksum"),
    updatedAt: readString(row, "updated_at", new Date(0).toISOString()),
    updatedBy: readString(row, "updated_by_display_name", "Maintainer"),
    nationalDex: numberOrNull(row.national_dex),
    cobblemonSpeciesId: nullableString(row.cobblemon_species_id),
    types: jsonStringArray(row.types),
    taskStatus: nullableString(row.task_status),
    taskCount: Number.isSafeInteger(Number(row.task_count)) ? Number(row.task_count) : 0,
    workItemAssignees: normalizeAssignees(row.work_item_assignees),
    workReady: readString(row, "work_ready", "not_started"),
    facts: jsonObject(row.facts),
    design: jsonObject(row.design),
    work: jsonObject(row.work),
    balance: jsonObject(row.balance),
    testing: jsonObject(row.testing),
    planning: jsonObject(row.planning),
    privateNote: readString(row, "private_note"),
  };
}

function normalizeRevision(value: unknown): StudioRevision | null {
  const row = objectValue(value);
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision)) return null;
  return {
    revision,
    actor: readString(row, "actor_display_name", "Maintainer"),
    at: readString(row, "created_at", new Date(0).toISOString()),
    summary: readString(row, "change_summary", "Updated Studio record."),
    snapshot: jsonObject(row.snapshot),
  };
}

function normalizeComment(value: unknown): StudioComment | null {
  const row = objectValue(value);
  const id = readString(row, "id");
  if (!id) return null;
  return {
    id,
    body: readString(row, "body"),
    author: readString(row, "author", "Maintainer"),
    createdAt: readString(row, "created_at", new Date(0).toISOString()),
    resolvedAt: nullableString(row.resolved_at),
    resolvedBy: nullableString(row.resolved_by),
  };
}

function normalizeAssignees(value: unknown): StudioAssignee[] {
  return Array.isArray(value)
    ? value
        .map((item): StudioAssignee | null => {
          const person = objectValue(item);
          const authUserId = readString(person, "auth_user_id");
          const githubLogin = readString(person, "github_login");
          if (!authUserId || !githubLogin) return null;
          const role = readString(person, "role");
          const member: StudioAssignee = {
            authUserId,
            githubLogin,
            displayName: readString(person, "display_name", githubLogin),
          };
          if (role === "viewer" || role === "editor" || role === "maintainer") {
            member.role = role;
          }
          return member;
        })
        .filter((item): item is StudioAssignee => item !== null)
    : [];
}

function normalizeWorkItem(value: unknown): StudioWorkItemLink | null {
  const row = objectValue(value);
  const publicId = readString(row, "work_item_public_id");
  if (!publicId) return null;
  return {
    publicId,
    title: readString(row, "title"),
    status: readString(row, "status", "backlog"),
    priority: readString(row, "priority", "normal"),
    relation: readString(row, "relation", "develops"),
    handoffNote: readString(row, "handoff_note"),
    assignees: normalizeAssignees(row.assignees),
  };
}

function normalizeProvenance(value: unknown): StudioProvenance | null {
  const row = objectValue(value);
  const fieldPath = readString(row, "field_path");
  if (!fieldPath) return null;
  return {
    fieldPath,
    sourceSheet: readString(row, "source_sheet"),
    sourceRow: Number(row.source_row ?? 0),
    sourceKey: readString(row, "source_key"),
    importedValue: (row.imported_value ?? null) as StudioJson,
    importedHash: readString(row, "imported_hash"),
    overriddenAt: nullableString(row.overridden_at),
  };
}

export async function listStudioRecords(
  filters: StudioRecordFilters = {},
): Promise<StudioRecordList> {
  if (isFixtureModeEnabled()) {
    const items = fixtureRecordList(filters).slice(0, filters.limit ?? 200);
    return { items, nextCursor: null };
  }
  if (!hasSupabaseEnvironment()) {
    throw new Error("The development studio requires a configured Supabase project.");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_editor_records", {
    p_kind: filters.kind,
    p_query: filters.query,
    p_type: filters.type,
    p_workflow: filters.workflow,
    p_task_status: filters.taskStatus,
    p_limit: filters.limit ?? 200,
    p_cursor: filters.cursor,
  });
  if (error) throw new Error(`Could not load Studio records: ${error.message}`);
  const envelope = objectValue(data);
  return {
    items: (Array.isArray(envelope.items) ? envelope.items : []).map(normalizeStudioRecord),
    nextCursor: nullableString(envelope.next_cursor),
  };
}

export async function loadStudioRecord(publicIdOrSlug: string): Promise<StudioRecordDetail> {
  if (isFixtureModeEnabled()) {
    const fixture = fixtureRecordDetail(publicIdOrSlug);
    if (!fixture) throw new Error("The requested fixture record does not exist.");
    return fixture;
  }
  if (!hasSupabaseEnvironment()) {
    throw new Error("The development studio requires a configured Supabase project.");
  }
  let publicId = publicIdOrSlug;
  if (!publicId.includes(":")) {
    const matching = await listStudioRecords({
      kind: "pokemon_species",
      query: publicId,
      limit: 200,
    });
    const record = matching.items.find((candidate) => candidate.slug === publicId);
    if (!record) throw new Error("The requested Studio record does not exist.");
    publicId = record.publicId;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_editor_record", { p_public_id: publicId });
  if (error) throw new Error(`Could not load Studio record: ${error.message}`);
  const envelope = objectValue(data);
  return {
    ...normalizeStudioRecord(envelope.record ?? envelope),
    revisions: (Array.isArray(envelope.revisions) ? envelope.revisions : [])
      .map(normalizeRevision)
      .filter((item): item is StudioRevision => item !== null),
    comments: (Array.isArray(envelope.comments) ? envelope.comments : [])
      .map(normalizeComment)
      .filter((item): item is StudioComment => item !== null),
    workItems: (Array.isArray(envelope.work_items) ? envelope.work_items : [])
      .map(normalizeWorkItem)
      .filter((item): item is StudioWorkItemLink => item !== null),
    provenance: (Array.isArray(envelope.provenance) ? envelope.provenance : [])
      .map(normalizeProvenance)
      .filter((item): item is StudioProvenance => item !== null),
  };
}

export async function loadStudioRecordHead(publicId: string): Promise<StudioHead> {
  if (isFixtureModeEnabled()) {
    const record = fixtureRecordDetail(publicId);
    if (!record) throw new Error("The requested fixture record does not exist.");
    return {
      publicId: record.publicId,
      revision: record.revision,
      checksum: record.checksum,
      workflowState: record.workflowState,
      updatedAt: record.updatedAt,
    };
  }
  if (!hasSupabaseEnvironment())
    throw new Error("The development studio requires a configured Supabase project.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_record_head", { p_public_id: publicId });
  if (error) throw new Error(`Could not check the current Studio revision: ${error.message}`);
  const row = objectValue(data);
  return {
    publicId: readString(row, "public_id"),
    revision: Number(row.revision),
    checksum: readString(row, "checksum"),
    workflowState: workflow(row.workflow_state),
    updatedAt: readString(row, "updated_at", new Date(0).toISOString()),
  };
}

export async function listStudioMembers(): Promise<import("@/data/studio-types").StudioAssignee[]> {
  if (isFixtureModeEnabled()) {
    return [
      {
        authUserId: "00000000-0000-4000-8000-000000000007",
        githubLogin: "fixture-daniel",
        displayName: "Fixture Daniel",
        role: "maintainer",
      },
      {
        authUserId: "00000000-0000-4000-8000-000000000008",
        githubLogin: "fixture-jake",
        displayName: "Fixture Jake",
        role: "maintainer",
      },
    ];
  }
  if (!hasSupabaseEnvironment())
    throw new Error("The development studio requires a configured Supabase project.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_active_members");
  if (error || !Array.isArray(data)) throw new Error("Could not load active Studio members.");
  return data
    .map((value) => {
      const row = objectValue(value);
      const authUserId = readString(row, "auth_user_id");
      const githubLogin = readString(row, "github_login");
      if (!authUserId || !githubLogin) return null;
      const role = row.role;
      return {
        authUserId,
        githubLogin,
        displayName: readString(row, "display_name", githubLogin),
        ...(role === "viewer" || role === "editor" || role === "maintainer" ? { role } : {}),
      };
    })
    .filter((member): member is import("@/data/studio-types").StudioAssignee => member !== null);
}

export async function listStudioImportRuns(): Promise<StudioImportRun[]> {
  if (isFixtureModeEnabled()) {
    return [
      {
        id: "fixture-gen1-import",
        sourceSha256: "f".repeat(64),
        sourceFilename: "reviewed-gen1-workbook.xlsx",
        status: "dry_run",
        createdAt: "2026-08-15T00:00:00.000Z",
        completedAt: null,
        summary: { imported: 581, quarantined: 151, manual_review: 0 },
        reviewCount: 0,
        quarantinedCount: 151,
      },
    ];
  }
  if (!hasSupabaseEnvironment())
    throw new Error("The development studio requires a configured Supabase project.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("import_runs")
    .select("id,source_sha256,source_filename,status,created_at,completed_at,summary")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Could not load import runs.");
  const result: StudioImportRun[] = [];
  for (const run of data ?? []) {
    const { data: importRows, error: importRowsError } = await supabase
      .from("import_rows")
      .select("id")
      .eq("import_run_id", run.id);
    if (importRowsError) throw new Error("Could not load import row details.");
    const importRowIds = (importRows ?? []).map((row) => row.id);
    const [{ count: reviews }, { count: quarantined }] = importRowIds.length
      ? await Promise.all([
          supabase
            .from("import_field_reviews")
            .select("id", { count: "exact", head: true })
            .in("import_row_id", importRowIds)
            .eq("classification", "overwrite_conflict"),
          supabase
            .from("import_field_reviews")
            .select("id", { count: "exact", head: true })
            .in("import_row_id", importRowIds)
            .eq("classification", "quarantined"),
        ])
      : [{ count: 0 }, { count: 0 }];
    result.push({
      id: String(run.id),
      sourceSha256: String(run.source_sha256),
      sourceFilename: String(run.source_filename),
      status: String(run.status),
      createdAt: String(run.created_at),
      completedAt: run.completed_at ? String(run.completed_at) : null,
      summary: jsonObject(run.summary),
      reviewCount: reviews ?? 0,
      quarantinedCount: quarantined ?? 0,
    });
  }
  return result;
}

export async function listStudioAuditEvents(): Promise<StudioAuditEvent[]> {
  if (isFixtureModeEnabled()) {
    return fixtureRecordList({ kind: "pokemon_species" })
      .slice(0, 8)
      .map((record, index) => ({
        id: index + 1,
        recordId: record.publicId,
        action: "record.imported",
        beforeRevision: null,
        afterRevision: record.revision,
        createdAt: record.updatedAt,
      }));
  }
  if (!hasSupabaseEnvironment())
    throw new Error("The development studio requires a configured Supabase project.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,record_id,action,before_revision,after_revision,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load Studio history.");
  return (data ?? []).map((event) => ({
    id: Number(event.id),
    recordId: event.record_id ? String(event.record_id) : null,
    action: String(event.action),
    beforeRevision: event.before_revision === null ? null : Number(event.before_revision),
    afterRevision: event.after_revision === null ? null : Number(event.after_revision),
    createdAt: String(event.created_at),
  }));
}
