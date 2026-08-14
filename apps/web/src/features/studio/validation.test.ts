import { describe, expect, it } from "vitest";
import { validateSquirtleEditor } from "./validation";

const valid = {
  machineId: "cobblemon_kinetics:hydro_coupler",
  jobId: "cobblemon_kinetics:hydro_operator",
  efficiency: 1,
  publicRationale: "A neutral baseline keeps the first prototype reviewable.",
  privateNote: "Internal test note.",
};

describe("validateSquirtleEditor", () => {
  it("accepts the Hydro vertical slice", () => {
    expect(validateSquirtleEditor(valid)).toEqual([]);
  });

  it("rejects unsafe balance and underspecified rationale", () => {
    const issues = validateSquirtleEditor({
      ...valid,
      efficiency: 4,
      publicRationale: "Too short",
    });
    expect(issues.map((issue) => issue.field)).toEqual(["efficiency", "publicRationale"]);
  });
});
