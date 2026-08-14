import type { SquirtleDraft } from "@/data/types";
import type { SquirtleEditorValues } from "@/features/studio/validation";

interface FixtureDraftInput extends SquirtleEditorValues {
  expectedRevision: number;
}

export function createFixtureRecord(
  input: FixtureDraftInput,
  operation: "save" | "approve",
): SquirtleDraft {
  const now = new Date().toISOString();
  const revision = operation === "save" ? input.expectedRevision + 1 : input.expectedRevision;
  return {
    publicId: "cobblemon_kinetics:pokemon/squirtle",
    revision,
    workflowState: operation === "approve" ? "approved" : "draft",
    machineId: input.machineId,
    jobId: input.jobId,
    efficiency: input.efficiency,
    publicRationale: input.publicRationale.trim(),
    privateNote: input.privateNote,
    updatedAt: now,
    updatedBy: "Fixture maintainer",
    revisions: [
      {
        revision,
        actor: "Fixture maintainer",
        at: now,
        summary:
          operation === "approve" ? "Approved this exact revision." : "Autosaved editor fields.",
      },
    ],
  };
}
