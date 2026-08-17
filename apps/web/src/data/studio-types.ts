export type StudioRecordKind =
  | "pokemon_species"
  | "pokemon_form"
  | "registry_entry"
  | "job"
  | "machine"
  | "work_profile"
  | "work_item"
  | "type_workshop"
  | "pokemon_idea"
  | "machine_research"
  | "evolution_family"
  | "capability"
  | "work_target"
  | "condition"
  | "result"
  | "relationship"
  | "blueprint_board";

export type StudioWorkflowState = "draft" | "in_review" | "approved" | "archived";

export type StudioJson =
  null | boolean | number | string | StudioJson[] | { [key: string]: StudioJson };
export type StudioObject = { [key: string]: StudioJson };

export interface StudioRevision {
  revision: number;
  actor: string;
  at: string;
  summary: string;
  snapshot?: StudioObject;
}

export interface StudioComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface StudioAssignee {
  authUserId: string;
  githubLogin: string;
  displayName: string;
  role?: "viewer" | "editor" | "maintainer";
}

export interface StudioWorkItemLink {
  publicId: string;
  title: string;
  status: string;
  priority: string;
  relation: string;
  handoffNote: string;
  assignees: StudioAssignee[];
}

export interface StudioProvenance {
  fieldPath: string;
  sourceSheet: string;
  sourceRow: number;
  sourceKey: string;
  importedValue: StudioJson;
  importedHash: string;
  overriddenAt: string | null;
}

export interface StudioRecord {
  publicId: string;
  slug: string;
  displayName: string;
  recordKind: StudioRecordKind;
  workflowState: StudioWorkflowState;
  revision: number;
  checksum: string;
  updatedAt: string;
  updatedBy: string;
  nationalDex: number | null;
  cobblemonSpeciesId: string | null;
  types: string[];
  taskStatus: string | null;
  taskCount: number;
  workItemAssignees: StudioAssignee[];
  workReady: string;
  facts: StudioObject;
  design: StudioObject;
  work: StudioObject;
  balance: StudioObject;
  testing: StudioObject;
  planning: StudioObject;
  privateNote: string;
}

export interface StudioRecordDetail extends StudioRecord {
  revisions: StudioRevision[];
  comments: StudioComment[];
  workItems: StudioWorkItemLink[];
  provenance: StudioProvenance[];
}

export interface StudioRecordList {
  items: StudioRecord[];
  nextCursor: string | null;
}

export interface StudioHead {
  publicId: string;
  revision: number;
  checksum: string;
  workflowState: StudioWorkflowState;
  updatedAt: string;
}

export interface StudioImportRun {
  id: string;
  sourceSha256: string;
  sourceFilename: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  summary: StudioObject;
  reviewCount: number;
  quarantinedCount: number;
}

export interface StudioAuditEvent {
  id: number;
  recordId: string | null;
  action: string;
  beforeRevision: number | null;
  afterRevision: number | null;
  createdAt: string;
}

export interface StudioRecordFilters {
  kind?: StudioRecordKind;
  query?: string;
  type?: string;
  workflow?: StudioWorkflowState;
  taskStatus?: string;
  limit?: number;
  cursor?: string;
}

export type PokemonWorkspaceTab = "overview" | "blueprint" | "facts" | "discussion";
export type BlueprintView = "canvas" | "outline";
export type BlueprintNodeFamily =
  "worker" | "capability" | "job" | "worksite" | "interlock" | "result";
export type BlueprintRelationshipKind =
  | "has_capability"
  | "requires_capability"
  | "assigned_to_job"
  | "operates_at"
  | "constrained_by"
  | "produces_result"
  | "evolves_to";
export type InheritanceDecision = "keep" | "raise" | "lower" | "replace" | "remove" | "add";
export type CapabilityTier = 1 | 2 | 3 | 4;

export interface ControlledFactValue {
  slug: string;
  label: string;
  reviewRequired: boolean;
}

export interface EvolutionFamilyMember {
  publicId: string;
  formPublicId: string;
  displayName: string;
  nationalDex: number;
  stageIndex: number;
  stageLabel: "Stage 1" | "Stage 2" | "Stage 3" | "Standalone";
}

export interface EvolutionFamilySummary {
  publicId: string;
  displayName: string;
  boardPublicId: string;
  stage: { index: number; label: EvolutionFamilyMember["stageLabel"] };
  members: EvolutionFamilyMember[];
}

export interface PokemonCapabilitySummary {
  relationshipPublicId: string;
  capabilityPublicId: string;
  name: string;
  tier: CapabilityTier;
  tierLabel: "Basic" | "Capable" | "Advanced" | "Exceptional";
  inheritanceDecision: InheritanceDecision | null;
  inheritanceState: "not_applicable" | "current" | "outdated";
  explicitValues: StudioObject;
}

export interface TypeCapabilitySuggestion {
  id: string;
  capabilityPublicId: string;
  name: string;
  suggestedTier: CapabilityTier;
  rationale: string;
  accepted: boolean;
}

export interface PokemonWorkspaceData extends StudioRecordDetail {
  family: EvolutionFamilySummary;
  controlledValues: Record<string, ControlledFactValue[]>;
  capabilities: PokemonCapabilitySummary[];
  typeSuggestions: TypeCapabilitySuggestion[];
  preferredView: "overview" | "canvas" | "outline" | "facts" | "discussion";
}

export interface BlueprintNodeData {
  id: string;
  recordKind: StudioRecordKind;
  nodeFamily: BlueprintNodeFamily;
  displayName: string;
  workflowState: StudioWorkflowState;
  recordRevision: number;
  position: { x: number; y: number };
  width: number | null;
  height: number | null;
  groupKey: string | null;
  collapsed: boolean;
  nationalDex: number | null;
  types: string[];
  data: StudioObject;
}

export interface BlueprintEdgeData {
  id: string;
  relationshipKind: BlueprintRelationshipKind;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  label: string;
  metadata: StudioObject;
  inheritanceDecision: InheritanceDecision | null;
  inheritanceState: "not_applicable" | "current" | "outdated";
  workflowState: StudioWorkflowState;
  recordRevision: number;
}

export interface StudioRelationshipEndpoint {
  publicId: string;
  recordKind: StudioRecordKind;
  displayName: string;
  speciesPublicId: string | null;
}

export interface StudioRelationshipSummary {
  publicId: string;
  relationshipKind: BlueprintRelationshipKind;
  workflowState: StudioWorkflowState;
  revision: number;
  source: StudioRelationshipEndpoint;
  target: StudioRelationshipEndpoint;
  metadata: StudioObject;
  inheritanceDecision: InheritanceDecision | null;
  inheritanceState: "not_applicable" | "current" | "outdated";
}

export interface BlueprintAnnotation {
  id: string;
  annotationKind: "group" | "comment";
  body: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  groupKey: string | null;
}

export interface BlueprintPreference {
  viewport: { x: number; y: number; zoom: number };
  filters: StudioObject;
  hiddenNodes: string[];
  lastView: "overview" | "canvas" | "outline" | "facts" | "discussion";
}

export interface FamilyBlueprint {
  board: {
    publicId: string;
    familyPublicId: string;
    revision: number;
    checksum: string;
  };
  nodes: BlueprintNodeData[];
  edges: BlueprintEdgeData[];
  annotations: BlueprintAnnotation[];
  preference: BlueprintPreference;
}

export interface BlueprintLibraryItem {
  publicId: string;
  displayName: string;
  recordKind: StudioRecordKind;
  nodeFamily: BlueprintNodeFamily;
  workflowState: StudioWorkflowState;
  revision: number;
}

export type BlueprintOperation =
  | {
      type: "add_node" | "move_node";
      record_public_id: string;
      position: { x: number; y: number };
      group_key?: string | null;
    }
  | { type: "remove_node"; record_public_id: string }
  | {
      type: "upsert_relationship";
      source_public_id: string;
      target_public_id: string;
      relationship_kind: BlueprintRelationshipKind;
      metadata: StudioObject;
      inheritance_decision?: InheritanceDecision;
      parent_relationship_public_id?: string;
      source_handle?: string;
      target_handle?: string;
    }
  | {
      type: "set_inheritance_decision";
      relationship_public_id: string;
      decision: InheritanceDecision;
      metadata: StudioObject;
    }
  | {
      type: "create_stub";
      record_public_id: string;
      record_kind: "capability" | "job" | "work_target" | "condition" | "result";
      display_name: string;
      description?: string;
      position: { x: number; y: number };
    }
  | { type: "remove_edge"; relationship_public_id: string }
  | { type: "archive_relationship"; relationship_public_id: string; confirmed: true }
  | {
      type: "add_annotation";
      annotation_kind: "group" | "comment";
      body: string;
      position: { x: number; y: number };
      width?: number;
      height?: number;
      group_key?: string;
    }
  | {
      type: "update_annotation";
      annotation_id: string;
      body?: string;
      position?: { x: number; y: number };
    }
  | { type: "remove_annotation"; annotation_id: string }
  | {
      type: "accept_type_suggestion";
      suggestion_id: string;
      form_public_id: string;
      tier?: 1 | 2 | 3 | 4;
      position?: { x: number; y: number };
    }
  | { type: "auto_layout" };

export interface BlueprintValidationFinding {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  recordPublicId?: string;
  relationshipPublicId?: string;
}

export interface BlueprintConflictEntity {
  publicId: string;
  expectedRevision: number;
  currentRevision: number | null;
}
