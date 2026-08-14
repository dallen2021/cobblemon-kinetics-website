import { describe, expect, it } from "vitest";
import { createFixtureRecord } from "./studio-fixture";

const input = {
  expectedRevision: 12,
  machineId: "cobblemon_kinetics:hydro_coupler",
  jobId: "cobblemon_kinetics:hydro_operator",
  efficiency: 1,
  publicRationale: "A reviewed neutral baseline.",
  privateNote: "Internal only.",
};

describe("studio fixture revisions", () => {
  it("increments a saved edit", () => {
    expect(createFixtureRecord(input, "save").revision).toBe(13);
  });

  it("approves the exact current revision without creating another", () => {
    const approved = createFixtureRecord(input, "approve");
    expect(approved.revision).toBe(12);
    expect(approved.workflowState).toBe("approved");
    expect(approved.revisions[0]?.revision).toBe(12);
  });
});
