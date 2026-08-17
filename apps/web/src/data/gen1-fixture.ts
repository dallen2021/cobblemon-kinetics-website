import type {
  StudioAssignee,
  StudioComment,
  StudioRecord,
  StudioRecordDetail,
  StudioRecordFilters,
  StudioWorkItemLink,
} from "./studio-types";
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
    provenance: [
      {
        fieldPath: "facts",
        sourceSheet: "Fixture",
        sourceRow: record.nationalDex ?? 0,
        sourceKey: record.slug,
        importedValue: record.facts,
        importedHash: record.checksum,
        overriddenAt: null,
      },
    ],
  };
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
