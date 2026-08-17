"use server";

import { headers } from "next/headers";
import {
  addFixtureStudioComment,
  approveFixtureStudioRecord,
  saveFixtureStudioRecord,
  setFixtureWorkItemAssignments,
} from "@/data/gen1-fixture";
import type {
  StudioComment,
  StudioHead,
  StudioObject,
  StudioRecord,
  StudioRecordDetail,
  StudioWorkItemLink,
} from "@/data/studio-types";
import { requireEditor, requireMaintainer } from "@/lib/auth";
import { getAppBaseUrl, hasSupabaseEnvironment, isFixtureModeEnabled } from "@/lib/env";
import { isCanonicalUuid } from "@/lib/uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  listStudioMembers,
  loadStudioRecord,
  loadStudioRecordHead,
  normalizeStudioRecord,
} from "./studio-repository";
import { createSignedPublicationBundleFromRpc, publicationIdFromRpc } from "./publication-bundle";

export interface StudioSaveInput {
  publicId: string;
  expectedRevision: number;
  clientMutationId: string;
  patch: Partial<
    Pick<StudioRecord, "facts" | "design" | "work" | "balance" | "testing" | "planning">
  > & {
    private_note?: string;
  };
}

export type StudioSaveResult =
  | { ok: true; record: StudioRecord }
  | { ok: false; kind: "validation"; message: string }
  | { ok: false; kind: "conflict"; current: StudioRecordDetail }
  | { ok: false; kind: "error"; message: string };

export type StudioPublicationResult =
  | { ok: true; publicationId: string }
  | { ok: false; kind: "validation" | "conflict" | "error"; message: string };

function validPublicId(value: string): boolean {
  return /^[a-z0-9_.-]+:[a-z0-9_./-]+$/u.test(value);
}

function boundedObject(value: unknown): value is StudioObject {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(value).length <= 1_000_000
  );
}

async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl || origin !== appBaseUrl.origin) {
    throw new Error("Cross-origin Studio mutation rejected.");
  }
}

function validateSaveInput(input: StudioSaveInput): string | null {
  if (!validPublicId(input.publicId)) return "The selected Studio record has an invalid ID.";
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return "The record revision is invalid.";
  }
  if (!isCanonicalUuid(input.clientMutationId)) return "The edit request ID is invalid.";
  const entries = Object.entries(input.patch);
  if (!entries.length) return "Make a change before saving.";
  for (const [key, value] of entries) {
    if (key === "private_note") {
      if (typeof value !== "string" || value.length > 10_000)
        return "Private notes must be text up to 10,000 characters.";
      continue;
    }
    if (!boundedObject(value)) return "Structured Studio sections must be valid bounded objects.";
  }
  return null;
}

export async function saveStudioRecord(input: StudioSaveInput): Promise<StudioSaveResult> {
  await assertSameOrigin();
  await requireEditor("/studio");
  const message = validateSaveInput(input);
  if (message) return { ok: false, kind: "validation", message };
  if (isFixtureModeEnabled()) {
    const current = await loadStudioRecord(input.publicId);
    if (current.revision !== input.expectedRevision)
      return { ok: false, kind: "conflict", current };
    const record = saveFixtureStudioRecord(input.publicId, input.expectedRevision, {
      facts: input.patch.facts ?? current.facts,
      design: input.patch.design ?? current.design,
      work: input.patch.work ?? current.work,
      balance: input.patch.balance ?? current.balance,
      testing: input.patch.testing ?? current.testing,
      planning: input.patch.planning ?? current.planning,
      privateNote: input.patch.private_note ?? current.privateNote,
    });
    return record ? { ok: true, record } : { ok: false, kind: "conflict", current };
  }
  if (!hasSupabaseEnvironment())
    return { ok: false, kind: "error", message: "Supabase is not configured." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("save_record_revision", {
    p_public_id: input.publicId,
    p_expected_revision: input.expectedRevision,
    p_client_mutation_id: input.clientMutationId,
    p_patch: input.patch,
  });
  if (error) {
    if (/revision_conflict/u.test(`${error.code} ${error.message}`.toLowerCase())) {
      return { ok: false, kind: "conflict", current: await loadStudioRecord(input.publicId) };
    }
    return {
      ok: false,
      kind: "error",
      message: "The record could not be saved. No fields were overwritten.",
    };
  }
  const envelope = data as { record?: unknown };
  return { ok: true, record: normalizeStudioRecord(envelope.record ?? data) };
}

export async function approveStudioRecord(
  publicId: string,
  expectedRevision: number,
): Promise<StudioSaveResult> {
  await assertSameOrigin();
  await requireMaintainer("/studio");
  if (!validPublicId(publicId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return { ok: false, kind: "validation", message: "The record or exact revision is invalid." };
  }
  if (isFixtureModeEnabled()) {
    const current = await loadStudioRecord(publicId);
    if (current.revision !== expectedRevision) return { ok: false, kind: "conflict", current };
    const record = approveFixtureStudioRecord(publicId, expectedRevision);
    return record ? { ok: true, record } : { ok: false, kind: "conflict", current };
  }
  if (!hasSupabaseEnvironment())
    return { ok: false, kind: "error", message: "Supabase is not configured." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("approve_record_revision", {
    p_public_id: publicId,
    p_expected_revision: expectedRevision,
  });
  if (error) {
    if (/revision_conflict|integrity/u.test(`${error.code} ${error.message}`.toLowerCase())) {
      return { ok: false, kind: "conflict", current: await loadStudioRecord(publicId) };
    }
    return { ok: false, kind: "error", message: "Approval failed without changing the record." };
  }
  const envelope = data as { record?: unknown };
  return { ok: true, record: normalizeStudioRecord(envelope.record ?? data) };
}

export async function checkStudioRecordHead(publicId: string): Promise<StudioHead> {
  await requireEditor("/studio");
  if (!validPublicId(publicId)) throw new Error("The selected Studio record has an invalid ID.");
  return loadStudioRecordHead(publicId);
}

export async function addStudioComment(publicId: string, body: string): Promise<StudioComment> {
  await assertSameOrigin();
  await requireEditor("/studio");
  if (!validPublicId(publicId) || body.trim().length < 1 || body.length > 10_000) {
    throw new Error("Comments must contain 1 to 10,000 characters.");
  }
  if (isFixtureModeEnabled()) {
    const comment = addFixtureStudioComment(publicId, body);
    if (!comment) throw new Error("The fixture record could not be found.");
    return comment;
  }
  if (!hasSupabaseEnvironment()) throw new Error("Supabase is not configured.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_record_comment", {
    p_public_id: publicId,
    p_body: body.trim(),
  });
  if (error || !data || typeof data !== "object")
    throw new Error("The comment could not be saved.");
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    body: String(row.body ?? body.trim()),
    author: "Maintainer",
    createdAt: String(row.created_at ?? new Date().toISOString()),
    resolvedAt: null,
    resolvedBy: null,
  };
}

export async function setStudioWorkItemAssignments(input: {
  publicId: string;
  expectedRevision: number;
  assigneeIds: string[];
  handoffNote: string;
  status?: string;
  priority?: string;
}): Promise<StudioWorkItemLink[]> {
  await assertSameOrigin();
  await requireEditor("/studio/workboard");
  if (
    !validPublicId(input.publicId) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1 ||
    input.assigneeIds.length > 2 ||
    input.assigneeIds.some((id) => !isCanonicalUuid(id))
  ) {
    throw new Error("The work-item assignment is invalid.");
  }
  if (input.assigneeIds.length > 1 && !input.handoffNote.trim()) {
    throw new Error("A shared task needs a handoff note.");
  }
  if (isFixtureModeEnabled()) {
    const [current, members] = await Promise.all([
      loadStudioRecord(input.publicId),
      listStudioMembers(),
    ]);
    if (current.revision !== input.expectedRevision) {
      throw new Error("The work item changed before this save. Refresh and try again.");
    }
    const assignees = members.filter((member) => input.assigneeIds.includes(member.authUserId));
    if (assignees.length !== input.assigneeIds.length) {
      throw new Error("Every work-item assignee must be an active Studio member.");
    }
    const saved = setFixtureWorkItemAssignments(
      input.publicId,
      input.expectedRevision,
      assignees,
      input.handoffNote,
      input.status ?? current.taskStatus ?? "backlog",
      input.priority ?? "normal",
    );
    if (!saved) throw new Error("The work item changed before this save. Refresh and try again.");
    return [];
  }
  if (!hasSupabaseEnvironment()) throw new Error("Supabase is not configured.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_work_item_assignees", {
    p_public_id: input.publicId,
    p_expected_revision: input.expectedRevision,
    p_assignee_ids: input.assigneeIds,
    p_handoff_note: input.handoffNote,
    p_status: input.status,
    p_priority: input.priority,
  });
  if (error || !data || typeof data !== "object")
    throw new Error("The work-item assignment could not be saved.");
  const rows = (data as { work_items?: unknown }).work_items;
  return Array.isArray(rows) ? (rows as StudioWorkItemLink[]) : [];
}

/**
 * Freezes selected approved heads, plus their required profile dependencies.
 * The returned ID can be downloaded through the existing private bundle route;
 * neither this action nor the database writes to Git.
 */
export async function createStudioPublicationBatch(
  publicIds: string[],
): Promise<StudioPublicationResult> {
  await assertSameOrigin();
  await requireMaintainer("/studio/publications");
  const selected = [...new Set(publicIds.map((value) => value.trim()).filter(Boolean))];
  if (
    !selected.length ||
    selected.length > 200 ||
    selected.some((value) => !validPublicId(value))
  ) {
    return {
      ok: false,
      kind: "validation",
      message: "Select one to 200 distinct approved Studio records.",
    };
  }
  if (selected.length !== publicIds.length) {
    return {
      ok: false,
      kind: "validation",
      message: "A publication batch cannot contain duplicate record IDs.",
    };
  }
  if (isFixtureModeEnabled()) {
    return {
      ok: false,
      kind: "error",
      message:
        "Fixture mode never creates publication batches. Use the configured private database.",
    };
  }
  if (!hasSupabaseEnvironment()) {
    return { ok: false, kind: "error", message: "Supabase is not configured." };
  }
  const signingKey = process.env.PUBLICATION_SIGNING_KEY;
  if (!signingKey) {
    return { ok: false, kind: "error", message: "Publication signing is not configured." };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_publication_batch", {
    p_public_ids: selected,
  });
  if (error) {
    const diagnostic = `${error.code} ${error.message}`.toLowerCase();
    if (
      diagnostic.includes("approved") ||
      diagnostic.includes("revision") ||
      diagnostic.includes("conflict")
    ) {
      return {
        ok: false,
        kind: "conflict",
        message:
          "One or more selected records or required dependencies are no longer exactly approved.",
      };
    }
    return { ok: false, kind: "error", message: "The publication batch could not be created." };
  }
  try {
    const publicationId = publicationIdFromRpc(data);
    createSignedPublicationBundleFromRpc(data, signingKey, publicationId);
    return { ok: true, publicationId };
  } catch {
    return {
      ok: false,
      kind: "error",
      message: "The database batch failed public-projection integrity validation.",
    };
  }
}
