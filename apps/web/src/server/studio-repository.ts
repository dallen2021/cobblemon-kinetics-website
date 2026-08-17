import {
  fixtureFamilyBlueprint,
  fixturePokemonWorkspace,
  fixtureRecordDetail,
  fixtureRecordList,
} from "@/data/gen1-fixture";
import type {
  BlueprintAnnotation,
  BlueprintEdgeData,
  BlueprintLibraryItem,
  BlueprintNodeData,
  BlueprintPreference,
  ControlledFactValue,
  EvolutionFamilyMember,
  FamilyBlueprint,
  PokemonCapabilitySummary,
  PokemonWorkspaceData,
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
  StudioRelationshipEndpoint,
  StudioRelationshipSummary,
  StudioRevision,
  StudioWorkItemLink,
  TypeCapabilitySuggestion,
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
    "evolution_family",
    "capability",
    "work_target",
    "condition",
    "result",
    "relationship",
    "blueprint_board",
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

function normalizeStudioRecordDetailEnvelope(value: unknown): StudioRecordDetail {
  const envelope = objectValue(value);
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
  return normalizeStudioRecordDetailEnvelope(data);
}

function normalizeControlledValues(value: unknown): Record<string, ControlledFactValue[]> {
  const source = objectValue(value);
  const result: Record<string, ControlledFactValue[]> = {};
  for (const [vocabulary, values] of Object.entries(source)) {
    if (!Array.isArray(values)) continue;
    result[vocabulary] = values
      .map((candidate): ControlledFactValue | null => {
        const row = objectValue(candidate);
        const slug = readString(row, "slug");
        const label = readString(row, "label");
        return slug && label ? { slug, label, reviewRequired: row.review_required === true } : null;
      })
      .filter((item): item is ControlledFactValue => item !== null);
  }
  return result;
}

function normalizePokemonWorkspace(value: unknown): PokemonWorkspaceData {
  const envelope = objectValue(value);
  const detail = normalizeStudioRecordDetailEnvelope(envelope);
  const family = objectValue(envelope.family);
  const stage = objectValue(family.stage);
  const members = (Array.isArray(family.members) ? family.members : []).map(
    (candidate): EvolutionFamilyMember => {
      const row = objectValue(candidate);
      const stageLabel = readString(row, "stage_label");
      return {
        publicId: readString(row, "public_id"),
        formPublicId: readString(row, "form_public_id"),
        displayName: readString(row, "display_name"),
        nationalDex: Number(row.national_dex),
        stageIndex: Number(row.stage_index),
        stageLabel:
          stageLabel === "Stage 1" || stageLabel === "Stage 2" || stageLabel === "Stage 3"
            ? stageLabel
            : "Standalone",
      };
    },
  );
  const capabilities = (Array.isArray(envelope.capabilities) ? envelope.capabilities : []).map(
    (candidate): PokemonCapabilitySummary => {
      const row = objectValue(candidate);
      const tier = Number(row.tier) as PokemonCapabilitySummary["tier"];
      const decision = nullableString(row.inheritance_decision);
      const inheritanceState = readString(row, "inheritance_state");
      return {
        relationshipPublicId: readString(row, "relationship_public_id"),
        capabilityPublicId: readString(row, "capability_public_id"),
        name: readString(row, "name"),
        tier,
        tierLabel:
          tier === 1 ? "Basic" : tier === 2 ? "Capable" : tier === 3 ? "Advanced" : "Exceptional",
        inheritanceDecision:
          decision === "keep" ||
          decision === "raise" ||
          decision === "lower" ||
          decision === "replace" ||
          decision === "remove" ||
          decision === "add"
            ? decision
            : null,
        inheritanceState:
          inheritanceState === "current" || inheritanceState === "outdated"
            ? inheritanceState
            : "not_applicable",
        explicitValues: jsonObject(row.explicit_values),
      };
    },
  );
  const typeSuggestions = (
    Array.isArray(envelope.type_suggestions) ? envelope.type_suggestions : []
  ).map((candidate): TypeCapabilitySuggestion => {
    const row = objectValue(candidate);
    return {
      id: readString(row, "id"),
      capabilityPublicId: readString(row, "capability_public_id"),
      name: readString(row, "name"),
      suggestedTier: Number(row.suggested_tier) as TypeCapabilitySuggestion["suggestedTier"],
      rationale: readString(row, "rationale"),
      accepted: row.accepted === true,
    };
  });
  const preferred = readString(envelope, "preferred_view", "overview");
  return {
    ...detail,
    family: {
      publicId: readString(family, "public_id"),
      displayName: readString(family, "display_name"),
      boardPublicId: readString(family, "board_public_id"),
      stage: {
        index: Number(stage.index ?? 1),
        label:
          readString(stage, "label") === "Stage 1" ||
          readString(stage, "label") === "Stage 2" ||
          readString(stage, "label") === "Stage 3"
            ? (readString(stage, "label") as "Stage 1" | "Stage 2" | "Stage 3")
            : "Standalone",
      },
      members,
    },
    controlledValues: normalizeControlledValues(envelope.controlled_values),
    capabilities,
    typeSuggestions,
    preferredView:
      preferred === "canvas" ||
      preferred === "outline" ||
      preferred === "facts" ||
      preferred === "discussion"
        ? preferred
        : "overview",
  };
}

export function normalizeBlueprint(value: unknown): FamilyBlueprint {
  const envelope = objectValue(value);
  const board = objectValue(envelope.board);
  const nodes = (Array.isArray(envelope.nodes) ? envelope.nodes : []).map(
    (candidate): BlueprintNodeData => {
      const row = objectValue(candidate);
      const position = objectValue(row.position);
      const nodeFamily = readString(row, "node_family") as BlueprintNodeData["nodeFamily"];
      return {
        id: readString(row, "id"),
        recordKind: recordKind(row.record_kind),
        nodeFamily,
        displayName: readString(row, "display_name"),
        workflowState: workflow(row.workflow_state),
        recordRevision: Number(row.record_revision),
        position: { x: Number(position.x ?? 0), y: Number(position.y ?? 0) },
        width: row.width === null || row.width === undefined ? null : Number(row.width),
        height: row.height === null || row.height === undefined ? null : Number(row.height),
        groupKey: nullableString(row.group_key),
        collapsed: row.collapsed === true,
        nationalDex: numberOrNull(row.national_dex),
        types: jsonStringArray(row.types),
        data: jsonObject(row.data),
      };
    },
  );
  const edges = (Array.isArray(envelope.edges) ? envelope.edges : []).map(
    (candidate): BlueprintEdgeData => {
      const row = objectValue(candidate);
      const decision = nullableString(row.inheritance_decision);
      const inheritanceState = readString(row, "inheritance_state");
      return {
        id: readString(row, "id"),
        relationshipKind: readString(
          row,
          "relationship_kind",
        ) as BlueprintEdgeData["relationshipKind"],
        source: readString(row, "source"),
        target: readString(row, "target"),
        sourceHandle: readString(row, "source_handle"),
        targetHandle: readString(row, "target_handle"),
        label: readString(row, "label"),
        metadata: jsonObject(row.metadata),
        inheritanceDecision:
          decision === "keep" ||
          decision === "raise" ||
          decision === "lower" ||
          decision === "replace" ||
          decision === "remove" ||
          decision === "add"
            ? decision
            : null,
        inheritanceState:
          inheritanceState === "current" || inheritanceState === "outdated"
            ? inheritanceState
            : "not_applicable",
        workflowState: workflow(row.workflow_state),
        recordRevision: Number(row.record_revision),
      };
    },
  );
  const annotations = (Array.isArray(envelope.annotations) ? envelope.annotations : []).map(
    (candidate): BlueprintAnnotation => {
      const row = objectValue(candidate);
      return {
        id: readString(row, "id"),
        annotationKind: readString(row, "annotation_kind") === "group" ? "group" : "comment",
        body: readString(row, "body"),
        positionX: Number(row.position_x),
        positionY: Number(row.position_y),
        width: Number(row.width ?? 280),
        height: Number(row.height ?? 140),
        groupKey: nullableString(row.group_key),
      };
    },
  );
  const rawPreference = objectValue(envelope.preference);
  const rawViewport = objectValue(rawPreference.viewport);
  const preference: BlueprintPreference = {
    viewport: {
      x: Number(rawViewport.x ?? 0),
      y: Number(rawViewport.y ?? 0),
      zoom: Number(rawViewport.zoom ?? 1),
    },
    filters: jsonObject(rawPreference.filters),
    hiddenNodes: jsonStringArray(rawPreference.hidden_nodes),
    lastView:
      readString(rawPreference, "last_view") === "canvas" ||
      readString(rawPreference, "last_view") === "outline" ||
      readString(rawPreference, "last_view") === "facts" ||
      readString(rawPreference, "last_view") === "discussion"
        ? (readString(rawPreference, "last_view") as BlueprintPreference["lastView"])
        : "overview",
  };
  return {
    board: {
      publicId: readString(board, "public_id"),
      familyPublicId: readString(board, "family_public_id"),
      revision: Number(board.revision),
      checksum: readString(board, "checksum"),
    },
    nodes,
    edges,
    annotations,
    preference,
  };
}

function normalizeRelationshipEndpoint(value: unknown): StudioRelationshipEndpoint {
  const row = objectValue(value);
  return {
    publicId: readString(row, "public_id"),
    recordKind: recordKind(row.record_kind),
    displayName: readString(row, "display_name"),
    speciesPublicId: nullableString(row.species_public_id),
  };
}

function normalizeRelationshipSummary(value: unknown): StudioRelationshipSummary {
  const row = objectValue(value);
  const decision = nullableString(row.inheritance_decision);
  const inheritanceState = readString(row, "inheritance_state");
  return {
    publicId: readString(row, "public_id"),
    relationshipKind: readString(
      row,
      "relationship_kind",
    ) as StudioRelationshipSummary["relationshipKind"],
    workflowState: workflow(row.workflow_state),
    revision: Number(row.revision),
    source: normalizeRelationshipEndpoint(row.source),
    target: normalizeRelationshipEndpoint(row.target),
    metadata: jsonObject(row.metadata),
    inheritanceDecision:
      decision === "keep" ||
      decision === "raise" ||
      decision === "lower" ||
      decision === "replace" ||
      decision === "remove" ||
      decision === "add"
        ? decision
        : null,
    inheritanceState:
      inheritanceState === "current" || inheritanceState === "outdated"
        ? inheritanceState
        : "not_applicable",
  };
}

export async function listStudioRelationships(
  kinds: StudioRelationshipSummary["relationshipKind"][] = [],
  query = "",
): Promise<StudioRelationshipSummary[]> {
  if (isFixtureModeEnabled()) {
    const blueprint = fixtureFamilyBlueprint("cobblemon_kinetics:evolution-family/bulbasaur");
    if (!blueprint) return [];
    const nodes = new Map(blueprint.nodes.map((node) => [node.id, node]));
    return blueprint.edges
      .filter((edge) => !kinds.length || kinds.includes(edge.relationshipKind))
      .filter((edge) => {
        const needle = query.trim().toLowerCase();
        return (
          !needle ||
          edge.id.toLowerCase().includes(needle) ||
          nodes.get(edge.source)?.displayName.toLowerCase().includes(needle) ||
          nodes.get(edge.target)?.displayName.toLowerCase().includes(needle)
        );
      })
      .map((edge) => {
        const source = nodes.get(edge.source)!;
        const target = nodes.get(edge.target)!;
        return {
          publicId: edge.id,
          relationshipKind: edge.relationshipKind,
          workflowState: edge.workflowState,
          revision: edge.recordRevision,
          source: {
            publicId: source.id,
            recordKind: source.recordKind,
            displayName: source.displayName,
            speciesPublicId:
              source.recordKind === "pokemon_form" ? source.id.replace(/\/default$/u, "") : null,
          },
          target: {
            publicId: target.id,
            recordKind: target.recordKind,
            displayName: target.displayName,
            speciesPublicId:
              target.recordKind === "pokemon_form" ? target.id.replace(/\/default$/u, "") : null,
          },
          metadata: edge.metadata,
          inheritanceDecision: edge.inheritanceDecision,
          inheritanceState: edge.inheritanceState,
        };
      });
  }
  if (!hasSupabaseEnvironment()) {
    throw new Error("The development studio requires a configured Supabase project.");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_studio_relationships", {
    p_kinds: kinds.length ? kinds : undefined,
    p_query: query || undefined,
    p_limit: 2000,
  });
  if (error) throw new Error(`Could not load Studio relationships: ${error.message}`);
  const envelope = objectValue(data);
  return (Array.isArray(envelope.items) ? envelope.items : []).map(normalizeRelationshipSummary);
}

export async function loadPokemonWorkspace(publicIdOrSlug: string): Promise<PokemonWorkspaceData> {
  if (isFixtureModeEnabled()) {
    const workspace = fixturePokemonWorkspace(publicIdOrSlug);
    if (!workspace) throw new Error("The requested fixture Pokémon does not exist.");
    return workspace;
  }
  let publicId = publicIdOrSlug;
  if (!publicId.includes(":")) {
    const record = (
      await listStudioRecords({ kind: "pokemon_species", query: publicId, limit: 200 })
    ).items.find((candidate) => candidate.slug === publicId);
    if (!record) throw new Error("The requested Pokémon workspace does not exist.");
    publicId = record.publicId;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_pokemon_workspace", { p_public_id: publicId });
  if (error) throw new Error(`Could not load Pokémon workspace: ${error.message}`);
  return normalizePokemonWorkspace(data);
}

export async function loadFamilyBlueprint(familyPublicId: string): Promise<FamilyBlueprint> {
  if (isFixtureModeEnabled()) {
    const blueprint = fixtureFamilyBlueprint(familyPublicId);
    if (!blueprint) throw new Error("The requested fixture Blueprint does not exist.");
    return blueprint;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_family_blueprint", {
    p_family_public_id: familyPublicId,
  });
  if (error) throw new Error(`Could not load family Blueprint: ${error.message}`);
  return normalizeBlueprint(data);
}

export async function loadBlueprintHead(boardPublicId: string): Promise<FamilyBlueprint["board"]> {
  if (isFixtureModeEnabled()) {
    const root = boardPublicId.split("/").at(-1);
    const blueprint = root
      ? fixtureFamilyBlueprint(`cobblemon_kinetics:evolution-family/${root}`)
      : null;
    if (!blueprint) throw new Error("The requested fixture Blueprint does not exist.");
    return blueprint.board;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_blueprint_head", {
    p_board_public_id: boardPublicId,
  });
  if (error) throw new Error(`Could not check Blueprint head: ${error.message}`);
  const row = objectValue(data);
  return {
    publicId: readString(row, "public_id"),
    familyPublicId: "",
    revision: Number(row.revision),
    checksum: readString(row, "checksum"),
  };
}

export async function listBlueprintLibrary(query = ""): Promise<BlueprintLibraryItem[]> {
  if (isFixtureModeEnabled()) {
    const bulbasaur = fixtureFamilyBlueprint("cobblemon_kinetics:evolution-family/bulbasaur");
    const seen = new Set<string>();
    return (bulbasaur?.nodes ?? [])
      .filter((node) => {
        if (seen.has(node.id)) return false;
        seen.add(node.id);
        return !query || node.displayName.toLowerCase().includes(query.toLowerCase());
      })
      .map((node) => ({
        publicId: node.id,
        displayName: node.displayName,
        recordKind: node.recordKind,
        nodeFamily: node.nodeFamily,
        workflowState: node.workflowState,
        revision: node.recordRevision,
      }));
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_blueprint_library", {
    p_query: query || undefined,
    p_kinds: undefined,
    p_filters: {},
    p_limit: 100,
    p_cursor: undefined,
  });
  if (error) throw new Error(`Could not load Blueprint library: ${error.message}`);
  const envelope = objectValue(data);
  return (Array.isArray(envelope.items) ? envelope.items : []).map((candidate) => {
    const row = objectValue(candidate);
    return {
      publicId: readString(row, "public_id"),
      displayName: readString(row, "display_name"),
      recordKind: recordKind(row.record_kind),
      nodeFamily: readString(row, "node_family") as BlueprintLibraryItem["nodeFamily"],
      workflowState: workflow(row.workflow_state),
      revision: Number(row.revision),
    };
  });
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
