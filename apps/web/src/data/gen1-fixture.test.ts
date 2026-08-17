import { afterEach, describe, expect, it } from "vitest";
import {
  allFixtureStudioRecords,
  fixtureRecordDetail,
  fixtureGen1Records,
  fixtureRecordList,
  fixtureFamilyBlueprint,
  fixturePokemonWorkspace,
  fixturePlanningRecords,
  fixtureTypes,
  resetFixtureStudioState,
  saveFixtureStudioRecord,
  setFixtureWorkItemAssignments,
} from "./gen1-fixture";

afterEach(() => resetFixtureStudioState());

describe("Gen 1 Studio fixture", () => {
  it("provides the complete neutral Gen 1 planning set", () => {
    expect(fixtureGen1Records).toHaveLength(151);
    expect(new Set(fixtureGen1Records.map((record) => record.nationalDex)).size).toBe(151);
    expect(fixtureGen1Records.flatMap((record) => record.types)).toHaveLength(218);
    expect(fixtureGen1Records.find((record) => record.nationalDex === 35)?.types).toEqual([
      "fairy",
    ]);
    expect(fixtureGen1Records.find((record) => record.nationalDex === 81)?.types).toEqual([
      "electric",
      "steel",
    ]);
    expect(fixtureTypes).toHaveLength(18);
    expect(
      fixturePlanningRecords.filter((record) => record.recordKind === "type_workshop"),
    ).toHaveLength(18);
    expect(
      fixturePlanningRecords.filter((record) => record.recordKind === "work_item"),
    ).toHaveLength(151);
    expect(allFixtureStudioRecords).toHaveLength(322);
  });

  it("matches padded Dex queries and applies the complete type filter in Dex order", () => {
    expect(fixtureRecordList({ kind: "pokemon_species", query: "#007" })).toMatchObject([
      { nationalDex: 7, displayName: "Squirtle" },
    ]);
    expect(fixtureRecordList({ kind: "pokemon_species", query: "025" })).toMatchObject([
      { nationalDex: 25, displayName: "Pikachu" },
    ]);
    const fairy = fixtureRecordList({ kind: "pokemon_species", type: "fairy" });
    expect(fairy.map((record) => record.nationalDex)).toEqual([35, 36, 39, 40, 122]);
    expect(fixtureRecordList({ kind: "pokemon_species" })[0]?.nationalDex).toBe(1);
  });

  it("starts every Pokémon and generated design task unassigned", () => {
    expect(fixtureGen1Records.every((record) => record.workflowState === "draft")).toBe(true);
    expect(
      fixturePlanningRecords
        .filter((record) => record.recordKind === "work_item")
        .every((record) => record.taskStatus === "backlog" && !("owner" in record.planning)),
    ).toBe(true);
  });

  it("persists fixture edits with the same optimistic-revision behavior as the Studio", () => {
    const initial = fixtureRecordDetail("pikachu");
    expect(initial).not.toBeNull();
    const saved = saveFixtureStudioRecord(initial!.publicId, initial!.revision, {
      facts: initial!.facts,
      design: { candidate_job: "Control operator" },
      work: initial!.work,
      balance: initial!.balance,
      testing: initial!.testing,
      planning: initial!.planning,
      privateNote: initial!.privateNote,
    });
    expect(saved).toMatchObject({ revision: 2, workflowState: "draft" });
    expect(fixtureRecordDetail("pikachu")?.design).toMatchObject({
      candidate_job: "Control operator",
    });
    expect(
      saveFixtureStudioRecord(initial!.publicId, initial!.revision, {
        facts: initial!.facts,
        design: initial!.design,
        work: initial!.work,
        balance: initial!.balance,
        testing: initial!.testing,
        planning: initial!.planning,
        privateNote: initial!.privateNote,
      }),
    ).toBeNull();
  });

  it("keeps shared fixture work explicit and visible to the linked Pokémon", () => {
    const task = fixturePlanningRecords.find(
      (record) => record.recordKind === "work_item" && record.slug.includes("pikachu"),
    );
    expect(task).toBeDefined();
    const saved = setFixtureWorkItemAssignments(
      task!.publicId,
      task!.revision,
      [
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
      ],
      "Daniel drafts the job; Jake checks the machine relationship.",
      "in_progress",
      "high",
    );
    expect(saved?.workItemAssignees).toHaveLength(2);
    expect(fixtureRecordDetail("pikachu")?.workItems[0]).toMatchObject({
      status: "in_progress",
      handoffNote: "Daniel drafts the job; Jake checks the machine relationship.",
    });
  });

  it("builds the complete Bulbasaur Blueprint without inheriting species facts", () => {
    const bulbasaur = fixturePokemonWorkspace("bulbasaur");
    const ivysaur = fixturePokemonWorkspace("ivysaur");
    const venusaur = fixturePokemonWorkspace("venusaur");
    const blueprint = fixtureFamilyBlueprint("cobblemon_kinetics:evolution-family/bulbasaur");

    expect(blueprint?.nodes).toHaveLength(8);
    expect(blueprint?.edges).toHaveLength(12);
    expect(blueprint?.edges.filter((edge) => edge.relationshipKind === "evolves_to")).toHaveLength(
      2,
    );
    expect([bulbasaur, ivysaur, venusaur].map((record) => record?.capabilities[0]?.tier)).toEqual([
      1, 2, 3,
    ]);
    const ivysaurFacts = structuredClone(ivysaur?.facts);
    saveFixtureStudioRecord(bulbasaur!.publicId, bulbasaur!.revision, {
      facts: { ...bulbasaur!.facts, genus: "Reviewed Bulbasaur-only genus" },
      design: bulbasaur!.design,
      work: bulbasaur!.work,
      balance: bulbasaur!.balance,
      testing: bulbasaur!.testing,
      planning: bulbasaur!.planning,
      privateNote: bulbasaur!.privateNote,
    });
    expect(fixturePokemonWorkspace("ivysaur")?.facts).toEqual(ivysaurFacts);
  });
});
