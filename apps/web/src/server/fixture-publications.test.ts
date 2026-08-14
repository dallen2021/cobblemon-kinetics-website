import { afterEach, describe, expect, it } from "vitest";
import {
  clearFixturePublicationBatches,
  createFixturePublicationBatch,
  getFixturePublicationBundle,
} from "./fixture-publications";

afterEach(() => clearFixturePublicationBatches());

describe("fixture publication repository", () => {
  it("freezes edited public fields and excludes private collaboration data", async () => {
    const { publicationId, bundle } = await createFixturePublicationBatch({
      expectedRevision: 13,
      machineId: "cobblemon_kinetics:hydro_coupler",
      jobId: "cobblemon_kinetics:hydro_operator",
      efficiency: 1.25,
      publicRationale: "A reviewed 1.25× fixture rationale.",
      privateNote: "This must never enter the bundle.",
    });
    const frozen = getFixturePublicationBundle(publicationId);
    expect(frozen).toEqual(bundle);
    expect(frozen?.records.pokemon[0]?.work_assignments[0]).toMatchObject({
      efficiency_multiplier: 1.25,
      public_rationale: "A reviewed 1.25× fixture rationale.",
    });
    expect(frozen?.records.work_profiles[0]?.contribution.efficiency_multiplier).toBe(1.25);
    const serialized = JSON.stringify(frozen);
    expect(serialized).not.toContain("This must never enter the bundle.");
    expect(serialized).not.toContain("private_note");
    expect(serialized).not.toContain("actor_id");
  });
});
