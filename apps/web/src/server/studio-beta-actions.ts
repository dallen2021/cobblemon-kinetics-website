"use server";

import { headers } from "next/headers";
import {
  addFixtureStudioComment,
  approveFixtureBlueprintRecord,
  approveFixtureStudioRecord,
  fixtureFamilyBlueprint,
  saveFixtureFamilyBlueprint,
  saveFixtureStudioRecord,
  setFixtureWorkItemAssignments,
} from "@/data/gen1-fixture";
import type {
  BlueprintConflictEntity,
  BlueprintOperation,
  FamilyBlueprint,
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
  loadBlueprintHead,
  normalizeBlueprint,
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

export type BlueprintApprovalResult =
  | { ok: true; publicId: string; revision: number; workflowState: "approved" }
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

export async function approveBlueprintRecord(
  publicId: string,
  expectedRevision: number,
): Promise<BlueprintApprovalResult> {
  await assertSameOrigin();
  await requireMaintainer("/studio");
  if (!validPublicId(publicId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return {
      ok: false,
      kind: "validation",
      message: "The Blueprint record or revision is invalid.",
    };
  }
  if (isFixtureModeEnabled()) {
    const record = approveFixtureBlueprintRecord(publicId, expectedRevision);
    return record
      ? { ok: true, ...record }
      : {
          ok: false,
          kind: "conflict",
          message: "The fixture record changed or its draft stub still needs completion.",
        };
  }
  if (!hasSupabaseEnvironment()) {
    return { ok: false, kind: "error", message: "Supabase is not configured." };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("approve_record_revision", {
    p_public_id: publicId,
    p_expected_revision: expectedRevision,
  });
  if (error) {
    const diagnostic = `${error.code} ${error.message}`.toLowerCase();
    if (/revision_conflict|integrity/u.test(diagnostic)) {
      return {
        ok: false,
        kind: "conflict",
        message: "This Blueprint record changed. Refresh the family before approving it.",
      };
    }
    return {
      ok: false,
      kind: "validation",
      message: "Complete and validate this Blueprint record before approval.",
    };
  }
  const record = normalizeStudioRecord((data as { record?: unknown }).record ?? data);
  return {
    ok: true,
    publicId: record.publicId,
    revision: record.revision,
    workflowState: "approved",
  };
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

export interface BlueprintApplyInput {
  boardPublicId: string;
  familyPublicId: string;
  expectedBoardRevision: number;
  expectedRecordHeads: Record<string, number>;
  operations: BlueprintOperation[];
  layout: {
    nodes: Array<{
      record_public_id: string;
      position: { x: number; y: number };
      group_key?: string | null;
      collapsed?: boolean;
    }>;
  };
  clientMutationId: string;
}

export type BlueprintApplyResult =
  | { ok: true; blueprint: FamilyBlueprint }
  | { ok: false; kind: "validation" | "error"; message: string }
  | {
      ok: false;
      kind: "conflict";
      message: string;
      staleEntities: BlueprintConflictEntity[];
      currentBoardRevision?: number;
    };

function validateBlueprintInput(input: BlueprintApplyInput): string | null {
  if (!validPublicId(input.boardPublicId) || !validPublicId(input.familyPublicId)) {
    return "The selected family Blueprint has an invalid ID.";
  }
  if (!Number.isSafeInteger(input.expectedBoardRevision) || input.expectedBoardRevision < 1) {
    return "The shared board revision is invalid.";
  }
  if (!isCanonicalUuid(input.clientMutationId)) return "The Blueprint request ID is invalid.";
  if (input.operations.length > 200 || JSON.stringify(input.operations).length > 1_000_000) {
    return "A Blueprint Apply may contain at most 200 bounded operations.";
  }
  if (
    Object.entries(input.expectedRecordHeads).some(
      ([publicId, revision]) =>
        !validPublicId(publicId) || !Number.isSafeInteger(revision) || revision < 0,
    )
  ) {
    return "One or more expected Blueprint record revisions are invalid.";
  }
  if (
    input.layout.nodes.some(
      (node) =>
        !validPublicId(node.record_public_id) ||
        !Number.isFinite(node.position.x) ||
        !Number.isFinite(node.position.y) ||
        Math.abs(node.position.x) > 100_000 ||
        Math.abs(node.position.y) > 100_000,
    )
  ) {
    return "The shared Blueprint layout contains an invalid node position.";
  }
  return null;
}

function applyFixtureOperations(
  blueprint: FamilyBlueprint,
  input: BlueprintApplyInput,
): FamilyBlueprint {
  const next = structuredClone(blueprint);
  const fixtureLibrary = fixtureFamilyBlueprint(
    "cobblemon_kinetics:evolution-family/bulbasaur",
  )?.nodes;
  for (const operation of input.operations) {
    if (operation.type === "remove_node") {
      next.nodes = next.nodes.filter((node) => node.id !== operation.record_public_id);
    } else if (operation.type === "add_node" || operation.type === "move_node") {
      const node = next.nodes.find((candidate) => candidate.id === operation.record_public_id);
      if (node) node.position = operation.position;
      else if (operation.type === "add_node") {
        const source = fixtureLibrary?.find(
          (candidate) => candidate.id === operation.record_public_id,
        );
        if (source) next.nodes.push({ ...structuredClone(source), position: operation.position });
      }
    } else if (operation.type === "create_stub") {
      const nodeFamily =
        operation.record_kind === "work_target"
          ? "worksite"
          : operation.record_kind === "condition"
            ? "interlock"
            : operation.record_kind;
      next.nodes.push({
        id: operation.record_public_id,
        recordKind: operation.record_kind,
        nodeFamily,
        displayName: operation.display_name,
        workflowState: "draft",
        recordRevision: 1,
        position: operation.position,
        width: 220,
        height: 116,
        groupKey: null,
        collapsed: false,
        nationalDex: null,
        types: [],
        data: {
          draft_stub: true,
          needs_completion: !operation.description?.trim(),
          description: operation.description?.trim() ?? "",
        },
      });
    } else if (operation.type === "remove_edge") {
      next.edges = next.edges.filter((edge) => edge.id !== operation.relationship_public_id);
    } else if (operation.type === "archive_relationship") {
      next.edges = next.edges.filter((edge) => edge.id !== operation.relationship_public_id);
    } else if (operation.type === "set_inheritance_decision") {
      const edge = next.edges.find(
        (candidate) => candidate.id === operation.relationship_public_id,
      );
      if (edge) {
        edge.inheritanceDecision = operation.decision;
        edge.inheritanceState = "current";
        edge.metadata = { ...edge.metadata, ...operation.metadata };
        edge.recordRevision += 1;
        edge.workflowState = "draft";
      }
    } else if (operation.type === "upsert_relationship") {
      const existing = next.edges.find(
        (edge) =>
          edge.source === operation.source_public_id &&
          edge.target === operation.target_public_id &&
          edge.relationshipKind === operation.relationship_kind,
      );
      if (existing) {
        existing.metadata = operation.metadata;
        existing.inheritanceDecision = operation.inheritance_decision ?? null;
        existing.inheritanceState = operation.inheritance_decision ? "current" : "not_applicable";
        existing.recordRevision += 1;
        existing.workflowState = "draft";
      } else {
        const handles: Record<string, [string, string]> = {
          has_capability: ["worker:capability", "capability:worker"],
          requires_capability: ["job:requirement", "capability:job"],
          assigned_to_job: ["worker:job", "job:worker"],
          operates_at: ["job:worksite", "worksite:job"],
          constrained_by: ["rule:condition", "interlock:rule"],
          produces_result: ["job:result", "result:job"],
          evolves_to: ["worker:evolution", "worker:evolution"],
        };
        const [sourceHandle, targetHandle] = handles[operation.relationship_kind]!;
        next.edges.push({
          id: `cobblemon_kinetics:relationship/fixture-${crypto.randomUUID()}`,
          relationshipKind: operation.relationship_kind,
          source: operation.source_public_id,
          target: operation.target_public_id,
          sourceHandle,
          targetHandle,
          label: operation.relationship_kind.replaceAll("_", " "),
          metadata: operation.metadata,
          inheritanceDecision: operation.inheritance_decision ?? null,
          inheritanceState: operation.inheritance_decision ? "current" : "not_applicable",
          workflowState: "draft",
          recordRevision: 1,
        });
      }
    } else if (operation.type === "add_annotation") {
      next.annotations.push({
        id: crypto.randomUUID(),
        annotationKind: operation.annotation_kind,
        body: operation.body,
        positionX: operation.position.x,
        positionY: operation.position.y,
        width: operation.width ?? 280,
        height: operation.height ?? 140,
        groupKey: operation.group_key ?? null,
      });
    } else if (operation.type === "remove_annotation") {
      next.annotations = next.annotations.filter(
        (annotation) => annotation.id !== operation.annotation_id,
      );
    } else if (operation.type === "update_annotation") {
      const annotation = next.annotations.find(
        (candidate) => candidate.id === operation.annotation_id,
      );
      if (annotation) {
        if (operation.body !== undefined) annotation.body = operation.body;
        if (operation.position) {
          annotation.positionX = operation.position.x;
          annotation.positionY = operation.position.y;
        }
      }
    } else if (operation.type === "accept_type_suggestion") {
      const capabilityId = "cobblemon_kinetics:capability/plant-care";
      if (!next.nodes.some((node) => node.id === capabilityId)) {
        const source = fixtureLibrary?.find((node) => node.id === capabilityId);
        if (source) {
          next.nodes.push({
            ...structuredClone(source),
            position: operation.position ?? { x: 400, y: 360 },
          });
        }
      }
      if (
        !next.edges.some(
          (edge) =>
            edge.source === operation.form_public_id &&
            edge.target === capabilityId &&
            edge.relationshipKind === "has_capability",
        )
      ) {
        next.edges.push({
          id: `cobblemon_kinetics:relationship/fixture-${crypto.randomUUID()}`,
          relationshipKind: "has_capability",
          source: operation.form_public_id,
          target: capabilityId,
          sourceHandle: "worker:capability",
          targetHandle: "capability:worker",
          label: `Type suggestion · Tier ${operation.tier ?? 1}`,
          metadata: { tier: operation.tier ?? 1 },
          inheritanceDecision: "add",
          inheritanceState: "current",
          workflowState: "draft",
          recordRevision: 1,
        });
      }
    }
  }
  for (const layoutNode of input.layout.nodes) {
    const node = next.nodes.find((candidate) => candidate.id === layoutNode.record_public_id);
    if (!node) continue;
    node.position = layoutNode.position;
    node.groupKey = layoutNode.group_key ?? node.groupKey;
    node.collapsed = layoutNode.collapsed ?? node.collapsed;
  }
  return saveFixtureFamilyBlueprint(next);
}

export async function applyBlueprintChanges(
  input: BlueprintApplyInput,
): Promise<BlueprintApplyResult> {
  await assertSameOrigin();
  await requireEditor("/studio");
  const validation = validateBlueprintInput(input);
  if (validation) return { ok: false, kind: "validation", message: validation };
  if (isFixtureModeEnabled()) {
    const current = fixtureFamilyBlueprint(input.familyPublicId);
    if (!current) return { ok: false, kind: "error", message: "Fixture Blueprint not found." };
    const fixtureLibrary = fixtureFamilyBlueprint("cobblemon_kinetics:evolution-family/bulbasaur");
    const staleEntities = Object.entries(input.expectedRecordHeads)
      .filter(([publicId, revision]) => {
        const node =
          current.nodes.find((candidate) => candidate.id === publicId) ??
          fixtureLibrary?.nodes.find((candidate) => candidate.id === publicId);
        const edge = current.edges.find((candidate) => candidate.id === publicId);
        return (node?.recordRevision ?? edge?.recordRevision ?? -1) !== revision;
      })
      .map(([publicId, expectedRevision]) => ({
        publicId,
        expectedRevision,
        currentRevision:
          current.nodes.find((candidate) => candidate.id === publicId)?.recordRevision ??
          fixtureLibrary?.nodes.find((candidate) => candidate.id === publicId)?.recordRevision ??
          current.edges.find((candidate) => candidate.id === publicId)?.recordRevision ??
          null,
      }));
    if (current.board.revision !== input.expectedBoardRevision || staleEntities.length) {
      return {
        ok: false,
        kind: "conflict",
        message: "The fixture board or one of its records changed.",
        staleEntities,
        currentBoardRevision: current.board.revision,
      };
    }
    return { ok: true, blueprint: applyFixtureOperations(current, input) };
  }
  if (!hasSupabaseEnvironment()) {
    return { ok: false, kind: "error", message: "Supabase is not configured." };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("apply_blueprint_change_set", {
    p_board_id: input.boardPublicId,
    p_expected_board_revision: input.expectedBoardRevision,
    p_expected_record_heads: input.expectedRecordHeads,
    p_operations: input.operations,
    p_layout: input.layout,
    p_client_mutation_id: input.clientMutationId,
  });
  if (error) {
    const diagnostic = `${error.code} ${error.message}`;
    if (diagnostic.includes("blueprint_conflict")) {
      let payload: Record<string, unknown> = {};
      try {
        const start = error.message.indexOf("{");
        if (start >= 0) payload = JSON.parse(error.message.slice(start)) as Record<string, unknown>;
      } catch {
        payload = {};
      }
      const staleEntities = Array.isArray(payload.stale_entities)
        ? payload.stale_entities.map((candidate) => {
            const row = candidate as Record<string, unknown>;
            return {
              publicId: String(row.public_id ?? input.boardPublicId),
              expectedRevision: Number(row.expected_revision ?? input.expectedBoardRevision),
              currentRevision:
                row.current_revision === null || row.current_revision === undefined
                  ? null
                  : Number(row.current_revision),
            };
          })
        : [];
      return {
        ok: false,
        kind: "conflict",
        message: "Another maintainer changed the board. Review the stale records before applying.",
        staleEntities,
        currentBoardRevision:
          payload.current_board_revision === undefined
            ? undefined
            : Number(payload.current_board_revision),
      };
    }
    return {
      ok: false,
      kind: "error",
      message: "The Blueprint change set was rejected atomically; no partial changes were saved.",
    };
  }
  try {
    return { ok: true, blueprint: normalizeBlueprint(data) };
  } catch {
    return { ok: false, kind: "error", message: "The saved Blueprint response was invalid." };
  }
}

export async function checkBlueprintHead(boardPublicId: string) {
  await requireEditor("/studio");
  if (!validPublicId(boardPublicId)) throw new Error("The Blueprint ID is invalid.");
  return loadBlueprintHead(boardPublicId);
}

export async function saveBlueprintView(input: {
  boardPublicId: string;
  viewport: { x: number; y: number; zoom: number };
  filters: StudioObject & { last_view?: string };
  hiddenNodes: string[];
}): Promise<void> {
  await assertSameOrigin();
  await requireEditor("/studio");
  if (
    !validPublicId(input.boardPublicId) ||
    !Number.isFinite(input.viewport.x) ||
    !Number.isFinite(input.viewport.y) ||
    input.viewport.zoom < 0.1 ||
    input.viewport.zoom > 4 ||
    input.hiddenNodes.some((id) => !validPublicId(id))
  ) {
    throw new Error("The personal Blueprint view is invalid.");
  }
  if (isFixtureModeEnabled()) return;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_blueprint_user_view", {
    p_board_id: input.boardPublicId,
    p_viewport: input.viewport,
    p_filters: input.filters,
    p_hidden_nodes: input.hiddenNodes,
  });
  if (error) throw new Error("The personal Blueprint view could not be saved.");
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
