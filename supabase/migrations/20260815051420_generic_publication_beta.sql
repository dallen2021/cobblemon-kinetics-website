begin;

-- Public records are explicit projections of frozen approved snapshots.  The
-- database never derives a public payload from a mutable normalized row.
create or replace function private.generic_public_projection(
  p_record public.records,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_projection jsonb;
  v_types jsonb;
begin
  if jsonb_typeof(p_snapshot) <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_revision_snapshot","message":"The approved revision has no object snapshot."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(p_snapshot -> 'publication') = 'object' then
    v_projection := p_snapshot -> 'publication';
  elsif (p_record).record_kind = 'pokemon_species' then
    v_types := coalesce(p_snapshot #> '{typing,current}', '[]'::jsonb);
    v_projection := jsonb_strip_nulls(jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'slug', (p_record).slug,
      'name', (p_record).display_name,
      'national_dex', coalesce(nullif(p_snapshot #>> '{facts,national_dex}', '')::integer, nullif(p_snapshot ->> 'national_dex', '')::integer),
      'generation', 1,
      'cobblemon_id', coalesce(p_snapshot #>> '{facts,cobblemon_id}', p_snapshot ->> 'cobblemon_id'),
      'current_types', v_types,
      'original_gen1_types', coalesce(p_snapshot #> '{typing,original_gen_i}', '[]'::jsonb),
      'type_changed', coalesce(p_snapshot #> '{typing,type_changed}', 'false'::jsonb),
      'summary', coalesce(p_snapshot ->> 'public_summary', p_snapshot #>> '{design,public_summary}', ''),
      'status', (p_record).workflow_state
    ));
  elsif (p_record).record_kind = 'job' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'slug', (p_record).slug,
      'name', (p_record).display_name,
      'summary', coalesce(p_snapshot ->> 'public_summary', p_snapshot #>> '{planning,description}', ''),
      'status', (p_record).workflow_state
    );
  elsif (p_record).record_kind = 'machine' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'slug', (p_record).slug,
      'name', (p_record).display_name,
      'summary', coalesce(p_snapshot ->> 'public_summary', p_snapshot #>> '{planning,description}', ''),
      'status', (p_record).workflow_state
    );
  elsif (p_record).record_kind = 'work_profile' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'id', (p_record).public_id,
      'title', (p_record).display_name,
      'priority', 0,
      'status', (p_record).workflow_state,
      'selector', coalesce(p_snapshot #> '{work,selector}', '{}'::jsonb),
      'requirements', coalesce(p_snapshot #> '{work,requirements}', '{}'::jsonb),
      'contribution', coalesce(p_snapshot #> '{balance,contribution}', '{}'::jsonb),
      'public_rationale', coalesce(p_snapshot #>> '{balance,public_rationale}', '')
    );
  else
    raise sqlstate 'PGRST' using
      message = '{"code":"unsupported_publication_record","message":"This record kind has no public projection contract."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if private.contains_forbidden_public_key(v_projection) then
    raise sqlstate 'PGRST' using
      message = '{"code":"private_publication_field","message":"The public projection contains a private or identity-bearing field."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;
  return v_projection;
end;
$$;

create or replace function private.create_publication_batch(p_public_ids text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.publication_batches%rowtype;
  v_record public.records%rowtype;
  v_revision public.record_revisions%rowtype;
  v_record_ids uuid[];
  v_hash text;
  v_payload jsonb;
  v_publication_id text;
begin
  v_actor := private.require_app_role('maintainer'::public.app_role);
  if p_public_ids is null or cardinality(p_public_ids) < 1 or cardinality(p_public_ids) > 200 then
    raise sqlstate '22023' using message = 'select one to 200 approved records for a publication batch';
  end if;
  if cardinality(array(select distinct value from unnest(p_public_ids) as value)) <> cardinality(p_public_ids) then
    raise sqlstate '22023' using message = 'publication records must be distinct';
  end if;

  -- Required profile dependencies are frozen with the selection. Selecting a
  -- Pokémon also includes its active default-form profile(s); selecting a
  -- profile includes its job and machine. Planning-only records never gain a
  -- public path by accident, and generic mod loading remains outside this
  -- milestone.
  with selected as (
    select id from public.records where public_id = any(p_public_ids)
  ), selected_profiles as (
    select id from selected
    union
    select assignment.work_profile_record_id
    from selected
    join public.pokemon_forms as form on form.species_record_id = selected.id and form.is_default
    join public.pokemon_work_assignments as assignment on assignment.form_record_id = form.record_id
    where assignment.status in ('candidate', 'active')
  ), dependencies as (
    select id from selected_profiles
    union
    select profile.job_record_id
    from public.work_profiles as profile join selected_profiles on selected_profiles.id = profile.record_id
    union
    select profile.machine_record_id
    from public.work_profiles as profile join selected_profiles on selected_profiles.id = profile.record_id
    where profile.machine_record_id is not null
  )
  select array_agg(distinct id order by id) into v_record_ids from dependencies;

  if (select count(*) from public.records where public_id = any(p_public_ids)) <> cardinality(p_public_ids) then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_record_not_found","message":"One or more selected records do not exist."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;
  if exists (
    select 1 from public.records
    where id = any(v_record_ids)
      and (workflow_state <> 'approved' or approved_revision is null or approved_revision <> current_revision)
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"publication_requires_approved_head","message":"Every selected record and dependency must have its exact current revision approved."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;
  if exists (select 1 from public.records where id = any(v_record_ids) and record_kind not in ('pokemon_species','job','machine','work_profile')) then
    raise sqlstate 'PGRST' using
      message = '{"code":"unsupported_publication_record","message":"Planning-only record kinds cannot enter a public publication batch."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  v_publication_id := 'publication-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text from 1 for 12);
  insert into public.publication_batches(public_id, state, schema_version, notes, created_by)
  values(v_publication_id, 'draft', '1.0.0', 'Generic Studio publication batch', v_actor)
  returning * into v_batch;

  for v_record in select * from public.records where id = any(v_record_ids) order by public_id loop
    select * into v_revision from public.record_revisions
    where record_id = v_record.id and revision_number = v_record.approved_revision;
    if not found or v_revision.snapshot <> v_record.content or v_revision.checksum <> v_record.checksum then
      raise sqlstate 'PGRST' using
        message = '{"code":"publication_revision_integrity","message":"An approved revision no longer matches the record head."}',
        detail = '{"status":409,"status_text":"Conflict"}';
    end if;
    insert into public.publication_batch_records(batch_id, record_id, revision_number, public_projection, checksum)
    values(v_batch.id, v_record.id, v_revision.revision_number, private.generic_public_projection(v_record, v_revision.snapshot), v_revision.checksum);
  end loop;

  v_payload := private.build_publication_payload(v_batch.id);
  v_hash := private.publication_payload_hash(v_payload);
  update public.publication_batches
  set state = 'validated', content_hash = v_hash, validated_by = v_actor, validated_at = clock_timestamp()
  where id = v_batch.id returning * into v_batch;
  insert into public.audit_events(record_id, actor_id, action, metadata)
  select record_id, v_actor, 'publication.frozen', jsonb_build_object('publication_id', v_batch.public_id)
  from public.publication_batch_records where batch_id = v_batch.id;
  return private.get_publication_bundle(v_batch.public_id);
end;
$$;

create or replace function public.create_publication_batch(p_public_ids text[])
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$ select private.create_publication_batch(p_public_ids); $$;

revoke all on function private.generic_public_projection(public.records,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.create_publication_batch(text[]) from public, anon, authenticated, service_role;
revoke all on function public.create_publication_batch(text[]) from public, anon;
grant execute on function private.create_publication_batch(text[]) to authenticated, service_role;
grant execute on function public.create_publication_batch(text[]) to authenticated, service_role;

commit;
