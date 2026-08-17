begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

select ok(to_regprocedure('public.get_pokemon_workspace(text)') is not null, 'Pokémon workspaces have a stable RPC');
select ok(to_regprocedure('public.get_family_blueprint(text)') is not null, 'family Blueprints have a stable RPC');
select ok(to_regprocedure('public.list_blueprint_library(text,text[],jsonb,integer,text)') is not null, 'the Blueprint library has a stable RPC');
select ok(to_regprocedure('public.get_blueprint_head(text)') is not null, 'Blueprint head polling has a stable RPC');
select ok(to_regprocedure('public.list_studio_relationships(text[],text,integer)') is not null, 'canonical relationship consumers have a stable RPC');
select ok(to_regprocedure('public.apply_blueprint_change_set(text,bigint,jsonb,jsonb,jsonb,uuid)') is not null, 'staged Apply has a stable optimistic RPC');
select ok(to_regprocedure('public.save_blueprint_user_view(text,jsonb,jsonb,text[])') is not null, 'personal views have a stable RPC');
select ok(to_regprocedure('public.reconcile_gen1_evolution_blueprints()') is not null, 'the service-only evolution reconciler exists');

select ok(
  not has_function_privilege('authenticated', 'public.reconcile_gen1_evolution_blueprints()', 'EXECUTE'),
  'browser sessions cannot run evolution reconciliation'
);
select ok(
  has_function_privilege('service_role', 'public.reconcile_gen1_evolution_blueprints()', 'EXECUTE'),
  'the service role can run evolution reconciliation'
);
select ok(
  not has_function_privilege('anon', 'public.list_studio_relationships(text[],text,integer)', 'EXECUTE'),
  'anonymous sessions cannot enumerate private Studio relationships'
);
select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'controlled_fact_values', 'fact_value_reviews', 'pokemon_fact_values',
        'evolution_families', 'evolution_family_members', 'capabilities', 'work_targets',
        'conditions', 'results', 'studio_relationships', 'evolution_edges',
        'form_capabilities', 'job_capability_requirements', 'type_capability_suggestions',
        'type_capability_acceptances', 'blueprint_boards', 'blueprint_nodes',
        'blueprint_edges', 'blueprint_annotations', 'blueprint_user_preferences',
        'blueprint_mutations'
      )
      and relation.relforcerowsecurity
  ),
  21::bigint,
  'every Blueprint and evolution table forces row-level security'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  0::bigint,
  'authenticated members receive no direct mutation grants'
);

select is((select count(*) from public.controlled_fact_values where vocabulary = 'growth_rate'), 4::bigint, 'all four growth rates are controlled');
select is((select count(*) from public.controlled_fact_values where vocabulary = 'habitat'), 9::bigint, 'all nine imported habitats are controlled');
select is((select count(*) from public.controlled_fact_values where vocabulary = 'shape'), 14::bigint, 'all fourteen imported body shapes are controlled');
select is((select count(*) from public.controlled_fact_values where vocabulary = 'color'), 10::bigint, 'all ten imported colors are controlled');

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('21000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'blueprint-daniel@example.test', '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('21000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'blueprint-jake@example.test', '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.editor_allowlist (github_user_id, github_login, display_name, role, is_active) values
  (920001, 'blueprint-daniel', 'Blueprint Daniel', 'maintainer', true),
  (920002, 'blueprint-jake', 'Blueprint Jake', 'maintainer', true);
insert into public.app_users (auth_user_id, github_user_id, github_login, display_name, role, is_active) values
  ('21000000-0000-4000-8000-000000000001', 920001, 'blueprint-daniel', 'Blueprint Daniel', 'maintainer', true),
  ('21000000-0000-4000-8000-000000000002', 920002, 'blueprint-jake', 'Blueprint Jake', 'maintainer', true);

insert into public.pokemon_types (id, identifier, display_name, color_hex)
values ('48000000-0000-4000-8000-000000000001', 'grass_test', 'Grass Test', '#4DAD5B');

insert into public.records (
  id, public_id, slug, display_name, record_kind, current_revision, content
) values
  ('41000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:pokemon/blueprint-bulbasaur', 'blueprint-bulbasaur', 'Blueprint Bulbasaur', 'pokemon_species', 1, '{"facts":{"genus":"Seed Pokémon","habitat":"grassland","growth_rate":"medium-slow","shape":"quadruped","color":"green"}}'),
  ('41000000-0000-4000-8000-000000000002', 'cobblemon_kinetics:pokemon/blueprint-ivysaur', 'blueprint-ivysaur', 'Blueprint Ivysaur', 'pokemon_species', 1, '{"facts":{"genus":"Seed Pokémon","habitat":"grassland","growth_rate":"medium-slow","shape":"quadruped","color":"green"}}'),
  ('42000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:pokemon/blueprint-bulbasaur/default', 'blueprint-bulbasaur-default', 'Blueprint Bulbasaur', 'pokemon_form', 1, '{"species_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur","form_key":"default","aspects":[]}'),
  ('42000000-0000-4000-8000-000000000002', 'cobblemon_kinetics:pokemon/blueprint-ivysaur/default', 'blueprint-ivysaur-default', 'Blueprint Ivysaur', 'pokemon_form', 1, '{"species_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur","form_key":"default","aspects":[]}'),
  ('43000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:evolution-family/blueprint-bulbasaur', 'evolution-family-blueprint-bulbasaur', 'Blueprint Bulbasaur family', 'evolution_family', 1, '{}'),
  ('44000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 'blueprint-blueprint-bulbasaur', 'Blueprint Bulbasaur family board', 'blueprint_board', 1, '{}'),
  ('45000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:capability/blueprint-plant-care', 'capability-blueprint-plant-care', 'Blueprint Plant Care', 'capability', 1, '{"category":"care","description":"Explicit plant care","tier_min":1,"tier_max":4}'),
  ('45000000-0000-4000-8000-000000000002', 'cobblemon_kinetics:capability/blueprint-growth-sense', 'capability-blueprint-growth-sense', 'Blueprint Growth Sense', 'capability', 1, '{"category":"senses","description":"Ghosted type suggestion","tier_min":1,"tier_max":4}'),
  ('46000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:relationship/blueprint-evolution', 'relationship-blueprint-evolution', 'Blueprint evolution', 'relationship', 1, '{"source_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","target_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","relationship_kind":"evolves_to","metadata":{},"inheritance_decision":null}'),
  ('46000000-0000-4000-8000-000000000002', 'cobblemon_kinetics:relationship/blueprint-basic-care', 'relationship-blueprint-basic-care', 'Blueprint basic care', 'relationship', 1, '{"source_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","target_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","relationship_kind":"has_capability","metadata":{"tier":1,"radius":2},"inheritance_decision":"add"}'),
  ('46000000-0000-4000-8000-000000000003', 'cobblemon_kinetics:relationship/blueprint-capable-care', 'relationship-blueprint-capable-care', 'Blueprint capable care', 'relationship', 1, '{"source_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","target_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","relationship_kind":"has_capability","metadata":{"tier":2,"radius":4},"inheritance_decision":"raise","parent_relationship_public_id":"cobblemon_kinetics:relationship/blueprint-basic-care"}'),
  ('47000000-0000-4000-8000-000000000001', 'cobblemon_kinetics:type-workshop/grass-test', 'type-workshop-grass-test', 'Grass Test Workshop', 'type_workshop', 1, '{}');

insert into public.record_revisions (record_id, revision_number, schema_version, snapshot, checksum, change_summary)
select id, 1, schema_version, content, checksum, 'Seeded Kinetic Blueprint pgTAP fixture'
from public.records
where id::text like any (array['41%', '42%', '43%', '44%', '45%', '46%', '47%']);

insert into public.pokemon_species (
  record_id, national_dex, generation_id, cobblemon_species_id, api_slug,
  genus, habitat, growth_rate, shape, color
) values
  ('41000000-0000-4000-8000-000000000001', 901, 1, 'cobblemon:test-bulbasaur', 'test-bulbasaur', 'Seed Pokémon', 'grassland', 'medium-slow', 'quadruped', 'green'),
  ('41000000-0000-4000-8000-000000000002', 902, 1, 'cobblemon:test-ivysaur', 'test-ivysaur', 'Seed Pokémon', 'grassland', 'medium-slow', 'quadruped', 'green');
insert into public.pokemon_forms (record_id, species_record_id, cobblemon_form_id, form_key, is_default) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'cobblemon:test-bulbasaur', 'default', true),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', 'cobblemon:test-ivysaur', 'default', true);
insert into public.pokemon_form_types (form_record_id, compatibility_set_id, typing_context, type_id, slot)
select '42000000-0000-4000-8000-000000000001', id, 'current', '48000000-0000-4000-8000-000000000001', 1
from public.compatibility_sets where is_active order by created_at limit 1;

insert into public.evolution_families (record_id, generation_id, family_key, imported_label)
values ('43000000-0000-4000-8000-000000000001', 1, 'blueprint-bulbasaur', 'Blueprint Bulbasaur → Blueprint Ivysaur');
insert into public.evolution_family_members (family_record_id, form_record_id, stage_index, stage_label, sort_order) values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 1, 'Stage 1', 1),
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', 2, 'Stage 2', 2);
insert into public.blueprint_boards (record_id, family_record_id, board_revision, layout_checksum)
values ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 1, repeat('0', 64));
insert into public.capabilities (record_id, category, description) values
  ('45000000-0000-4000-8000-000000000001', 'care', 'Explicit plant care'),
  ('45000000-0000-4000-8000-000000000002', 'senses', 'Ghosted type suggestion');
insert into public.studio_relationships (
  record_id, source_record_id, target_record_id, relationship_kind, metadata,
  inheritance_decision, parent_relationship_record_id, inheritance_state, parent_revision_at_review
) values
  ('46000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', 'evolves_to', '{}', null, null, 'not_applicable', null),
  ('46000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 'has_capability', '{"tier":1,"radius":2}', 'add', null, 'not_applicable', null),
  ('46000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000001', 'has_capability', '{"tier":2,"radius":4}', 'raise', '46000000-0000-4000-8000-000000000002', 'current', 1);
insert into public.evolution_edges (relationship_record_id, family_record_id, from_form_record_id, to_form_record_id)
values ('46000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002');
insert into public.form_capabilities (relationship_record_id, form_record_id, capability_record_id, tier, explicit_values) values
  ('46000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 1, '{"radius":2}'),
  ('46000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000001', 2, '{"radius":4}');
insert into public.blueprint_nodes (board_record_id, record_id, node_family, position_x, position_y) values
  ('44000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'worker', 0, 0),
  ('44000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', 'worker', 300, 0),
  ('44000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 'capability', 160, 220);
insert into public.blueprint_edges (board_record_id, relationship_record_id, source_handle, target_handle, label) values
  ('44000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'worker:evolution', 'worker:evolution', 'Evolves to'),
  ('44000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000002', 'worker:capability', 'capability:worker', 'Plant Care Tier 1'),
  ('44000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000003', 'worker:capability', 'capability:worker', 'Plant Care Tier 2');
insert into public.type_workshop_plans (record_id, type_id, planning)
values ('47000000-0000-4000-8000-000000000001', '48000000-0000-4000-8000-000000000001', '{}');
insert into public.type_capability_suggestions (id, type_workshop_record_id, capability_record_id, suggested_tier, rationale)
values ('49000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000002', 1, 'Ghosted until accepted.');

select is((select count(*) from public.type_capability_acceptances), 0::bigint, 'type suggestions create no capability acceptance on their own');

select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select ok(
  jsonb_array_length(public.list_studio_relationships(array['has_capability'], null, 100) -> 'items') = 2
  and public.list_studio_relationships(array['has_capability'], null, 100) #>> '{items,0,source,species_public_id}' = 'cobblemon_kinetics:pokemon/blueprint-bulbasaur',
  'the relationship index exposes typed canonical edges and their owning species to members'
);

select throws_ok(
  $$select public.apply_blueprint_change_set(
    'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 1,
    '{"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default":1,"cobblemon_kinetics:pokemon/blueprint-ivysaur/default":1,"cobblemon_kinetics:capability/blueprint-plant-care":1,"cobblemon_kinetics:relationship/blueprint-evolution":1,"cobblemon_kinetics:relationship/blueprint-basic-care":1,"cobblemon_kinetics:relationship/blueprint-capable-care":1}'::jsonb,
    '[{"type":"create_stub","record_public_id":"cobblemon_kinetics:capability/draft-51000000-0000-4000-8000-000000000008","record_kind":"capability","display_name":"Incomplete stub","position":{"x":10,"y":10}}]'::jsonb,
    '{"nodes":[]}'::jsonb,
    '51000000-0000-4000-8000-000000000008'
  )$$,
  'P0001', null, 'an incomplete catalog stub cannot be applied'
);

select lives_ok(
  $$select public.apply_blueprint_change_set(
    'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 1,
    '{"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default":1,"cobblemon_kinetics:pokemon/blueprint-ivysaur/default":1,"cobblemon_kinetics:capability/blueprint-plant-care":1,"cobblemon_kinetics:relationship/blueprint-evolution":1,"cobblemon_kinetics:relationship/blueprint-basic-care":1,"cobblemon_kinetics:relationship/blueprint-capable-care":1}'::jsonb,
    '[{"type":"set_inheritance_decision","relationship_public_id":"cobblemon_kinetics:relationship/blueprint-basic-care","decision":"keep","metadata":{"tier":1,"radius":3}}]'::jsonb,
    '{"nodes":[{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","position":{"x":0,"y":0}},{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","position":{"x":300,"y":0}},{"record_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","position":{"x":160,"y":220}}]}'::jsonb,
    '51000000-0000-4000-8000-000000000001'
  )$$,
  'a staged relationship review applies atomically'
);
select is((select board_revision from public.blueprint_boards where record_id = '44000000-0000-4000-8000-000000000001'), 2::bigint, 'one Apply advances the shared board once');
select is((select current_revision from public.records where id = '46000000-0000-4000-8000-000000000002'), 2::bigint, 'the edited relationship receives one immutable revision');
select is((select inheritance_state from public.studio_relationships where record_id = '46000000-0000-4000-8000-000000000003'), 'outdated', 'a parent change marks its descendant inheritance outdated');
select is((select metadata ->> 'radius' from public.studio_relationships where record_id = '46000000-0000-4000-8000-000000000003'), '4', 'outdated descendants are never silently rewritten');
select is((select genus from public.pokemon_species where record_id = '41000000-0000-4000-8000-000000000002'), 'Seed Pokémon', 'factual fields do not inherit from a parent change');

select throws_ok(
  $$select public.apply_blueprint_change_set('cobblemon_kinetics:blueprint/blueprint-bulbasaur', 1, '{}'::jsonb, '[]'::jsonb, '{"nodes":[]}'::jsonb, '51000000-0000-4000-8000-000000000002')$$,
  'PGRST', null, 'a stale shared-board revision is rejected'
);
select throws_ok(
  $$select public.apply_blueprint_change_set('cobblemon_kinetics:blueprint/blueprint-bulbasaur', 2, '{}'::jsonb, '[{"type":"auto_layout"}]'::jsonb, '{"nodes":[]}'::jsonb, '51000000-0000-4000-8000-000000000003')$$,
  'PGRST', null, 'missing record heads return a precise optimistic conflict'
);
select throws_ok(
  $$select public.apply_blueprint_change_set(
    'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 2,
    '{"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default":1,"cobblemon_kinetics:pokemon/blueprint-ivysaur/default":1,"cobblemon_kinetics:capability/blueprint-plant-care":1,"cobblemon_kinetics:relationship/blueprint-evolution":1,"cobblemon_kinetics:relationship/blueprint-basic-care":2,"cobblemon_kinetics:relationship/blueprint-capable-care":1}'::jsonb,
    '[{"type":"upsert_relationship","source_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","target_public_id":"cobblemon_kinetics:capability/blueprint-growth-sense","relationship_kind":"has_capability","metadata":{"tier":1},"source_handle":"wrong","target_handle":"capability:worker"}]'::jsonb,
    '{"nodes":[{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","position":{"x":0,"y":0}},{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","position":{"x":300,"y":0}},{"record_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","position":{"x":160,"y":220}}]}'::jsonb,
    '51000000-0000-4000-8000-000000000004'
  )$$,
  'P0001', null, 'invalid labeled ports are rejected in PostgreSQL'
);
select throws_ok(
  $$select public.apply_blueprint_change_set(
    'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 2,
    '{"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default":1,"cobblemon_kinetics:pokemon/blueprint-ivysaur/default":1,"cobblemon_kinetics:capability/blueprint-plant-care":1,"cobblemon_kinetics:relationship/blueprint-evolution":1,"cobblemon_kinetics:relationship/blueprint-basic-care":2,"cobblemon_kinetics:relationship/blueprint-capable-care":1}'::jsonb,
    '[{"type":"upsert_relationship","source_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","target_public_id":"cobblemon_kinetics:capability/blueprint-growth-sense","relationship_kind":"has_capability","metadata":{"tier":5}}]'::jsonb,
    '{"nodes":[{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","position":{"x":0,"y":0}},{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","position":{"x":300,"y":0}},{"record_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","position":{"x":160,"y":220}}]}'::jsonb,
    '51000000-0000-4000-8000-000000000005'
  )$$,
  'P0001', null, 'invalid capability tiers are rejected in PostgreSQL'
);
select throws_ok(
  $$select public.apply_blueprint_change_set(
    'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 2,
    '{"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default":1,"cobblemon_kinetics:pokemon/blueprint-ivysaur/default":1,"cobblemon_kinetics:capability/blueprint-plant-care":1,"cobblemon_kinetics:relationship/blueprint-evolution":1,"cobblemon_kinetics:relationship/blueprint-basic-care":2,"cobblemon_kinetics:relationship/blueprint-capable-care":1}'::jsonb,
    '[{"type":"upsert_relationship","source_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","target_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","relationship_kind":"evolves_to","metadata":{}}]'::jsonb,
    '{"nodes":[{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","position":{"x":0,"y":0}},{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","position":{"x":300,"y":0}},{"record_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","position":{"x":160,"y":220}}]}'::jsonb,
    '51000000-0000-4000-8000-000000000006'
  )$$,
  'P0001', null, 'evolution cycles are rejected in PostgreSQL'
);
select is((select board_revision from public.blueprint_boards where record_id = '44000000-0000-4000-8000-000000000001'), 2::bigint, 'rejected change sets leave the whole board untouched');

select lives_ok(
  $$select public.save_blueprint_user_view('cobblemon_kinetics:blueprint/blueprint-bulbasaur', '{"x":4,"y":8,"zoom":1.25}', '{"last_view":"outline","kind":"all"}', array['cobblemon_kinetics:capability/blueprint-plant-care'])$$,
  'a maintainer can save a personal Blueprint view'
);
select is((select count(*) from public.blueprint_user_preferences), 1::bigint, 'the maintainer can read their own saved view');

select lives_ok(
  $$select public.apply_blueprint_change_set(
    'cobblemon_kinetics:blueprint/blueprint-bulbasaur', 2,
    '{"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default":1,"cobblemon_kinetics:pokemon/blueprint-ivysaur/default":1,"cobblemon_kinetics:capability/blueprint-plant-care":1,"cobblemon_kinetics:relationship/blueprint-evolution":1,"cobblemon_kinetics:relationship/blueprint-basic-care":2,"cobblemon_kinetics:relationship/blueprint-capable-care":1}'::jsonb,
    '[{"type":"accept_type_suggestion","suggestion_id":"49000000-0000-4000-8000-000000000001","form_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","tier":1,"position":{"x":150,"y":360}}]'::jsonb,
    '{"nodes":[{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-bulbasaur/default","position":{"x":0,"y":0}},{"record_public_id":"cobblemon_kinetics:pokemon/blueprint-ivysaur/default","position":{"x":300,"y":0}},{"record_public_id":"cobblemon_kinetics:capability/blueprint-plant-care","position":{"x":160,"y":220}}]}'::jsonb,
    '51000000-0000-4000-8000-000000000007'
  )$$,
  'a Type Workshop suggestion can be explicitly accepted for one form'
);
select is((select count(*) from public.type_capability_acceptances where form_record_id = '42000000-0000-4000-8000-000000000001'), 1::bigint, 'acceptance is recorded for the selected form');
select is((select count(*) from public.type_capability_acceptances where form_record_id = '42000000-0000-4000-8000-000000000002'), 0::bigint, 'acceptance never propagates to an evolved form');
select is((select tier from public.form_capabilities where form_record_id = '42000000-0000-4000-8000-000000000001' and capability_record_id = '45000000-0000-4000-8000-000000000002'), 1::smallint, 'the accepted suggestion creates the explicit selected tier');

select lives_ok(
  $$select public.approve_record_revision('cobblemon_kinetics:pokemon/blueprint-bulbasaur', 1)$$,
  'a maintainer can approve the species dependency'
);
select lives_ok(
  $$select public.approve_record_revision('cobblemon_kinetics:pokemon/blueprint-bulbasaur/default', 1)$$,
  'a maintainer can approve the default form dependency'
);
select lives_ok(
  $$select public.approve_record_revision('cobblemon_kinetics:capability/blueprint-plant-care', 1)$$,
  'a maintainer can approve a capability record'
);
select lives_ok(
  $$select public.approve_record_revision('cobblemon_kinetics:relationship/blueprint-basic-care', 2)$$,
  'a maintainer can approve an exact relationship revision'
);

create temporary table blueprint_publication_result as
select public.create_publication_batch(array['cobblemon_kinetics:relationship/blueprint-basic-care']) as value;

select is(
  (select value #>> '{payload,schema_version}' from blueprint_publication_result),
  '1.1.0',
  'an evolution-aware publication uses the Blueprint-capable schema version'
);
select is(
  (select jsonb_array_length(value #> '{payload,records,blueprints}') from blueprint_publication_result),
  3,
  'relationship publication freezes the relationship plus its form and capability dependencies'
);
select is(
  (select jsonb_array_length(value #> '{payload,records,pokemon}') from blueprint_publication_result),
  1,
  'relationship publication also closes over the form species dependency'
);

select throws_ok(
  $$update public.pokemon_species set habitat = 'moon-base' where record_id = '41000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'RLS prevents direct factual mutation from the browser role'
);

reset role;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.blueprint_user_preferences), 0::bigint, 'Jake cannot read Daniel personal viewport preferences');

select * from finish();
rollback;
