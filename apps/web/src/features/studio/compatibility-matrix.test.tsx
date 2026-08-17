import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StudioRecord, StudioRelationshipSummary } from "@/data/studio-types";
import { CompatibilityMatrix } from "./compatibility-matrix";

const bulbasaur: StudioRecord = {
  publicId: "cobblemon_kinetics:pokemon/bulbasaur",
  slug: "bulbasaur",
  displayName: "Bulbasaur",
  recordKind: "pokemon_species",
  workflowState: "draft",
  revision: 1,
  checksum: "fixture",
  updatedAt: "2026-08-17T00:00:00.000Z",
  updatedBy: "Maintainer",
  nationalDex: 1,
  cobblemonSpeciesId: "cobblemon:bulbasaur",
  types: ["grass", "poison"],
  taskStatus: "backlog",
  taskCount: 1,
  workItemAssignees: [],
  workReady: "candidate",
  facts: {},
  design: {},
  work: {},
  balance: {},
  testing: {},
  planning: {},
  privateNote: "",
};

function endpoint(
  publicId: string,
  recordKind: StudioRelationshipSummary["source"]["recordKind"],
  displayName: string,
  speciesPublicId: string | null = null,
) {
  return { publicId, recordKind, displayName, speciesPublicId };
}

const relationships: StudioRelationshipSummary[] = [
  {
    publicId: "cobblemon_kinetics:relationship/bulbasaur-plant-tender",
    relationshipKind: "assigned_to_job",
    workflowState: "draft",
    revision: 1,
    source: endpoint(
      "cobblemon_kinetics:pokemon/bulbasaur/default",
      "pokemon_form",
      "Bulbasaur",
      bulbasaur.publicId,
    ),
    target: endpoint("cobblemon_kinetics:job/plant-tender", "job", "Plant Tender"),
    metadata: {},
    inheritanceDecision: "add",
    inheritanceState: "current",
  },
  {
    publicId: "cobblemon_kinetics:relationship/plant-tender-farmland",
    relationshipKind: "operates_at",
    workflowState: "approved",
    revision: 1,
    source: endpoint("cobblemon_kinetics:job/plant-tender", "job", "Plant Tender"),
    target: endpoint(
      "cobblemon_kinetics:work-target/ordinary-farmland",
      "work_target",
      "Ordinary Farmland",
    ),
    metadata: {},
    inheritanceDecision: null,
    inheritanceState: "not_applicable",
  },
];

describe("CompatibilityMatrix", () => {
  it("derives jobs and worksites from canonical Blueprint relationships", () => {
    render(<CompatibilityMatrix records={[bulbasaur]} relationships={relationships} />);

    expect(screen.getByRole("link", { name: /#001 Bulbasaur/u })).toBeVisible();
    expect(screen.getByText("Plant Tender")).toBeVisible();
    expect(screen.getByText("Ordinary Farmland")).toBeVisible();
    expect(screen.getByText("approved")).toBeVisible();

    fireEvent.click(screen.getByRole("checkbox", { name: "Show configured only" }));
    expect(screen.getByRole("link", { name: /#001 Bulbasaur/u })).toBeVisible();
  });
});
