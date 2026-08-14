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
      kind: "pokemon_collection" | "job" | "machine" | "work_profile" | "asset_manifest";
      record_count: number;
    },
    ...{
      path: string;
      sha256: string;
      kind: "pokemon_collection" | "job" | "machine" | "work_profile" | "asset_manifest";
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
/** Stable application-facing aliases for schema-titled generated declarations. */
export type ResourceLocation = MinecraftResourceLocation;
export type PokemonType = TypeList[number];
export type PublicNamedRecord = PublishedNamedRecord;
export type PublicPokemon = PublishedPokemonRecord;
export type WorkProfile = CobblemonKineticsWorkProfile;
export type AssetManifestEntry = CobblemonKineticsAssetManifest["assets"][number];
export type AssetManifest = CobblemonKineticsAssetManifest;
export type PublicationBundlePayload = Omit<ApprovedPublicationBundle, "integrity">;
export type PublicationBundle = ApprovedPublicationBundle;
export type PublishedManifestFile = GitPublishedContentManifest["files"][number];
export type PublishedManifest = GitPublishedContentManifest;
export type ModExportManifestFile = ModWorkProfileExportManifest["files"][number];
export type ModExportManifest = ModWorkProfileExportManifest;
