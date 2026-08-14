begin;

create or replace function private.role_rank(p_role public.app_role)
returns smallint
language sql
immutable
strict
set search_path = ''
as $$
  select case p_role
    when 'viewer'::public.app_role then 1
    when 'editor'::public.app_role then 2
    when 'maintainer'::public.app_role then 3
  end::smallint;
$$;

create or replace function private.has_app_role(p_minimum public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.app_users as app_user
      join public.editor_allowlist as allowlist
        on allowlist.github_user_id = app_user.github_user_id
      where app_user.auth_user_id = (select auth.uid())
        and app_user.is_active
        and allowlist.is_active
        and private.role_rank(app_user.role) >= private.role_rank(p_minimum)
        and private.role_rank(allowlist.role) >= private.role_rank(p_minimum)
    );
$$;

create or replace function private.require_app_role(p_minimum public.app_role)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
begin
  if v_auth_user_id is null then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'authentication_required',
        'message', 'A verified user session is required.'
      )::text,
      detail = json_build_object('status', 401, 'status_text', 'Unauthorized')::text;
  end if;

  if not private.has_app_role(p_minimum) then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'membership_required',
        'message', 'This account is not an active project member with the required role.'
      )::text,
      detail = json_build_object('status', 403, 'status_text', 'Forbidden')::text;
  end if;

  return v_auth_user_id;
end;
$$;

create or replace function private.sync_allowlist_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.app_users
  set github_login = new.github_login,
      display_name = new.display_name,
      role = new.role,
      is_active = new.is_active
  where github_user_id = new.github_user_id;
  return new;
end;
$$;

create trigger editor_allowlist_sync_membership
after update of github_login, display_name, role, is_active
on public.editor_allowlist
for each row execute function private.sync_allowlist_membership();

create or replace function private.claim_editor_access()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_provider_id text;
  v_github_user_id bigint;
  v_allowlist public.editor_allowlist%rowtype;
  v_app_user public.app_users%rowtype;
begin
  if v_auth_user_id is null then
    raise sqlstate 'PGRST' using
      message = '{"code":"authentication_required","message":"A verified user session is required."}',
      detail = '{"status":401,"status_text":"Unauthorized"}';
  end if;

  select coalesce(identity.provider_id, identity.identity_data ->> 'id')
  into v_provider_id
  from auth.identities as identity
  where identity.user_id = v_auth_user_id
    and identity.provider = 'github'
  order by identity.created_at asc
  limit 1;

  if v_provider_id is null or v_provider_id !~ '^[0-9]+$' then
    raise sqlstate 'PGRST' using
      message = '{"code":"github_identity_required","message":"A verified GitHub identity is required."}',
      detail = '{"status":403,"status_text":"Forbidden"}';
  end if;

  v_github_user_id := v_provider_id::bigint;

  select *
  into v_allowlist
  from public.editor_allowlist
  where github_user_id = v_github_user_id
    and is_active;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"not_allowlisted","message":"This GitHub account is not on the project allowlist."}',
      detail = '{"status":403,"status_text":"Forbidden"}';
  end if;

  insert into public.app_users (
    auth_user_id,
    github_user_id,
    github_login,
    display_name,
    role,
    is_active,
    last_seen_at
  ) values (
    v_auth_user_id,
    v_allowlist.github_user_id,
    v_allowlist.github_login,
    v_allowlist.display_name,
    v_allowlist.role,
    true,
    clock_timestamp()
  )
  on conflict (auth_user_id) do update
  set github_user_id = excluded.github_user_id,
      github_login = excluded.github_login,
      display_name = excluded.display_name,
      role = excluded.role,
      is_active = excluded.is_active,
      last_seen_at = excluded.last_seen_at
  returning * into v_app_user;

  return jsonb_build_object(
    'auth_user_id', v_app_user.auth_user_id,
    'github_user_id', v_app_user.github_user_id,
    'github_login', v_app_user.github_login,
    'display_name', v_app_user.display_name,
    'role', v_app_user.role,
    'is_active', v_app_user.is_active,
    'last_seen_at', v_app_user.last_seen_at
  );
end;
$$;

create or replace function private.editor_record_json(p_record public.records)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select (p_record).content || jsonb_build_object(
    'id', (p_record).id,
    'public_id', (p_record).public_id,
    'slug', (p_record).slug,
    'display_name', (p_record).display_name,
    'record_kind', (p_record).record_kind,
    'revision', (p_record).current_revision,
    'workflow_state', (p_record).workflow_state,
    'schema_version', (p_record).schema_version,
    'checksum', (p_record).checksum,
    'updated_at', (p_record).updated_at,
    'updated_by', (p_record).updated_by,
    'updated_by_display_name', (
      select coalesce(nullif(btrim(app_user.display_name), ''), app_user.github_login)
      from public.app_users as app_user
      where app_user.auth_user_id = (p_record).updated_by
    ),
    'approved_revision', (p_record).approved_revision,
    'approved_at', (p_record).approved_at,
    'approved_by', (p_record).approved_by,
    'approved_by_display_name', (
      select coalesce(nullif(btrim(app_user.display_name), ''), app_user.github_login)
      from public.app_users as app_user
      where app_user.auth_user_id = (p_record).approved_by
    )
  );
$$;

create or replace function private.revision_json(p_revision public.record_revisions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', (p_revision).id,
    'revision', (p_revision).revision_number,
    'schema_version', (p_revision).schema_version,
    'snapshot', (p_revision).snapshot,
    'checksum', (p_revision).checksum,
    'actor_id', (p_revision).actor_id,
    'actor_display_name', (
      select coalesce(nullif(btrim(app_user.display_name), ''), app_user.github_login)
      from public.app_users as app_user
      where app_user.auth_user_id = (p_revision).actor_id
    ),
    'client_mutation_id', (p_revision).client_mutation_id,
    'change_summary', (p_revision).change_summary,
    'created_at', (p_revision).created_at
  );
$$;

-- Record-kind dispatch is the authoritative database validation boundary for
-- direct RPC calls. Add a branch here when a later vertical slice makes a new
-- record kind editable; do not weaken the default rejection.
create or replace function private.validate_editor_content(p_record public.records)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_content jsonb := (p_record).content;
begin
  if (p_record).public_id <> 'cobblemon_kinetics:pokemon/squirtle'
     or (p_record).record_kind <> 'pokemon_species' then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_editable","message":"This record does not have a database editor contract yet."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content -> 'machine_id') <> 'string'
     or v_content ->> 'machine_id' <> 'cobblemon_kinetics:hydro_coupler' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_machine","message":"The Squirtle slice only supports the Hydro Coupler machine."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content -> 'job_id') <> 'string'
     or v_content ->> 'job_id' <> 'cobblemon_kinetics:hydro_operator' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_job","message":"The Squirtle slice only supports the Hydro Operator job."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if not exists (
    select 1 from public.records
    where public_id = 'cobblemon_kinetics:hydro_coupler' and record_kind = 'machine'
  ) or not exists (
    select 1 from public.records
    where public_id = 'cobblemon_kinetics:hydro_operator' and record_kind = 'job'
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"missing_relationship","message":"The configured machine or job record does not exist."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content -> 'efficiency') <> 'number'
     or (v_content ->> 'efficiency')::numeric < 0.25
     or (v_content ->> 'efficiency')::numeric > 2 then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_efficiency","message":"Efficiency must be a number from 0.25 through 2."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content -> 'public_rationale') <> 'string'
     or length(btrim(v_content ->> 'public_rationale')) < 1
     or length(v_content ->> 'public_rationale') > 500 then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_public_rationale","message":"Public rationale must contain 1 to 500 characters."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content -> 'private_note') <> 'string'
     or length(v_content ->> 'private_note') > 2000 then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_private_note","message":"Private note must contain at most 2000 characters."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;
end;
$$;

create or replace function private.validate_editor_patch(
  p_record public.records,
  p_patch jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_candidate public.records%rowtype := p_record;
begin
  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_key(key)
    where patch_key.key <> all (array[
      'machine_id', 'job_id', 'efficiency', 'public_rationale', 'private_note'
    ])
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"unknown_editor_field","message":"The patch contains a field that is not editable for this record."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  v_candidate.content := (p_record).content || p_patch;
  perform private.validate_editor_content(v_candidate);
end;
$$;

create or replace function private.get_editor_record(p_public_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_record public.records%rowtype;
  v_revisions jsonb;
begin
  perform private.require_app_role('viewer'::public.app_role);

  select * into v_record
  from public.records
  where public_id = p_public_id;

  if not found then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'record_not_found',
        'message', 'No editable record exists for the requested public ID.'
      )::text,
      detail = json_build_object('status', 404, 'status_text', 'Not Found')::text;
  end if;

  select coalesce(jsonb_agg(revision_payload order by revision_number desc), '[]'::jsonb)
  into v_revisions
  from (
    select revision.revision_number,
           private.revision_json(revision) as revision_payload
    from public.record_revisions as revision
    where revision.record_id = v_record.id
    order by revision.revision_number desc
    limit 50
  ) as recent_revisions;

  return jsonb_build_object(
    'record', private.editor_record_json(v_record),
    'revisions', v_revisions
  );
end;
$$;

create or replace function private.save_record_revision(
  p_public_id text,
  p_expected_revision bigint,
  p_client_mutation_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_record public.records%rowtype;
  v_revision public.record_revisions%rowtype;
  v_existing_revision public.record_revisions%rowtype;
  v_content jsonb;
  v_checksum text;
  v_new_revision bigint;
  v_changed_keys text;
begin
  v_auth_user_id := private.require_app_role('editor'::public.app_role);

  if p_expected_revision is null or p_expected_revision < 0 then
    raise sqlstate '22023' using message = 'expected_revision must be a non-negative integer';
  end if;

  if p_client_mutation_id is null then
    raise sqlstate '22023' using message = 'client_mutation_id is required';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise sqlstate '22023' using message = 'patch must be a non-empty JSON object';
  end if;

  if octet_length(p_patch::text) > 1048576 then
    raise sqlstate '22023' using message = 'patch exceeds the 1 MiB limit';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_key(key)
    where patch_key.key = any (array[
      'id', 'public_id', 'slug', 'display_name', 'record_kind', 'revision',
      'workflow_state', 'schema_version', 'checksum', 'updated_at', 'updated_by',
      'approved_revision', 'approved_at', 'approved_by'
    ])
  ) then
    raise sqlstate '22023' using message = 'patch contains a reserved record key';
  end if;

  select * into v_record
  from public.records
  where public_id = p_public_id
  for update;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_found","message":"No editable record exists for the requested public ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  select * into v_existing_revision
  from public.record_revisions
  where record_id = v_record.id
    and actor_id = v_auth_user_id
    and client_mutation_id = p_client_mutation_id;

  if found then
    return jsonb_build_object(
      'record', private.editor_record_json(v_record),
      'revision', private.revision_json(v_existing_revision),
      'revisions', jsonb_build_array(private.revision_json(v_existing_revision))
    );
  end if;

  if v_record.current_revision <> p_expected_revision then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'revision_conflict',
        'message', 'The record changed after this editor loaded it.',
        'expected_revision', p_expected_revision,
        'current_revision', v_record.current_revision
      )::text,
      detail = json_build_object('status', 409, 'status_text', 'Conflict')::text;
  end if;

  if v_record.workflow_state = 'archived' then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_archived","message":"Archived records cannot be edited."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  perform private.validate_editor_patch(v_record, p_patch);

  v_content := v_record.content || p_patch;
  v_checksum := encode(extensions.digest(v_content::text, 'sha256'), 'hex');
  v_new_revision := v_record.current_revision + 1;

  select string_agg(key, ', ' order by key)
  into v_changed_keys
  from jsonb_object_keys(p_patch) as changed(key);

  update public.records
  set content = v_content,
      checksum = v_checksum,
      current_revision = v_new_revision,
      workflow_state = case when workflow_state = 'approved' then 'draft' else workflow_state end,
      approved_revision = null,
      approved_by = null,
      approved_at = null,
      updated_by = v_auth_user_id
  where id = v_record.id
  returning * into v_record;

  insert into public.record_revisions (
    record_id,
    revision_number,
    schema_version,
    snapshot,
    checksum,
    actor_id,
    client_mutation_id,
    change_summary
  ) values (
    v_record.id,
    v_new_revision,
    v_record.schema_version,
    v_content,
    v_checksum,
    v_auth_user_id,
    p_client_mutation_id,
    'Updated ' || v_changed_keys
  )
  returning * into v_revision;

  insert into public.audit_events (
    record_id,
    actor_id,
    action,
    before_revision,
    after_revision,
    request_id,
    metadata
  ) values (
    v_record.id,
    v_auth_user_id,
    'record.saved',
    p_expected_revision,
    v_new_revision,
    p_client_mutation_id,
    jsonb_build_object('changed_keys', to_jsonb(string_to_array(v_changed_keys, ', ')))
  );

  return jsonb_build_object(
    'record', private.editor_record_json(v_record),
    'revision', private.revision_json(v_revision),
    'revisions', jsonb_build_array(private.revision_json(v_revision))
  );
end;
$$;

create or replace function private.contains_forbidden_public_key(p_value jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_pair record;
  v_item jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    for v_pair in select key, value from jsonb_each(p_value)
    loop
      if v_pair.key = any (array[
        'private_note', 'internal_notes', 'comments', 'comment',
        'raw_value', 'normalized_value', 'actor_id', 'author_id',
        'auth_user_id', 'user_id', 'created_by', 'updated_by',
        'approved_by', 'resolved_by', 'client_mutation_id', 'import_run_id',
        'actor_display_name', 'updated_by_display_name',
        'approved_by_display_name'
      ]) or private.contains_forbidden_public_key(v_pair.value) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_item in select value from jsonb_array_elements(p_value)
    loop
      if private.contains_forbidden_public_key(v_item) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

-- Mirrors the repository's compactCanonicalJson contract for the bounded
-- publication schemas: object keys sort bytewise, arrays retain order, and
-- numeric trailing zeroes are removed before SHA-256 hashing.
create or replace function private.canonical_jsonb(p_value jsonb)
returns text
language plpgsql
stable
strict
set search_path = ''
as $$
declare
  v_result text;
begin
  case jsonb_typeof(p_value)
    when 'object' then
      select '{' || coalesce(
        string_agg(
          to_jsonb(entry.key)::text || ':' || private.canonical_jsonb(entry.value),
          ',' order by entry.key collate "C"
        ),
        ''
      ) || '}'
      into v_result
      from jsonb_each(p_value) as entry;
    when 'array' then
      select '[' || coalesce(
        string_agg(private.canonical_jsonb(entry.value), ',' order by entry.ordinality),
        ''
      ) || ']'
      into v_result
      from jsonb_array_elements(p_value) with ordinality as entry(value, ordinality);
    when 'number' then
      v_result := trim_scale((p_value #>> '{}')::numeric)::text;
    else
      v_result := p_value::text;
  end case;

  return v_result;
end;
$$;

create or replace function private.build_publication_payload(p_batch_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_batch public.publication_batches%rowtype;
  v_pokemon jsonb;
  v_jobs jsonb;
  v_machines jsonb;
  v_work_profiles jsonb;
  v_assets jsonb;
begin
  select * into v_batch
  from public.publication_batches
  where id = p_batch_id;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_not_found","message":"No publication batch exists for the requested ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  if not exists (
    select 1 from public.publication_batch_records where batch_id = v_batch.id
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_empty","message":"A publication batch must contain at least one approved record revision."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from public.publication_batch_records as batch_record
    join public.records as record on record.id = batch_record.record_id
    where batch_record.batch_id = v_batch.id
      and record.record_kind not in ('pokemon_species', 'job', 'machine', 'work_profile', 'asset')
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"unsupported_publication_record","message":"The batch contains a record kind that has no canonical public projection."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from public.publication_batch_records as batch_record
    where batch_record.batch_id = v_batch.id
      and private.contains_forbidden_public_key(batch_record.public_projection)
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"private_publication_field","message":"A public projection contains a private or identity-bearing field."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  select
    coalesce(jsonb_agg(batch_record.public_projection order by coalesce(
      batch_record.public_projection ->> 'public_id',
      batch_record.public_projection ->> 'id',
      batch_record.public_projection ->> 'asset_key',
      record.public_id
    ))
      filter (where record.record_kind = 'pokemon_species'), '[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by coalesce(
      batch_record.public_projection ->> 'public_id',
      batch_record.public_projection ->> 'id',
      batch_record.public_projection ->> 'asset_key',
      record.public_id
    ))
      filter (where record.record_kind = 'job'), '[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by coalesce(
      batch_record.public_projection ->> 'public_id',
      batch_record.public_projection ->> 'id',
      batch_record.public_projection ->> 'asset_key',
      record.public_id
    ))
      filter (where record.record_kind = 'machine'), '[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by coalesce(
      batch_record.public_projection ->> 'public_id',
      batch_record.public_projection ->> 'id',
      batch_record.public_projection ->> 'asset_key',
      record.public_id
    ))
      filter (where record.record_kind = 'work_profile'), '[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by coalesce(
      batch_record.public_projection ->> 'public_id',
      batch_record.public_projection ->> 'id',
      batch_record.public_projection ->> 'asset_key',
      record.public_id
    ))
      filter (where record.record_kind = 'asset'), '[]'::jsonb)
  into v_pokemon, v_jobs, v_machines, v_work_profiles, v_assets
  from public.publication_batch_records as batch_record
  join public.records as record on record.id = batch_record.record_id
  where batch_record.batch_id = v_batch.id;

  return jsonb_build_object(
    'bundle_version', 1,
    'schema_version', v_batch.schema_version,
    'batch_id', 'cobblemon_kinetics:publication/' || regexp_replace(v_batch.public_id, '^publication-', ''),
    'records', jsonb_build_object(
      'pokemon', v_pokemon,
      'jobs', v_jobs,
      'machines', v_machines,
      'work_profiles', v_work_profiles
    ),
    'asset_manifest', jsonb_build_object(
      'manifest_version', 1,
      'assets', v_assets
    )
  );
end;
$$;

create or replace function private.publication_payload_hash(p_payload jsonb)
returns text
language sql
stable
strict
set search_path = ''
as $$
  select encode(
    extensions.digest(convert_to(private.canonical_jsonb(p_payload), 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.expected_publication_manifest_files(p_payload jsonb)
returns jsonb
language sql
stable
strict
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'path', expected.path,
        'kind', expected.kind,
        'record_count', expected.record_count
      )
      order by expected.path collate "C"
    ),
    '[]'::jsonb
  )
  from (
    select
      'assets/manifest.json'::text as path,
      'asset_manifest'::text as kind,
      jsonb_array_length(p_payload #> '{asset_manifest,assets}') as record_count
    union all
    select
      'pokemon/gen1.json',
      'pokemon_collection',
      jsonb_array_length(p_payload #> '{records,pokemon}')
    union all
    select
      'jobs/' || (job.value ->> 'slug') || '.json',
      'job',
      1
    from jsonb_array_elements(p_payload #> '{records,jobs}') as job(value)
    union all
    select
      'machines/' || (machine.value ->> 'slug') || '.json',
      'machine',
      1
    from jsonb_array_elements(p_payload #> '{records,machines}') as machine(value)
    union all
    select
      'work_profiles/' || regexp_replace(profile.value ->> 'id', '^.*[:/]', '') || '.json',
      'work_profile',
      1
    from jsonb_array_elements(p_payload #> '{records,work_profiles}') as profile(value)
  ) as expected;
$$;

create or replace function private.validate_squirtle_domain_sources(
  p_species_snapshot jsonb,
  p_job_snapshot jsonb,
  p_machine_snapshot jsonb,
  p_profile_snapshot jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_species_source jsonb;
  v_job_source jsonb;
  v_machine_source jsonb;
  v_profile_source jsonb;
  v_current_types jsonb;
  v_original_types jsonb;
begin
  if jsonb_typeof(p_species_snapshot -> 'publication') <> 'object'
     or jsonb_typeof(p_species_snapshot -> 'source_snapshot') <> 'object'
     or jsonb_typeof(p_job_snapshot -> 'publication') <> 'object'
     or jsonb_typeof(p_job_snapshot -> 'source_snapshot') <> 'object'
     or jsonb_typeof(p_machine_snapshot -> 'publication') <> 'object'
     or jsonb_typeof(p_machine_snapshot -> 'source_snapshot') <> 'object'
     or jsonb_typeof(p_profile_snapshot -> 'publication') <> 'object'
     or jsonb_typeof(p_profile_snapshot -> 'source_snapshot') <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"incomplete_revision_snapshot","message":"Each vertical-slice revision must contain complete immutable publication and normalized-source snapshots."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  select coalesce(jsonb_agg(pokemon_type.identifier order by form_type.slot), '[]'::jsonb)
  into v_current_types
  from public.records as species_record
  join public.pokemon_forms as form on form.species_record_id = species_record.id and form.is_default
  join public.pokemon_form_types as form_type on form_type.form_record_id = form.record_id
  join public.pokemon_types as pokemon_type on pokemon_type.id = form_type.type_id
  join public.compatibility_sets as compatibility_set
    on compatibility_set.id = form_type.compatibility_set_id
   and compatibility_set.public_id = 'cobblemon_kinetics:mc_1_21_1'
  where species_record.public_id = 'cobblemon_kinetics:pokemon/squirtle'
    and form_type.typing_context = 'current';

  select coalesce(jsonb_agg(pokemon_type.identifier order by form_type.slot), '[]'::jsonb)
  into v_original_types
  from public.records as species_record
  join public.pokemon_forms as form on form.species_record_id = species_record.id and form.is_default
  join public.pokemon_form_types as form_type on form_type.form_record_id = form.record_id
  join public.pokemon_types as pokemon_type on pokemon_type.id = form_type.type_id
  join public.compatibility_sets as compatibility_set
    on compatibility_set.id = form_type.compatibility_set_id
   and compatibility_set.public_id = 'cobblemon_kinetics:mc_1_21_1'
  where species_record.public_id = 'cobblemon_kinetics:pokemon/squirtle'
    and form_type.typing_context = 'original_gen_i';

  select jsonb_build_object(
    'species', jsonb_build_object(
      'national_dex', species.national_dex,
      'generation_id', species.generation_id,
      'cobblemon_species_id', species.cobblemon_species_id,
      'api_slug', species.api_slug,
      'genus', species.genus,
      'habitat', species.habitat,
      'height_decimeters', species.height_decimeters,
      'weight_hectograms', species.weight_hectograms,
      'capture_rate', species.capture_rate,
      'base_friendship', species.base_friendship,
      'growth_rate', species.growth_rate,
      'shape', species.shape,
      'color', species.color,
      'is_legendary', species.is_legendary,
      'is_mythical', species.is_mythical,
      'source_data', species.source_data
    ),
    'form', jsonb_build_object(
      'public_id', form_record.public_id,
      'cobblemon_form_id', form.cobblemon_form_id,
      'form_key', form.form_key,
      'is_default', form.is_default,
      'aspects', to_jsonb(form.aspects),
      'base_stats', form.base_stats,
      'abilities', to_jsonb(form.abilities),
      'attributes', form.attributes
    ),
    'current_types', v_current_types,
    'original_gen1_types', v_original_types
  )
  into v_species_source
  from public.records as species_record
  join public.pokemon_species as species on species.record_id = species_record.id
  join public.pokemon_forms as form on form.species_record_id = species_record.id and form.is_default
  join public.records as form_record on form_record.id = form.record_id
  where species_record.public_id = 'cobblemon_kinetics:pokemon/squirtle';

  select jsonb_build_object(
    'category', job.category,
    'description', job.description,
    'required_type', pokemon_type.identifier,
    'capability_ids', to_jsonb(job.capability_ids),
    'adapter_id', job.adapter_id,
    'constraints', job.constraints
  )
  into v_job_source
  from public.records as record
  join public.jobs as job on job.record_id = record.id
  left join public.pokemon_types as pokemon_type on pokemon_type.id = job.required_type_id
  where record.public_id = 'cobblemon_kinetics:hydro_operator';

  select jsonb_build_object(
    'description', machine.description,
    'lifecycle_state', machine.lifecycle_state,
    'evidence_state', machine.evidence_state,
    'metadata', machine.metadata
  )
  into v_machine_source
  from public.records as record
  join public.machines as machine on machine.record_id = record.id
  where record.public_id = 'cobblemon_kinetics:hydro_coupler';

  select jsonb_build_object(
    'job_id', job_record.public_id,
    'machine_id', machine_record.public_id,
    'compatibility_set_id', compatibility_set.public_id,
    'adapter_id', profile.adapter_id,
    'selector', profile.selector,
    'requirements', profile.requirements,
    'outputs', profile.outputs,
    'balance', profile.balance,
    'minimum_efficiency', profile.minimum_efficiency,
    'maximum_efficiency', profile.maximum_efficiency
  )
  into v_profile_source
  from public.records as profile_record
  join public.work_profiles as profile on profile.record_id = profile_record.id
  join public.records as job_record on job_record.id = profile.job_record_id
  join public.records as machine_record on machine_record.id = profile.machine_record_id
  join public.compatibility_sets as compatibility_set
    on compatibility_set.id = profile.compatibility_set_id
  where profile_record.public_id = 'cobblemon_kinetics:squirtle_hydro_operator';

  if p_species_snapshot -> 'source_snapshot' is distinct from v_species_source
     or p_job_snapshot -> 'source_snapshot' is distinct from v_job_source
     or p_machine_snapshot -> 'source_snapshot' is distinct from v_machine_source
     or p_profile_snapshot -> 'source_snapshot' is distinct from v_profile_source then
    raise sqlstate 'PGRST' using
      message = '{"code":"normalized_source_drift","message":"Mutable normalized domain rows no longer match the approved immutable revision snapshots."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;
end;
$$;

create or replace function private.validate_publication_batch(p_publication_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_batch public.publication_batches%rowtype;
  v_payload jsonb;
  v_hash text;
begin
  v_auth_user_id := private.require_app_role('maintainer'::public.app_role);

  select * into v_batch
  from public.publication_batches
  where public_id = p_publication_id
  for update;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_not_found","message":"No publication batch exists for the requested ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  if v_batch.state not in ('draft', 'validated') then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_locked","message":"Only draft or validated batches can be validated."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if v_batch.schema_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_schema_not_stable","message":"Published bundles require a stable major.minor.patch schema version."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from public.publication_batch_records as batch_record
    join public.records as record on record.id = batch_record.record_id
    join public.record_revisions as revision
      on revision.record_id = batch_record.record_id
     and revision.revision_number = batch_record.revision_number
    where batch_record.batch_id = v_batch.id
      and (
        record.workflow_state <> 'approved'
        or record.approved_revision is distinct from batch_record.revision_number
        or batch_record.checksum <> revision.checksum
      )
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"batch_revision_not_approved","message":"Every publication entry must pin an exact approved immutable revision and checksum."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from public.publication_batch_records as batch_record
    join public.records as record on record.id = batch_record.record_id
    left join public.assets as asset on asset.record_id = record.id
    where batch_record.batch_id = v_batch.id
      and record.record_kind = 'asset'
      and (
        asset.record_id is null
        or asset.rights_status <> 'approved'
        or asset.permitted_visibility <> 'public'
        or asset.publication_state <> 'published'
      )
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"asset_not_publishable","message":"Every published asset must pass the rights, visibility, and publication gates."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  v_payload := private.build_publication_payload(v_batch.id);
  v_hash := private.publication_payload_hash(v_payload);

  update public.publication_batches
  set state = 'validated',
      content_hash = v_hash,
      validated_by = v_auth_user_id,
      validated_at = clock_timestamp()
  where id = v_batch.id
  returning * into v_batch;

  return jsonb_build_object(
    'publication', jsonb_build_object(
      'public_id', v_batch.public_id,
      'state', v_batch.state,
      'schema_version', v_batch.schema_version,
      'content_hash', v_batch.content_hash,
      'git_commit_sha', v_batch.git_commit_sha,
      'validated_at', v_batch.validated_at,
      'exported_at', v_batch.exported_at,
      'published_at', v_batch.published_at
    ),
    'payload', v_payload
  );
end;
$$;

create or replace function private.get_publication_bundle(p_publication_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_batch public.publication_batches%rowtype;
  v_payload jsonb;
  v_hash text;
begin
  perform private.require_app_role('maintainer'::public.app_role);

  select * into v_batch
  from public.publication_batches
  where public_id = p_publication_id;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_not_found","message":"No publication batch exists for the requested ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  if v_batch.state not in ('validated', 'exported', 'published')
     or v_batch.content_hash is null then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_not_exportable","message":"The publication batch must be validated and hashed before export."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  v_payload := private.build_publication_payload(v_batch.id);
  v_hash := private.publication_payload_hash(v_payload);

  if v_hash <> v_batch.content_hash then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'publication_hash_mismatch',
        'message', 'The canonical publication payload no longer matches its validated hash.',
        'expected_hash', v_batch.content_hash,
        'actual_hash', v_hash
      )::text,
      detail = json_build_object('status', 409, 'status_text', 'Conflict')::text;
  end if;

  return jsonb_build_object(
    'publication', jsonb_build_object(
      'public_id', v_batch.public_id,
      'state', v_batch.state,
      'schema_version', v_batch.schema_version,
      'content_hash', v_batch.content_hash,
      'git_commit_sha', v_batch.git_commit_sha,
      'validated_at', v_batch.validated_at,
      'exported_at', v_batch.exported_at,
      'published_at', v_batch.published_at
    ),
    'payload', v_payload
  );
end;
$$;

create or replace function private.reconcile_publication_commit(
  p_publication_id text,
  p_git_commit_sha text,
  p_manifest jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.publication_batches%rowtype;
  v_payload jsonb;
  v_payload_hash text;
  v_expected_files jsonb;
  v_actual_file_shapes jsonb;
  v_species_snapshot jsonb;
  v_job_snapshot jsonb;
  v_machine_snapshot jsonb;
  v_profile_snapshot jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_git_commit_sha is null or p_git_commit_sha !~ '^[0-9a-f]{40}$' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_git_commit_sha","message":"Git commit SHA must be exactly 40 lowercase hexadecimal characters."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if p_manifest is null
     or jsonb_typeof(p_manifest) <> 'object'
     or octet_length(p_manifest::text) > 1048576
     or (select count(*) from jsonb_object_keys(p_manifest)) <> 5
     or exists (
       select 1
       from jsonb_object_keys(p_manifest) as manifest_key(key)
       where manifest_key.key <> all (array[
         'manifest_version', 'schema_version', 'batch_id',
         'bundle_content_sha256', 'files'
       ])
     )
     or private.contains_forbidden_public_key(p_manifest) then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_publication_manifest","message":"The Git publication manifest has invalid, extra, private, or oversized data."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if not exists (
    select 1
    from public.app_users as app_user
    join public.editor_allowlist as allowlist
      on allowlist.github_user_id = app_user.github_user_id
    where app_user.auth_user_id = p_actor_id
      and app_user.is_active
      and allowlist.is_active
      and app_user.role = 'maintainer'::public.app_role
      and allowlist.role = 'maintainer'::public.app_role
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"maintainer_actor_required","message":"Reconciliation requires an active allowlisted maintainer actor."}',
      detail = '{"status":403,"status_text":"Forbidden"}';
  end if;

  select * into v_batch
  from public.publication_batches
  where public_id = p_publication_id
  for update;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_not_found","message":"No publication batch exists for the requested ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  if v_batch.state not in ('validated', 'exported', 'published')
     or v_batch.content_hash is null then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_not_reconcilable","message":"Only a validated or exported publication batch can be reconciled."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if exists (
    select 1
    from public.publication_batch_records as batch_record
    join public.record_revisions as revision
      on revision.record_id = batch_record.record_id
     and revision.revision_number = batch_record.revision_number
    where batch_record.batch_id = v_batch.id
      and (
        batch_record.checksum <> revision.checksum
        or revision.checksum <> encode(
          extensions.digest(revision.snapshot::text, 'sha256'),
          'hex'
        )
      )
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"frozen_revision_drift","message":"A frozen publication revision or checksum no longer matches its immutable snapshot."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if exists (
    select 1
    from public.publication_batch_records as batch_record
    join public.records as record on record.id = batch_record.record_id
    where batch_record.batch_id = v_batch.id
      and record.public_id = 'cobblemon_kinetics:pokemon/squirtle'
  ) then
    if (
      select count(*)
      from public.publication_batch_records as batch_record
      join public.records as record on record.id = batch_record.record_id
      where batch_record.batch_id = v_batch.id
        and record.public_id in (
          'cobblemon_kinetics:pokemon/squirtle',
          'cobblemon_kinetics:hydro_operator',
          'cobblemon_kinetics:hydro_coupler',
          'cobblemon_kinetics:squirtle_hydro_operator'
        )
    ) <> 4 then
      raise sqlstate 'PGRST' using
        message = '{"code":"incomplete_vertical_slice_batch","message":"A Squirtle publication must freeze all four Hydro vertical-slice records."}',
        detail = '{"status":409,"status_text":"Conflict"}';
    end if;

    if exists (
      select 1
      from public.records as record
      left join public.record_revisions as head_revision
        on head_revision.record_id = record.id
       and head_revision.revision_number = record.current_revision
      where record.public_id in (
          'cobblemon_kinetics:pokemon/squirtle',
          'cobblemon_kinetics:hydro_operator',
          'cobblemon_kinetics:hydro_coupler',
          'cobblemon_kinetics:squirtle_hydro_operator'
        )
        and (
          head_revision.id is null
          or head_revision.snapshot <> record.content
          or head_revision.checksum <> record.checksum
          or head_revision.schema_version <> record.schema_version
          or head_revision.checksum <> encode(
            extensions.digest(head_revision.snapshot::text, 'sha256'),
            'hex'
          )
        )
    ) then
      raise sqlstate 'PGRST' using
        message = '{"code":"current_domain_head_drift","message":"A current vertical-slice record head no longer matches its immutable revision."}',
        detail = '{"status":409,"status_text":"Conflict"}';
    end if;

    select
      (jsonb_agg(head_revision.snapshot) filter (
        where record.public_id = 'cobblemon_kinetics:pokemon/squirtle'
      )) -> 0,
      (jsonb_agg(head_revision.snapshot) filter (
        where record.public_id = 'cobblemon_kinetics:hydro_operator'
      )) -> 0,
      (jsonb_agg(head_revision.snapshot) filter (
        where record.public_id = 'cobblemon_kinetics:hydro_coupler'
      )) -> 0,
      (jsonb_agg(head_revision.snapshot) filter (
        where record.public_id = 'cobblemon_kinetics:squirtle_hydro_operator'
      )) -> 0
    into
      v_species_snapshot,
      v_job_snapshot,
      v_machine_snapshot,
      v_profile_snapshot
    from public.records as record
    join public.record_revisions as head_revision
      on head_revision.record_id = record.id
     and head_revision.revision_number = record.current_revision
    where record.public_id in (
      'cobblemon_kinetics:pokemon/squirtle',
      'cobblemon_kinetics:hydro_operator',
      'cobblemon_kinetics:hydro_coupler',
      'cobblemon_kinetics:squirtle_hydro_operator'
    );

    perform private.validate_squirtle_domain_sources(
      v_species_snapshot,
      v_job_snapshot,
      v_machine_snapshot,
      v_profile_snapshot
    );
  end if;

  v_payload := private.build_publication_payload(v_batch.id);
  v_payload_hash := private.publication_payload_hash(v_payload);

  if v_payload_hash <> v_batch.content_hash then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'publication_hash_mismatch',
        'message', 'The frozen database payload no longer matches its validated hash.',
        'expected_hash', v_batch.content_hash,
        'actual_hash', v_payload_hash
      )::text,
      detail = json_build_object('status', 409, 'status_text', 'Conflict')::text;
  end if;

  if jsonb_typeof(p_manifest -> 'manifest_version') <> 'number'
     or p_manifest ->> 'manifest_version' <> '1'
     or jsonb_typeof(p_manifest -> 'schema_version') <> 'string'
     or p_manifest ->> 'schema_version' <> v_batch.schema_version
     or jsonb_typeof(p_manifest -> 'batch_id') <> 'string'
     or p_manifest ->> 'batch_id' <> v_payload ->> 'batch_id'
     or jsonb_typeof(p_manifest -> 'bundle_content_sha256') <> 'string'
     or p_manifest ->> 'bundle_content_sha256' <> v_batch.content_hash
     or jsonb_typeof(p_manifest -> 'files') <> 'array'
     or jsonb_array_length(p_manifest -> 'files') = 0 then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_manifest_mismatch","message":"The Git manifest does not match the frozen batch ID, schema, or canonical content hash."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_manifest -> 'files') as manifest_file(value)
    where jsonb_typeof(manifest_file.value) <> 'object'
       or (select count(*) from jsonb_object_keys(manifest_file.value)) <> 4
       or exists (
         select 1
         from jsonb_object_keys(manifest_file.value) as file_key(key)
         where file_key.key <> all (array['path', 'sha256', 'kind', 'record_count'])
       )
       or jsonb_typeof(manifest_file.value -> 'path') <> 'string'
       or jsonb_typeof(manifest_file.value -> 'sha256') <> 'string'
       or manifest_file.value ->> 'sha256' !~ '^[0-9a-f]{64}$'
       or jsonb_typeof(manifest_file.value -> 'kind') <> 'string'
       or manifest_file.value ->> 'kind' not in (
         'pokemon_collection', 'job', 'machine', 'work_profile', 'asset_manifest'
       )
       or jsonb_typeof(manifest_file.value -> 'record_count') <> 'number'
       or manifest_file.value ->> 'record_count' !~ '^[0-9]+$'
       or case manifest_file.value ->> 'kind'
         when 'pokemon_collection' then manifest_file.value ->> 'path' <> 'pokemon/gen1.json'
         when 'asset_manifest' then manifest_file.value ->> 'path' <> 'assets/manifest.json'
         when 'job' then manifest_file.value ->> 'path' !~ '^jobs/[a-z0-9]+(?:-[a-z0-9]+)*\.json$'
         when 'machine' then manifest_file.value ->> 'path' !~ '^machines/[a-z0-9]+(?:-[a-z0-9]+)*\.json$'
         when 'work_profile' then manifest_file.value ->> 'path' !~ '^work_profiles/[a-z0-9](?:[a-z0-9_.-]*[a-z0-9])?\.json$'
         else true
       end
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_manifest_file","message":"A Git manifest file entry has an invalid shape, path, hash, kind, or record count."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from (
      select
        manifest_file.value ->> 'path' as path,
        lag(manifest_file.value ->> 'path') over (order by manifest_file.ordinality) as previous_path
      from jsonb_array_elements(p_manifest -> 'files') with ordinality
        as manifest_file(value, ordinality)
    ) as ordered_file
    where ordered_file.previous_path is not null
      and ordered_file.path collate "C" <= ordered_file.previous_path collate "C"
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"manifest_files_not_deterministic","message":"Manifest file paths must be unique and sorted in bytewise ascending order."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  v_expected_files := private.expected_publication_manifest_files(v_payload);

  select coalesce(
    jsonb_agg(manifest_file.value - 'sha256' order by manifest_file.ordinality),
    '[]'::jsonb
  )
  into v_actual_file_shapes
  from jsonb_array_elements(p_manifest -> 'files') with ordinality
    as manifest_file(value, ordinality);

  if v_actual_file_shapes <> v_expected_files then
    raise sqlstate 'PGRST' using
      message = '{"code":"manifest_file_set_mismatch","message":"The Git manifest file set is incomplete, extra, or inconsistent with the canonical payload."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if v_batch.git_commit_sha is not null
     and v_batch.git_commit_sha <> p_git_commit_sha then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_commit_conflict","message":"This publication is already bound to a different Git commit."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if v_batch.published_manifest is not null
     and v_batch.published_manifest <> p_manifest then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_manifest_conflict","message":"This publication is already bound to a different Git manifest."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if v_batch.state = 'published' then
    return jsonb_build_object(
      'publication', jsonb_build_object(
        'public_id', v_batch.public_id,
        'state', v_batch.state,
        'schema_version', v_batch.schema_version,
        'content_hash', v_batch.content_hash,
        'git_commit_sha', v_batch.git_commit_sha,
        'published_at', v_batch.published_at,
        'published_by', v_batch.published_by
      ),
      'manifest', v_batch.published_manifest
    );
  end if;

  update public.publication_batches
  set state = 'published',
      git_commit_sha = p_git_commit_sha,
      published_manifest = p_manifest,
      exported_by = coalesce(exported_by, p_actor_id),
      exported_at = coalesce(exported_at, v_now),
      published_by = p_actor_id,
      published_at = v_now
  where id = v_batch.id
  returning * into v_batch;

  insert into public.audit_events (
    actor_id,
    action,
    metadata
  ) values (
    p_actor_id,
    'publication.published',
    jsonb_build_object(
      'publication_id', v_batch.public_id,
      'git_commit_sha', v_batch.git_commit_sha,
      'content_hash', v_batch.content_hash,
      'manifest_sha256', private.publication_payload_hash(p_manifest)
    )
  );

  return jsonb_build_object(
    'publication', jsonb_build_object(
      'public_id', v_batch.public_id,
      'state', v_batch.state,
      'schema_version', v_batch.schema_version,
      'content_hash', v_batch.content_hash,
      'git_commit_sha', v_batch.git_commit_sha,
      'published_at', v_batch.published_at,
      'published_by', v_batch.published_by
    ),
    'manifest', v_batch.published_manifest
  );
end;
$$;

-- The first publish action is intentionally narrow: it freezes the exact
-- approved Squirtle revision and the three approved Hydro contract records.
-- Later record kinds must receive their own canonical projection builder
-- before this dispatcher is generalized.
create or replace function private.create_squirtle_publication_batch(
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_species public.records%rowtype;
  v_species_revision public.record_revisions%rowtype;
  v_job public.records%rowtype;
  v_job_revision public.record_revisions%rowtype;
  v_machine public.records%rowtype;
  v_machine_revision public.record_revisions%rowtype;
  v_profile public.records%rowtype;
  v_profile_revision public.record_revisions%rowtype;
  v_pokemon_projection jsonb;
  v_job_projection jsonb;
  v_machine_projection jsonb;
  v_profile_projection jsonb;
  v_entries jsonb;
  v_projection_hash text;
  v_publication_id text;
  v_batch public.publication_batches%rowtype;
  v_mismatch_count integer;
  v_insert_count integer;
begin
  v_auth_user_id := private.require_app_role('maintainer'::public.app_role);

  if p_expected_revision is null or p_expected_revision < 1 then
    raise sqlstate '22023' using message = 'expected_revision must be a positive integer';
  end if;

  select * into v_species
  from public.records
  where public_id = 'cobblemon_kinetics:pokemon/squirtle'
    and record_kind = 'pokemon_species'
  for update;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_found","message":"The Squirtle publication source does not exist."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  perform private.validate_editor_content(v_species);

  if v_species.current_revision <> p_expected_revision then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'revision_conflict',
        'message', 'The approved Squirtle revision changed before publication.',
        'expected_revision', p_expected_revision,
        'current_revision', v_species.current_revision
      )::text,
      detail = json_build_object('status', 409, 'status_text', 'Conflict')::text;
  end if;

  if v_species.workflow_state <> 'approved'
     or v_species.approved_revision is distinct from p_expected_revision then
    raise sqlstate 'PGRST' using
      message = '{"code":"revision_not_approved","message":"The exact Squirtle revision must be approved before publication."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  select * into strict v_species_revision
  from public.record_revisions
  where record_id = v_species.id
    and revision_number = p_expected_revision;

  if v_species_revision.checksum <> v_species.checksum
     or v_species_revision.snapshot <> v_species.content then
    raise sqlstate 'PGRST' using
      message = '{"code":"approved_revision_drift","message":"The current Squirtle head no longer matches its approved immutable revision."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  select * into strict v_job
  from public.records
  where public_id = 'cobblemon_kinetics:hydro_operator'
    and record_kind = 'job';

  select * into strict v_machine
  from public.records
  where public_id = 'cobblemon_kinetics:hydro_coupler'
    and record_kind = 'machine';

  select * into strict v_profile
  from public.records
  where public_id = 'cobblemon_kinetics:squirtle_hydro_operator'
    and record_kind = 'work_profile';

  if v_job.workflow_state <> 'approved'
     or v_machine.workflow_state <> 'approved'
     or v_profile.workflow_state <> 'approved'
     or v_job.approved_revision is null
     or v_machine.approved_revision is null
     or v_profile.approved_revision is null then
    raise sqlstate 'PGRST' using
      message = '{"code":"hydro_contract_not_approved","message":"The Hydro job, machine, and work profile must each have an approved revision."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  select * into strict v_job_revision
  from public.record_revisions
  where record_id = v_job.id and revision_number = v_job.approved_revision;
  select * into strict v_machine_revision
  from public.record_revisions
  where record_id = v_machine.id and revision_number = v_machine.approved_revision;
  select * into strict v_profile_revision
  from public.record_revisions
  where record_id = v_profile.id and revision_number = v_profile.approved_revision;

  if v_job.current_revision <> v_job.approved_revision
     or v_machine.current_revision <> v_machine.approved_revision
     or v_profile.current_revision <> v_profile.approved_revision
     or v_job_revision.snapshot <> v_job.content
     or v_machine_revision.snapshot <> v_machine.content
     or v_profile_revision.snapshot <> v_profile.content then
    raise sqlstate 'PGRST' using
      message = '{"code":"hydro_contract_drift","message":"A Hydro contract record no longer matches its approved immutable revision."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  perform private.validate_squirtle_domain_sources(
    v_species_revision.snapshot,
    v_job_revision.snapshot,
    v_machine_revision.snapshot,
    v_profile_revision.snapshot
  );

  -- Public output is derived only from approved immutable revision snapshots.
  -- Mutable normalized rows are checked above for drift but never projected.
  v_pokemon_projection := (v_species_revision.snapshot -> 'publication') || jsonb_build_object(
    'work_assignments', jsonb_build_array(jsonb_build_object(
      'work_profile_id', 'cobblemon_kinetics:hydro_operator',
      'machine_registry_id', v_species_revision.snapshot ->> 'machine_id',
      'efficiency_multiplier', v_species_revision.snapshot -> 'efficiency',
      'public_rationale', v_species_revision.snapshot ->> 'public_rationale'
    ))
  );

  v_job_projection := v_job_revision.snapshot -> 'publication';

  v_machine_projection := v_machine_revision.snapshot -> 'publication';

  v_profile_projection := jsonb_set(
    jsonb_set(
      v_profile_revision.snapshot -> 'publication',
      '{contribution,efficiency_multiplier}',
      v_species_revision.snapshot -> 'efficiency',
      false
    ),
    '{public_rationale}',
    to_jsonb(v_species_revision.snapshot ->> 'public_rationale'),
    false
  );

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'record_id', v_species.id,
      'revision_number', v_species_revision.revision_number,
      'projection', v_pokemon_projection,
      'checksum', v_species_revision.checksum
    ),
    jsonb_build_object(
      'record_id', v_job.id,
      'revision_number', v_job_revision.revision_number,
      'projection', v_job_projection,
      'checksum', v_job_revision.checksum
    ),
    jsonb_build_object(
      'record_id', v_machine.id,
      'revision_number', v_machine_revision.revision_number,
      'projection', v_machine_projection,
      'checksum', v_machine_revision.checksum
    ),
    jsonb_build_object(
      'record_id', v_profile.id,
      'revision_number', v_profile_revision.revision_number,
      'projection', v_profile_projection,
      'checksum', v_profile_revision.checksum
    )
  );

  -- Do not include environment-local UUIDs in the deterministic public ID.
  v_projection_hash := private.publication_payload_hash(jsonb_build_object(
    'pokemon', v_pokemon_projection,
    'job', v_job_projection,
    'machine', v_machine_projection,
    'work_profile', v_profile_projection,
    'revision_checksums', jsonb_build_object(
      v_species.public_id, v_species_revision.checksum,
      v_job.public_id, v_job_revision.checksum,
      v_machine.public_id, v_machine_revision.checksum,
      v_profile.public_id, v_profile_revision.checksum
    )
  ));
  v_publication_id := 'publication-'
    || to_char(v_species_revision.created_at at time zone 'UTC', 'YYYYMMDD')
    || '-squirtle-hydro-r' || p_expected_revision::text
    || '-' || substr(v_projection_hash, 1, 16);

  insert into public.publication_batches (
    public_id,
    state,
    schema_version,
    notes,
    created_by
  ) values (
    v_publication_id,
    'draft',
    v_species.schema_version,
    'Squirtle to Hydro Coupler vertical slice',
    v_auth_user_id
  )
  on conflict (public_id) do nothing;

  get diagnostics v_insert_count = row_count;

  select * into strict v_batch
  from public.publication_batches
  where public_id = v_publication_id
  for update;

  if v_batch.state in ('superseded', 'rolled_back') then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_closed","message":"The matching deterministic publication batch is closed."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  insert into public.publication_batch_records (
    batch_id,
    record_id,
    revision_number,
    public_projection,
    checksum
  )
  select
    v_batch.id,
    (entry.value ->> 'record_id')::uuid,
    (entry.value ->> 'revision_number')::bigint,
    entry.value -> 'projection',
    entry.value ->> 'checksum'
  from jsonb_array_elements(v_entries) as entry(value)
  on conflict (batch_id, record_id) do nothing;

  select count(*)
  into v_mismatch_count
  from jsonb_array_elements(v_entries) as expected(value)
  left join public.publication_batch_records as actual
    on actual.batch_id = v_batch.id
   and actual.record_id = (expected.value ->> 'record_id')::uuid
   and actual.revision_number = (expected.value ->> 'revision_number')::bigint
   and actual.public_projection = expected.value -> 'projection'
   and actual.checksum = expected.value ->> 'checksum'
  where actual.record_id is null;

  if v_mismatch_count <> 0
     or (select count(*) from public.publication_batch_records where batch_id = v_batch.id) <> 4 then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_id_collision","message":"An existing deterministic batch does not match the approved source projection."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if v_insert_count = 1 then
    insert into public.audit_events (
      record_id,
      actor_id,
      action,
      before_revision,
      after_revision,
      metadata
    ) values (
      v_species.id,
      v_auth_user_id,
      'publication.frozen',
      p_expected_revision,
      p_expected_revision,
      jsonb_build_object('publication_id', v_publication_id)
    );
  end if;

  if v_batch.state in ('validated', 'exported', 'published') then
    return private.get_publication_bundle(v_publication_id);
  end if;

  return private.validate_publication_batch(v_publication_id);
end;
$$;

create or replace function private.approve_record_revision(
  p_public_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_record public.records%rowtype;
  v_revision public.record_revisions%rowtype;
begin
  v_auth_user_id := private.require_app_role('maintainer'::public.app_role);

  if p_expected_revision is null or p_expected_revision < 1 then
    raise sqlstate '22023' using message = 'expected_revision must be a positive integer';
  end if;

  select * into v_record
  from public.records
  where public_id = p_public_id
  for update;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_found","message":"No editable record exists for the requested public ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  perform private.validate_editor_content(v_record);

  if v_record.current_revision <> p_expected_revision then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'revision_conflict',
        'message', 'The record changed before it could be approved.',
        'expected_revision', p_expected_revision,
        'current_revision', v_record.current_revision
      )::text,
      detail = json_build_object('status', 409, 'status_text', 'Conflict')::text;
  end if;

  if v_record.workflow_state = 'archived' then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_archived","message":"Archived records cannot be approved."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  select * into v_revision
  from public.record_revisions
  where record_id = v_record.id
    and revision_number = p_expected_revision;

  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"revision_not_found","message":"The requested revision does not exist."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  if v_revision.snapshot <> v_record.content
     or v_revision.checksum <> v_record.checksum
     or v_revision.schema_version <> v_record.schema_version
     or v_revision.checksum <> encode(
       extensions.digest(v_revision.snapshot::text, 'sha256'),
       'hex'
     ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"revision_integrity_mismatch","message":"The immutable revision snapshot, checksum, or schema no longer matches the current record head."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  update public.records
  set workflow_state = 'approved',
      approved_revision = p_expected_revision,
      approved_by = v_auth_user_id,
      approved_at = clock_timestamp(),
      updated_by = v_auth_user_id
  where id = v_record.id
  returning * into v_record;

  insert into public.audit_events (
    record_id,
    actor_id,
    action,
    before_revision,
    after_revision,
    metadata
  ) values (
    v_record.id,
    v_auth_user_id,
    'record.approved',
    p_expected_revision,
    p_expected_revision,
    jsonb_build_object('checksum', v_revision.checksum)
  );

  return jsonb_build_object(
    'record', private.editor_record_json(v_record),
    'revision', private.revision_json(v_revision),
    'revisions', jsonb_build_array(private.revision_json(v_revision))
  );
end;
$$;

create or replace function private.enforce_work_item_handoff()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_work_item_id uuid := coalesce(new.work_item_record_id, old.work_item_record_id);
  v_assignee_count integer;
  v_handoff_note text;
begin
  select count(*) into v_assignee_count
  from public.work_item_assignees
  where work_item_record_id = v_work_item_id;

  select handoff_note into v_handoff_note
  from public.work_items
  where record_id = v_work_item_id;

  if v_assignee_count > 1 and length(btrim(coalesce(v_handoff_note, ''))) = 0 then
    raise check_violation using
      message = 'A work item assigned to multiple collaborators requires a handoff note.';
  end if;

  return null;
end;
$$;

create or replace function private.enforce_work_item_handoff_from_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if length(btrim(new.handoff_note)) = 0
     and (select count(*) from public.work_item_assignees where work_item_record_id = new.record_id) > 1 then
    raise check_violation using
      message = 'A work item assigned to multiple collaborators requires a handoff note.';
  end if;
  return new;
end;
$$;

create constraint trigger work_item_assignees_require_handoff
after insert or update or delete on public.work_item_assignees
deferrable initially immediate
for each row execute function private.enforce_work_item_handoff();

create trigger work_items_preserve_handoff
before update of handoff_note on public.work_items
for each row execute function private.enforce_work_item_handoff_from_item();

create or replace function public.claim_editor_access()
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.claim_editor_access();
$$;

create or replace function public.get_editor_record(p_public_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_editor_record(p_public_id);
$$;

create or replace function public.save_record_revision(
  p_public_id text,
  p_expected_revision bigint,
  p_client_mutation_id uuid,
  p_patch jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.save_record_revision(
    p_public_id,
    p_expected_revision,
    p_client_mutation_id,
    p_patch
  );
$$;

create or replace function public.approve_record_revision(
  p_public_id text,
  p_expected_revision bigint
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.approve_record_revision(p_public_id, p_expected_revision);
$$;

create or replace function public.create_squirtle_publication_batch(
  p_expected_revision bigint
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_squirtle_publication_batch(p_expected_revision);
$$;

create or replace function public.reconcile_publication_commit(
  p_publication_id text,
  p_git_commit_sha text,
  p_manifest jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise sqlstate 'PGRST' using
      message = '{"code":"service_role_required","message":"Publication reconciliation is restricted to the server service role."}',
      detail = '{"status":403,"status_text":"Forbidden"}';
  end if;

  return private.reconcile_publication_commit(
    p_publication_id,
    p_git_commit_sha,
    p_manifest,
    p_actor_id
  );
end;
$$;

create or replace function public.get_publication_bundle(p_publication_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_publication_bundle(p_publication_id);
$$;

create or replace function public.validate_publication_batch(p_publication_id text)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.validate_publication_batch(p_publication_id);
$$;

-- Every table in the exposed public schema is protected. Most tables are
-- readable by active members; writes happen only through checked RPCs or the
-- server-side service role used by controlled import/export tooling.
do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'editor_allowlist', 'app_users', 'records', 'record_aliases',
    'record_revisions', 'audit_events', 'generations', 'pokemon_types',
    'compatibility_sets', 'pokemon_species', 'pokemon_forms',
    'pokemon_form_types', 'registry_entries', 'jobs', 'machines',
    'machine_components', 'work_profiles', 'pokemon_work_assignments',
    'comments', 'publication_batches', 'publication_batch_records',
    'import_runs', 'import_rows', 'import_field_reviews', 'source_references',
    'asset_sources', 'assets', 'asset_variants', 'asset_bindings',
    'asset_reviews', 'work_items', 'work_item_assignees'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
  end loop;
end;
$block$;

create policy editor_allowlist_maintainer_read
on public.editor_allowlist
for select
to authenticated
using ((select private.has_app_role('maintainer'::public.app_role)));

do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'app_users', 'records', 'record_aliases', 'record_revisions',
    'audit_events', 'generations', 'pokemon_types', 'compatibility_sets',
    'pokemon_species', 'pokemon_forms', 'pokemon_form_types',
    'registry_entries', 'jobs', 'machines', 'machine_components',
    'work_profiles', 'pokemon_work_assignments', 'comments',
    'publication_batches', 'publication_batch_records', 'import_runs',
    'import_rows', 'import_field_reviews', 'source_references',
    'asset_sources', 'assets', 'asset_variants', 'asset_bindings',
    'asset_reviews', 'work_items', 'work_item_assignees'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_app_role(''viewer''::public.app_role)))',
      v_table || '_member_read',
      v_table
    );
  end loop;
end;
$block$;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant usage on schema private to authenticated, service_role;
grant usage on type public.app_role to authenticated, service_role;

grant select on table
  public.editor_allowlist,
  public.app_users,
  public.records,
  public.record_aliases,
  public.record_revisions,
  public.audit_events,
  public.generations,
  public.pokemon_types,
  public.compatibility_sets,
  public.pokemon_species,
  public.pokemon_forms,
  public.pokemon_form_types,
  public.registry_entries,
  public.jobs,
  public.machines,
  public.machine_components,
  public.work_profiles,
  public.pokemon_work_assignments,
  public.comments,
  public.publication_batches,
  public.publication_batch_records,
  public.import_runs,
  public.import_rows,
  public.import_field_reviews,
  public.source_references,
  public.asset_sources,
  public.assets,
  public.asset_variants,
  public.asset_bindings,
  public.asset_reviews,
  public.work_items,
  public.work_item_assignees
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function private.role_rank(public.app_role) from public, anon, authenticated, service_role;
revoke all on function private.has_app_role(public.app_role) from public, anon, authenticated, service_role;
revoke all on function private.require_app_role(public.app_role) from public, anon, authenticated, service_role;
revoke all on function private.sync_allowlist_membership() from public, anon, authenticated, service_role;
revoke all on function private.claim_editor_access() from public, anon, authenticated, service_role;
revoke all on function private.editor_record_json(public.records) from public, anon, authenticated, service_role;
revoke all on function private.revision_json(public.record_revisions) from public, anon, authenticated, service_role;
revoke all on function private.validate_editor_content(public.records) from public, anon, authenticated, service_role;
revoke all on function private.validate_editor_patch(public.records, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.get_editor_record(text) from public, anon, authenticated, service_role;
revoke all on function private.save_record_revision(text, bigint, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.approve_record_revision(text, bigint) from public, anon, authenticated, service_role;
revoke all on function private.create_squirtle_publication_batch(bigint) from public, anon, authenticated, service_role;
revoke all on function private.contains_forbidden_public_key(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.canonical_jsonb(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.build_publication_payload(uuid) from public, anon, authenticated, service_role;
revoke all on function private.publication_payload_hash(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.expected_publication_manifest_files(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.validate_squirtle_domain_sources(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.validate_publication_batch(text) from public, anon, authenticated, service_role;
revoke all on function private.get_publication_bundle(text) from public, anon, authenticated, service_role;
revoke all on function private.reconcile_publication_commit(text, text, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function private.enforce_work_item_handoff() from public, anon, authenticated, service_role;
revoke all on function private.enforce_work_item_handoff_from_item() from public, anon, authenticated, service_role;

grant execute on function private.has_app_role(public.app_role) to authenticated, service_role;
grant execute on function private.claim_editor_access() to authenticated, service_role;
grant execute on function private.get_editor_record(text) to authenticated, service_role;
grant execute on function private.save_record_revision(text, bigint, uuid, jsonb) to authenticated, service_role;
grant execute on function private.approve_record_revision(text, bigint) to authenticated, service_role;
grant execute on function private.create_squirtle_publication_batch(bigint) to authenticated, service_role;
grant execute on function private.validate_publication_batch(text) to authenticated, service_role;
grant execute on function private.get_publication_bundle(text) to authenticated, service_role;
grant execute on function private.reconcile_publication_commit(text, text, jsonb, uuid) to service_role;

grant execute on function public.claim_editor_access() to authenticated, service_role;
grant execute on function public.get_editor_record(text) to authenticated, service_role;
grant execute on function public.save_record_revision(text, bigint, uuid, jsonb) to authenticated, service_role;
grant execute on function public.approve_record_revision(text, bigint) to authenticated, service_role;
grant execute on function public.create_squirtle_publication_batch(bigint) to authenticated, service_role;
grant execute on function public.validate_publication_batch(text) to authenticated, service_role;
grant execute on function public.get_publication_bundle(text) to authenticated, service_role;
grant execute on function public.reconcile_publication_commit(text, text, jsonb, uuid) to service_role;

commit;
