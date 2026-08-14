export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          auth_user_id: string
          created_at: string
          display_name: string | null
          github_login: string
          github_user_id: number
          is_active: boolean
          last_seen_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          display_name?: string | null
          github_login: string
          github_user_id: number
          is_active?: boolean
          last_seen_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          display_name?: string | null
          github_login?: string
          github_user_id?: number
          is_active?: boolean
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_github_user_id_fkey"
            columns: ["github_user_id"]
            isOneToOne: true
            referencedRelation: "editor_allowlist"
            referencedColumns: ["github_user_id"]
          },
        ]
      }
      asset_bindings: {
        Row: {
          aspect_key: string | null
          asset_record_id: string
          created_at: string
          form_key: string | null
          priority: number
          purpose: string
          target_record_id: string
        }
        Insert: {
          aspect_key?: string | null
          asset_record_id: string
          created_at?: string
          form_key?: string | null
          priority?: number
          purpose?: string
          target_record_id: string
        }
        Update: {
          aspect_key?: string | null
          asset_record_id?: string
          created_at?: string
          form_key?: string | null
          priority?: number
          purpose?: string
          target_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_bindings_asset_record_id_fkey"
            columns: ["asset_record_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["record_id"]
          },
          {
            foreignKeyName: "asset_bindings_target_record_id_fkey"
            columns: ["target_record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_reviews: {
        Row: {
          asset_record_id: string
          created_at: string
          decision: string
          id: string
          notes: string
          reviewer_id: string
        }
        Insert: {
          asset_record_id: string
          created_at?: string
          decision: string
          id?: string
          notes?: string
          reviewer_id: string
        }
        Update: {
          asset_record_id?: string
          created_at?: string
          decision?: string
          id?: string
          notes?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_reviews_asset_record_id_fkey"
            columns: ["asset_record_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["record_id"]
          },
        ]
      }
      asset_sources: {
        Row: {
          archive_sha256: string | null
          archive_url: string | null
          attribution_text: string
          created_at: string
          id: string
          is_enabled: boolean
          license_identifier: string | null
          license_url: string | null
          source_mod: string
          source_version: string
          updated_at: string
        }
        Insert: {
          archive_sha256?: string | null
          archive_url?: string | null
          attribution_text?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          license_identifier?: string | null
          license_url?: string | null
          source_mod: string
          source_version: string
          updated_at?: string
        }
        Update: {
          archive_sha256?: string | null
          archive_url?: string | null
          attribution_text?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          license_identifier?: string | null
          license_url?: string | null
          source_mod?: string
          source_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_variants: {
        Row: {
          asset_record_id: string
          bucket_id: string
          content_sha256: string
          created_at: string
          height: number | null
          id: string
          media_type: string
          object_path: string
          transform: Json
          variant_key: string
          width: number | null
        }
        Insert: {
          asset_record_id: string
          bucket_id: string
          content_sha256: string
          created_at?: string
          height?: number | null
          id?: string
          media_type: string
          object_path: string
          transform?: Json
          variant_key: string
          width?: number | null
        }
        Update: {
          asset_record_id?: string
          bucket_id?: string
          content_sha256?: string
          created_at?: string
          height?: number | null
          id?: string
          media_type?: string
          object_path?: string
          transform?: Json
          variant_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_variants_asset_record_id_fkey"
            columns: ["asset_record_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["record_id"]
          },
        ]
      }
      assets: {
        Row: {
          metadata: Json
          permitted_visibility: string
          publication_state: string
          record_id: string
          rights_status: string
          source_entry_path: string | null
          source_id: string | null
          source_sha256: string | null
          stable_key: string
        }
        Insert: {
          metadata?: Json
          permitted_visibility?: string
          publication_state?: string
          record_id: string
          rights_status?: string
          source_entry_path?: string | null
          source_id?: string | null
          source_sha256?: string | null
          stable_key: string
        }
        Update: {
          metadata?: Json
          permitted_visibility?: string
          publication_state?: string
          record_id?: string
          rights_status?: string
          source_entry_path?: string | null
          source_id?: string | null
          source_sha256?: string | null
          stable_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "asset_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_revision: number | null
          before_revision: number | null
          created_at: string
          id: number
          metadata: Json
          record_id: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_revision?: number | null
          before_revision?: number | null
          created_at?: string
          id?: never
          metadata?: Json
          record_id?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_revision?: number | null
          before_revision?: number | null
          created_at?: string
          id?: never
          metadata?: Json
          record_id?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          record_id: string
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          record_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          record_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      compatibility_sets: {
        Row: {
          cobblemon_version: string
          create_version: string
          created_at: string
          display_name: string
          generation_max: number
          generation_min: number
          id: string
          is_active: boolean
          minecraft_version: string
          mod_version: string | null
          public_id: string
          updated_at: string
        }
        Insert: {
          cobblemon_version: string
          create_version: string
          created_at?: string
          display_name: string
          generation_max: number
          generation_min: number
          id?: string
          is_active?: boolean
          minecraft_version: string
          mod_version?: string | null
          public_id: string
          updated_at?: string
        }
        Update: {
          cobblemon_version?: string
          create_version?: string
          created_at?: string
          display_name?: string
          generation_max?: number
          generation_min?: number
          id?: string
          is_active?: boolean
          minecraft_version?: string
          mod_version?: string | null
          public_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibility_sets_generation_max_fkey"
            columns: ["generation_max"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_sets_generation_min_fkey"
            columns: ["generation_min"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      editor_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          github_login: string
          github_user_id: number
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          github_login: string
          github_user_id: number
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          github_login?: string
          github_user_id?: number
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      generations: {
        Row: {
          created_at: string
          display_name: string
          id: number
          identifier: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: number
          identifier: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      import_field_reviews: {
        Row: {
          classification: string
          created_at: string
          field_name: string
          id: number
          import_row_id: number
          normalized_value: Json | null
          raw_value: Json | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          classification: string
          created_at?: string
          field_name: string
          id?: never
          import_row_id: number
          normalized_value?: Json | null
          raw_value?: Json | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          classification?: string
          created_at?: string
          field_name?: string
          id?: never
          import_row_id?: number
          normalized_value?: Json | null
          raw_value?: Json | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_field_reviews_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: false
            referencedRelation: "import_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          id: number
          import_run_id: string
          normalized_data: Json
          row_fingerprint: string
          sheet_name: string
          source_row: number
          stable_key: string | null
          status: string
          transformations: Json
        }
        Insert: {
          created_at?: string
          id?: never
          import_run_id: string
          normalized_data?: Json
          row_fingerprint: string
          sheet_name: string
          source_row: number
          stable_key?: string | null
          status: string
          transformations?: Json
        }
        Update: {
          created_at?: string
          id?: never
          import_run_id?: string
          normalized_data?: Json
          row_fingerprint?: string
          sheet_name?: string
          source_row?: number
          stable_key?: string | null
          status?: string
          transformations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          importer_version: string
          schema_version: string
          source_filename: string
          source_kind: string
          source_sha256: string
          started_at: string | null
          status: string
          summary: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          importer_version: string
          schema_version: string
          source_filename: string
          source_kind: string
          source_sha256: string
          started_at?: string | null
          status?: string
          summary?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          importer_version?: string
          schema_version?: string
          source_filename?: string
          source_kind?: string
          source_sha256?: string
          started_at?: string | null
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      jobs: {
        Row: {
          adapter_id: string
          capability_ids: string[]
          category: string
          constraints: Json
          description: string
          record_id: string
          required_type_id: string | null
        }
        Insert: {
          adapter_id: string
          capability_ids?: string[]
          category: string
          constraints?: Json
          description?: string
          record_id: string
          required_type_id?: string | null
        }
        Update: {
          adapter_id?: string
          capability_ids?: string[]
          category?: string
          constraints?: Json
          description?: string
          record_id?: string
          required_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_required_type_id_fkey"
            columns: ["required_type_id"]
            isOneToOne: false
            referencedRelation: "pokemon_types"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_components: {
        Row: {
          is_primary: boolean
          machine_record_id: string
          position: number
          purpose: string
          registry_record_id: string
        }
        Insert: {
          is_primary?: boolean
          machine_record_id: string
          position?: number
          purpose?: string
          registry_record_id: string
        }
        Update: {
          is_primary?: boolean
          machine_record_id?: string
          position?: number
          purpose?: string
          registry_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_components_machine_record_id_fkey"
            columns: ["machine_record_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["record_id"]
          },
          {
            foreignKeyName: "machine_components_registry_record_id_fkey"
            columns: ["registry_record_id"]
            isOneToOne: false
            referencedRelation: "registry_entries"
            referencedColumns: ["record_id"]
          },
        ]
      }
      machines: {
        Row: {
          description: string
          evidence_state: string
          lifecycle_state: string
          metadata: Json
          record_id: string
        }
        Insert: {
          description?: string
          evidence_state?: string
          lifecycle_state?: string
          metadata?: Json
          record_id: string
        }
        Update: {
          description?: string
          evidence_state?: string
          lifecycle_state?: string
          metadata?: Json
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      pokemon_form_types: {
        Row: {
          compatibility_set_id: string
          created_at: string
          form_record_id: string
          slot: number
          type_id: string
          typing_context: string
        }
        Insert: {
          compatibility_set_id: string
          created_at?: string
          form_record_id: string
          slot: number
          type_id: string
          typing_context: string
        }
        Update: {
          compatibility_set_id?: string
          created_at?: string
          form_record_id?: string
          slot?: number
          type_id?: string
          typing_context?: string
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_form_types_compatibility_set_id_fkey"
            columns: ["compatibility_set_id"]
            isOneToOne: false
            referencedRelation: "compatibility_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_form_types_form_record_id_fkey"
            columns: ["form_record_id"]
            isOneToOne: false
            referencedRelation: "pokemon_forms"
            referencedColumns: ["record_id"]
          },
          {
            foreignKeyName: "pokemon_form_types_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "pokemon_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pokemon_forms: {
        Row: {
          abilities: string[]
          aspects: string[]
          attributes: Json
          base_stats: Json
          cobblemon_form_id: string
          form_key: string
          is_default: boolean
          record_id: string
          species_record_id: string
        }
        Insert: {
          abilities?: string[]
          aspects?: string[]
          attributes?: Json
          base_stats?: Json
          cobblemon_form_id: string
          form_key: string
          is_default?: boolean
          record_id: string
          species_record_id: string
        }
        Update: {
          abilities?: string[]
          aspects?: string[]
          attributes?: Json
          base_stats?: Json
          cobblemon_form_id?: string
          form_key?: string
          is_default?: boolean
          record_id?: string
          species_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_forms_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_forms_species_record_id_fkey"
            columns: ["species_record_id"]
            isOneToOne: false
            referencedRelation: "pokemon_species"
            referencedColumns: ["record_id"]
          },
        ]
      }
      pokemon_species: {
        Row: {
          api_slug: string
          base_friendship: number | null
          capture_rate: number | null
          cobblemon_species_id: string
          color: string | null
          generation_id: number
          genus: string | null
          growth_rate: string | null
          habitat: string | null
          height_decimeters: number | null
          is_legendary: boolean
          is_mythical: boolean
          national_dex: number
          record_id: string
          shape: string | null
          source_data: Json
          weight_hectograms: number | null
        }
        Insert: {
          api_slug: string
          base_friendship?: number | null
          capture_rate?: number | null
          cobblemon_species_id: string
          color?: string | null
          generation_id: number
          genus?: string | null
          growth_rate?: string | null
          habitat?: string | null
          height_decimeters?: number | null
          is_legendary?: boolean
          is_mythical?: boolean
          national_dex: number
          record_id: string
          shape?: string | null
          source_data?: Json
          weight_hectograms?: number | null
        }
        Update: {
          api_slug?: string
          base_friendship?: number | null
          capture_rate?: number | null
          cobblemon_species_id?: string
          color?: string | null
          generation_id?: number
          genus?: string | null
          growth_rate?: string | null
          habitat?: string | null
          height_decimeters?: number | null
          is_legendary?: boolean
          is_mythical?: boolean
          national_dex?: number
          record_id?: string
          shape?: string | null
          source_data?: Json
          weight_hectograms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_species_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_species_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      pokemon_types: {
        Row: {
          color_hex: string | null
          created_at: string
          display_name: string
          id: string
          identifier: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          display_name: string
          id?: string
          identifier: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          display_name?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      pokemon_work_assignments: {
        Row: {
          compatibility_set_id: string
          created_at: string
          created_by: string | null
          efficiency_multiplier: number
          form_record_id: string
          id: string
          internal_notes: string
          public_rationale: string
          status: string
          updated_at: string
          updated_by: string | null
          work_profile_record_id: string
        }
        Insert: {
          compatibility_set_id: string
          created_at?: string
          created_by?: string | null
          efficiency_multiplier?: number
          form_record_id: string
          id?: string
          internal_notes?: string
          public_rationale?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_profile_record_id: string
        }
        Update: {
          compatibility_set_id?: string
          created_at?: string
          created_by?: string | null
          efficiency_multiplier?: number
          form_record_id?: string
          id?: string
          internal_notes?: string
          public_rationale?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_profile_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_work_assignments_compatibility_set_id_fkey"
            columns: ["compatibility_set_id"]
            isOneToOne: false
            referencedRelation: "compatibility_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_work_assignments_form_record_id_fkey"
            columns: ["form_record_id"]
            isOneToOne: false
            referencedRelation: "pokemon_forms"
            referencedColumns: ["record_id"]
          },
          {
            foreignKeyName: "pokemon_work_assignments_work_profile_record_id_fkey"
            columns: ["work_profile_record_id"]
            isOneToOne: false
            referencedRelation: "work_profiles"
            referencedColumns: ["record_id"]
          },
        ]
      }
      publication_batch_records: {
        Row: {
          batch_id: string
          checksum: string
          public_projection: Json
          record_id: string
          revision_number: number
        }
        Insert: {
          batch_id: string
          checksum: string
          public_projection: Json
          record_id: string
          revision_number: number
        }
        Update: {
          batch_id?: string
          checksum?: string
          public_projection?: Json
          record_id?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "publication_batch_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "publication_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_batch_records_record_id_revision_number_fkey"
            columns: ["record_id", "revision_number"]
            isOneToOne: false
            referencedRelation: "record_revisions"
            referencedColumns: ["record_id", "revision_number"]
          },
        ]
      }
      publication_batches: {
        Row: {
          content_hash: string | null
          created_at: string
          created_by: string | null
          exported_at: string | null
          exported_by: string | null
          git_commit_sha: string | null
          id: string
          notes: string
          public_id: string
          published_at: string | null
          published_by: string | null
          published_manifest: Json | null
          schema_version: string
          state: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          exported_at?: string | null
          exported_by?: string | null
          git_commit_sha?: string | null
          id?: string
          notes?: string
          public_id: string
          published_at?: string | null
          published_by?: string | null
          published_manifest?: Json | null
          schema_version: string
          state?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          exported_at?: string | null
          exported_by?: string | null
          git_commit_sha?: string | null
          id?: string
          notes?: string
          public_id?: string
          published_at?: string | null
          published_by?: string | null
          published_manifest?: Json | null
          schema_version?: string
          state?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      record_aliases: {
        Row: {
          alias_slug: string
          created_at: string
          created_by: string | null
          id: string
          record_id: string
        }
        Insert: {
          alias_slug: string
          created_at?: string
          created_by?: string | null
          id?: string
          record_id: string
        }
        Update: {
          alias_slug?: string
          created_at?: string
          created_by?: string | null
          id?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_aliases_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      record_revisions: {
        Row: {
          actor_id: string | null
          change_summary: string | null
          checksum: string
          client_mutation_id: string | null
          created_at: string
          id: string
          record_id: string
          revision_number: number
          schema_version: string
          snapshot: Json
        }
        Insert: {
          actor_id?: string | null
          change_summary?: string | null
          checksum: string
          client_mutation_id?: string | null
          created_at?: string
          id?: string
          record_id: string
          revision_number: number
          schema_version: string
          snapshot: Json
        }
        Update: {
          actor_id?: string | null
          change_summary?: string | null
          checksum?: string
          client_mutation_id?: string | null
          created_at?: string
          id?: string
          record_id?: string
          revision_number?: number
          schema_version?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "record_revisions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_revision: number | null
          archived_at: string | null
          checksum: string
          content: Json
          created_at: string
          created_by: string | null
          current_revision: number
          display_name: string
          id: string
          public_id: string
          record_kind: string
          schema_version: string
          search_document: unknown
          slug: string
          updated_at: string
          updated_by: string | null
          workflow_state: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_revision?: number | null
          archived_at?: string | null
          checksum?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          current_revision?: number
          display_name: string
          id?: string
          public_id: string
          record_kind: string
          schema_version?: string
          search_document?: unknown
          slug: string
          updated_at?: string
          updated_by?: string | null
          workflow_state?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_revision?: number | null
          archived_at?: string | null
          checksum?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          current_revision?: number
          display_name?: string
          id?: string
          public_id?: string
          record_kind?: string
          schema_version?: string
          search_document?: unknown
          slug?: string
          updated_at?: string
          updated_by?: string | null
          workflow_state?: string
        }
        Relationships: []
      }
      registry_entries: {
        Row: {
          introduced_version: string | null
          lifecycle_state: string
          metadata: Json
          record_id: string
          registry_kind: string
          removed_version: string | null
          resource_location: string
          source_mod: string
        }
        Insert: {
          introduced_version?: string | null
          lifecycle_state?: string
          metadata?: Json
          record_id: string
          registry_kind: string
          removed_version?: string | null
          resource_location: string
          source_mod: string
        }
        Update: {
          introduced_version?: string | null
          lifecycle_state?: string
          metadata?: Json
          record_id?: string
          registry_kind?: string
          removed_version?: string | null
          resource_location?: string
          source_mod?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_entries_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      source_references: {
        Row: {
          created_at: string
          field_path: string | null
          id: string
          is_verified: boolean
          license_identifier: string | null
          license_url: string | null
          notes: string
          record_id: string | null
          source_kind: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string
          field_path?: string | null
          id?: string
          is_verified?: boolean
          license_identifier?: string | null
          license_url?: string | null
          notes?: string
          record_id?: string | null
          source_kind: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string
          field_path?: string | null
          id?: string
          is_verified?: boolean
          license_identifier?: string | null
          license_url?: string | null
          notes?: string
          record_id?: string | null
          source_kind?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_references_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_assignees: {
        Row: {
          assigned_by: string | null
          assignee_id: string
          created_at: string
          work_item_record_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignee_id: string
          created_at?: string
          work_item_record_id: string
        }
        Update: {
          assigned_by?: string | null
          assignee_id?: string
          created_at?: string
          work_item_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_assignees_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "work_item_assignees_work_item_record_id_fkey"
            columns: ["work_item_record_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["record_id"]
          },
        ]
      }
      work_items: {
        Row: {
          created_at: string
          due_date: string | null
          handoff_note: string
          labels: string[]
          priority: string
          record_id: string
          source_key: string | null
          status: string
          suggested_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          handoff_note?: string
          labels?: string[]
          priority?: string
          record_id: string
          source_key?: string | null
          status?: string
          suggested_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          handoff_note?: string
          labels?: string[]
          priority?: string
          record_id?: string
          source_key?: string | null
          status?: string
          suggested_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      work_profiles: {
        Row: {
          adapter_id: string
          balance: Json
          compatibility_set_id: string
          job_record_id: string
          machine_record_id: string | null
          maximum_efficiency: number
          minimum_efficiency: number
          outputs: Json
          record_id: string
          requirements: Json
          selector: Json
        }
        Insert: {
          adapter_id: string
          balance?: Json
          compatibility_set_id: string
          job_record_id: string
          machine_record_id?: string | null
          maximum_efficiency?: number
          minimum_efficiency?: number
          outputs?: Json
          record_id: string
          requirements?: Json
          selector?: Json
        }
        Update: {
          adapter_id?: string
          balance?: Json
          compatibility_set_id?: string
          job_record_id?: string
          machine_record_id?: string | null
          maximum_efficiency?: number
          minimum_efficiency?: number
          outputs?: Json
          record_id?: string
          requirements?: Json
          selector?: Json
        }
        Relationships: [
          {
            foreignKeyName: "work_profiles_compatibility_set_id_fkey"
            columns: ["compatibility_set_id"]
            isOneToOne: false
            referencedRelation: "compatibility_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_profiles_job_record_id_fkey"
            columns: ["job_record_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["record_id"]
          },
          {
            foreignKeyName: "work_profiles_machine_record_id_fkey"
            columns: ["machine_record_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["record_id"]
          },
          {
            foreignKeyName: "work_profiles_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_record_revision: {
        Args: { p_expected_revision: number; p_public_id: string }
        Returns: Json
      }
      claim_editor_access: { Args: never; Returns: Json }
      create_squirtle_publication_batch: {
        Args: { p_expected_revision: number }
        Returns: Json
      }
      get_editor_record: { Args: { p_public_id: string }; Returns: Json }
      get_publication_bundle: {
        Args: { p_publication_id: string }
        Returns: Json
      }
      reconcile_publication_commit: {
        Args: {
          p_actor_id: string
          p_git_commit_sha: string
          p_manifest: Json
          p_publication_id: string
        }
        Returns: Json
      }
      save_record_revision: {
        Args: {
          p_client_mutation_id: string
          p_expected_revision: number
          p_patch: Json
          p_public_id: string
        }
        Returns: Json
      }
      validate_publication_batch: {
        Args: { p_publication_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "viewer" | "editor" | "maintainer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["viewer", "editor", "maintainer"],
    },
  },
} as const
