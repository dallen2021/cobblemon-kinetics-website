import { describe, expect, it } from "vitest";

import {
  assertPublicSafe,
  isResourceLocation,
  validateKineticBlueprint,
  validateModExportManifest,
  validatePublicBlueprintRecord,
  validateWorkProfile,
  type ModExportManifest,
  type PublicBlueprintRecord,
  type WorkProfile,
} from "../src/index.js";

const hydroProfile: WorkProfile = {
  format_version: 1,
  id: "cobblemon_kinetics:hydro_operator",
  title: "Hydro Operator",
  priority: 0,
  status: "experimental",
  selector: {
    kind: "type",
    types: ["cobblemon:water"],
    national_dex: { min: 1, max: 151 },
  },
  constraints: {
    requires_owner: true,
    must_be_alive: true,
    must_not_be_fainted: true,
    must_not_be_battling: true,
    must_be_idle: true,
  },
  workstation: {
    adapter_id: "cobblemon_kinetics:hydro_coupler",
    registry_ids: ["cobblemon_kinetics:hydro_coupler"],
    required_attachment_tag: "create:water_wheels",
    radius: 6,
  },
  contribution: {
    mode: "fixed",
    rpm: 8,
    capacity_per_rpm: 64,
    efficiency_multiplier: 1,
  },
  public_rationale: "Water-type workers drive the attached wheel without placing water blocks.",
};

const modExportManifest: ModExportManifest = {
  manifest_version: 1,
  source: {
    repository: "cobblemon-kinetics/studio",
    commit_sha: "a".repeat(40),
    publication_manifest_sha256: "b".repeat(64),
  },
  publication: {
    batch_id: "cobblemon_kinetics:squirtle_hydro_v1",
    schema_version: "1.0.0",
    bundle_content_sha256: "c".repeat(64),
  },
  files: [
    {
      path: "work_profiles/hydro_operator.json",
      profile_id: "cobblemon_kinetics:hydro_operator",
      format_version: 1,
      sha256: "d".repeat(64),
    },
  ],
};

describe("domain validation", () => {
  it("accepts the versioned Hydro profile", () => {
    expect(validateWorkProfile(hydroProfile)).toMatchObject({ ok: true, errors: [] });
  });

  it("rejects unknown format versions and invalid resource locations", () => {
    expect(validateWorkProfile({ ...hydroProfile, format_version: 2 }).ok).toBe(false);
    expect(isResourceLocation("Not Valid")).toBe(false);
  });

  it("validates deterministic mod-export provenance", () => {
    expect(validateModExportManifest(modExportManifest)).toMatchObject({ ok: true, errors: [] });

    expect(
      validateModExportManifest({
        ...modExportManifest,
        source: { ...modExportManifest.source, commit_sha: "ABC123" },
      }).ok,
    ).toBe(false);
    expect(
      validateModExportManifest({
        ...modExportManifest,
        files: [{ ...modExportManifest.files[0], path: "../hydro_operator.json" }],
      }).ok,
    ).toBe(false);
  });

  it("blocks private fields from public projections", () => {
    expect(() => assertPublicSafe({ public_id: "test:record", private_note: "no" })).toThrow(
      /private or quarantined fields/,
    );
  });

  it("validates staged Kinetic Blueprint operations and per-form suggestion acceptance", () => {
    const blueprint = {
      board: {
        public_id: "cobblemon_kinetics:blueprint/bulbasaur",
        family_public_id: "cobblemon_kinetics:evolution-family/bulbasaur",
        revision: 1,
        checksum: "a".repeat(64),
      },
      nodes: [],
      edges: [],
      annotations: [],
      preference: {
        viewport: { x: 0, y: 0, zoom: 1 },
        filters: {},
        hidden_nodes: [],
        last_view: "overview",
      },
      operations: [
        {
          type: "accept_type_suggestion",
          suggestion_id: "00000000-0000-4000-8000-000000000001",
          form_public_id: "cobblemon_kinetics:pokemon/bulbasaur/default",
          tier: 1,
        },
      ],
    };

    expect(validateKineticBlueprint(blueprint)).toMatchObject({ ok: true, errors: [] });
    expect(
      validateKineticBlueprint({
        ...blueprint,
        operations: [{ ...blueprint.operations[0], tier: 5 }],
      }).ok,
    ).toBe(false);
    expect(
      validateKineticBlueprint({
        ...blueprint,
        operations: [{ type: "accept_type_suggestion", suggestion_id: "not-a-uuid" }],
      }).ok,
    ).toBe(false);
  });

  it("validates strict public Blueprint relationship projections", () => {
    const relationship: PublicBlueprintRecord = {
      format_version: 1,
      public_id: "cobblemon_kinetics:relationship/bulbasaur-plant-care",
      record_kind: "relationship",
      name: "Bulbasaur has Plant Care",
      status: "approved",
      source_public_id: "cobblemon_kinetics:pokemon/bulbasaur/default",
      target_public_id: "cobblemon_kinetics:capability/plant-care",
      relationship_kind: "has_capability",
      metadata: { tier: 1, radius: 2 },
      inheritance_decision: "add",
      parent_relationship_public_id: null,
    };
    expect(validatePublicBlueprintRecord(relationship)).toMatchObject({ ok: true, errors: [] });
    expect(
      validatePublicBlueprintRecord({ ...relationship, relationship_kind: "invented" }).ok,
    ).toBe(false);
    expect(validatePublicBlueprintRecord({ ...relationship, private_note: "leak" }).ok).toBe(false);
  });
});
