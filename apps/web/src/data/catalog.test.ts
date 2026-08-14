import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./fixture";
import { filterCatalog } from "./catalog";

describe("filterCatalog", () => {
  it.each(["Squirtle", "#007", "cobblemon:squirtle"])("finds Squirtle by %s", (query) => {
    expect(filterCatalog(fixtureCatalog, query).pokemon).toHaveLength(1);
  });

  it("finds exact registry identifiers", () => {
    expect(filterCatalog(fixtureCatalog, "cobblemon_kinetics:hydro_coupler").machines).toHaveLength(
      1,
    );
  });
});
