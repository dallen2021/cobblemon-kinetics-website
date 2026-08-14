-- Local-only, rights-safe fixture data. No real collaborator or Auth identity
-- is seeded; access is granted explicitly with the access:grant workflow.

insert into public.generations (id, identifier, display_name)
values (1, 'generation_i', 'Generation I')
on conflict (id) do update
set identifier = excluded.identifier,
    display_name = excluded.display_name;

insert into public.pokemon_types (id, identifier, display_name, color_hex)
values ('00000000-0000-4000-8000-000000000701', 'water', 'Water', '#3B82C4')
on conflict (id) do update
set identifier = excluded.identifier,
    display_name = excluded.display_name,
    color_hex = excluded.color_hex;

insert into public.compatibility_sets (
  id,
  public_id,
  display_name,
  minecraft_version,
  cobblemon_version,
  create_version,
  mod_version,
  generation_min,
  generation_max,
  is_active
) values (
  '00000000-0000-4000-8000-000000000702',
  'cobblemon_kinetics:mc_1_21_1',
  'Minecraft 1.21.1 / Cobblemon 1.7.3 / Create 6.0.10',
  '1.21.1',
  '1.7.3+1.21.1',
  '6.0.10-280',
  '0.1.0-alpha.1',
  1,
  1,
  true
)
on conflict (id) do update
set display_name = excluded.display_name,
    minecraft_version = excluded.minecraft_version,
    cobblemon_version = excluded.cobblemon_version,
    create_version = excluded.create_version,
    mod_version = excluded.mod_version,
    generation_min = excluded.generation_min,
    generation_max = excluded.generation_max,
    is_active = excluded.is_active;

insert into public.records (
  id,
  public_id,
  slug,
  display_name,
  record_kind,
  workflow_state,
  schema_version,
  current_revision,
  content
) values
  (
    '00000000-0000-4000-8000-000000000007',
    'cobblemon_kinetics:pokemon/squirtle',
    'squirtle',
    'Squirtle',
    'pokemon_species',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object(
      'national_dex', 7,
      'types', jsonb_build_array('water'),
      'machine_id', 'cobblemon_kinetics:hydro_coupler',
      'job_id', 'cobblemon_kinetics:hydro_operator',
      'efficiency', 1.0,
      'public_rationale', 'Squirtle can direct a steady Water-type flow into the Hydro Coupler.',
      'private_note', '',
      'publication', jsonb_build_object(
        'format_version', 1,
        'public_id', 'cobblemon_kinetics:pokemon/squirtle',
        'slug', 'squirtle',
        'national_dex', 7,
        'name', 'Squirtle',
        'cobblemon_id', 'cobblemon:squirtle',
        'generation', 1,
        'current_types', jsonb_build_array('water'),
        'original_gen1_types', jsonb_build_array('water'),
        'type_changed', false,
        'form', jsonb_build_object(
          'public_id', 'cobblemon_kinetics:pokemon/squirtle/default',
          'slug', 'default',
          'name', 'Default',
          'is_default', true
        ),
        'facts', jsonb_build_object(
          'habitat', 'Waters Edge',
          'height_m', 0.5,
          'weight_kg', 9,
          'base_stat_total', 314,
          'base_stats', jsonb_build_object(
            'hp', 44,
            'attack', 48,
            'defense', 65,
            'special_attack', 50,
            'special_defense', 64,
            'speed', 43
          ),
          'standard_abilities', jsonb_build_array('Torrent'),
          'hidden_ability', 'Rain Dish',
          'capture_rate', 45,
          'base_friendship', 70,
          'legendary', false,
          'mythical', false,
          'growth_rate', 'Medium Slow',
          'shape', 'Upright',
          'color', 'Blue'
        ),
        'source_references', jsonb_build_array('https://pokeapi.co/api/v2/pokemon/7/')
      ),
      'source_snapshot', jsonb_build_object(
        'species', jsonb_build_object(
          'national_dex', 7,
          'generation_id', 1,
          'cobblemon_species_id', 'cobblemon:squirtle',
          'api_slug', 'squirtle',
          'genus', 'Tiny Turtle Pokémon',
          'habitat', 'waters-edge',
          'height_decimeters', 5,
          'weight_hectograms', 90,
          'capture_rate', 45,
          'base_friendship', 70,
          'growth_rate', 'medium-slow',
          'shape', 'upright',
          'color', 'blue',
          'is_legendary', false,
          'is_mythical', false,
          'source_data', jsonb_build_object('source', 'PokéAPI', 'rights_review', 'facts_only')
        ),
        'form', jsonb_build_object(
          'public_id', 'cobblemon_kinetics:pokemon/squirtle/default',
          'cobblemon_form_id', 'cobblemon:squirtle',
          'form_key', 'default',
          'is_default', true,
          'aspects', '[]'::jsonb,
          'base_stats', jsonb_build_object(
            'hp', 44,
            'attack', 48,
            'defense', 65,
            'special_attack', 50,
            'special_defense', 64,
            'speed', 43
          ),
          'abilities', jsonb_build_array('torrent', 'rain-dish'),
          'attributes', '{}'::jsonb
        ),
        'current_types', jsonb_build_array('water'),
        'original_gen1_types', jsonb_build_array('water')
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000001007',
    'cobblemon_kinetics:pokemon/squirtle/default',
    'squirtle-default',
    'Squirtle (Default Form)',
    'pokemon_form',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object('species_id', 'cobblemon_kinetics:pokemon/squirtle', 'form_key', 'default')
  ),
  (
    '00000000-0000-4000-8000-000000002001',
    'cobblemon_kinetics:registry/hydro_coupler',
    'hydro-coupler-registry',
    'Hydro Coupler Registry Entry',
    'registry_entry',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object('resource_location', 'cobblemon_kinetics:hydro_coupler', 'registry_kind', 'block')
  ),
  (
    '00000000-0000-4000-8000-000000003001',
    'cobblemon_kinetics:hydro_operator',
    'hydro-operator',
    'Hydro Operator',
    'job',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object(
      'category', 'power_generation',
      'required_type', 'water',
      'publication', jsonb_build_object(
        'format_version', 1,
        'public_id', 'cobblemon_kinetics:job/hydro_operator',
        'slug', 'hydro-operator',
        'name', 'Hydro Operator',
        'summary', 'Direct a Water-type stream into a kinetic network.',
        'status', 'approved'
      ),
      'source_snapshot', jsonb_build_object(
        'category', 'power_generation',
        'description', 'Direct a Water-type stream into a kinetic network.',
        'required_type', 'water',
        'capability_ids', jsonb_build_array('water_flow', 'rotational_power'),
        'adapter_id', 'cobblemon_kinetics:hydro_coupler',
        'constraints', jsonb_build_object('requires_owner', true, 'requires_not_in_battle', true)
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000004001',
    'cobblemon_kinetics:hydro_coupler',
    'hydro-coupler',
    'Hydro Coupler',
    'machine',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object(
      'primary_component', 'cobblemon_kinetics:hydro_coupler',
      'publication', jsonb_build_object(
        'format_version', 1,
        'public_id', 'cobblemon_kinetics:machine/hydro_coupler',
        'slug', 'hydro-coupler',
        'name', 'Hydro Coupler',
        'summary', 'A project-owned workstation that converts Pokémon water flow into Create rotation.',
        'status', 'approved'
      ),
      'source_snapshot', jsonb_build_object(
        'description', 'A project-owned workstation that converts Pokémon water flow into Create rotation.',
        'lifecycle_state', 'prototype',
        'evidence_state', 'tested',
        'metadata', jsonb_build_object('fixture', true)
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000005001',
    'cobblemon_kinetics:squirtle_hydro_operator',
    'squirtle-hydro-operator',
    'Squirtle Hydro Operator Profile',
    'work_profile',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object(
      'pokemon_id', 'cobblemon_kinetics:pokemon/squirtle',
      'machine_id', 'cobblemon_kinetics:hydro_coupler',
      'job_id', 'cobblemon_kinetics:hydro_operator',
      'efficiency', 1.0,
      'public_rationale', 'A stable first-pass Hydro Coupler assignment.',
      'publication', jsonb_build_object(
        'format_version', 1,
        'id', 'cobblemon_kinetics:hydro_operator',
        'title', 'Hydro Operator',
        'priority', 0,
        'status', 'approved',
        'selector', jsonb_build_object(
          'kind', 'type',
          'types', jsonb_build_array('cobblemon:water'),
          'national_dex', jsonb_build_object('min', 1, 'max', 151)
        ),
        'constraints', jsonb_build_object(
          'requires_owner', true,
          'must_be_alive', true,
          'must_not_be_fainted', true,
          'must_not_be_battling', true,
          'must_be_idle', true
        ),
        'workstation', jsonb_build_object(
          'adapter_id', 'cobblemon_kinetics:hydro_coupler',
          'registry_ids', jsonb_build_array('cobblemon_kinetics:hydro_coupler'),
          'required_attachment_tag', 'create:water_wheels',
          'radius', 6
        ),
        'contribution', jsonb_build_object(
          'mode', 'fixed',
          'rpm', 8,
          'capacity_per_rpm', 64,
          'efficiency_multiplier', 1.0
        ),
        'public_rationale', 'A stable first-pass Hydro Coupler assignment.'
      ),
      'source_snapshot', jsonb_build_object(
        'job_id', 'cobblemon_kinetics:hydro_operator',
        'machine_id', 'cobblemon_kinetics:hydro_coupler',
        'compatibility_set_id', 'cobblemon_kinetics:mc_1_21_1',
        'adapter_id', 'cobblemon_kinetics:hydro_coupler',
        'selector', jsonb_build_object('kind', 'pokemon', 'pokemon', 'cobblemon:squirtle'),
        'requirements', jsonb_build_object('owned', true, 'not_in_battle', true),
        'outputs', jsonb_build_object('kind', 'fixed_rotation', 'rpm', 8),
        'balance', jsonb_build_object('efficiency', 1.0, 'stress_capacity', 64),
        'minimum_efficiency', 0.25,
        'maximum_efficiency', 2.0
      )
    )
  ),
  (
    '00000000-0000-4000-8000-000000006001',
    'cobblemon_kinetics:work/verify_hydro_coupler',
    'verify-hydro-coupler',
    'Verify Hydro Coupler Vertical Slice',
    'work_item',
    'draft',
    '1.0.0',
    1,
    jsonb_build_object('summary', 'Verify the Squirtle to Hydro Coupler editor and export flow.')
  )
on conflict (id) do update
set public_id = excluded.public_id,
    slug = excluded.slug,
    display_name = excluded.display_name,
    record_kind = excluded.record_kind,
    workflow_state = excluded.workflow_state,
    schema_version = excluded.schema_version,
    current_revision = excluded.current_revision,
    approved_revision = null,
    approved_by = null,
    approved_at = null,
    content = excluded.content;

insert into public.record_revisions (
  record_id,
  revision_number,
  schema_version,
  snapshot,
  checksum,
  change_summary
)
select
  record.id,
  1,
  record.schema_version,
  record.content,
  record.checksum,
  'Seeded local Squirtle/Hydro fixture'
from public.records as record
where record.id in (
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000001007',
  '00000000-0000-4000-8000-000000002001',
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000005001',
  '00000000-0000-4000-8000-000000006001'
)
on conflict (record_id, revision_number) do update
set schema_version = excluded.schema_version,
    snapshot = excluded.snapshot,
    checksum = excluded.checksum,
    change_summary = excluded.change_summary;

-- The project-owned Hydro contract fixture is already reviewed. Squirtle
-- remains draft so the editor flow still exercises save and explicit approval.
update public.records
set workflow_state = 'approved',
    approved_revision = 1,
    approved_by = null,
    approved_at = timestamptz '2026-08-14 00:00:00+00'
where id in (
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000005001'
);

insert into public.pokemon_species (
  record_id,
  national_dex,
  generation_id,
  cobblemon_species_id,
  api_slug,
  genus,
  habitat,
  height_decimeters,
  weight_hectograms,
  capture_rate,
  base_friendship,
  growth_rate,
  shape,
  color,
  source_data
) values (
  '00000000-0000-4000-8000-000000000007',
  7,
  1,
  'cobblemon:squirtle',
  'squirtle',
  'Tiny Turtle Pokémon',
  'waters-edge',
  5,
  90,
  45,
  70,
  'medium-slow',
  'upright',
  'blue',
  jsonb_build_object('source', 'PokéAPI', 'rights_review', 'facts_only')
)
on conflict (record_id) do update
set national_dex = excluded.national_dex,
    generation_id = excluded.generation_id,
    cobblemon_species_id = excluded.cobblemon_species_id,
    api_slug = excluded.api_slug,
    genus = excluded.genus,
    habitat = excluded.habitat,
    height_decimeters = excluded.height_decimeters,
    weight_hectograms = excluded.weight_hectograms,
    capture_rate = excluded.capture_rate,
    base_friendship = excluded.base_friendship,
    growth_rate = excluded.growth_rate,
    shape = excluded.shape,
    color = excluded.color,
    source_data = excluded.source_data;

insert into public.pokemon_forms (
  record_id,
  species_record_id,
  cobblemon_form_id,
  form_key,
  is_default,
  aspects,
  base_stats,
  abilities,
  attributes
) values (
  '00000000-0000-4000-8000-000000001007',
  '00000000-0000-4000-8000-000000000007',
  'cobblemon:squirtle',
  'default',
  true,
  '{}',
  jsonb_build_object('hp', 44, 'attack', 48, 'defense', 65, 'special_attack', 50, 'special_defense', 64, 'speed', 43),
  array['torrent', 'rain-dish'],
  '{}'::jsonb
)
on conflict (record_id) do update
set species_record_id = excluded.species_record_id,
    cobblemon_form_id = excluded.cobblemon_form_id,
    form_key = excluded.form_key,
    is_default = excluded.is_default,
    aspects = excluded.aspects,
    base_stats = excluded.base_stats,
    abilities = excluded.abilities,
    attributes = excluded.attributes;

insert into public.pokemon_form_types (
  form_record_id,
  compatibility_set_id,
  typing_context,
  type_id,
  slot
) values
  (
    '00000000-0000-4000-8000-000000001007',
    '00000000-0000-4000-8000-000000000702',
    'current',
    '00000000-0000-4000-8000-000000000701',
    1
  ),
  (
    '00000000-0000-4000-8000-000000001007',
    '00000000-0000-4000-8000-000000000702',
    'original_gen_i',
    '00000000-0000-4000-8000-000000000701',
    1
  )
on conflict (form_record_id, compatibility_set_id, typing_context, slot) do update
set type_id = excluded.type_id;

insert into public.registry_entries (
  record_id,
  registry_kind,
  resource_location,
  source_mod,
  introduced_version,
  lifecycle_state,
  metadata
) values (
  '00000000-0000-4000-8000-000000002001',
  'block',
  'cobblemon_kinetics:hydro_coupler',
  'cobblemon_kinetics',
  '0.1.0-alpha.1',
  'active',
  jsonb_build_object('fixture', true)
)
on conflict (record_id) do update
set registry_kind = excluded.registry_kind,
    resource_location = excluded.resource_location,
    source_mod = excluded.source_mod,
    introduced_version = excluded.introduced_version,
    lifecycle_state = excluded.lifecycle_state,
    metadata = excluded.metadata;

insert into public.jobs (
  record_id,
  category,
  description,
  required_type_id,
  capability_ids,
  adapter_id,
  constraints
) values (
  '00000000-0000-4000-8000-000000003001',
  'power_generation',
  'Direct a Water-type stream into a kinetic network.',
  '00000000-0000-4000-8000-000000000701',
  array['water_flow', 'rotational_power'],
  'cobblemon_kinetics:hydro_coupler',
  jsonb_build_object('requires_owner', true, 'requires_not_in_battle', true)
)
on conflict (record_id) do update
set category = excluded.category,
    description = excluded.description,
    required_type_id = excluded.required_type_id,
    capability_ids = excluded.capability_ids,
    adapter_id = excluded.adapter_id,
    constraints = excluded.constraints;

insert into public.machines (
  record_id,
  description,
  lifecycle_state,
  evidence_state,
  metadata
) values (
  '00000000-0000-4000-8000-000000004001',
  'A project-owned workstation that converts Pokémon water flow into Create rotation.',
  'prototype',
  'tested',
  jsonb_build_object('fixture', true)
)
on conflict (record_id) do update
set description = excluded.description,
    lifecycle_state = excluded.lifecycle_state,
    evidence_state = excluded.evidence_state,
    metadata = excluded.metadata;

insert into public.machine_components (
  machine_record_id,
  registry_record_id,
  purpose,
  is_primary,
  position
) values (
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000002001',
  'Primary workstation block',
  true,
  0
)
on conflict (machine_record_id, registry_record_id) do update
set purpose = excluded.purpose,
    is_primary = excluded.is_primary,
    position = excluded.position;

insert into public.work_profiles (
  record_id,
  job_record_id,
  machine_record_id,
  compatibility_set_id,
  adapter_id,
  selector,
  requirements,
  outputs,
  balance,
  minimum_efficiency,
  maximum_efficiency
) values (
  '00000000-0000-4000-8000-000000005001',
  '00000000-0000-4000-8000-000000003001',
  '00000000-0000-4000-8000-000000004001',
  '00000000-0000-4000-8000-000000000702',
  'cobblemon_kinetics:hydro_coupler',
  jsonb_build_object('kind', 'pokemon', 'pokemon', 'cobblemon:squirtle'),
  jsonb_build_object('owned', true, 'not_in_battle', true),
  jsonb_build_object('kind', 'fixed_rotation', 'rpm', 8),
  jsonb_build_object('efficiency', 1.0, 'stress_capacity', 64),
  0.25,
  2.0
)
on conflict (record_id) do update
set job_record_id = excluded.job_record_id,
    machine_record_id = excluded.machine_record_id,
    compatibility_set_id = excluded.compatibility_set_id,
    adapter_id = excluded.adapter_id,
    selector = excluded.selector,
    requirements = excluded.requirements,
    outputs = excluded.outputs,
    balance = excluded.balance,
    minimum_efficiency = excluded.minimum_efficiency,
    maximum_efficiency = excluded.maximum_efficiency;

insert into public.pokemon_work_assignments (
  id,
  form_record_id,
  work_profile_record_id,
  compatibility_set_id,
  efficiency_multiplier,
  public_rationale,
  internal_notes,
  status
) values (
  '00000000-0000-4000-8000-000000005007',
  '00000000-0000-4000-8000-000000001007',
  '00000000-0000-4000-8000-000000005001',
  '00000000-0000-4000-8000-000000000702',
  1.0,
  'Squirtle can provide a controlled stream for the Hydro Coupler.',
  '',
  'active'
)
on conflict (id) do update
set form_record_id = excluded.form_record_id,
    work_profile_record_id = excluded.work_profile_record_id,
    compatibility_set_id = excluded.compatibility_set_id,
    efficiency_multiplier = excluded.efficiency_multiplier,
    public_rationale = excluded.public_rationale,
    internal_notes = excluded.internal_notes,
    status = excluded.status;

insert into public.work_items (
  record_id,
  status,
  priority,
  suggested_by,
  handoff_note,
  labels,
  source_key
) values (
  '00000000-0000-4000-8000-000000006001',
  'ready',
  'high',
  null,
  '',
  array['vertical-slice', 'hydro'],
  'fixture:verify-hydro-coupler'
)
on conflict (record_id) do update
set status = excluded.status,
    priority = excluded.priority,
    suggested_by = null,
    handoff_note = excluded.handoff_note,
    labels = excluded.labels,
    source_key = excluded.source_key;

-- Intentionally no row in work_item_assignees: creating or importing a task
-- must never infer ownership from its author, suggester, or importer.
