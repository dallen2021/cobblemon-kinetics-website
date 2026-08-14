begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public;

-- New objects are opt-in to the Data API. Keep this explicit even on projects
-- created before Supabase changed the platform default in 2026.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

create type public.app_role as enum ('viewer', 'editor', 'maintainer');

create table public.editor_allowlist (
  github_user_id bigint primary key check (github_user_id > 0),
  github_login text not null check (github_login ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$'),
  display_name text,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index editor_allowlist_github_login_lower_uidx
  on public.editor_allowlist (lower(github_login));

create table public.app_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  github_user_id bigint not null unique references public.editor_allowlist(github_user_id) on update cascade,
  github_login text not null check (github_login ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$'),
  display_name text,
  role public.app_role not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index app_users_github_login_lower_uidx
  on public.app_users (lower(github_login));
create index app_users_active_role_idx
  on public.app_users (is_active, role);

create table public.records (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique
    check (public_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  record_kind text not null check (record_kind in (
    'pokemon_species', 'pokemon_form', 'registry_entry', 'job', 'machine',
    'work_profile', 'work_item', 'asset', 'type_workshop', 'pokemon_idea'
  )),
  workflow_state text not null default 'draft'
    check (workflow_state in ('draft', 'in_review', 'approved', 'archived')),
  schema_version text not null default '1.0.0'
    check (schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$'),
  current_revision bigint not null default 0 check (current_revision >= 0),
  approved_revision bigint check (approved_revision is null or approved_revision between 0 and current_revision),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  checksum text not null default repeat('0', 64) check (checksum ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(display_name, '') || ' ' || coalesce(public_id, '') || ' ' || coalesce(slug, '')
    )
  ) stored,
  check ((workflow_state = 'approved') = (approved_revision is not null and approved_at is not null)
    or workflow_state <> 'approved')
);

create index records_kind_state_updated_idx
  on public.records (record_kind, workflow_state, updated_at desc);
create index records_search_document_idx
  on public.records using gin (search_document);
create index records_display_name_trgm_idx
  on public.records using gin (display_name extensions.gin_trgm_ops);
create index records_updated_by_idx on public.records (updated_by);
create index records_approved_by_idx on public.records (approved_by);

create table public.record_aliases (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records(id) on delete cascade,
  alias_slug text not null unique check (alias_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index record_aliases_record_id_idx on public.record_aliases (record_id);
create index record_aliases_created_by_idx on public.record_aliases (created_by);

create table public.record_revisions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records(id) on delete restrict,
  revision_number bigint not null check (revision_number > 0),
  schema_version text not null check (schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  actor_id uuid references auth.users(id) on delete set null,
  client_mutation_id uuid,
  change_summary text check (change_summary is null or length(change_summary) <= 500),
  created_at timestamptz not null default now(),
  unique (record_id, revision_number)
);
create index record_revisions_record_created_idx
  on public.record_revisions (record_id, created_at desc);
create index record_revisions_actor_id_idx on public.record_revisions (actor_id);
create unique index record_revisions_client_mutation_uidx
  on public.record_revisions (record_id, actor_id, client_mutation_id)
  where client_mutation_id is not null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  record_id uuid references public.records(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  before_revision bigint,
  after_revision bigint,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_events_record_created_idx
  on public.audit_events (record_id, created_at desc);
create index audit_events_actor_created_idx
  on public.audit_events (actor_id, created_at desc);

create table public.generations (
  id smallint primary key check (id between 1 and 99),
  identifier text not null unique check (identifier ~ '^[a-z0-9_]+$'),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.pokemon_types (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique check (identifier ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null,
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.compatibility_sets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  display_name text not null,
  minecraft_version text not null,
  cobblemon_version text not null,
  create_version text not null,
  mod_version text,
  generation_min smallint not null references public.generations(id) on delete restrict,
  generation_max smallint not null references public.generations(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (generation_min <= generation_max)
);
create index compatibility_sets_generation_min_idx on public.compatibility_sets (generation_min);
create index compatibility_sets_generation_max_idx on public.compatibility_sets (generation_max);

create table public.pokemon_species (
  record_id uuid primary key references public.records(id) on delete restrict,
  national_dex integer not null unique check (national_dex > 0),
  generation_id smallint not null references public.generations(id) on delete restrict,
  cobblemon_species_id text not null unique
    check (cobblemon_species_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  api_slug text not null unique check (api_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  genus text,
  habitat text,
  height_decimeters integer check (height_decimeters is null or height_decimeters >= 0),
  weight_hectograms integer check (weight_hectograms is null or weight_hectograms >= 0),
  capture_rate integer check (capture_rate is null or capture_rate between 0 and 255),
  base_friendship integer check (base_friendship is null or base_friendship between 0 and 255),
  growth_rate text,
  shape text,
  color text,
  is_legendary boolean not null default false,
  is_mythical boolean not null default false,
  source_data jsonb not null default '{}'::jsonb check (jsonb_typeof(source_data) = 'object')
);
create index pokemon_species_generation_id_idx on public.pokemon_species (generation_id);

create table public.pokemon_forms (
  record_id uuid primary key references public.records(id) on delete restrict,
  species_record_id uuid not null references public.pokemon_species(record_id) on delete restrict,
  cobblemon_form_id text not null unique
    check (cobblemon_form_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  form_key text not null check (form_key ~ '^[a-z0-9_./-]+$'),
  is_default boolean not null default false,
  aspects text[] not null default '{}',
  base_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(base_stats) = 'object'),
  abilities text[] not null default '{}',
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  unique (species_record_id, form_key)
);
create unique index pokemon_forms_one_default_per_species_uidx
  on public.pokemon_forms (species_record_id) where is_default;
create index pokemon_forms_species_record_id_idx on public.pokemon_forms (species_record_id);

create table public.pokemon_form_types (
  form_record_id uuid not null references public.pokemon_forms(record_id) on delete cascade,
  compatibility_set_id uuid not null references public.compatibility_sets(id) on delete restrict,
  typing_context text not null check (typing_context in ('current', 'original_gen_i')),
  type_id uuid not null references public.pokemon_types(id) on delete restrict,
  slot smallint not null check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  primary key (form_record_id, compatibility_set_id, typing_context, slot),
  unique (form_record_id, compatibility_set_id, typing_context, type_id)
);
create index pokemon_form_types_compatibility_set_id_idx
  on public.pokemon_form_types (compatibility_set_id);
create index pokemon_form_types_type_id_idx on public.pokemon_form_types (type_id);

create table public.registry_entries (
  record_id uuid primary key references public.records(id) on delete restrict,
  registry_kind text not null check (registry_kind in ('block', 'item', 'entity', 'fluid', 'tag')),
  resource_location text not null
    check (resource_location ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  source_mod text not null check (source_mod ~ '^[a-z0-9_.-]+$'),
  introduced_version text,
  removed_version text,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('candidate', 'active', 'deprecated', 'removed')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (registry_kind, resource_location)
);
create index registry_entries_source_lifecycle_idx
  on public.registry_entries (source_mod, lifecycle_state);

create table public.jobs (
  record_id uuid primary key references public.records(id) on delete restrict,
  category text not null check (category ~ '^[a-z][a-z0-9_]*$'),
  description text not null default '',
  required_type_id uuid references public.pokemon_types(id) on delete restrict,
  capability_ids text[] not null default '{}',
  adapter_id text not null check (adapter_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  constraints jsonb not null default '{}'::jsonb check (jsonb_typeof(constraints) = 'object')
);
create index jobs_required_type_id_idx on public.jobs (required_type_id);

create table public.machines (
  record_id uuid primary key references public.records(id) on delete restrict,
  description text not null default '',
  lifecycle_state text not null default 'candidate'
    check (lifecycle_state in ('candidate', 'prototype', 'supported', 'deprecated', 'removed')),
  evidence_state text not null default 'unverified'
    check (evidence_state in ('unverified', 'documented', 'tested')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create table public.machine_components (
  machine_record_id uuid not null references public.machines(record_id) on delete cascade,
  registry_record_id uuid not null references public.registry_entries(record_id) on delete restrict,
  purpose text not null default '',
  is_primary boolean not null default false,
  position smallint not null default 0 check (position >= 0),
  primary key (machine_record_id, registry_record_id)
);
create index machine_components_registry_record_id_idx
  on public.machine_components (registry_record_id);
create unique index machine_components_one_primary_uidx
  on public.machine_components (machine_record_id) where is_primary;

create table public.work_profiles (
  record_id uuid primary key references public.records(id) on delete restrict,
  job_record_id uuid not null references public.jobs(record_id) on delete restrict,
  machine_record_id uuid references public.machines(record_id) on delete restrict,
  compatibility_set_id uuid not null references public.compatibility_sets(id) on delete restrict,
  adapter_id text not null check (adapter_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  selector jsonb not null default '{}'::jsonb check (jsonb_typeof(selector) = 'object'),
  requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(requirements) = 'object'),
  outputs jsonb not null default '{}'::jsonb check (jsonb_typeof(outputs) = 'object'),
  balance jsonb not null default '{}'::jsonb check (jsonb_typeof(balance) = 'object'),
  minimum_efficiency numeric(8,4) not null default 0 check (minimum_efficiency >= 0),
  maximum_efficiency numeric(8,4) not null default 4 check (maximum_efficiency > 0),
  check (minimum_efficiency <= maximum_efficiency)
);
create index work_profiles_job_record_id_idx on public.work_profiles (job_record_id);
create index work_profiles_machine_record_id_idx on public.work_profiles (machine_record_id);
create index work_profiles_compatibility_set_id_idx on public.work_profiles (compatibility_set_id);
create index work_profiles_selector_gin_idx
  on public.work_profiles using gin (selector jsonb_path_ops);

create table public.pokemon_work_assignments (
  id uuid primary key default gen_random_uuid(),
  form_record_id uuid not null references public.pokemon_forms(record_id) on delete restrict,
  work_profile_record_id uuid not null references public.work_profiles(record_id) on delete restrict,
  compatibility_set_id uuid not null references public.compatibility_sets(id) on delete restrict,
  efficiency_multiplier numeric(8,4) not null default 1 check (efficiency_multiplier between 0 and 4),
  public_rationale text not null default '',
  internal_notes text not null default '',
  status text not null default 'active' check (status in ('candidate', 'active', 'disabled')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_record_id, work_profile_record_id, compatibility_set_id)
);
create index pokemon_work_assignments_profile_idx
  on public.pokemon_work_assignments (work_profile_record_id);
create index pokemon_work_assignments_compatibility_idx
  on public.pokemon_work_assignments (compatibility_set_id);
create index pokemon_work_assignments_updated_by_idx
  on public.pokemon_work_assignments (updated_by);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 10000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((resolved_at is null) = (resolved_by is null))
);
create index comments_record_created_idx on public.comments (record_id, created_at);
create index comments_author_id_idx on public.comments (author_id);
create index comments_resolved_by_idx on public.comments (resolved_by);

create table public.publication_batches (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^publication-[0-9]{8}-[a-z0-9-]+$'),
  state text not null default 'draft'
    check (state in ('draft', 'validated', 'exported', 'published', 'superseded', 'rolled_back')),
  schema_version text not null check (schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$'),
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  git_commit_sha text check (git_commit_sha is null or git_commit_sha ~ '^[0-9a-f]{40}$'),
  published_manifest jsonb check (
    published_manifest is null or jsonb_typeof(published_manifest) = 'object'
  ),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  exported_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  exported_at timestamptz,
  published_at timestamptz,
  check (
    state <> 'published'
    or (
      content_hash is not null
      and git_commit_sha is not null
      and published_manifest is not null
      and published_by is not null
      and published_at is not null
    )
  )
);
create unique index publication_batches_content_hash_uidx
  on public.publication_batches (content_hash) where content_hash is not null;
create index publication_batches_state_created_idx
  on public.publication_batches (state, created_at desc);
create index publication_batches_created_by_idx on public.publication_batches (created_by);

create table public.publication_batch_records (
  batch_id uuid not null references public.publication_batches(id) on delete cascade,
  record_id uuid not null,
  revision_number bigint not null,
  public_projection jsonb not null check (jsonb_typeof(public_projection) = 'object'),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  primary key (batch_id, record_id),
  foreign key (record_id, revision_number)
    references public.record_revisions(record_id, revision_number) on delete restrict
);
create index publication_batch_records_record_revision_idx
  on public.publication_batch_records (record_id, revision_number);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('xlsx', 'csv', 'json', 'git_snapshot')),
  source_filename text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  importer_version text not null,
  schema_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'dry_run', 'applying', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index import_runs_source_hash_idx on public.import_runs (source_sha256);
create index import_runs_status_created_idx on public.import_runs (status, created_at desc);
create index import_runs_created_by_idx on public.import_runs (created_by);

create table public.import_rows (
  id bigint generated always as identity primary key,
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  sheet_name text not null,
  source_row integer not null check (source_row > 0),
  stable_key text,
  row_fingerprint text not null check (row_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null check (status in (
    'imported', 'updated', 'unchanged', 'skipped', 'invalid', 'ambiguous',
    'manual_review', 'quarantined', 'duplicate', 'unsupported'
  )),
  normalized_data jsonb not null default '{}'::jsonb check (jsonb_typeof(normalized_data) = 'object'),
  transformations jsonb not null default '[]'::jsonb check (jsonb_typeof(transformations) = 'array'),
  created_at timestamptz not null default now(),
  unique (import_run_id, sheet_name, source_row)
);
create unique index import_rows_stable_key_uidx
  on public.import_rows (import_run_id, sheet_name, stable_key) where stable_key is not null;
create index import_rows_status_idx on public.import_rows (import_run_id, status);

create table public.import_field_reviews (
  id bigint generated always as identity primary key,
  import_row_id bigint not null references public.import_rows(id) on delete cascade,
  field_name text not null,
  classification text not null check (classification in (
    'ambiguous', 'quarantined', 'unsupported', 'overwrite_conflict', 'invalid'
  )),
  raw_value jsonb,
  normalized_value jsonb,
  reason text not null,
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((resolved_at is null) = (resolved_by is null))
);
create index import_field_reviews_row_idx on public.import_field_reviews (import_row_id);
create index import_field_reviews_unresolved_idx
  on public.import_field_reviews (classification, created_at) where resolved_at is null;
create index import_field_reviews_resolved_by_idx on public.import_field_reviews (resolved_by);

create table public.source_references (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references public.records(id) on delete cascade,
  source_kind text not null,
  url text,
  title text not null,
  field_path text,
  license_identifier text,
  license_url text,
  is_verified boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index source_references_record_id_idx on public.source_references (record_id);

create table public.asset_sources (
  id uuid primary key default gen_random_uuid(),
  source_mod text not null,
  source_version text not null,
  archive_url text,
  archive_sha256 text check (archive_sha256 is null or archive_sha256 ~ '^[0-9a-f]{64}$'),
  license_identifier text,
  license_url text,
  attribution_text text not null default '',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_mod, source_version)
);

create table public.assets (
  record_id uuid primary key references public.records(id) on delete restrict,
  source_id uuid references public.asset_sources(id) on delete restrict,
  stable_key text not null unique check (stable_key ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$'),
  source_entry_path text,
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  rights_status text not null default 'candidate'
    check (rights_status in ('candidate', 'needs_review', 'approved', 'rejected')),
  permitted_visibility text not null default 'private'
    check (permitted_visibility in ('private', 'public')),
  publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'withdrawn')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (publication_state <> 'published' or (rights_status = 'approved' and permitted_visibility = 'public'))
);
create index assets_source_id_idx on public.assets (source_id);
create index assets_rights_publication_idx
  on public.assets (rights_status, permitted_visibility, publication_state);

create table public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  asset_record_id uuid not null references public.assets(record_id) on delete cascade,
  variant_key text not null check (variant_key ~ '^[a-z0-9_-]+$'),
  bucket_id text not null,
  object_path text not null check (object_path !~ '(^|/)\.\.?(/|$)'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  media_type text not null,
  transform jsonb not null default '{}'::jsonb check (jsonb_typeof(transform) = 'object'),
  created_at timestamptz not null default now(),
  unique (asset_record_id, variant_key),
  unique (bucket_id, object_path)
);
create index asset_variants_asset_record_id_idx on public.asset_variants (asset_record_id);

create table public.asset_bindings (
  asset_record_id uuid not null references public.assets(record_id) on delete cascade,
  target_record_id uuid not null references public.records(id) on delete cascade,
  form_key text,
  aspect_key text,
  purpose text not null default 'primary',
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (asset_record_id, target_record_id, purpose)
);
create index asset_bindings_target_record_id_idx on public.asset_bindings (target_record_id);

create table public.asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_record_id uuid not null references public.assets(record_id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'needs_review')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index asset_reviews_asset_created_idx
  on public.asset_reviews (asset_record_id, created_at desc);
create index asset_reviews_reviewer_id_idx on public.asset_reviews (reviewer_id);

create table public.work_items (
  record_id uuid primary key references public.records(id) on delete restrict,
  status text not null default 'backlog'
    check (status in ('backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  suggested_by uuid references auth.users(id) on delete set null,
  handoff_note text not null default '',
  due_date date,
  labels text[] not null default '{}',
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_items_status_priority_idx on public.work_items (status, priority);
create index work_items_suggested_by_idx on public.work_items (suggested_by);

create table public.work_item_assignees (
  work_item_record_id uuid not null references public.work_items(record_id) on delete cascade,
  assignee_id uuid not null references public.app_users(auth_user_id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (work_item_record_id, assignee_id)
);
create index work_item_assignees_assignee_id_idx on public.work_item_assignees (assignee_id);
create index work_item_assignees_assigned_by_idx on public.work_item_assignees (assigned_by);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function private.prepare_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  new.checksum := encode(extensions.digest(new.content::text, 'sha256'), 'hex');
  return new;
end;
$$;

create trigger records_prepare_before_write
before insert or update on public.records
for each row execute function private.prepare_record();

create trigger editor_allowlist_set_updated_at
before update on public.editor_allowlist
for each row execute function private.set_updated_at();
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function private.set_updated_at();
create trigger compatibility_sets_set_updated_at
before update on public.compatibility_sets
for each row execute function private.set_updated_at();
create trigger pokemon_work_assignments_set_updated_at
before update on public.pokemon_work_assignments
for each row execute function private.set_updated_at();
create trigger comments_set_updated_at
before update on public.comments
for each row execute function private.set_updated_at();
create trigger asset_sources_set_updated_at
before update on public.asset_sources
for each row execute function private.set_updated_at();
create trigger work_items_set_updated_at
before update on public.work_items
for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.prepare_record() from public, anon, authenticated, service_role;

commit;
