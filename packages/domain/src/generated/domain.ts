/* eslint-disable */
/** Generated from JSON Schema. Do not edit by hand. */

/**
 * A lower-case namespaced Minecraft resource location.
 */
export type MinecraftResourceLocation = string;
/**
 * @minItems 1
 * @maxItems 2
 */
export type TypeList =
  | [
      | "bug"
      | "dark"
      | "dragon"
      | "electric"
      | "fairy"
      | "fighting"
      | "fire"
      | "flying"
      | "ghost"
      | "grass"
      | "ground"
      | "ice"
      | "normal"
      | "poison"
      | "psychic"
      | "rock"
      | "steel"
      | "water"
    ]
  | [
      (
        | "bug"
        | "dark"
        | "dragon"
        | "electric"
        | "fairy"
        | "fighting"
        | "fire"
        | "flying"
        | "ghost"
        | "grass"
        | "ground"
        | "ice"
        | "normal"
        | "poison"
        | "psychic"
        | "rock"
        | "steel"
        | "water"
      ),
      (
        | "bug"
        | "dark"
        | "dragon"
        | "electric"
        | "fairy"
        | "fighting"
        | "fire"
        | "flying"
        | "ghost"
        | "grass"
        | "ground"
        | "ice"
        | "normal"
        | "poison"
        | "psychic"
        | "rock"
        | "steel"
        | "water"
      )
    ];
/**
 * Public-safe, revision-frozen Kinetic Blueprint entities and relationships.
 */
export type PublishedBlueprintRecord =
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "pokemon_form";
      name: string;
      status: "approved" | "deprecated";
      species_public_id: MinecraftResourceLocation;
      form_key: string;
      /**
       * @maxItems 32
       */
      aspects: string[];
    })
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "capability";
      name: string;
      status: "approved" | "deprecated";
      category: string;
      description: string;
      tier_min: number;
      tier_max: number;
    })
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "work_target";
      name: string;
      status: "approved" | "deprecated";
      target_kind: "machine" | "farmland" | "water" | "storage" | "area" | "entity" | "world_workflow";
      description: string;
    })
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "condition";
      name: string;
      status: "approved" | "deprecated";
      condition_kind: "ownership" | "loading" | "weather" | "held_item" | "space" | "battle" | "other";
      description: string;
    })
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "result";
      name: string;
      status: "approved" | "deprecated";
      result_kind: string;
      description: string;
      bounds: {
        [k: string]: unknown;
      };
    })
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "registry_entry";
      name: string;
      status: "approved" | "deprecated";
      registry_kind: "block" | "item" | "entity" | "fluid" | "tag";
      resource_location: MinecraftResourceLocation;
      source_mod: string;
      lifecycle_state: "candidate" | "active" | "deprecated" | "removed";
    })
  | (Base & {
      format_version: 1;
      public_id: MinecraftResourceLocation;
      record_kind: "relationship";
      name: string;
      status: "approved" | "deprecated";
      source_public_id: MinecraftResourceLocation;
      target_public_id: MinecraftResourceLocation;
      relationship_kind:
        | "has_capability"
        | "requires_capability"
        | "assigned_to_job"
        | "operates_at"
        | "constrained_by"
        | "produces_result"
        | "evolves_to";
      metadata: {
        [k: string]: unknown;
      };
      inheritance_decision: "keep" | "raise" | "lower" | "replace" | "remove" | "add" | null;
      parent_relationship_public_id?: MinecraftResourceLocation | null;
    });

/**
 * Generation root used to keep the public TypeScript contract in lockstep with every published JSON Schema.
 */
export interface CobblemonKineticsDomainCatalog {
  named: PublishedNamedRecord;
  pokemon: PublishedPokemonRecord;
  profile: CobblemonKineticsWorkProfile;
  assets: CobblemonKineticsAssetManifest;
  bundle: ApprovedPublicationBundle;
  manifest: GitPublishedContentManifest;
  mod_export: ModWorkProfileExportManifest;
  blueprint: KineticBlueprintContract;
  public_blueprint: PublishedBlueprintRecord;
}
export interface PublishedNamedRecord {
  format_version: 1;
  public_id: MinecraftResourceLocation;
  slug: string;
  name: string;
  summary: string;
  status: "experimental" | "approved" | "deprecated";
}
export interface PublishedPokemonRecord {
  format_version: 1;
  public_id: MinecraftResourceLocation;
  slug: string;
  national_dex: number;
  name: string;
  cobblemon_id: MinecraftResourceLocation;
  generation: number;
  current_types: TypeList;
  original_gen1_types: TypeList;
  type_changed: boolean;
  form: {
    public_id: MinecraftResourceLocation;
    slug: string;
    name: string;
    is_default: true;
  };
  facts?: {
    habitat?: string | null;
    height_m?: number | null;
    weight_kg?: number | null;
    base_stat_total?: number | null;
    base_stats?: {
      hp: number;
      attack: number;
      defense: number;
      special_attack: number;
      special_defense: number;
      speed: number;
    };
    standard_abilities?: string[];
    hidden_ability?: string | null;
    capture_rate?: number | null;
    base_friendship?: number | null;
    legendary?: boolean;
    mythical?: boolean;
    growth_rate?: string | null;
    shape?: string | null;
    color?: string | null;
  };
  work_assignments: {
    work_profile_id: MinecraftResourceLocation;
    machine_registry_id: MinecraftResourceLocation;
    efficiency_multiplier: number;
    public_rationale: string;
  }[];
  source_references: string[];
}
export interface CobblemonKineticsWorkProfile {
  format_version: 1;
  id: MinecraftResourceLocation;
  title: string;
  priority: number;
  status: "experimental" | "approved" | "deprecated";
  selector:
    | {
        kind: "type";
        /**
         * @minItems 1
         */
        types: [MinecraftResourceLocation, ...MinecraftResourceLocation[]];
        national_dex: {
          min: number;
          max: number;
        };
      }
    | {
        kind: "pokemon";
        /**
         * @minItems 1
         */
        pokemon: [MinecraftResourceLocation, ...MinecraftResourceLocation[]];
      };
  constraints: {
    requires_owner: boolean;
    must_be_alive: boolean;
    must_not_be_fainted: boolean;
    must_not_be_battling: boolean;
    must_be_idle: boolean;
  };
  workstation: {
    adapter_id: MinecraftResourceLocation;
    /**
     * @minItems 1
     */
    registry_ids: [MinecraftResourceLocation, ...MinecraftResourceLocation[]];
    required_attachment_tag: MinecraftResourceLocation;
    radius: number;
  };
  contribution: {
    mode: "fixed";
    rpm: number;
    capacity_per_rpm: number;
    efficiency_multiplier: number;
  };
  public_rationale: string;
}
export interface CobblemonKineticsAssetManifest {
  manifest_version: 1;
  assets: {
    asset_key: MinecraftResourceLocation;
    bound_record_id: MinecraftResourceLocation;
    provider: string;
    source_mod: string;
    source_version: string;
    source_archive_url: string;
    source_archive_sha256: string;
    archive_path: string;
    input_sha256: string;
    output_sha256: string;
    transform: string;
    license_id: string;
    license_url: string;
    attribution: string;
    reviewer: string;
    review_date: string;
    rights_status: "candidate" | "needs_review" | "approved" | "rejected";
    permitted_visibility: "private" | "public";
    publication_state: "draft" | "published" | "withdrawn";
  }[];
}
export interface ApprovedPublicationBundle {
  bundle_version: 1;
  schema_version: string;
  batch_id: MinecraftResourceLocation;
  records: {
    pokemon: PublishedPokemonRecord[];
    jobs: PublishedNamedRecord[];
    machines: PublishedNamedRecord[];
    work_profiles: CobblemonKineticsWorkProfile[];
    blueprints?: PublishedBlueprintRecord[];
  };
  asset_manifest: CobblemonKineticsAssetManifest;
  integrity: {
    content_sha256: string;
    signature?: {
      algorithm: "hmac-sha256";
      value: string;
    };
  };
}
export interface Base {
  format_version: 1;
  public_id: MinecraftResourceLocation;
  record_kind:
    "pokemon_form" | "capability" | "work_target" | "condition" | "result" | "registry_entry" | "relationship";
  name: string;
  status: "approved" | "deprecated";
  [k: string]: unknown;
}
export interface GitPublishedContentManifest {
  manifest_version: 1;
  schema_version: string;
  batch_id: MinecraftResourceLocation;
  bundle_content_sha256: string;
  /**
   * @minItems 1
   */
  files: [
    {
      path: string;
      sha256: string;
      kind: "pokemon_collection" | "job" | "machine" | "work_profile" | "blueprint_collection" | "asset_manifest";
      record_count: number;
    },
    ...{
      path: string;
      sha256: string;
      kind: "pokemon_collection" | "job" | "machine" | "work_profile" | "blueprint_collection" | "asset_manifest";
      record_count: number;
    }[]
  ];
}
/**
 * Deterministic provenance contract for work profiles explicitly handed off to the mod repository.
 */
export interface ModWorkProfileExportManifest {
  manifest_version: 1;
  source: {
    repository: string;
    commit_sha: string;
    publication_manifest_sha256: string;
  };
  publication: {
    batch_id: MinecraftResourceLocation;
    schema_version: string;
    bundle_content_sha256: string;
  };
  /**
   * @minItems 1
   */
  files: [
    {
      path: string;
      profile_id: MinecraftResourceLocation;
      format_version: number;
      sha256: string;
    },
    ...{
      path: string;
      profile_id: MinecraftResourceLocation;
      format_version: number;
      sha256: string;
    }[]
  ];
}
/**
 * Private Studio contract for shared family boards, durable relationships, staged operations, validation, and optimistic conflicts.
 */
export interface KineticBlueprintContract {
  board: Board;
  nodes: Node[];
  edges: Edge[];
  annotations: Annotation[];
  preference: Preference;
  operations?: (
    | {
        type: "add_node";
        record_public_id: string;
        position?: Position;
        group_key?: string | null;
      }
    | {
        type: "move_node";
        record_public_id: string;
        position: Position;
      }
    | {
        type: "remove_node";
        record_public_id: string;
      }
    | {
        type: "upsert_relationship";
        source_public_id: string;
        target_public_id: string;
        relationship_kind:
          | "has_capability"
          | "requires_capability"
          | "assigned_to_job"
          | "operates_at"
          | "constrained_by"
          | "produces_result"
          | "evolves_to";
        metadata: {
          [k: string]: unknown;
        };
        inheritance_decision?: "keep" | "raise" | "lower" | "replace" | "remove" | "add";
        parent_relationship_public_id?: string;
        source_handle?: string;
        target_handle?: string;
      }
    | {
        type: "set_inheritance_decision";
        relationship_public_id: string;
        decision: "keep" | "raise" | "lower" | "replace" | "remove" | "add";
        metadata: {
          [k: string]: unknown;
        };
      }
    | {
        type: "create_stub";
        record_public_id: string;
        record_kind: "capability" | "job" | "work_target" | "condition" | "result";
        display_name: string;
        description?: string;
        position: Position;
      }
    | {
        type: "remove_edge";
        relationship_public_id: string;
      }
    | {
        type: "archive_relationship";
        relationship_public_id: string;
        confirmed: true;
      }
    | {
        type: "add_annotation";
        annotation_kind: "group" | "comment";
        body: string;
        position: Position;
        width?: number;
        height?: number;
        group_key?: string;
      }
    | {
        type: "update_annotation";
        annotation_id: string;
        body?: string;
        position?: Position;
      }
    | {
        type: "remove_annotation";
        annotation_id: string;
      }
    | {
        type: "auto_layout";
      }
    | {
        type: "accept_type_suggestion";
        suggestion_id: string;
        form_public_id: string;
        tier?: number;
        position?: Position;
      }
  )[];
}
export interface Board {
  public_id: string;
  family_public_id: string;
  revision: number;
  checksum: string;
}
export interface Node {
  id: string;
  record_kind: string;
  node_family: "worker" | "capability" | "job" | "worksite" | "interlock" | "result";
  display_name: string;
  workflow_state: "draft" | "in_review" | "approved" | "archived";
  record_revision: number;
  position: Position;
  width?: number | null;
  height?: number | null;
  group_key?: string | null;
  collapsed: boolean;
  national_dex?: number | null;
  /**
   * @maxItems 2
   */
  types?: [] | [string] | [string, string];
  data: {
    [k: string]: unknown;
  };
}
export interface Position {
  x: number;
  y: number;
}
export interface Edge {
  id: string;
  relationship_kind:
    | "has_capability"
    | "requires_capability"
    | "assigned_to_job"
    | "operates_at"
    | "constrained_by"
    | "produces_result"
    | "evolves_to";
  source: string;
  target: string;
  source_handle: string;
  target_handle: string;
  label: string;
  metadata: {
    [k: string]: unknown;
  };
  inheritance_decision?: ("keep" | "raise" | "lower" | "replace" | "remove" | "add") | null;
  inheritance_state: "not_applicable" | "current" | "outdated";
  workflow_state: "draft" | "in_review" | "approved" | "archived";
  record_revision: number;
}
export interface Annotation {
  id: string;
  annotation_kind: "group" | "comment";
  body: string;
  position_x: number;
  position_y: number;
  [k: string]: unknown;
}
export interface Preference {
  viewport: {
    x: number;
    y: number;
    zoom: number;
    [k: string]: unknown;
  };
  filters: {
    [k: string]: unknown;
  };
  hidden_nodes: string[];
  last_view: "overview" | "canvas" | "outline" | "facts" | "discussion";
}
/** Stable application-facing aliases for schema-titled generated declarations. */
export type ResourceLocation = MinecraftResourceLocation;
export type PokemonType = TypeList[number];
export type PublicNamedRecord = PublishedNamedRecord;
export type PublicPokemon = PublishedPokemonRecord;
export type PublicBlueprintRecord = PublishedBlueprintRecord;
export type WorkProfile = CobblemonKineticsWorkProfile;
export type AssetManifestEntry = CobblemonKineticsAssetManifest["assets"][number];
export type AssetManifest = CobblemonKineticsAssetManifest;
export type PublicationBundlePayload = Omit<ApprovedPublicationBundle, "integrity">;
export type PublicationBundle = ApprovedPublicationBundle;
export type PublishedManifestFile = GitPublishedContentManifest["files"][number];
export type PublishedManifest = GitPublishedContentManifest;
export type ModExportManifestFile = ModWorkProfileExportManifest["files"][number];
export type ModExportManifest = ModWorkProfileExportManifest;
