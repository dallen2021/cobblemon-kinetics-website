begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

select ok(
  to_regprocedure('public.list_editor_records(text,text,text,text,text,integer,text)') is not null,
  'the generic Studio directory RPC has a stable signature'
);

select ok(
  to_regprocedure('public.get_editor_record(text)') is not null,
  'the generic Studio detail RPC has a stable signature'
);

select ok(
  to_regprocedure('public.get_record_head(text)') is not null,
  'the lightweight stale-head RPC has a stable signature'
);

select ok(
  to_regprocedure('public.save_record_revision(text,bigint,uuid,jsonb)') is not null,
  'generic optimistic record saves use an exact expected revision'
);

select ok(
  to_regprocedure('public.add_record_comment(text,text)') is not null,
  'private record comments use a generic record identifier'
);

select ok(
  to_regprocedure('public.set_work_item_assignees(text,bigint,uuid[],text,text,text)') is not null,
  'work-item assignment saves carry an expected revision'
);

select ok(
  to_regprocedure('public.create_publication_batch(text[])') is not null,
  'generic publication batches accept selected public IDs'
);

select ok(
  to_regprocedure('public.apply_gen1_workbook_import(jsonb,text)') is not null,
  'the controlled service-only workbook import RPC exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_gen1_workbook_import(jsonb,text)',
    'EXECUTE'
  ),
  'browser sessions cannot run workbook application'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_gen1_workbook_import(jsonb,text)',
    'EXECUTE'
  ),
  'only the service role can run workbook application'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'record_field_provenance',
        'type_workshop_plans',
        'pokemon_design_ideas',
        'machine_research',
        'work_item_links'
      )
      and relation.relforcerowsecurity
  ),
  5::bigint,
  'all new Gen 1 planning tables force row-level security'
);

-- The test accounts represent equal maintainers. There is no implied owner on
-- either the record imported from source data or the neutral work item.
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '20000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'daniel@example.test',
    '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'jake@example.test',
    '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.editor_allowlist (
  github_user_id, github_login, display_name, role, is_active
) values
  (910001, 'fixture-daniel', 'Fixture Daniel', 'maintainer', true),
  (910002, 'fixture-jake', 'Fixture Jake', 'maintainer', true);

insert into public.app_users (
  auth_user_id, github_user_id, github_login, display_name, role, is_active
) values
  ('20000000-0000-4000-8000-000000000001', 910001, 'fixture-daniel', 'Fixture Daniel', 'maintainer', true),
  ('20000000-0000-4000-8000-000000000002', 910002, 'fixture-jake', 'Fixture Jake', 'maintainer', true);

select is(
  (select count(*) from public.app_users where role = 'maintainer' and is_active),
  2::bigint,
  'Daniel and Jake fixtures have equal active maintainer authority'
);

-- A non-Squirtle record proves that the generic editor contract is not a
-- disguised vertical-slice-only path.
insert into public.records (
  id, public_id, slug, display_name, record_kind, workflow_state, schema_version, current_revision, content
) values (
  '00000000-0000-4000-8000-000000000025',
  'cobblemon_kinetics:pokemon/pikachu-test',
  'pikachu-test',
  'Pikachu Test',
  'pokemon_species',
  'draft',
  '1.0.0',
  1,
  jsonb_build_object(
    'facts', jsonb_build_object('national_dex', 25, 'cobblemon_id', 'cobblemon:pikachu'),
    'typing', jsonb_build_object('current', jsonb_build_array('electric'), 'original_gen_i', jsonb_build_array('electric'), 'type_changed', false),
    'design', '{}'::jsonb,
    'work', jsonb_build_object('readiness', 'not_started'),
    'balance', jsonb_build_object('efficiency', 1.0, 'public_rationale', ''),
    'testing', '{}'::jsonb,
    'private_note', ''
  )
);

insert into public.record_revisions (
  record_id, revision_number, schema_version, snapshot, checksum, change_summary
)
select id, 1, schema_version, content, checksum, 'Seeded generic editor contract fixture'
from public.records
where id = '00000000-0000-4000-8000-000000000025';

insert into public.pokemon_species (
  record_id, national_dex, generation_id, cobblemon_species_id, api_slug
) values (
  '00000000-0000-4000-8000-000000000025', 25, 1, 'cobblemon:pikachu', 'pikachu'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(
    public.list_editor_records('pokemon_species', 'pikachu-test', null, null, null, 10, null) -> 'items'
  ),
  1,
  'the generic directory locates a non-Squirtle Gen 1 record'
);

select is(
  public.list_editor_records('pokemon_species', 'pikachu-test', null, null, null, 10, null)
    #>> '{items,0,public_id}',
  'cobblemon_kinetics:pokemon/pikachu-test',
  'directory rows carry a durable public identifier'
);

select lives_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/pikachu-test',
      1,
      '30000000-0000-4000-8000-000000000025',
      '{"design":{"candidate_direction":"Use an Electric-type control role."},"testing":{"status":"planned"}}'::jsonb
    )
  $$,
  'a maintainer can edit a non-Squirtle Pokémon through the generic contract'
);

select is(
  (select current_revision from public.records where public_id = 'cobblemon_kinetics:pokemon/pikachu-test'),
  2::bigint,
  'a generic Pokémon save produces one immutable head revision'
);

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/pikachu-test',
      1,
      '30000000-0000-4000-8000-000000000026',
      '{"design":{"candidate_direction":"A stale overwrite."}}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'a second maintainer receives a stale-save conflict instead of overwriting'
);

select lives_ok(
  $$ select public.add_record_comment('cobblemon_kinetics:pokemon/pikachu-test', 'Review the control cap before approval.') $$,
  'maintainers can add private collaboration comments to any editable record'
);

select is(
  jsonb_array_length(public.get_editor_record('cobblemon_kinetics:pokemon/pikachu-test') -> 'comments'),
  1,
  'the generic record detail returns its private comment history'
);

select is(
  public.get_record_head('cobblemon_kinetics:pokemon/pikachu-test') ->> 'revision',
  '2',
  'the lightweight stale-record endpoint reports the current generic head'
);

select throws_ok(
  $$
    select public.set_work_item_assignees(
      'cobblemon_kinetics:work/verify_hydro_coupler',
      1,
      array['20000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000002'::uuid],
      '',
      'in_progress',
      'high'
    )
  $$,
  '23514',
  null,
  'sharing a work item without an explicit handoff note is rejected'
);

select lives_ok(
  $$
    select public.set_work_item_assignees(
      'cobblemon_kinetics:work/verify_hydro_coupler',
      1,
      array['20000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000002'::uuid],
      'Daniel validates exports; Jake reviews the workstation relationship.',
      'in_progress',
      'high'
    )
  $$,
  'both maintainers can explicitly share work with a handoff note'
);

select is(
  (
    select count(*)
    from public.work_item_assignees
    where work_item_record_id = '00000000-0000-4000-8000-000000006001'
  ),
  2::bigint,
  'shared work records both explicit assignments and no inferred owner'
);

select is(
  (
    select suggested_by is null
    from public.work_items
    where record_id = '00000000-0000-4000-8000-000000006001'
  ),
  true,
  'source or creator metadata never becomes a task owner'
);

select throws_ok(
  $$
    select public.set_work_item_assignees(
      'cobblemon_kinetics:work/verify_hydro_coupler',
      1,
      array['20000000-0000-4000-8000-000000000001'::uuid],
      '',
      'review',
      'normal'
    )
  $$,
  'PGRST',
  null,
  'stale work-item assignment saves receive the same conflict protection'
);

select lives_ok(
  $$ select public.approve_record_revision('cobblemon_kinetics:pokemon/pikachu-test', 2) $$,
  'either equal maintainer can approve an exact non-Squirtle revision'
);

select is(
  (select workflow_state from public.records where public_id = 'cobblemon_kinetics:pokemon/pikachu-test'),
  'approved',
  'approval changes workflow state without changing the approved snapshot'
);

select lives_ok(
  $$ select public.approve_record_revision('cobblemon_kinetics:pokemon/squirtle', 1) $$,
  'the existing Hydro species can be approved through the generic approval path'
);

select lives_ok(
  $$ select public.create_publication_batch(array['cobblemon_kinetics:pokemon/squirtle']) $$,
  'a generic batch automatically closes the selected species over its Hydro dependencies'
);

select is(
  (
    select count(*)
    from public.publication_batch_records as batch_record
    join public.publication_batches as batch on batch.id = batch_record.batch_id
    where batch.notes = 'Generic Studio publication batch'
  ),
  4::bigint,
  'generic publication closure freezes the species, profile, job, and machine together'
);

select is(
  (
    select jsonb_array_length(
      public.get_publication_bundle(batch.public_id) #> '{payload,records,work_profiles}'
    )
    from public.publication_batches as batch
    where batch.notes = 'Generic Studio publication batch'
    order by batch.created_at desc
    limit 1
  ),
  1,
  'generic publication bundles preserve the required work-profile projection'
);

reset role;

select * from finish();
rollback;
