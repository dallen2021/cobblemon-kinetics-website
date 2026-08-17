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
  | "machine_research";

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
