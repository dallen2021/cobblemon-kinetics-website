import type {
  FamilyBlueprint,
  PokemonWorkspaceData,
  StudioAssignee,
  StudioComment,
  StudioObject,
  StudioRecord,
  StudioRecordDetail,
  StudioRecordFilters,
  StudioWorkItemLink,
} from "./studio-types";
import { evolutionPositionForDex } from "./gen1-evolution";
import { gen1CurrentTypesByDex } from "./gen1-types";

const names = [
  "Bulbasaur",
  "Ivysaur",
  "Venusaur",
  "Charmander",
  "Charmeleon",
  "Charizard",
  "Squirtle",
  "Wartortle",
  "Blastoise",
  "Caterpie",
  "Metapod",
  "Butterfree",
  "Weedle",
  "Kakuna",
  "Beedrill",
  "Pidgey",
  "Pidgeotto",
  "Pidgeot",
  "Rattata",
  "Raticate",
  "Spearow",
  "Fearow",
  "Ekans",
  "Arbok",
  "Pikachu",
  "Raichu",
  "Sandshrew",
  "Sandslash",
  "Nidoran♀",
  "Nidorina",
  "Nidoqueen",
  "Nidoran♂",
  "Nidorino",
  "Nidoking",
  "Clefairy",
  "Clefable",
  "Vulpix",
  "Ninetales",
  "Jigglypuff",
  "Wigglytuff",
  "Zubat",
  "Golbat",
  "Oddish",
  "Gloom",
  "Vileplume",
  "Paras",
  "Parasect",
  "Venonat",
  "Venomoth",
  "Diglett",
  "Dugtrio",
  "Meowth",
  "Persian",
  "Psyduck",
  "Golduck",
  "Mankey",
  "Primeape",
  "Growlithe",
  "Arcanine",
  "Poliwag",
  "Poliwhirl",
  "Poliwrath",
  "Abra",
  "Kadabra",
  "Alakazam",
  "Machop",
  "Machoke",
  "Machamp",
  "Bellsprout",
  "Weepinbell",
  "Victreebel",
  "Tentacool",
  "Tentacruel",
  "Geodude",
  "Graveler",
  "Golem",
  "Ponyta",
  "Rapidash",
  "Slowpoke",
  "Slowbro",
  "Magnemite",
  "Magneton",
  "Farfetch’d",
  "Doduo",
  "Dodrio",
  "Seel",
  "Dewgong",
  "Grimer",
  "Muk",
  "Shellder",
  "Cloyster",
  "Gastly",
  "Haunter",
  "Gengar",
  "Onix",
  "Drowzee",
  "Hypno",
  "Krabby",
  "Kingler",
  "Voltorb",
  "Electrode",
  "Exeggcute",
  "Exeggutor",
  "Cubone",
  "Marowak",
  "Hitmonlee",
  "Hitmonchan",
  "Lickitung",
  "Koffing",
  "Weezing",
  "Rhyhorn",
  "Rhydon",
  "Chansey",
  "Tangela",
  "Kangaskhan",
  "Horsea",
  "Seadra",
  "Goldeen",
  "Seaking",
  "Staryu",
  "Starmie",
  "Mr. Mime",
  "Scyther",
  "Jynx",
  "Electabuzz",
  "Magmar",
  "Pinsir",
  "Tauros",
  "Magikarp",
  "Gyarados",
  "Lapras",
  "Ditto",
  "Eevee",
  "Vaporeon",
  "Jolteon",
  "Flareon",
  "Porygon",
  "Omanyte",
  "Omastar",
  "Kabuto",
  "Kabutops",
  "Aerodactyl",
  "Snorlax",
  "Articuno",
  "Zapdos",
  "Moltres",
  "Dratini",
  "Dragonair",
  "Dragonite",
  "Mewtwo",
  "Mew",
] as const;

function slugFor(name: string): string {
  const explicit: Record<string, string> = {
    "Nidoran♀": "nidoranf",
    "Nidoran♂": "nidoranm",
    "Mr. Mime": "mrmime",
    "Farfetch’d": "farfetchd",
  };
  return explicit[name] ?? name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "");
}

function typeFor(dex: number): string[] {
  return [...(gen1CurrentTypesByDex[dex] ?? ["normal"])];
}

function originalTypeFor(dex: number, currentTypes: string[]): string[] {
  const preModernTypes: Record<number, string[]> = {
    35: ["normal"],
    36: ["normal"],
    39: ["normal"],
    40: ["normal"],
    81: ["electric"],
    82: ["electric"],
    122: ["psychic"],
  };
  return [...(preModernTypes[dex] ?? currentTypes)];
}

function recordFor(name: string, index: number): StudioRecord {
  const nationalDex = index + 1;
  const slug = slugFor(name);
  const types = typeFor(nationalDex);
  const originalTypes = originalTypeFor(nationalDex, types);
  const squirtle = nationalDex === 7;
  const evolution = evolutionPositionForDex(nationalDex);
  const familyNames = evolution.members.map((dex) => names[dex - 1]!);
  const evolutionFamily =
    nationalDex === 106 || nationalDex === 107
      ? "Hitmonlee / Hitmonchan"
      : nationalDex >= 133 && nationalDex <= 136
        ? "Eevee → Vaporeon / Jolteon / Flareon"
        : familyNames.join(" → ");
  const bulbasaurLine = nationalDex >= 1 && nationalDex <= 3;
  return {
    publicId: `cobblemon_kinetics:pokemon/${slug}`,
    slug,
    displayName: name,
    recordKind: "pokemon_species",
    workflowState: "draft",
    revision: squirtle ? 12 : 1,
    checksum: `fixture-${nationalDex.toString().padStart(3, "0")}`.padEnd(64, "0"),
    updatedAt: "2026-08-15T00:00:00.000Z",
    updatedBy: "Fixture maintainer",
    nationalDex,
    cobblemonSpeciesId: `cobblemon:${slug}`,
    types,
    taskStatus: "backlog",
    taskCount: 1,
    workItemAssignees: [],
    workReady: squirtle ? "candidate" : "not_started",
    facts: {
      national_dex: nationalDex,
      api_slug: slug,
      current_typing: types.join(" / "),
      original_gen1_typing: originalTypes.join(" / "),
      base_friendship: 70,
      genus: bulbasaurLine ? "Seed Pokémon" : "",
      habitat: bulbasaurLine ? "grassland" : "",
      growth_rate: bulbasaurLine ? "medium-slow" : "",
      shape: bulbasaurLine ? "quadruped" : "",
      color: bulbasaurLine ? "green" : "",
      primary_type: types[0] ?? "normal",
      secondary_type: types[1] ?? "",
      evolution_family: evolutionFamily,
      evolution_stage: evolution.stageLabel,
      source: "Fixture data only",
    },
    design: {},
    work: squirtle
      ? {
          readiness: "candidate",
          machine_id: "cobblemon_kinetics:hydro_coupler",
          job_id: "cobblemon_kinetics:hydro_operator",
        }
      : { readiness: "not_started", machine_id: null, job_id: null },
    balance: squirtle
      ? {
          efficiency: 1,
          public_rationale:
            "A neutral baseline keeps the Hydro prototype focused on reliable worker eligibility.",
        }
      : { efficiency: 1, public_rationale: "" },
    testing: {},
    planning: {},
    privateNote: squirtle
      ? "Fixture-only note: confirm shutdown feedback before implementation."
      : "",
  };
}

export const fixtureGen1Records = names.map(recordFor);

export const fixtureTypes = [
  "bug",
  "dark",
  "dragon",
  "electric",
  "fairy",
  "fighting",
  "fire",
  "flying",
  "ghost",
  "grass",
  "ground",
  "ice",
  "normal",
  "poison",
  "psychic",
  "rock",
  "steel",
  "water",
];

function planningRecord(
  publicId: string,
  slug: string,
  displayName: string,
  recordKind: StudioRecord["recordKind"],
  planning: StudioRecord["planning"],
): StudioRecord {
  return {
    publicId,
    slug,
    displayName,
    recordKind,
    workflowState: "draft",
    revision: 1,
    checksum: `fixture-${slug}`.padEnd(64, "0").slice(0, 64),
    updatedAt: "2026-08-15T00:00:00.000Z",
    updatedBy: "Fixture maintainer",
    nationalDex: null,
    cobblemonSpeciesId: null,
    types: recordKind === "type_workshop" ? [slug.replace("type-workshop-", "")] : [],
    taskStatus: recordKind === "work_item" ? "backlog" : null,
    taskCount: 0,
    workItemAssignees: [],
    workReady: "not_started",
    facts: {},
    design: {},
    work: {},
    balance: { efficiency: 1, public_rationale: "" },
    testing: {},
    planning,
    privateNote: "",
  };
}

export const fixturePlanningRecords: StudioRecord[] = [
  ...fixtureTypes.map((type) =>
    planningRecord(
      `cobblemon_kinetics:type-workshop/${type}`,
      `type-workshop-${type}`,
      `${type[0]?.toUpperCase()}${type.slice(1)} Type Workshop`,
      "type_workshop",
      {
        status: "Needs Discussion",
        decision: "Undecided",
        core_worker_fantasy: "Define a grounded Gen 1 worker direction.",
      },
    ),
  ),
  planningRecord("cobblemon_kinetics:hydro_operator", "hydro-operator", "Hydro Operator", "job", {
    category: "power_generation",
    adapter_id: "cobblemon_kinetics:hydro_coupler",
  }),
  planningRecord("cobblemon_kinetics:hydro_coupler", "hydro-coupler", "Hydro Coupler", "machine", {
    lifecycle_state: "prototype",
    registry_id: "cobblemon_kinetics:hydro_coupler",
  }),
  ...fixtureGen1Records.map((species) =>
    planningRecord(
      `cobblemon_kinetics:work-item/gen1-${String(species.nationalDex).padStart(3, "0")}-${species.slug}`,
      `gen1-${String(species.nationalDex).padStart(3, "0")}-${species.slug}-design`,
      `Design ${species.displayName} for Gen 1`,
      "work_item",
      {
        status: "backlog",
        priority: "normal",
        linked_record: species.publicId,
        definition_of_done:
          "Document a reviewed design direction, constraints, balance rationale, and validation plan.",
      },
    ),
  ),
];

export const allFixtureStudioRecords = [...fixtureGen1Records, ...fixturePlanningRecords];

/**
 * Fixture mode is deliberately local-only, but it still models the server's
 * revision semantics. This lets browser tests exercise two-editor conflicts
 * without pretending that a shared hosted database exists.
 */
const fixtureOverrides = new Map<string, StudioRecord>();
const fixtureComments = new Map<string, StudioComment[]>();
const fixtureHistories = new Map<string, import("./studio-types").StudioRevision[]>();

function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

function baseFixtureRecord(publicIdOrSlug: string): StudioRecord | null {
  return (
    allFixtureStudioRecords.find(
      (candidate) => candidate.publicId === publicIdOrSlug || candidate.slug === publicIdOrSlug,
    ) ?? null
  );
}

function currentFixtureRecord(publicIdOrSlug: string): StudioRecord | null {
  const base = baseFixtureRecord(publicIdOrSlug);
  if (!base) return null;
  return cloneRecord(fixtureOverrides.get(base.publicId) ?? base);
}

function defaultHistory(record: StudioRecord) {
  return [
    {
      revision: record.revision,
      actor: "Fixture maintainer",
      at: record.updatedAt,
      summary: "Created editable Gen 1 planning record.",
    },
  ];
}

function currentFixtureRecords(): StudioRecord[] {
  return allFixtureStudioRecords.map((record) => currentFixtureRecord(record.publicId) ?? record);
}

function fixtureChecksum(record: StudioRecord): string {
  return `fixture-${record.slug}-revision-${record.revision}`.padEnd(64, "0").slice(0, 64);
}

export function saveFixtureStudioRecord(
  publicId: string,
  expectedRevision: number,
  patch: Pick<StudioRecord, "facts" | "design" | "work" | "balance" | "testing" | "planning"> & {
    privateNote: string;
  },
): StudioRecord | null {
  const current = currentFixtureRecord(publicId);
  if (!current || current.revision !== expectedRevision) return null;
  const next: StudioRecord = {
    ...current,
    facts: cloneRecord(patch.facts),
    design: cloneRecord(patch.design),
    work: cloneRecord(patch.work),
    balance: cloneRecord(patch.balance),
    testing: cloneRecord(patch.testing),
    planning: cloneRecord(patch.planning),
    privateNote: patch.privateNote,
    revision: current.revision + 1,
    workflowState: "draft",
    updatedAt: new Date().toISOString(),
    updatedBy: "Fixture maintainer",
  };
  next.checksum = fixtureChecksum(next);
  fixtureOverrides.set(next.publicId, next);
  fixtureHistories.set(next.publicId, [
    {
      revision: next.revision,
      actor: next.updatedBy,
      at: next.updatedAt,
      summary: "Saved structured Studio sections.",
    },
    ...(fixtureHistories.get(next.publicId) ?? defaultHistory(current)),
  ]);
  return cloneRecord(next);
}

export function approveFixtureStudioRecord(
  publicId: string,
  expectedRevision: number,
): StudioRecord | null {
  const current = currentFixtureRecord(publicId);
  if (!current || current.revision !== expectedRevision) return null;
  const next: StudioRecord = {
    ...current,
    workflowState: "approved",
    updatedAt: new Date().toISOString(),
    updatedBy: "Fixture maintainer",
  };
  fixtureOverrides.set(next.publicId, next);
  return cloneRecord(next);
}

export function addFixtureStudioComment(publicId: string, body: string): StudioComment | null {
  const record = currentFixtureRecord(publicId);
  if (!record) return null;
  const comment: StudioComment = {
    id: crypto.randomUUID(),
    body: body.trim(),
    author: "Fixture maintainer",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  fixtureComments.set(record.publicId, [...(fixtureComments.get(record.publicId) ?? []), comment]);
  return cloneRecord(comment);
}

export function setFixtureWorkItemAssignments(
  publicId: string,
  expectedRevision: number,
  assignees: StudioAssignee[],
  handoffNote: string,
  status: string,
  priority: string,
): StudioRecord | null {
  const current = currentFixtureRecord(publicId);
  if (!current || current.recordKind !== "work_item" || current.revision !== expectedRevision) {
    return null;
  }
  const next: StudioRecord = {
    ...current,
    taskStatus: status,
    workItemAssignees: cloneRecord(assignees),
    planning: {
      ...current.planning,
      status,
      priority,
      handoff_note: handoffNote,
    },
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "Fixture maintainer",
  };
  next.checksum = fixtureChecksum(next);
  fixtureOverrides.set(next.publicId, next);
  fixtureHistories.set(next.publicId, [
    {
      revision: next.revision,
      actor: next.updatedBy,
      at: next.updatedAt,
      summary: "Updated explicit work-item assignments.",
    },
    ...(fixtureHistories.get(next.publicId) ?? defaultHistory(current)),
  ]);
  return cloneRecord(next);
}

export function resetFixtureStudioState(): void {
  fixtureOverrides.clear();
  fixtureComments.clear();
  fixtureHistories.clear();
  fixtureBlueprintOverrides.clear();
}

export function fixtureRecordDetail(publicId: string): StudioRecordDetail | null {
  const record = currentFixtureRecord(publicId);
  if (!record) return null;
  const taskRecord =
    record.recordKind === "pokemon_species"
      ? currentFixtureRecords().find(
          (candidate) =>
            candidate.recordKind === "work_item" &&
            candidate.planning.linked_record === record.publicId,
        )
      : null;
  const task: StudioWorkItemLink | null = taskRecord
    ? {
        publicId: taskRecord.publicId,
        title: taskRecord.displayName,
        status: taskRecord.taskStatus ?? "backlog",
        priority:
          typeof taskRecord.planning.priority === "string"
            ? taskRecord.planning.priority
            : "normal",
        relation: "develops",
        handoffNote:
          typeof taskRecord.planning.handoff_note === "string"
            ? taskRecord.planning.handoff_note
            : "",
        assignees: taskRecord.workItemAssignees,
      }
    : null;
  return {
    ...record,
    revisions: cloneRecord(fixtureHistories.get(record.publicId) ?? defaultHistory(record)),
    comments: cloneRecord(fixtureComments.get(record.publicId) ?? []),
    workItems: task ? [task] : [],
    provenance: Object.entries(record.facts).map(([field, value]) => ({
      fieldPath: `facts.${field}`,
      sourceSheet: "Fixture",
      sourceRow: record.nationalDex ?? 0,
      sourceKey: record.slug,
      importedValue: value,
      importedHash: record.checksum,
      overriddenAt: null,
    })),
  };
}

const controlledValues: PokemonWorkspaceData["controlledValues"] = {
  growth_rate: [
    { slug: "fast", label: "Fast", reviewRequired: false },
    { slug: "medium", label: "Medium", reviewRequired: false },
    { slug: "medium-slow", label: "Medium Slow", reviewRequired: false },
    { slug: "slow", label: "Slow", reviewRequired: false },
  ],
  habitat: [
    "Cave",
    "Forest",
    "Grassland",
    "Mountain",
    "Rare",
    "Rough Terrain",
    "Sea",
    "Urban",
    "Waters Edge",
  ].map((label) => ({
    slug: label.toLowerCase().replaceAll(" ", "-"),
    label,
    reviewRequired: false,
  })),
  shape: [
    "Armor",
    "Arms",
    "Ball",
    "Blob",
    "Bug Wings",
    "Fish",
    "Heads",
    "Humanoid",
    "Legs",
    "Quadruped",
    "Squiggle",
    "Tentacles",
    "Upright",
    "Wings",
  ].map((label) => ({
    slug: label.toLowerCase().replaceAll(" ", "-"),
    label,
    reviewRequired: false,
  })),
  color: [
    "Black",
    "Blue",
    "Brown",
    "Gray",
    "Green",
    "Pink",
    "Purple",
    "Red",
    "White",
    "Yellow",
  ].map((label) => ({ slug: label.toLowerCase(), label, reviewRequired: false })),
  pokemon_type: fixtureTypes.map((type) => ({
    slug: type,
    label: `${type[0]?.toUpperCase()}${type.slice(1)}`,
    reviewRequired: false,
  })),
  genus: [
    { slug: "seed-pokemon", label: "Seed Pokémon", reviewRequired: false },
    { slug: "tiny-turtle-pokemon", label: "Tiny Turtle Pokémon", reviewRequired: false },
  ],
};

function familyForRecord(record: StudioRecord) {
  const dex = record.nationalDex ?? 1;
  const evolution = evolutionPositionForDex(dex);
  const root = currentFixtureRecord(
    `cobblemon_kinetics:pokemon/${slugFor(names[evolution.members[0]! - 1]!)}`,
  )!;
  return {
    publicId: `cobblemon_kinetics:evolution-family/${root.slug}`,
    displayName: `${root.displayName} family`,
    boardPublicId: `cobblemon_kinetics:blueprint/${root.slug}`,
    stage: { index: evolution.stageIndex, label: evolution.stageLabel },
    members: evolution.members.map((memberDex) => {
      const member = currentFixtureRecord(
        `cobblemon_kinetics:pokemon/${slugFor(names[memberDex - 1]!)}`,
      )!;
      const position = evolutionPositionForDex(memberDex);
      return {
        publicId: member.publicId,
        formPublicId: `${member.publicId}/default`,
        displayName: member.displayName,
        nationalDex: memberDex,
        stageIndex: position.stageIndex,
        stageLabel: position.stageLabel,
      };
    }),
  } satisfies PokemonWorkspaceData["family"];
}

export function fixturePokemonWorkspace(publicIdOrSlug: string): PokemonWorkspaceData | null {
  const detail = fixtureRecordDetail(publicIdOrSlug);
  if (!detail || detail.recordKind !== "pokemon_species") return null;
  const dex = detail.nationalDex ?? 0;
  const capabilityTier = dex >= 1 && dex <= 3 ? (dex as 1 | 2 | 3) : null;
  const family = familyForRecord(detail);
  const formPublicId = `${detail.publicId}/default`;
  const acceptedEdge = fixtureFamilyBlueprint(family.publicId)?.edges.find(
    (edge) =>
      edge.source === formPublicId &&
      edge.target === "cobblemon_kinetics:capability/plant-care" &&
      edge.relationshipKind === "has_capability",
  );
  const acceptedTier =
    capabilityTier ??
    (acceptedEdge ? (Number(acceptedEdge.metadata.tier ?? 1) as 1 | 2 | 3 | 4) : null);
  return {
    ...detail,
    family,
    controlledValues,
    capabilities: acceptedTier
      ? [
          {
            relationshipPublicId:
              acceptedEdge?.id ??
              `cobblemon_kinetics:relationship/fixture-${detail.slug}-plant-care`,
            capabilityPublicId: "cobblemon_kinetics:capability/plant-care",
            name: "Plant Care",
            tier: acceptedTier,
            tierLabel: ["Basic", "Capable", "Advanced", "Exceptional"][acceptedTier - 1] as
              "Basic" | "Capable" | "Advanced" | "Exceptional",
            inheritanceDecision:
              acceptedEdge?.inheritanceDecision ?? (acceptedTier === 1 ? "add" : "raise"),
            inheritanceState: "current",
            explicitValues: {
              radius: Number(acceptedEdge?.metadata.radius ?? [2, 4, 6, 8][acceptedTier - 1]),
              speed_modifier: acceptedTier === 3 ? 0.85 : 1,
            },
          },
        ]
      : [],
    typeSuggestions: detail.types.includes("grass")
      ? [
          {
            id: "00000000-0000-4000-8000-00000000a001",
            capabilityPublicId: "cobblemon_kinetics:capability/plant-care",
            name: "Plant Care",
            suggestedTier: 1,
            rationale: "Grass Workshop suggestion only; accepting it creates an explicit draft.",
            accepted: acceptedTier !== null,
          },
        ]
      : [],
    preferredView: "overview",
  };
}

function blueprintRelationship(
  id: string,
  relationshipKind: FamilyBlueprint["edges"][number]["relationshipKind"],
  source: string,
  target: string,
  label: string,
  metadata: StudioObject = {},
  inheritanceDecision: FamilyBlueprint["edges"][number]["inheritanceDecision"] = null,
): FamilyBlueprint["edges"][number] {
  const handles: Record<FamilyBlueprint["edges"][number]["relationshipKind"], [string, string]> = {
    has_capability: ["worker:capability", "capability:worker"],
    requires_capability: ["job:requirement", "capability:job"],
    assigned_to_job: ["worker:job", "job:worker"],
    operates_at: ["job:worksite", "worksite:job"],
    constrained_by: ["rule:condition", "interlock:rule"],
    produces_result: ["job:result", "result:job"],
    evolves_to: ["worker:evolution", "worker:evolution"],
  };
  return {
    id,
    relationshipKind,
    source,
    target,
    sourceHandle: handles[relationshipKind][0],
    targetHandle: handles[relationshipKind][1],
    label,
    metadata,
    inheritanceDecision,
    inheritanceState: inheritanceDecision ? "current" : "not_applicable",
    workflowState: "draft",
    recordRevision: 1,
  };
}

const fixtureBlueprintOverrides = new Map<string, FamilyBlueprint>();

export function fixtureFamilyBlueprint(familyPublicId: string): FamilyBlueprint | null {
  const existing = fixtureBlueprintOverrides.get(familyPublicId);
  if (existing) return cloneRecord(existing);
  const rootSlug = familyPublicId.split("/").at(-1);
  const root = currentFixtureRecords().find((record) => record.slug === rootSlug);
  if (!root?.nationalDex) return null;
  const evolution = evolutionPositionForDex(root.nationalDex);
  const members = evolution.members.map((dex) => currentFixtureRecord(slugFor(names[dex - 1]!))!);
  const nodes: FamilyBlueprint["nodes"] = members.map((member) => {
    const position = evolutionPositionForDex(member.nationalDex!);
    const branch = evolution.members
      .filter((dex) => evolutionPositionForDex(dex).stageIndex === position.stageIndex)
      .indexOf(member.nationalDex!);
    return {
      id: `${member.publicId}/default`,
      recordKind: "pokemon_form",
      nodeFamily: "worker",
      displayName: member.displayName,
      workflowState: member.workflowState,
      recordRevision: member.revision,
      position: { x: 60 + (position.stageIndex - 1) * 320, y: 70 + branch * 190 },
      width: 250,
      height: 136,
      groupKey: null,
      collapsed: false,
      nationalDex: member.nationalDex,
      types: member.types,
      data: { stage_label: position.stageLabel },
    };
  });
  const edges = evolution.edges.map(([from, to]) =>
    blueprintRelationship(
      `cobblemon_kinetics:relationship/fixture-evolves-${from}-${to}`,
      "evolves_to",
      `${currentFixtureRecord(slugFor(names[from - 1]!))!.publicId}/default`,
      `${currentFixtureRecord(slugFor(names[to - 1]!))!.publicId}/default`,
      "Evolves to",
    ),
  );
  if (root.nationalDex === 1) {
    const sharedNodes: FamilyBlueprint["nodes"] = [
      [
        "cobblemon_kinetics:capability/plant-care",
        "capability",
        "capability",
        "Plant Care",
        380,
        360,
      ],
      ["cobblemon_kinetics:job/plant-tender", "job", "job", "Plant Tender", 680, 360],
      [
        "cobblemon_kinetics:work-target/ordinary-farmland",
        "work_target",
        "worksite",
        "Ordinary Farmland",
        980,
        260,
      ],
      [
        "cobblemon_kinetics:condition/owner-permission",
        "condition",
        "interlock",
        "Owner Permission",
        980,
        430,
      ],
      ["cobblemon_kinetics:result/tended-crops", "result", "result", "Tended Crops", 1280, 340],
    ].map(([id, recordKind, nodeFamily, displayName, x, y]) => ({
      id: String(id),
      recordKind: recordKind as StudioRecord["recordKind"],
      nodeFamily: nodeFamily as FamilyBlueprint["nodes"][number]["nodeFamily"],
      displayName: String(displayName),
      workflowState: "draft",
      recordRevision: 1,
      position: { x: Number(x), y: Number(y) },
      width: 220,
      height: 116,
      groupKey: null,
      collapsed: false,
      nationalDex: null,
      types: [],
      data: {},
    }));
    nodes.push(...sharedNodes);
    let parentCapability: string | null = null;
    let parentJob: string | null = null;
    for (const [index, member] of members.entries()) {
      const workerId = `${member.publicId}/default`;
      const tier = (index + 1) as 1 | 2 | 3;
      const capabilityId = `cobblemon_kinetics:relationship/fixture-${member.slug}-plant-care`;
      edges.push(
        blueprintRelationship(
          capabilityId,
          "has_capability",
          workerId,
          "cobblemon_kinetics:capability/plant-care",
          `Plant Care · Tier ${tier}`,
          { tier, radius: [2, 4, 6][index]!, speed_modifier: tier === 3 ? 0.85 : 1 },
          tier === 1 ? "add" : "raise",
        ),
      );
      const jobId = `cobblemon_kinetics:relationship/fixture-${member.slug}-plant-tender`;
      edges.push(
        blueprintRelationship(
          jobId,
          "assigned_to_job",
          workerId,
          "cobblemon_kinetics:job/plant-tender",
          "Candidate job",
          { parent_relationship: parentJob },
          tier === 1 ? "add" : "keep",
        ),
      );
      parentCapability = capabilityId;
      parentJob = jobId;
      void parentCapability;
    }
    edges.push(
      blueprintRelationship(
        "cobblemon_kinetics:relationship/fixture-job-requires-plant-care",
        "requires_capability",
        "cobblemon_kinetics:job/plant-tender",
        "cobblemon_kinetics:capability/plant-care",
        "Requires Tier 1",
        { minimum_tier: 1 },
      ),
      blueprintRelationship(
        "cobblemon_kinetics:relationship/fixture-job-farmland",
        "operates_at",
        "cobblemon_kinetics:job/plant-tender",
        "cobblemon_kinetics:work-target/ordinary-farmland",
        "Operates at",
      ),
      blueprintRelationship(
        "cobblemon_kinetics:relationship/fixture-job-owner",
        "constrained_by",
        "cobblemon_kinetics:job/plant-tender",
        "cobblemon_kinetics:condition/owner-permission",
        "Requires permission",
      ),
      blueprintRelationship(
        "cobblemon_kinetics:relationship/fixture-job-result",
        "produces_result",
        "cobblemon_kinetics:job/plant-tender",
        "cobblemon_kinetics:result/tended-crops",
        "Produces",
        { bounded: true },
      ),
    );
  }
  return {
    board: {
      publicId: `cobblemon_kinetics:blueprint/${root.slug}`,
      familyPublicId,
      revision: 1,
      checksum: `fixture-blueprint-${root.slug}`.padEnd(64, "0").slice(0, 64),
    },
    nodes,
    edges,
    annotations: [],
    preference: {
      viewport: { x: 0, y: 0, zoom: 1 },
      filters: {},
      hiddenNodes: [],
      lastView: "overview",
    },
  };
}

export function saveFixtureFamilyBlueprint(blueprint: FamilyBlueprint): FamilyBlueprint {
  const next = cloneRecord({
    ...blueprint,
    board: {
      ...blueprint.board,
      revision: blueprint.board.revision + 1,
      checksum: `fixture-blueprint-${blueprint.board.revision + 1}`.padEnd(64, "0").slice(0, 64),
    },
  });
  fixtureBlueprintOverrides.set(next.board.familyPublicId, next);
  return cloneRecord(next);
}

export function approveFixtureBlueprintRecord(
  publicId: string,
  expectedRevision: number,
): { publicId: string; revision: number; workflowState: "approved" } | null {
  const familyIds = new Set(
    currentFixtureRecords()
      .filter((record) => record.recordKind === "pokemon_species")
      .map((record) => familyForRecord(record).publicId),
  );
  for (const familyPublicId of familyIds) {
    const blueprint = fixtureFamilyBlueprint(familyPublicId);
    if (!blueprint) continue;
    const node = blueprint.nodes.find((candidate) => candidate.id === publicId);
    if (node) {
      if (node.recordRevision !== expectedRevision || node.data.needs_completion === true)
        return null;
      node.workflowState = "approved";
      fixtureBlueprintOverrides.set(familyPublicId, cloneRecord(blueprint));
      return { publicId, revision: node.recordRevision, workflowState: "approved" };
    }
    const edge = blueprint.edges.find((candidate) => candidate.id === publicId);
    if (edge) {
      if (edge.recordRevision !== expectedRevision) return null;
      edge.workflowState = "approved";
      fixtureBlueprintOverrides.set(familyPublicId, cloneRecord(blueprint));
      return { publicId, revision: edge.recordRevision, workflowState: "approved" };
    }
  }
  return null;
}

export function fixtureRecordList(filters: StudioRecordFilters = {}): StudioRecord[] {
  const query = filters.query?.trim().toLowerCase().replace(/^#/u, "");
  const nationalDexQuery = query && /^\d+$/u.test(query) ? Number(query) : null;
  return currentFixtureRecords()
    .filter((record) => !filters.kind || record.recordKind === filters.kind)
    .filter((record) => !filters.type || record.types.includes(filters.type.toLowerCase()))
    .filter((record) => !filters.workflow || record.workflowState === filters.workflow)
    .filter((record) => !filters.taskStatus || record.taskStatus === filters.taskStatus)
    .filter(
      (record) =>
        !query ||
        record.displayName.toLowerCase().includes(query) ||
        record.slug.includes(query) ||
        record.nationalDex === nationalDexQuery ||
        record.cobblemonSpeciesId?.includes(query),
    )
    .sort(
      (left, right) =>
        (left.nationalDex ?? Number.MAX_SAFE_INTEGER) -
          (right.nationalDex ?? Number.MAX_SAFE_INTEGER) ||
        left.displayName.localeCompare(right.displayName),
    );
}
