export type WorkflowState = "draft" | "in_review" | "approved" | "archived" | "published";

export interface PublishedPokemon {
  publicId: string;
  slug: string;
  name: string;
  nationalDex: number;
  generation: number;
  currentTypes: string[];
  originalTypes: string[];
  summary: string;
  status: WorkflowState;
  jobIds: string[];
}

export interface PublishedJob {
  publicId: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  requirements: string[];
  behaviors: string[];
  machineIds: string[];
  status: WorkflowState;
}

export interface PublishedMachine {
  publicId: string;
  slug: string;
  name: string;
  registryId: string;
  category: string;
  summary: string;
  components: string[];
  status: WorkflowState;
}

export interface PublishedCompatibility {
  pokemonId: string;
  jobId: string;
  machineId: string;
  efficiency: number;
  rationale: string;
}

export interface PublishedVersion {
  id: string;
  label: string;
  minecraft: string;
  cobblemon: string;
  create: string;
  status: string;
}

export interface PublishedCatalog {
  schemaVersion: string;
  publishedAt: string | null;
  pokemon: PublishedPokemon[];
  jobs: PublishedJob[];
  machines: PublishedMachine[];
  compatibility: PublishedCompatibility[];
  versions: PublishedVersion[];
}
