import { fixtureSquirtleDraft } from "@/data/fixture";
import type { RevisionSummary, SquirtleDraft } from "@/data/types";
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

function readRevision(value: unknown): RevisionSummary | null {
  const item = objectValue(value);
  const revision = Number(item.revision);
  if (!Number.isInteger(revision)) return null;
  return {
    revision,
    actor: readString(item, "actor_display_name", readString(item, "actor_id", "Maintainer")),
    at: readString(item, "created_at", new Date(0).toISOString()),
    summary: readString(item, "change_summary", "Updated the development record."),
  };
}

export function normalizeSquirtleRpc(value: unknown): SquirtleDraft {
  const envelope = objectValue(value);
  const record = objectValue(envelope.record ?? envelope);
  const revisionsRaw = Array.isArray(envelope.revisions) ? envelope.revisions : [];
  const publicId = readString(record, "public_id");
  if (publicId !== "cobblemon_kinetics:pokemon/squirtle") {
    throw new Error("The studio RPC returned the wrong public record.");
  }
  const workflowState = readString(record, "workflow_state", "draft");
  if (!(["draft", "in_review", "approved"] as string[]).includes(workflowState)) {
    throw new Error("The studio RPC returned an invalid workflow state.");
  }
  return {
    publicId,
    revision: Number(record.revision ?? 0),
    workflowState: workflowState as SquirtleDraft["workflowState"],
    machineId: readString(record, "machine_id"),
    jobId: readString(record, "job_id"),
    efficiency: Number(record.efficiency ?? 1),
    publicRationale: readString(record, "public_rationale"),
    privateNote: readString(record, "private_note"),
    updatedAt: readString(record, "updated_at", new Date(0).toISOString()),
    updatedBy: readString(
      record,
      "updated_by_display_name",
      readString(record, "updated_by", "Maintainer"),
    ),
    revisions: revisionsRaw
      .map(readRevision)
      .filter((item): item is RevisionSummary => item !== null),
  };
}

export async function loadSquirtleDraft(): Promise<SquirtleDraft> {
  if (isFixtureModeEnabled()) return fixtureSquirtleDraft;
  if (!hasSupabaseEnvironment()) {
    throw new Error("The development studio requires a configured Supabase project.");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_editor_record", {
    p_public_id: "cobblemon_kinetics:pokemon/squirtle",
  });
  if (error) throw new Error(`Could not load Squirtle: ${error.message}`);
  return normalizeSquirtleRpc(data);
}
