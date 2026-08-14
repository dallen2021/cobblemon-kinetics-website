import { promises as fs } from "node:fs";
import path from "node:path";
import { fixtureCatalog } from "./fixture";
import type {
  PublishedCatalog,
  PublishedCompatibility,
  PublishedJob,
  PublishedMachine,
  PublishedPokemon,
  PublishedVersion,
} from "./types";
import { isFixtureModeEnabled } from "@/lib/env";

function repositoryRoot(): string {
  return process.env.COBBLEMON_KINETICS_REPO_ROOT ?? path.resolve(process.cwd(), "../..");
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8")) as unknown;
}

async function readJsonDirectory(directory: string): Promise<unknown[]> {
  try {
    const names = (await fs.readdir(directory))
      .filter((name) => name.endsWith(".json"))
      .sort((left, right) => left.localeCompare(right));
    return await Promise.all(names.map((name) => readJson(path.join(directory, name))));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(object: Record<string, unknown>, camel: string, snake = camel): string {
  const value = object[camel] ?? object[snake];
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function titleCase(value: string): string {
  return value.length ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : value;
}

function flattenCollection(values: unknown[], key: string): unknown[] {
  return values.flatMap((value) => {
    const object = asObject(value);
    const nested = object?.[key];
    return Array.isArray(nested) ? nested : [value];
  });
}

function parsePokemon(value: unknown): PublishedPokemon | null {
  const item = asObject(value);
  if (!item) return null;
  const publicId =
    stringValue(item, "cobblemonId", "cobblemon_id") || stringValue(item, "publicId", "public_id");
  const name = stringValue(item, "name");
  if (!publicId || !name) return null;
  return {
    publicId,
    slug: stringValue(item, "slug") || publicId.split(":").at(-1) || publicId,
    name,
    nationalDex: Number(item.nationalDex ?? item.national_dex ?? 0),
    generation: Number(item.generation ?? 1),
    currentTypes: stringArray(item.currentTypes ?? item.current_types ?? item.types).map(titleCase),
    originalTypes: stringArray(
      item.originalTypes ?? item.original_gen1_types ?? item.original_types ?? item.types,
    ).map(titleCase),
    summary:
      stringValue(item, "summary") ||
      `Generation ${Number(item.generation ?? 1)} species record with versioned typing and work assignments.`,
    status: (stringValue(item, "status") || "published") as PublishedPokemon["status"],
    jobIds: Array.isArray(item.work_assignments)
      ? item.work_assignments.flatMap((assignment) => {
          const object = asObject(assignment);
          const id = object ? stringValue(object, "workProfileId", "work_profile_id") : "";
          return id ? [id] : [];
        })
      : stringArray(item.jobIds ?? item.job_ids),
  };
}

function parseJob(value: unknown): PublishedJob | null {
  const item = asObject(value);
  if (!item) return null;
  const publicId = stringValue(item, "publicId", "public_id");
  const name = stringValue(item, "name");
  if (!publicId || !name) return null;
  return {
    publicId,
    slug: stringValue(item, "slug") || publicId.split(":").at(-1) || publicId,
    name,
    category: stringValue(item, "category"),
    summary: stringValue(item, "summary"),
    requirements: stringArray(item.requirements),
    behaviors: stringArray(item.behaviors),
    machineIds: stringArray(item.machineIds ?? item.machine_ids),
    status: (stringValue(item, "status") || "published") as PublishedJob["status"],
  };
}

function parseMachine(value: unknown): PublishedMachine | null {
  const item = asObject(value);
  if (!item) return null;
  const publicId = stringValue(item, "publicId", "public_id");
  const name = stringValue(item, "name");
  if (!publicId || !name) return null;
  return {
    publicId,
    slug: stringValue(item, "slug") || publicId.split(":").at(-1) || publicId,
    name,
    registryId: stringValue(item, "registryId", "registry_id") || publicId,
    category: stringValue(item, "category"),
    summary: stringValue(item, "summary"),
    components: stringArray(item.components),
    status: (stringValue(item, "status") || "published") as PublishedMachine["status"],
  };
}

function parseCompatibility(value: unknown): PublishedCompatibility | null {
  const item = asObject(value);
  if (!item) return null;
  const pokemonId = stringValue(item, "pokemonId", "pokemon_id");
  const jobId = stringValue(item, "jobId", "job_id");
  const machineId = stringValue(item, "machineId", "machine_id");
  if (!pokemonId || !jobId || !machineId) return null;
  return {
    pokemonId,
    jobId,
    machineId,
    efficiency: Number(item.efficiency ?? 1),
    rationale: stringValue(item, "rationale"),
  };
}

function parseVersion(value: unknown): PublishedVersion | null {
  const item = asObject(value);
  if (!item) return null;
  const id = stringValue(item, "id");
  if (!id) return null;
  return {
    id,
    label: stringValue(item, "label"),
    minecraft: stringValue(item, "minecraft"),
    cobblemon: stringValue(item, "cobblemon"),
    create: stringValue(item, "create"),
    status: stringValue(item, "status"),
  };
}

async function loadDirectoryCatalog(root: string): Promise<PublishedCatalog> {
  const [pokemonFiles, jobsRaw, machinesRaw, compatibilityRaw, versionsRaw, workProfilesRaw] =
    await Promise.all([
      readJsonDirectory(path.join(root, "pokemon")),
      readJsonDirectory(path.join(root, "jobs")),
      readJsonDirectory(path.join(root, "machines")),
      readJsonDirectory(path.join(root, "compatibility")),
      readJsonDirectory(path.join(root, "versions")),
      readJsonDirectory(path.join(root, "work_profiles")),
    ]);

  const pokemonRaw = flattenCollection(pokemonFiles, "pokemon");

  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = asObject(await readJson(path.join(root, "manifest.json")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const pokemon = pokemonRaw
    .map(parsePokemon)
    .filter((item): item is PublishedPokemon => item !== null);
  const profileById = new Map<string, Record<string, unknown>>();
  for (const rawProfile of workProfilesRaw) {
    const profile = asObject(rawProfile);
    const id = profile ? stringValue(profile, "id") : "";
    if (id) profileById.set(id, profile!);
  }

  const jobs = jobsRaw
    .map(parseJob)
    .filter((item): item is PublishedJob => item !== null)
    .map((job) => {
      const profile = [...profileById.values()].find((item) => {
        const id = stringValue(item, "id");
        return id.endsWith(job.slug.replaceAll("-", "_"));
      });
      if (!profile) return job;
      const constraints = asObject(profile.constraints);
      const workstation = asObject(profile.workstation);
      const requirements = constraints
        ? Object.entries(constraints)
            .filter(([, enabled]) => enabled === true)
            .map(([key]) => key.replaceAll("_", " "))
        : [];
      return {
        ...job,
        publicId: stringValue(profile, "id") || job.publicId,
        category: job.category || "Kinetic power",
        requirements,
        behaviors: [
          "Validate worker eligibility",
          "Supply bounded kinetic power",
          "Stop when eligibility fails",
        ],
        machineIds: stringArray(workstation?.registry_ids),
      };
    });

  const machines = machinesRaw
    .map(parseMachine)
    .filter((item): item is PublishedMachine => item !== null)
    .map((machine) => {
      const matchingProfile = [...profileById.values()].find((profile) => {
        const workstation = asObject(profile.workstation);
        return stringArray(workstation?.registry_ids).some((id) =>
          id.endsWith(machine.slug.replaceAll("-", "_")),
        );
      });
      const workstation = matchingProfile ? asObject(matchingProfile.workstation) : null;
      const registryId = stringArray(workstation?.registry_ids)[0];
      return {
        ...machine,
        registryId: registryId || machine.registryId.replace("machine/", ""),
        category: machine.category || "Kinetic source",
        components: machine.components.length
          ? machine.components
          : ["Worker attachment", "Eligibility checks", "Kinetic output"],
      };
    });

  const derivedCompatibility = pokemonRaw.flatMap((rawPokemon) => {
    const source = asObject(rawPokemon);
    const pokemonId = source ? stringValue(source, "cobblemonId", "cobblemon_id") : "";
    const assignments =
      source && Array.isArray(source.work_assignments) ? source.work_assignments : [];
    return assignments.flatMap((rawAssignment) => {
      const assignment = asObject(rawAssignment);
      if (!assignment || !pokemonId) return [];
      const parsed = parseCompatibility({
        pokemon_id: pokemonId,
        job_id: stringValue(assignment, "workProfileId", "work_profile_id"),
        machine_id: stringValue(assignment, "machineRegistryId", "machine_registry_id"),
        efficiency: assignment.efficiency_multiplier,
        rationale: assignment.public_rationale,
      });
      return parsed ? [parsed] : [];
    });
  });

  const explicitCompatibility = compatibilityRaw
    .map(parseCompatibility)
    .filter((item): item is PublishedCompatibility => item !== null);

  return {
    schemaVersion: manifest
      ? stringValue(manifest, "schemaVersion", "schema_version") || "1.0.0"
      : "1.0.0",
    publishedAt: manifest ? stringValue(manifest, "publishedAt", "published_at") || null : null,
    pokemon,
    jobs,
    machines,
    compatibility: explicitCompatibility.length ? explicitCompatibility : derivedCompatibility,
    versions: versionsRaw
      .map(parseVersion)
      .filter((item): item is PublishedVersion => item !== null),
  };
}

export async function getPublishedCatalog(): Promise<PublishedCatalog> {
  const root = path.join(repositoryRoot(), "data", "published");
  const catalogPath = path.join(root, "catalog.json");

  try {
    const catalog = asObject(await readJson(catalogPath));
    if (catalog) {
      return {
        schemaVersion: stringValue(catalog, "schemaVersion", "schema_version") || "1.0.0",
        publishedAt: stringValue(catalog, "publishedAt", "published_at") || null,
        pokemon: (Array.isArray(catalog.pokemon) ? catalog.pokemon : [])
          .map(parsePokemon)
          .filter((item): item is PublishedPokemon => item !== null),
        jobs: (Array.isArray(catalog.jobs) ? catalog.jobs : [])
          .map(parseJob)
          .filter((item): item is PublishedJob => item !== null),
        machines: (Array.isArray(catalog.machines) ? catalog.machines : [])
          .map(parseMachine)
          .filter((item): item is PublishedMachine => item !== null),
        compatibility: (Array.isArray(catalog.compatibility) ? catalog.compatibility : [])
          .map(parseCompatibility)
          .filter((item): item is PublishedCompatibility => item !== null),
        versions: (Array.isArray(catalog.versions) ? catalog.versions : [])
          .map(parseVersion)
          .filter((item): item is PublishedVersion => item !== null),
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const catalog = await loadDirectoryCatalog(root);
  if (catalog.pokemon.length || catalog.jobs.length || catalog.machines.length) {
    return catalog;
  }
  if (isFixtureModeEnabled()) {
    return fixtureCatalog;
  }
  return catalog;
}

export function filterCatalog(catalog: PublishedCatalog, query: string): PublishedCatalog {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return catalog;
  const includes = (...values: Array<string | number>) =>
    values.some((value) => String(value).toLocaleLowerCase().includes(needle));
  return {
    ...catalog,
    pokemon: catalog.pokemon.filter((item) =>
      includes(
        item.name,
        item.slug,
        item.publicId,
        item.nationalDex,
        `#${String(item.nationalDex).padStart(3, "0")}`,
      ),
    ),
    jobs: catalog.jobs.filter((item) =>
      includes(item.name, item.slug, item.publicId, item.category),
    ),
    machines: catalog.machines.filter((item) =>
      includes(item.name, item.slug, item.publicId, item.registryId, item.category),
    ),
    compatibility: catalog.compatibility,
    versions: catalog.versions,
  };
}
