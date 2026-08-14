import type { PublishedCatalog, SquirtleDraft } from "./types";

export const fixtureCatalog: PublishedCatalog = {
  schemaVersion: "1.0.0",
  publishedAt: "2026-08-14T00:00:00.000Z",
  pokemon: [
    {
      publicId: "cobblemon:squirtle",
      slug: "squirtle",
      name: "Squirtle",
      nationalDex: 7,
      generation: 1,
      currentTypes: ["Water"],
      originalTypes: ["Water"],
      summary:
        "A compact Water-type worker candidate for testing controlled kinetic input at a Hydro Coupler.",
      status: "published",
      jobIds: ["cobblemon_kinetics:hydro_operator"],
    },
  ],
  jobs: [
    {
      publicId: "cobblemon_kinetics:hydro_operator",
      slug: "hydro-operator",
      name: "Hydro Operator",
      category: "Kinetic power",
      summary:
        "Supplies a controlled stream to a purpose-built coupling instead of passive flowing-water power.",
      requirements: ["Water type", "Player-owned", "Not in battle", "Within workstation range"],
      behaviors: [
        "Approaches the assigned coupling",
        "Channels water while eligible",
        "Stops immediately when ownership or battle checks fail",
      ],
      machineIds: ["cobblemon_kinetics:hydro_coupler"],
      status: "published",
    },
  ],
  machines: [
    {
      publicId: "cobblemon_kinetics:hydro_coupler",
      slug: "hydro-coupler",
      name: "Hydro Coupler",
      registryId: "cobblemon_kinetics:hydro_coupler",
      category: "Kinetic source",
      summary: "A controlled handoff between a Water-type worker and a Create kinetic network.",
      components: ["Worker attachment", "Eligibility sensor", "Kinetic output shaft"],
      status: "published",
    },
  ],
  compatibility: [
    {
      pokemonId: "cobblemon:squirtle",
      jobId: "cobblemon_kinetics:hydro_operator",
      machineId: "cobblemon_kinetics:hydro_coupler",
      efficiency: 1,
      rationale:
        "A neutral baseline keeps the first prototype focused on reliability before species-specific balance.",
    },
  ],
  versions: [
    {
      id: "cobblemon-kinetics:mc-1.21.1",
      label: "Gen 1 prototype",
      minecraft: "1.21.1",
      cobblemon: "1.7.3",
      create: "6.0.10",
      status: "Supported prototype",
    },
  ],
};

export const fixtureSquirtleDraft: SquirtleDraft = {
  publicId: "cobblemon_kinetics:pokemon/squirtle",
  revision: 12,
  workflowState: "draft",
  machineId: "cobblemon_kinetics:hydro_coupler",
  jobId: "cobblemon_kinetics:hydro_operator",
  efficiency: 1,
  publicRationale:
    "A neutral baseline keeps the first prototype focused on reliability before species-specific balance.",
  privateNote:
    "Fixture-only note: confirm the coupler shutdown animation before marking implementation-ready.",
  updatedAt: "2026-08-14T17:00:00.000Z",
  updatedBy: "Fixture maintainer",
  revisions: [
    {
      revision: 12,
      actor: "Fixture maintainer",
      at: "2026-08-14T17:00:00.000Z",
      summary: "Clarified the baseline balance rationale.",
    },
    {
      revision: 11,
      actor: "Fixture maintainer",
      at: "2026-08-14T16:15:00.000Z",
      summary: "Assigned the Hydro Coupler machine candidate.",
    },
    {
      revision: 10,
      actor: "Workbook importer",
      at: "2026-08-14T15:30:00.000Z",
      summary: "Created the Squirtle development record.",
    },
  ],
};
