begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(78);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  0::bigint,
  'every public table has row-level security enabled'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relforcerowsecurity
  ),
  0::bigint,
  'every public table forces row-level security'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_policy as policy where policy.polrelid = relation.oid
      )
  ),
  0::bigint,
  'every public table has at least one explicit policy'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
  ),
  0::bigint,
  'anonymous clients receive no public table grants'
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
  'authenticated clients receive no direct table mutation grants'
);

select is(
  (
    select count(*)
    from pg_proc as function
    join pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'public'
      and function.proname in (
        'claim_editor_access', 'get_editor_record', 'save_record_revision',
        'approve_record_revision', 'create_squirtle_publication_batch',
        'get_publication_bundle', 'validate_publication_batch',
        'reconcile_publication_commit'
      )
      and function.prosecdef
  ),
  0::bigint,
  'no exposed RPC is SECURITY DEFINER'
);

select is(
  (
    select count(*)
    from pg_proc as function
    join pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'private'
      and function.proname in ('canonical_jsonb', 'publication_payload_hash')
      and function.provolatile <> 's'
  ),
  0::bigint,
  'canonical publication hashing declares truthful stable volatility'
);

select ok(
  to_regprocedure('public.save_record_revision(text,bigint,uuid,jsonb)') is not null,
  'the optimistic save RPC exists with its stable signature'
);

select ok(
  to_regprocedure('public.approve_record_revision(text,bigint)') is not null,
  'the approval RPC exists with its stable signature'
);

select ok(
  to_regprocedure('public.get_publication_bundle(text)') is not null,
  'the public-projection bundle RPC exists with its stable signature'
);

select ok(
  to_regprocedure('public.create_squirtle_publication_batch(bigint)') is not null,
  'the first vertical-slice publication RPC exists with its stable signature'
);

select ok(
  to_regprocedure('public.reconcile_publication_commit(text,text,jsonb,uuid)') is not null,
  'the service-only publication reconciliation RPC exists with its stable signature'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reconcile_publication_commit(text,text,jsonb,uuid)',
    'EXECUTE'
  ),
  'authenticated browser sessions cannot execute publication reconciliation'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_publication_commit(text,text,jsonb,uuid)',
    'EXECUTE'
  ),
  'only the server service role receives publication reconciliation execution rights'
);

select is(
  (select count(*) from public.pokemon_species where national_dex = 7),
  1::bigint,
  'the local seed contains one Squirtle species fixture'
);

select is(
  (select count(*) from public.app_users),
  0::bigint,
  'the local seed contains no real or synthetic Auth memberships'
);

select is(
  (
    select count(*)
    from public.work_item_assignees
    where work_item_record_id = '00000000-0000-4000-8000-000000006001'
  ),
  0::bigint,
  'seeded work starts unassigned'
);

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'viewer@example.test',
    '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'editor@example.test',
    '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'maintainer@example.test',
    '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'claimant@example.test',
    '{"provider":"github","providers":["github"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into auth.identities (user_id, provider_id, identity_data, provider, created_at)
values (
  '10000000-0000-4000-8000-000000000004',
  '900004',
  '{"id":"900004","user_name":"fixture-claimant"}'::jsonb,
  'github',
  now()
);

insert into public.editor_allowlist (
  github_user_id, github_login, display_name, role, is_active
) values
  (900001, 'fixture-viewer', 'Fixture Viewer', 'viewer', true),
  (900002, 'fixture-editor', null, 'editor', true),
  (900003, 'fixture-maintainer', 'Fixture Maintainer', 'maintainer', true),
  (900004, 'fixture-claimant', null, 'viewer', true);

insert into public.app_users (
  auth_user_id, github_user_id, github_login, display_name, role, is_active
) values
  ('10000000-0000-4000-8000-000000000001', 900001, 'fixture-viewer', 'Fixture Viewer', 'viewer', true),
  ('10000000-0000-4000-8000-000000000002', 900002, 'fixture-editor', null, 'editor', true),
  ('10000000-0000-4000-8000-000000000003', 900003, 'fixture-maintainer', 'Fixture Maintainer', 'maintainer', true);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select lives_ok(
  $$ select public.claim_editor_access() $$,
  'an allowlisted numeric GitHub identity can claim project membership'
);
reset role;

select is(
  (
    select role::text
    from public.app_users
    where auth_user_id = '10000000-0000-4000-8000-000000000004'
  ),
  'viewer',
  'membership claiming copies the fresh database allowlist role'
);

set local role anon;
select throws_ok(
  $$ select count(*) from public.records $$,
  '42501',
  null,
  'anonymous clients cannot read private records'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(
  (select count(*) from public.records) > 0,
  'an active viewer can read private records through RLS'
);

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      1,
      '20000000-0000-4000-8000-000000000001',
      '{"balance":{"efficiency":1.1}}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'a viewer cannot call the editor save implementation'
);

select throws_ok(
  $$ select public.claim_editor_access() $$,
  'PGRST',
  null,
  'membership claiming requires a verified GitHub identity, not user metadata'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      1,
      '20000000-0000-4000-8000-000000000011',
      '{"arbitrary_field":"bypass"}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'direct RPC calls cannot add arbitrary editor fields'
);

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      1,
      '20000000-0000-4000-8000-000000000012',
      '{"balance":{"efficiency":4.01}}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'direct RPC calls cannot bypass generic balance limits'
);

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      1,
      '20000000-0000-4000-8000-000000000013',
      '{"work":{"machine_id":"not a registry id"}}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'direct RPC calls cannot save a malformed registry relationship'
);

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle/default',
      1,
      '20000000-0000-4000-8000-000000000014',
      '{"private_note":"forms are modeled but not independently editable"}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'records without an active Studio editor contract reject direct edits'
);

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      null,
      '20000000-0000-4000-8000-000000000015',
      '{"balance":{"efficiency":1.1}}'::jsonb
    )
  $$,
  '22023',
  null,
  'the save RPC requires a valid expected revision'
);

select lives_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      1,
      '20000000-0000-4000-8000-000000000002',
      '{"balance":{"efficiency":1.25,"public_rationale":"Test-approved Hydro rationale."},"private_note":"test-only private note"}'::jsonb
    )
  $$,
  'an editor can save a revision through the checked RPC'
);

select is(
  (select current_revision from public.records where public_id = 'cobblemon_kinetics:pokemon/squirtle'),
  2::bigint,
  'a successful save advances the revision exactly once'
);

select is(
  public.get_editor_record('cobblemon_kinetics:pokemon/squirtle')
    #>> '{record,updated_by_display_name}',
  'fixture-editor',
  'private editor records fall back to the collaborator GitHub login'
);

select is(
  public.get_editor_record('cobblemon_kinetics:pokemon/squirtle')
    #>> '{revisions,0,actor_display_name}',
  'fixture-editor',
  'private revision history resolves actor display names with GitHub login fallback'
);

select throws_ok(
  $$
    select public.save_record_revision(
      'cobblemon_kinetics:pokemon/squirtle',
      1,
      '20000000-0000-4000-8000-000000000003',
      '{"balance":{"efficiency":1.5}}'::jsonb
    )
  $$,
  'PGRST',
  null,
  'a stale expected revision is rejected as a typed conflict'
);

select throws_ok(
  $$ select public.approve_record_revision('cobblemon_kinetics:pokemon/squirtle', 2) $$,
  'PGRST',
  null,
  'an editor cannot approve a revision'
);
reset role;

update public.records
set content = jsonb_set(content, '{balance,efficiency}', '99'::jsonb, true)
where public_id = 'cobblemon_kinetics:pokemon/squirtle';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$ select public.approve_record_revision('cobblemon_kinetics:pokemon/squirtle', 2) $$,
  'PGRST',
  null,
  'approval revalidates authoritative record content'
);
reset role;

update public.records as record
set content = revision.snapshot
from public.record_revisions as revision
where record.id = revision.record_id
  and record.public_id = 'cobblemon_kinetics:pokemon/squirtle'
  and revision.revision_number = 2;

update public.records
set content = jsonb_set(
  content,
  '{balance,public_rationale}',
  '"Valid but not revisioned."'::jsonb
)
where public_id = 'cobblemon_kinetics:pokemon/squirtle';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$ select public.approve_record_revision('cobblemon_kinetics:pokemon/squirtle', 2) $$,
  'PGRST',
  null,
  'approval rejects a valid head that diverges from its immutable revision snapshot'
);
reset role;

update public.records as record
set content = revision.snapshot
from public.record_revisions as revision
where record.id = revision.record_id
  and record.public_id = 'cobblemon_kinetics:pokemon/squirtle'
  and revision.revision_number = 2;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select lives_ok(
  $$ select public.approve_record_revision('cobblemon_kinetics:pokemon/squirtle', 2) $$,
  'a maintainer can approve the exact current revision'
);

select is(
  (select workflow_state from public.records where public_id = 'cobblemon_kinetics:pokemon/squirtle'),
  'approved',
  'approval changes workflow state without inventing a new content revision'
);
reset role;

update public.editor_allowlist set is_active = false where github_user_id = 900002;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select ok(
  not private.has_app_role('viewer'::public.app_role),
  'deactivating the allowlist immediately revokes membership'
);
reset role;

update public.editor_allowlist set is_active = true, role = 'viewer' where github_user_id = 900002;
select is(
  (select role::text from public.app_users where auth_user_id = '10000000-0000-4000-8000-000000000002'),
  'viewer',
  'allowlist role changes synchronize to active membership rows'
);
update public.editor_allowlist set role = 'editor' where github_user_id = 900002;

insert into public.work_item_assignees (work_item_record_id, assignee_id, assigned_by)
values (
  '00000000-0000-4000-8000-000000006001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003'
);

select throws_ok(
  $$
    insert into public.work_item_assignees (work_item_record_id, assignee_id, assigned_by)
    values (
      '00000000-0000-4000-8000-000000006001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  '23514',
  null,
  'multiple assignees require an explicit handoff note'
);

select is(
  (
    select count(*)
    from public.work_item_assignees
    where work_item_record_id = '00000000-0000-4000-8000-000000006001'
  ),
  1::bigint,
  'a rejected shared assignment leaves the original assignment intact'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_squirtle_publication_batch(2) $$,
  'PGRST',
  null,
  'an editor cannot freeze or validate a publication batch'
);
reset role;

insert into public.publication_batches (
  id, public_id, state, schema_version
) values (
  '30000000-0000-4000-8000-000000000001',
  'publication-20260814-private-test',
  'draft',
  '1.0.0'
);

insert into public.publication_batch_records (
  batch_id, record_id, revision_number, public_projection, checksum
)
select
  '30000000-0000-4000-8000-000000000001',
  record.id,
  revision.revision_number,
  jsonb_build_object(
    'format_version', 1,
    'public_id', record.public_id,
    'private_note', revision.snapshot ->> 'private_note'
  ),
  revision.checksum
from public.records as record
join public.record_revisions as revision
  on revision.record_id = record.id and revision.revision_number = 2
where record.public_id = 'cobblemon_kinetics:pokemon/squirtle';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$ select public.validate_publication_batch('publication-20260814-private-test') $$,
  'PGRST',
  null,
  'publication validation rejects private fields even through a direct RPC call'
);
reset role;

update public.jobs
set description = 'Unreviewed normalized-table mutation.'
where record_id = '00000000-0000-4000-8000-000000003001';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_squirtle_publication_batch(2) $$,
  'PGRST',
  null,
  'publication rejects mutable normalized data that drifted from approved snapshots'
);
reset role;

update public.jobs
set description = 'Direct a Water-type stream into a kinetic network.'
where record_id = '00000000-0000-4000-8000-000000003001';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;

select lives_ok(
  $$ select public.create_squirtle_publication_batch(2) $$,
  'a maintainer can freeze and validate the exact approved vertical slice'
);

select lives_ok(
  $$ select public.create_squirtle_publication_batch(2) $$,
  'repeating the same publication request is idempotent'
);
reset role;

select is(
  (
    select count(*)
    from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  ),
  1::bigint,
  'idempotent publication requests create one deterministic batch'
);

select is(
  (
    select count(*)
    from public.audit_events
    where action = 'publication.frozen'
  ),
  1::bigint,
  'an idempotent publication retry does not duplicate its audit event'
);

select is(
  (
    select count(*)
    from public.publication_batch_records as batch_record
    join public.publication_batches as batch on batch.id = batch_record.batch_id
    where batch.notes = 'Squirtle to Hydro Coupler vertical slice'
  ),
  4::bigint,
  'the vertical-slice batch freezes all four exact source revisions'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is(
  jsonb_array_length(
    public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    )) #> '{payload,records,pokemon}'
  ),
  1,
  'the canonical publication payload contains one Pokemon record'
);

select is(
  jsonb_array_length(
    public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    )) #> '{payload,records,jobs}'
  ),
  1,
  'the canonical publication payload contains one job record'
);

select is(
  jsonb_array_length(
    public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    )) #> '{payload,records,machines}'
  ),
  1,
  'the canonical publication payload contains one machine record'
);

select is(
  jsonb_array_length(
    public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    )) #> '{payload,records,work_profiles}'
  ),
  1,
  'the canonical publication payload contains one work profile'
);

select is(
  jsonb_array_length(
    public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    )) #> '{payload,asset_manifest,assets}'
  ),
  0,
  'the first bundle uses an explicit empty rights-reviewed asset manifest'
);

select ok(
  public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,records,pokemon,0,work_assignments,0,efficiency_multiplier}' = '1.25'
  and public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,records,work_profiles,0,contribution,efficiency_multiplier}' = '1.25'
  and public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,records,work_profiles,0,contribution,rpm}' = '8'
  and public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,records,work_profiles,0,contribution,capacity_per_rpm}' = '64',
  'the approved efficiency and preserved 8 RPM / 64 capacity defaults reach both public consumers'
);

select ok(
  public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,records,pokemon,0,work_assignments,0,public_rationale}' = 'Test-approved Hydro rationale.'
  and public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,records,work_profiles,0,public_rationale}' = 'Test-approved Hydro rationale.',
  'the approved public rationale is projected into both public consumers'
);

select ok(
  public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  ))::text not like '%private_note%'
  and public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  ))::text not like '%actor_id%'
  and public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  ))::text not like '%display_name%',
  'publication bundles exclude private notes and every actor identity field'
);
reset role;

select is(
  public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{publication,content_hash}',
  private.publication_payload_hash(
    public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    )) -> 'payload'
  ),
  'the stored content hash equals the canonical public payload hash'
);

select ok(
  public.get_publication_bundle((
    select public_id from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  )) #>> '{payload,batch_id}'
    ~ '^cobblemon_kinetics:publication/[0-9]{8}-squirtle-hydro-r2-[a-f0-9]{16}$',
  'the canonical batch ID is stable and resource-location safe'
);

create temporary table reconciliation_fixture (
  publication_id text primary key,
  manifest jsonb not null
) on commit drop;

insert into reconciliation_fixture (publication_id, manifest)
select
  batch.public_id,
  jsonb_build_object(
    'manifest_version', 1,
    'schema_version', batch.schema_version,
    'batch_id', private.build_publication_payload(batch.id) ->> 'batch_id',
    'bundle_content_sha256', batch.content_hash,
    'files', jsonb_build_array(
      jsonb_build_object(
        'path', 'assets/manifest.json',
        'sha256', repeat('a', 64),
        'kind', 'asset_manifest',
        'record_count', 0
      ),
      jsonb_build_object(
        'path', 'jobs/hydro-operator.json',
        'sha256', repeat('b', 64),
        'kind', 'job',
        'record_count', 1
      ),
      jsonb_build_object(
        'path', 'machines/hydro-coupler.json',
        'sha256', repeat('c', 64),
        'kind', 'machine',
        'record_count', 1
      ),
      jsonb_build_object(
        'path', 'pokemon/gen1.json',
        'sha256', repeat('d', 64),
        'kind', 'pokemon_collection',
        'record_count', 1
      ),
      jsonb_build_object(
        'path', 'work_profiles/hydro_operator.json',
        'sha256', repeat('e', 64),
        'kind', 'work_profile',
        'record_count', 1
      )
    )
  )
from public.publication_batches as batch
where batch.notes = 'Squirtle to Hydro Coupler vertical slice';

grant select on reconciliation_fixture to authenticated, service_role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  null,
  'an authenticated maintainer cannot invoke the service-only reconciliation RPC'
);
reset role;

set local role service_role;
select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000002'
    )
  $$,
  'PGRST',
  null,
  'the service role cannot attribute publication to a non-maintainer actor'
);

select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      'ABC123',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rejects noncanonical Git commit SHAs'
);

select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture) || '{"private_note":"leak"}'::jsonb,
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rejects private or extra manifest fields'
);

select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture) #- '{files,4}',
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rejects an incomplete deterministic manifest file set'
);
reset role;

update public.jobs
set description = 'Post-export normalized-table mutation.'
where record_id = '00000000-0000-4000-8000-000000003001';

set local role service_role;
select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rechecks normalized rows against frozen immutable snapshots'
);
reset role;

update public.jobs
set description = 'Direct a Water-type stream into a kinetic network.'
where record_id = '00000000-0000-4000-8000-000000003001';

update public.publication_batch_records as batch_record
set checksum = repeat('f', 64)
from public.publication_batches as batch, public.records as record
where batch.id = batch_record.batch_id
  and record.id = batch_record.record_id
  and batch.notes = 'Squirtle to Hydro Coupler vertical slice'
  and record.public_id = 'cobblemon_kinetics:pokemon/squirtle';

set local role service_role;
select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rejects drift in an exact frozen revision checksum'
);
reset role;

update public.publication_batch_records as batch_record
set checksum = revision.checksum
from public.publication_batches as batch,
     public.records as record,
     public.record_revisions as revision
where batch.id = batch_record.batch_id
  and record.id = batch_record.record_id
  and revision.record_id = batch_record.record_id
  and revision.revision_number = batch_record.revision_number
  and batch.notes = 'Squirtle to Hydro Coupler vertical slice'
  and record.public_id = 'cobblemon_kinetics:pokemon/squirtle';

set local role service_role;
select lives_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'the service role can reconcile a verified commit for an active maintainer'
);
reset role;

select is(
  (
    select state
    from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  ),
  'published',
  'successful reconciliation marks the batch published'
);

select ok(
  (
    select git_commit_sha = '1111111111111111111111111111111111111111'
      and published_by = '10000000-0000-4000-8000-000000000003'
      and published_manifest = (select manifest from reconciliation_fixture)
    from public.publication_batches
    where notes = 'Squirtle to Hydro Coupler vertical slice'
  ),
  'reconciliation persists the exact commit, manifest, and maintainer attribution'
);

set local role service_role;
select lives_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'repeating identical reconciliation is idempotent'
);
reset role;

select is(
  (select count(*) from public.audit_events where action = 'publication.published'),
  1::bigint,
  'idempotent reconciliation writes one publication audit event'
);

set local role service_role;
select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '2222222222222222222222222222222222222222',
      (select manifest from reconciliation_fixture),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rejects a conflicting Git commit for a published batch'
);

select throws_ok(
  $$
    select public.reconcile_publication_commit(
      (select publication_id from reconciliation_fixture),
      '1111111111111111111111111111111111111111',
      jsonb_set(
        (select manifest from reconciliation_fixture),
        '{files,0,sha256}',
        to_jsonb(repeat('9', 64))
      ),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'PGRST',
  null,
  'reconciliation rejects a conflicting manifest for the same commit'
);
reset role;

update public.publication_batch_records as batch_record
set public_projection = jsonb_set(
  batch_record.public_projection,
  '{contribution,efficiency_multiplier}',
  '1.5'::jsonb
)
from public.publication_batches as batch, public.records as record
where batch.id = batch_record.batch_id
  and record.id = batch_record.record_id
  and batch.notes = 'Squirtle to Hydro Coupler vertical slice'
  and record.record_kind = 'work_profile';

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$
    select public.get_publication_bundle((
      select public_id from public.publication_batches
      where notes = 'Squirtle to Hydro Coupler vertical slice'
    ))
  $$,
  'PGRST',
  null,
  'bundle retrieval detects projection drift after validation'
);
reset role;

select is(
  (
    select count(*)
    from storage.buckets as bucket
    where bucket.id in ('asset-candidates', 'published-assets')
      and not bucket.public
  ),
  2::bigint,
  'both asset buckets begin private'
);

select is(
  (
    select count(*)
    from pg_policy as policy
    join pg_class as relation on relation.oid = policy.polrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    join pg_roles as anon_role on anon_role.rolname = 'anon'
    where namespace.nspname = 'storage'
      and relation.relname = 'objects'
      and anon_role.oid = any (policy.polroles)
      and policy.polname like 'cobblemon_kinetics_%'
  ),
  0::bigint,
  'asset storage defines no anonymous access policy in private mode'
);

select is(
  (
    select count(*)
    from pg_proc as function
    join pg_namespace as namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'private'
      and function.prosrc ilike '%user_metadata%'
  ),
  0::bigint,
  'authorization code never relies on user-editable metadata'
);

select * from finish();
rollback;
