begin;

-- Gen 1 Studio Beta keeps the existing Squirtle/Hydro records intact while
-- widening the durable record model.  Imported workbook values are kept in
-- private provenance tables; neither those values nor review notes are part
-- of a public publication projection.
alter table public.records
  drop constraint if exists records_record_kind_check;

alter table public.records
  add constraint records_record_kind_check check (record_kind in (
    'pokemon_species', 'pokemon_form', 'registry_entry', 'job', 'machine',
    'work_profile', 'work_item', 'asset', 'type_workshop', 'pokemon_idea',
    'machine_research'
  ));

create table public.record_field_provenance (
  record_id uuid not null references public.records(id) on delete cascade,
  field_path text not null check (field_path ~ '^[a-z][a-z0-9_.-]{0,255}$'),
  import_run_id uuid references public.import_runs(id) on delete set null,
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  source_key text not null,
  imported_value jsonb not null,
  imported_hash text not null check (imported_hash ~ '^[0-9a-f]{64}$'),
  overridden_at timestamptz,
  overridden_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (record_id, field_path)
);
create index record_field_provenance_import_run_idx
  on public.record_field_provenance (import_run_id);
create index record_field_provenance_override_idx
  on public.record_field_provenance (overridden_at) where overridden_at is not null;

create table public.type_workshop_plans (
  record_id uuid primary key references public.records(id) on delete restrict,
  type_id uuid not null references public.pokemon_types(id) on delete restrict,
  planning jsonb not null default '{}'::jsonb check (jsonb_typeof(planning) = 'object'),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index type_workshop_plans_type_uidx on public.type_workshop_plans(type_id);

create table public.pokemon_design_ideas (
  record_id uuid primary key references public.records(id) on delete restrict,
  species_record_id uuid not null references public.pokemon_species(record_id) on delete restrict,
  planning jsonb not null default '{}'::jsonb check (jsonb_typeof(planning) = 'object'),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index pokemon_design_ideas_species_uidx on public.pokemon_design_ideas(species_record_id);

create table public.machine_research (
  record_id uuid primary key references public.records(id) on delete restrict,
  system_id text not null unique check (system_id ~ '^[a-z0-9][a-z0-9_.-]{0,127}$'),
  planning jsonb not null default '{}'::jsonb check (jsonb_typeof(planning) = 'object'),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_item_links (
  work_item_record_id uuid not null references public.work_items(record_id) on delete cascade,
  target_record_id uuid not null references public.records(id) on delete restrict,
  relation text not null default 'develops'
    check (relation in ('develops', 'blocks', 'depends_on', 'tests', 'references')),
  created_at timestamptz not null default now(),
  primary key (work_item_record_id, target_record_id, relation)
);
create index work_item_links_target_idx on public.work_item_links(target_record_id, relation);

create trigger record_field_provenance_set_updated_at
before update on public.record_field_provenance
for each row execute function private.set_updated_at();
create trigger type_workshop_plans_set_updated_at
before update on public.type_workshop_plans
for each row execute function private.set_updated_at();
create trigger pokemon_design_ideas_set_updated_at
before update on public.pokemon_design_ideas
for each row execute function private.set_updated_at();
create trigger machine_research_set_updated_at
before update on public.machine_research
for each row execute function private.set_updated_at();

-- Normalise arbitrary user-facing labels into immutable, namespaced slugs.
create or replace function private.studio_slug(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(btrim(p_value)), '[^a-z0-9]+', '-', 'g')), ''),
    'untitled'
  );
$$;

create or replace function private.studio_work_item_status(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(btrim(p_value), ''))
    when 'ready' then 'ready'
    when 'in progress' then 'in_progress'
    when 'in_progress' then 'in_progress'
    when 'blocked' then 'blocked'
    when 'review' then 'review'
    when 'testing' then 'review'
    when 'done' then 'done'
    when 'shipped' then 'done'
    when 'cancelled' then 'archived'
    when 'archived' then 'archived'
    else 'backlog'
  end;
$$;

create or replace function private.studio_priority(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_value, '')) like 'p0%' or lower(coalesce(p_value, '')) = 'critical' then 'critical'
    when lower(coalesce(p_value, '')) like 'p1%' or lower(coalesce(p_value, '')) = 'high' then 'high'
    when lower(coalesce(p_value, '')) like 'p3%' or lower(coalesce(p_value, '')) = 'low' then 'low'
    else 'normal'
  end;
$$;

-- The old validator intentionally accepted only the first vertical slice.
-- This replacement is a record-kind boundary: top-level payloads are
-- structured sections, identifiers remain immutable, and private material is
-- never a publication input.
create or replace function private.validate_editor_content(p_record public.records)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_content jsonb := (p_record).content;
  v_private_note text;
  v_efficiency numeric;
  v_machine_id text;
  v_job_id text;
begin
  if (p_record).record_kind not in (
    'pokemon_species', 'job', 'machine', 'work_profile', 'work_item',
    'type_workshop', 'pokemon_idea', 'machine_research'
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_editable","message":"This record kind does not have an editor contract."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content) <> 'object' or octet_length(v_content::text) > 1048576 then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_record_content","message":"Record content must be a bounded JSON object."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_content) as key(name)
    where key.name in ('id', 'public_id', 'slug', 'record_kind', 'checksum', 'revision')
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"reserved_content_key","message":"Record identity fields are not editable content."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  foreach v_private_note in array array['private_note', 'internal_notes'] loop
    if v_content ? v_private_note
       and (jsonb_typeof(v_content -> v_private_note) <> 'string'
            or length(v_content ->> v_private_note) > 10000) then
      raise sqlstate 'PGRST' using
        message = '{"code":"invalid_private_note","message":"Private notes must be text no longer than 10,000 characters."}',
        detail = '{"status":422,"status_text":"Unprocessable Entity"}';
    end if;
  end loop;

  if (p_record).record_kind = 'pokemon_species'
     and v_content ? 'facts'
     and jsonb_typeof(v_content -> 'facts') <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_facts","message":"Pokémon facts must be a JSON object."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if (p_record).record_kind in ('pokemon_idea', 'type_workshop', 'machine_research')
     and v_content ? 'planning'
     and jsonb_typeof(v_content -> 'planning') <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_planning","message":"Planning data must be a JSON object."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if v_content ? 'work' and jsonb_typeof(v_content -> 'work') <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_work","message":"Work details must be a JSON object."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if v_content ? 'balance' and jsonb_typeof(v_content -> 'balance') <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_balance","message":"Balance details must be a JSON object."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if jsonb_typeof(v_content #> '{balance,efficiency}') not in ('null', 'number') then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_efficiency","message":"Efficiency must be a number."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;
  if jsonb_typeof(v_content #> '{balance,efficiency}') = 'number' then
    v_efficiency := (v_content #>> '{balance,efficiency}')::numeric;
    if v_efficiency < 0 or v_efficiency > 4 then
      raise sqlstate 'PGRST' using
        message = '{"code":"invalid_efficiency","message":"Efficiency must be between 0 and 4."}',
        detail = '{"status":422,"status_text":"Unprocessable Entity"}';
    end if;
  end if;

  if v_content #> '{balance,public_rationale}' is not null
     and (jsonb_typeof(v_content #> '{balance,public_rationale}') <> 'string'
          or length(v_content #>> '{balance,public_rationale}') > 2000) then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_public_rationale","message":"Public rationale must be text no longer than 2,000 characters."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  v_machine_id := nullif(v_content #>> '{work,machine_id}', '');
  v_job_id := nullif(v_content #>> '{work,job_id}', '');
  if v_machine_id is not null and v_machine_id !~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_machine_id","message":"Machine IDs must use a namespaced identifier."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;
  if v_job_id is not null and v_job_id !~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_job_id","message":"Job IDs must use a namespaced identifier."}',
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
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_patch","message":"A save patch must be a non-empty JSON object."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_patch) as key(name)
    where key.name = any (array[
      'id', 'public_id', 'slug', 'display_name', 'record_kind', 'revision',
      'workflow_state', 'schema_version', 'checksum', 'updated_at', 'updated_by',
      'approved_revision', 'approved_at', 'approved_by', 'source_snapshot', 'import'
    ])
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"reserved_patch_key","message":"Record identity and workflow fields are not editable content."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_patch) as key(name)
    where key.name <> all (array['facts', 'design', 'work', 'balance', 'testing', 'planning', 'private_note'])
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"unknown_editor_field","message":"The patch contains a section that is not editable for this record."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if exists (
    select 1 from jsonb_each(p_patch) as field(name, value)
    where field.name in ('facts', 'design', 'work', 'balance', 'testing', 'planning')
      and jsonb_typeof(field.value) <> 'object'
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_editor_section","message":"Structured editor sections must be JSON objects."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if p_patch ? 'private_note'
     and (jsonb_typeof(p_patch -> 'private_note') <> 'string'
          or length(p_patch ->> 'private_note') > 10000) then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_private_note","message":"Private notes must be text no longer than 10,000 characters."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  v_candidate.content := (p_record).content || p_patch;
  perform private.validate_editor_content(v_candidate);
end;
$$;

create or replace function private.sync_normalized_editor_record(
  p_record public.records,
  p_actor uuid
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_facts jsonb := (p_record).content -> 'facts';
  v_planning jsonb := coalesce((p_record).content -> 'planning', '{}'::jsonb);
begin
  if (p_record).record_kind = 'pokemon_species' then
    update public.pokemon_species
    set genus = coalesce(v_facts ->> 'genus', genus),
        habitat = coalesce(v_facts ->> 'habitat', habitat),
        height_decimeters = coalesce(nullif(v_facts ->> 'height_decimeters', '')::integer, height_decimeters),
        weight_hectograms = coalesce(nullif(v_facts ->> 'weight_hectograms', '')::integer, weight_hectograms),
        capture_rate = coalesce(nullif(v_facts ->> 'capture_rate', '')::integer, capture_rate),
        base_friendship = coalesce(nullif(v_facts ->> 'base_friendship', '')::integer, base_friendship),
        growth_rate = coalesce(v_facts ->> 'growth_rate', growth_rate),
        shape = coalesce(v_facts ->> 'shape', shape),
        color = coalesce(v_facts ->> 'color', color),
        is_legendary = coalesce((v_facts ->> 'legendary')::boolean, is_legendary),
        is_mythical = coalesce((v_facts ->> 'mythical')::boolean, is_mythical),
        source_data = coalesce(v_facts, source_data)
    where record_id = (p_record).id;
  elsif (p_record).record_kind = 'type_workshop' then
    update public.type_workshop_plans
    set planning = v_planning
    where record_id = (p_record).id;
  elsif (p_record).record_kind = 'pokemon_idea' then
    update public.pokemon_design_ideas
    set planning = v_planning
    where record_id = (p_record).id;
  elsif (p_record).record_kind = 'machine_research' then
    update public.machine_research
    set planning = v_planning
    where record_id = (p_record).id;
  elsif (p_record).record_kind = 'work_item' then
    update public.work_items
    set status = private.studio_work_item_status((p_record).content #>> '{planning,status}'),
        priority = private.studio_priority((p_record).content #>> '{planning,priority}'),
        handoff_note = coalesce((p_record).content #>> '{planning,handoff_note}', handoff_note),
        labels = coalesce(array(select jsonb_array_elements_text((p_record).content #> '{planning,labels}')), labels)
    where record_id = (p_record).id;
  end if;

  -- Mark a provenance row only when an editor changed the corresponding
  -- top-level section; the imported baseline remains available for review.
  update public.record_field_provenance
  set overridden_at = clock_timestamp(), overridden_by = p_actor
  where record_id = (p_record).id
    and (field_path like 'facts.%' or field_path like 'planning.%');
end;
$$;

create or replace function private.editor_list_item_json(p_record public.records)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.editor_record_json(p_record) || jsonb_build_object(
    'national_dex', species.national_dex,
    'cobblemon_species_id', species.cobblemon_species_id,
    'types', coalesce(types.identifiers, '[]'::jsonb),
    'task_status', task.status,
    'task_count', coalesce(task.task_count, 0),
    'work_ready', coalesce((p_record).content #>> '{work,readiness}', 'not_started'),
    'planning', case
      when (p_record).record_kind = 'work_item' then
        coalesce((p_record).content -> 'planning', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'linked_record', linked_target.public_id,
          'status', own_work_item.status,
          'priority', own_work_item.priority,
          'handoff_note', own_work_item.handoff_note
        ))
      else coalesce((p_record).content -> 'planning', '{}'::jsonb)
    end,
    'work_item_assignees', case
      when (p_record).record_kind = 'work_item' then coalesce(own_assignees.people, '[]'::jsonb)
      else '[]'::jsonb
    end
  )
  from public.records as source
  left join public.pokemon_species as species on species.record_id = source.id
  left join lateral (
    select jsonb_agg(type.identifier order by form_type.slot) as identifiers
    from public.pokemon_forms as form
    join public.pokemon_form_types as form_type on form_type.form_record_id = form.record_id
    join public.pokemon_types as type on type.id = form_type.type_id
    where form.species_record_id = source.id and form.is_default and form_type.typing_context = 'current'
  ) as types on true
  left join lateral (
    select min(item.status) as status, count(*)::integer as task_count
    from public.work_item_links as link
    join public.work_items as item on item.record_id = link.work_item_record_id
    where link.target_record_id = source.id
  ) as task on true
  left join public.work_items as own_work_item on own_work_item.record_id = source.id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'auth_user_id', member.auth_user_id,
      'github_login', member.github_login,
      'display_name', coalesce(nullif(btrim(member.display_name), ''), member.github_login),
      'role', member.role
    ) order by member.github_login) as people
    from public.work_item_assignees as assignment
    join public.app_users as member on member.auth_user_id = assignment.assignee_id
    where assignment.work_item_record_id = source.id
  ) as own_assignees on true
  left join lateral (
    select target.public_id
    from public.work_item_links as link
    join public.records as target on target.id = link.target_record_id
    where link.work_item_record_id = source.id
    order by target.public_id
    limit 1
  ) as linked_target on true
  where source.id = (p_record).id;
$$;

create or replace function private.list_editor_records(
  p_kind text default null,
  p_query text default null,
  p_type text default null,
  p_workflow text default null,
  p_task_status text default null,
  p_limit integer default 50,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_next_cursor text;
  v_has_more boolean;
begin
  perform private.require_app_role('viewer'::public.app_role);
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise sqlstate '22023' using message = 'limit must be between 1 and 200';
  end if;

  with filtered as (
    select record.*
    from public.records as record
    left join public.pokemon_species as species on species.record_id = record.id
    where (p_kind is null or record.record_kind = p_kind)
      and (p_workflow is null or record.workflow_state = p_workflow)
      and (p_cursor is null or record.public_id > p_cursor)
      and (
        nullif(btrim(p_query), '') is null
        or record.public_id ilike '%' || btrim(p_query) || '%'
        or record.display_name ilike '%' || btrim(p_query) || '%'
        or coalesce(species.national_dex::text, '') = btrim(regexp_replace(p_query, '^#', ''))
      )
      and (
        p_type is null or exists (
          select 1
          from public.pokemon_forms as form
          join public.pokemon_form_types as form_type on form_type.form_record_id = form.record_id
          join public.pokemon_types as type on type.id = form_type.type_id
          where form.species_record_id = record.id and form.is_default
            and form_type.typing_context = 'current' and type.identifier = lower(p_type)
        )
      )
      and (
        p_task_status is null or exists (
          select 1 from public.work_item_links as link
          join public.work_items as item on item.record_id = link.work_item_record_id
          where link.target_record_id = record.id and item.status = p_task_status
        )
      )
    order by coalesce(species.national_dex, 999999), record.display_name collate "C", record.public_id
  ), picked as (
    select * from filtered limit p_limit + 1
  ), page as (
    select * from picked limit p_limit
  )
  select coalesce(jsonb_agg(private.editor_list_item_json(page) order by coalesce((private.editor_list_item_json(page) ->> 'national_dex')::integer, 999999), page.display_name collate "C", page.public_id), '[]'::jsonb),
         max(page.public_id),
         (select count(*) > p_limit from picked)
  into v_items, v_next_cursor, v_has_more
  from page;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', case when v_has_more then v_next_cursor else null end
  );
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
  v_comments jsonb;
  v_links jsonb;
  v_provenance jsonb;
begin
  perform private.require_app_role('viewer'::public.app_role);
  select * into v_record from public.records where public_id = p_public_id;
  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_found","message":"No Studio record exists for the requested public ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;

  select coalesce(jsonb_agg(private.revision_json(revision) order by revision.revision_number desc), '[]'::jsonb)
  into v_revisions
  from (
    select * from public.record_revisions
    where record_id = v_record.id order by revision_number desc limit 50
  ) as revision;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', comment.id, 'body', comment.body, 'resolved_at', comment.resolved_at,
    'created_at', comment.created_at, 'updated_at', comment.updated_at,
    'author', coalesce(nullif(btrim(member.display_name), ''), member.github_login, 'Maintainer'),
    'resolved_by', coalesce(nullif(btrim(resolver.display_name), ''), resolver.github_login)
  ) order by comment.created_at), '[]'::jsonb)
  into v_comments
  from public.comments as comment
  left join public.app_users as member on member.auth_user_id = comment.author_id
  left join public.app_users as resolver on resolver.auth_user_id = comment.resolved_by
  where comment.record_id = v_record.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'work_item_public_id', item_record.public_id,
    'title', item_record.display_name,
    'status', item.status,
    'priority', item.priority,
    'relation', link.relation,
    'handoff_note', item.handoff_note,
    'assignees', coalesce(assignees.people, '[]'::jsonb)
  ) order by item_record.display_name), '[]'::jsonb)
  into v_links
  from public.work_item_links as link
  join public.work_items as item on item.record_id = link.work_item_record_id
  join public.records as item_record on item_record.id = item.record_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'auth_user_id', person.auth_user_id,
      'github_login', person.github_login,
      'display_name', coalesce(nullif(btrim(person.display_name), ''), person.github_login)
    ) order by person.github_login) as people
    from public.work_item_assignees as assignment
    join public.app_users as person on person.auth_user_id = assignment.assignee_id
    where assignment.work_item_record_id = item.record_id
  ) as assignees on true
  where link.target_record_id = v_record.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'field_path', provenance.field_path,
    'source_sheet', provenance.source_sheet,
    'source_row', provenance.source_row,
    'source_key', provenance.source_key,
    'imported_value', provenance.imported_value,
    'imported_hash', provenance.imported_hash,
    'overridden_at', provenance.overridden_at
  ) order by provenance.field_path), '[]'::jsonb)
  into v_provenance
  from public.record_field_provenance as provenance
  where provenance.record_id = v_record.id;

  return jsonb_build_object(
    'record', private.editor_list_item_json(v_record),
    'revisions', v_revisions,
    'comments', v_comments,
    'work_items', v_links,
    'provenance', v_provenance
  );
end;
$$;

create or replace function private.get_record_head(p_public_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_record public.records%rowtype;
begin
  perform private.require_app_role('viewer'::public.app_role);
  select * into v_record from public.records where public_id = p_public_id;
  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_found","message":"No Studio record exists for the requested public ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;
  return jsonb_build_object(
    'public_id', v_record.public_id,
    'revision', v_record.current_revision,
    'checksum', v_record.checksum,
    'workflow_state', v_record.workflow_state,
    'updated_at', v_record.updated_at,
    'updated_by', v_record.updated_by
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
  v_actor uuid;
  v_record public.records%rowtype;
  v_existing public.record_revisions%rowtype;
  v_revision public.record_revisions%rowtype;
  v_content jsonb;
  v_checksum text;
  v_changed_keys text;
  v_revision_number bigint;
begin
  v_actor := private.require_app_role('editor'::public.app_role);
  if p_expected_revision is null or p_expected_revision < 0 or p_client_mutation_id is null then
    raise sqlstate '22023' using message = 'expected_revision and client_mutation_id are required';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or octet_length(p_patch::text) > 1048576 then
    raise sqlstate '22023' using message = 'patch must be a bounded JSON object';
  end if;

  select * into v_record from public.records where public_id = p_public_id for update;
  if not found then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_not_found","message":"No Studio record exists for the requested public ID."}',
      detail = '{"status":404,"status_text":"Not Found"}';
  end if;
  if v_record.workflow_state = 'archived' then
    raise sqlstate 'PGRST' using
      message = '{"code":"record_archived","message":"Archived records cannot be edited."}',
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  select * into v_existing from public.record_revisions
  where record_id = v_record.id and actor_id = v_actor and client_mutation_id = p_client_mutation_id;
  if found then
    return jsonb_build_object('record', private.editor_list_item_json(v_record),
      'revision', private.revision_json(v_existing), 'revisions', jsonb_build_array(private.revision_json(v_existing)));
  end if;
  if v_record.current_revision <> p_expected_revision then
    raise sqlstate 'PGRST' using
      message = json_build_object('code','revision_conflict','message','The record changed after this editor loaded it.','expected_revision',p_expected_revision,'current_revision',v_record.current_revision)::text,
      detail = '{"status":409,"status_text":"Conflict"}';
  end if;

  perform private.validate_editor_patch(v_record, p_patch);
  v_content := v_record.content || p_patch;
  -- Preserve field names used by the original Hydro fixture whenever a
  -- record already carries that legacy envelope. This is data-shape
  -- compatibility, not a species-specific path: new Studio records use the
  -- structured sections only, while the existing approved profile can retain
  -- its deterministic historical export until it is deliberately migrated.
  if v_record.content ? 'efficiency' and p_patch #> '{balance,efficiency}' is not null then
    v_content := jsonb_set(v_content, '{efficiency}', p_patch #> '{balance,efficiency}', true);
  end if;
  if v_record.content ? 'public_rationale' and p_patch #> '{balance,public_rationale}' is not null then
    v_content := jsonb_set(v_content, '{public_rationale}', p_patch #> '{balance,public_rationale}', true);
  end if;
  if v_record.content ? 'machine_id' and p_patch #> '{work,machine_id}' is not null then
    v_content := jsonb_set(v_content, '{machine_id}', p_patch #> '{work,machine_id}', true);
  end if;
  if v_record.content ? 'job_id' and p_patch #> '{work,job_id}' is not null then
    v_content := jsonb_set(v_content, '{job_id}', p_patch #> '{work,job_id}', true);
  end if;
  v_checksum := encode(extensions.digest(v_content::text, 'sha256'), 'hex');
  v_revision_number := v_record.current_revision + 1;
  select string_agg(key, ', ' order by key) into v_changed_keys from jsonb_object_keys(p_patch) as key(key);

  update public.records set content = v_content, checksum = v_checksum,
    current_revision = v_revision_number,
    workflow_state = case when workflow_state = 'approved' then 'draft' else workflow_state end,
    approved_revision = null, approved_by = null, approved_at = null, updated_by = v_actor
  where id = v_record.id returning * into v_record;

  perform private.sync_normalized_editor_record(v_record, v_actor);
  insert into public.record_revisions(record_id, revision_number, schema_version, snapshot, checksum, actor_id, client_mutation_id, change_summary)
  values(v_record.id, v_revision_number, v_record.schema_version, v_content, v_checksum, v_actor, p_client_mutation_id, 'Updated ' || coalesce(v_changed_keys, 'record'))
  returning * into v_revision;
  insert into public.audit_events(record_id, actor_id, action, before_revision, after_revision, request_id, metadata)
  values(v_record.id, v_actor, 'record.saved', p_expected_revision, v_revision_number, p_client_mutation_id,
    jsonb_build_object('changed_keys', to_jsonb(string_to_array(coalesce(v_changed_keys, ''), ', '))));

  return jsonb_build_object('record', private.editor_list_item_json(v_record),
    'revision', private.revision_json(v_revision), 'revisions', jsonb_build_array(private.revision_json(v_revision)));
end;
$$;

create or replace function private.add_record_comment(p_public_id text, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_record_id uuid;
  v_comment public.comments%rowtype;
begin
  v_actor := private.require_app_role('editor'::public.app_role);
  if length(btrim(coalesce(p_body, ''))) not between 1 and 10000 then
    raise sqlstate '22023' using message = 'comment must contain 1 to 10,000 characters';
  end if;
  select id into v_record_id from public.records where public_id = p_public_id;
  if v_record_id is null then
    raise sqlstate 'PGRST' using message = '{"code":"record_not_found","message":"No Studio record exists for the requested public ID."}', detail = '{"status":404,"status_text":"Not Found"}';
  end if;
  insert into public.comments(record_id, author_id, body) values(v_record_id, v_actor, btrim(p_body)) returning * into v_comment;
  insert into public.audit_events(record_id, actor_id, action, metadata) values(v_record_id, v_actor, 'comment.added', jsonb_build_object('comment_id', v_comment.id));
  return jsonb_build_object('id', v_comment.id, 'body', v_comment.body, 'created_at', v_comment.created_at);
end;
$$;

create or replace function private.resolve_record_comment(p_comment_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_comment public.comments%rowtype;
begin
  v_actor := private.require_app_role('editor'::public.app_role);
  update public.comments set resolved_at = clock_timestamp(), resolved_by = v_actor
  where id = p_comment_id and resolved_at is null returning * into v_comment;
  if not found then
    raise sqlstate 'PGRST' using message = '{"code":"comment_not_found","message":"The comment is missing or already resolved."}', detail = '{"status":404,"status_text":"Not Found"}';
  end if;
  insert into public.audit_events(record_id, actor_id, action, metadata) values(v_comment.record_id, v_actor, 'comment.resolved', jsonb_build_object('comment_id', v_comment.id));
  return jsonb_build_object('id', v_comment.id, 'resolved_at', v_comment.resolved_at);
end;
$$;

create or replace function private.list_active_members()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_app_role('viewer'::public.app_role);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'auth_user_id', app_user.auth_user_id, 'github_login', app_user.github_login,
    'display_name', coalesce(nullif(btrim(app_user.display_name), ''), app_user.github_login),
    'role', app_user.role
  ) order by app_user.github_login) from public.app_users as app_user where app_user.is_active), '[]'::jsonb);
end;
$$;

create or replace function private.set_work_item_assignees(
  p_public_id text,
  p_expected_revision bigint,
  p_assignee_ids uuid[],
  p_handoff_note text,
  p_status text default null,
  p_priority text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_record public.records%rowtype;
  v_work_item public.work_items%rowtype;
  v_ids uuid[] := coalesce(p_assignee_ids, '{}'::uuid[]);
  v_count integer;
  v_content jsonb;
  v_checksum text;
  v_revision bigint;
begin
  v_actor := private.require_app_role('editor'::public.app_role);
  select * into v_record from public.records where public_id = p_public_id and record_kind = 'work_item' for update;
  if not found then
    raise sqlstate 'PGRST' using message = '{"code":"work_item_not_found","message":"No work item exists for that public ID."}', detail = '{"status":404,"status_text":"Not Found"}';
  end if;
  if p_expected_revision is null or v_record.current_revision <> p_expected_revision then
    raise sqlstate 'PGRST' using message = '{"code":"revision_conflict","message":"The work item changed before this save."}', detail = '{"status":409,"status_text":"Conflict"}';
  end if;
  select count(distinct item) into v_count from unnest(v_ids) as item;
  if v_count <> cardinality(v_ids) or v_count > 2 then
    raise sqlstate '22023' using message = 'work items may have zero, one, or two distinct explicit assignees';
  end if;
  if v_count > 1 and length(btrim(coalesce(p_handoff_note, ''))) = 0 then
    raise sqlstate '23514' using message = 'a shared work item requires a handoff note';
  end if;
  if exists(select 1 from unnest(v_ids) as member_id where not exists(select 1 from public.app_users where auth_user_id = member_id and is_active)) then
    raise sqlstate '22023' using message = 'assignees must be active Studio members';
  end if;
  delete from public.work_item_assignees where work_item_record_id = v_record.id;
  update public.work_items set handoff_note = coalesce(p_handoff_note, ''),
    status = coalesce(private.studio_work_item_status(p_status), status),
    priority = coalesce(private.studio_priority(p_priority), priority)
  where record_id = v_record.id returning * into v_work_item;
  insert into public.work_item_assignees(work_item_record_id, assignee_id, assigned_by)
  select v_record.id, member_id, v_actor from unnest(v_ids) as member_id;
  v_content := v_record.content || jsonb_build_object(
    'planning', coalesce(v_record.content -> 'planning', '{}'::jsonb) || jsonb_build_object(
      'status', v_work_item.status,
      'priority', v_work_item.priority,
      'handoff_note', v_work_item.handoff_note
    )
  );
  v_checksum := encode(extensions.digest(v_content::text, 'sha256'), 'hex');
  v_revision := v_record.current_revision + 1;
  update public.records
  set content = v_content, checksum = v_checksum, current_revision = v_revision, updated_by = v_actor
  where id = v_record.id returning * into v_record;
  insert into public.record_revisions(record_id, revision_number, schema_version, snapshot, checksum, actor_id, client_mutation_id, change_summary)
  values(v_record.id, v_revision, v_record.schema_version, v_content, v_checksum, v_actor, gen_random_uuid(), 'Updated explicit work-item assignments');
  insert into public.audit_events(record_id, actor_id, action, before_revision, after_revision, metadata)
  values(v_record.id, v_actor, 'work_item.assignees_set', p_expected_revision, v_revision, jsonb_build_object('assignee_count', v_count));
  return private.get_editor_record(p_public_id);
end;
$$;

-- Create a source-backed record without assigning an owner.  On a subsequent
-- workbook run the same fingerprint is a no-op; a changed imported record is
-- preserved for review rather than silently replacing collaboration work.
create or replace function private.import_upsert_record(
  p_public_id text,
  p_slug text,
  p_display_name text,
  p_record_kind text,
  p_content jsonb,
  p_source_fingerprint text,
  p_import_run_id uuid,
  p_source_sheet text,
  p_source_row integer,
  p_source_key text
)
returns table(record_id uuid, operation text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_record public.records%rowtype;
  v_revision bigint;
begin
  select * into v_record from public.records where public_id = p_public_id for update;
  if found and v_record.content #>> '{import,fingerprint}' = p_source_fingerprint then
    return query select v_record.id, 'unchanged'::text;
    return;
  end if;
  if found and v_record.content ? 'import' then
    return query select v_record.id, 'review'::text;
    return;
  end if;

  if not found then
    insert into public.records(public_id, slug, display_name, record_kind, workflow_state, schema_version, current_revision, content)
    values(p_public_id, p_slug, p_display_name, p_record_kind, 'draft', '1.0.0', 1, p_content)
    returning * into v_record;
    insert into public.record_revisions(record_id, revision_number, schema_version, snapshot, checksum, change_summary)
    values(v_record.id, 1, v_record.schema_version, v_record.content, v_record.checksum, 'Imported from workbook') ;
    insert into public.audit_events(record_id, action, after_revision, metadata)
    values(v_record.id, 'record.imported', 1, jsonb_build_object('import_run_id', p_import_run_id, 'source_key', p_source_key, 'source_sheet', p_source_sheet, 'source_row', p_source_row));
    return query select v_record.id, 'imported'::text;
    return;
  end if;

  -- This is the one pre-existing fixture record (Squirtle). Preserve its
  -- Hydro work/balance fields while replacing the old vertical-slice envelope.
  v_revision := v_record.current_revision + 1;
  update public.records
  set content = p_content || jsonb_build_object(
        'work', coalesce(v_record.content -> 'work', jsonb_build_object(
          'machine_id', v_record.content -> 'machine_id',
          'job_id', v_record.content -> 'job_id'
        )),
        'balance', coalesce(v_record.content -> 'balance', jsonb_build_object(
          'efficiency', coalesce(v_record.content -> 'efficiency', '1'::jsonb),
          'public_rationale', coalesce(v_record.content -> 'public_rationale', '""'::jsonb)
        )),
        'private_note', coalesce(v_record.content -> 'private_note', '""'::jsonb)
      ),
      current_revision = v_revision,
      workflow_state = 'draft', approved_revision = null, approved_at = null, approved_by = null
  where id = v_record.id returning * into v_record;
  insert into public.record_revisions(record_id, revision_number, schema_version, snapshot, checksum, change_summary)
  values(v_record.id, v_revision, v_record.schema_version, v_record.content, v_record.checksum, 'Imported Gen 1 workbook facts');
  insert into public.audit_events(record_id, action, before_revision, after_revision, metadata)
  values(v_record.id, 'record.imported', v_revision - 1, v_revision, jsonb_build_object('import_run_id', p_import_run_id, 'source_key', p_source_key, 'source_sheet', p_source_sheet, 'source_row', p_source_row));
  return query select v_record.id, 'updated'::text;
end;
$$;

create or replace function private.import_record_provenance(
  p_record_id uuid,
  p_import_run_id uuid,
  p_sheet text,
  p_row integer,
  p_source_key text,
  p_fields jsonb,
  p_hashes jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_field record;
begin
  for v_field in select key, value from jsonb_each(p_fields) loop
    insert into public.record_field_provenance(
      record_id, field_path, import_run_id, source_sheet, source_row, source_key, imported_value, imported_hash
    ) values(
      p_record_id, 'facts.' || v_field.key, p_import_run_id, p_sheet, p_row, p_source_key,
      v_field.value, coalesce(p_hashes ->> v_field.key, encode(extensions.digest(v_field.value::text, 'sha256'), 'hex'))
    ) on conflict (record_id, field_path) do update
      set import_run_id = excluded.import_run_id,
          source_sheet = excluded.source_sheet,
          source_row = excluded.source_row,
          source_key = excluded.source_key,
          imported_value = excluded.imported_value,
          imported_hash = excluded.imported_hash
      where public.record_field_provenance.overridden_at is null;
  end loop;
end;
$$;

create or replace function private.apply_gen1_workbook_import(
  p_document jsonb,
  p_expected_source_sha256 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run public.import_runs%rowtype;
  v_row jsonb;
  v_fields jsonb;
  v_derived jsonb;
  v_record_id uuid;
  v_operation text;
  v_species_id uuid;
  v_form_id uuid;
  v_type_id uuid;
  v_type_identifier text;
  v_content jsonb;
  v_public_id text;
  v_slug text;
  v_dex integer;
  v_summary jsonb := jsonb_build_object('imported', 0, 'updated', 0, 'unchanged', 0, 'manual_review', 0, 'quarantined', 0);
  v_import_row_id bigint;
  v_revision bigint;
  v_species_record public.records%rowtype;
begin
  -- Caller role is checked by the public SECURITY INVOKER facade below.
  -- `current_user` inside this SECURITY DEFINER function is its owner, so
  -- checking it here would reject the service-role call it is meant to serve.
  if jsonb_typeof(p_document) <> 'object'
     or p_document ->> 'import_format_version' <> '1'
     or p_document #>> '{source,sha256}' <> p_expected_source_sha256
     or p_expected_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise sqlstate '22023' using message = 'The reviewed import document and source SHA-256 must match.';
  end if;
  if coalesce(jsonb_array_length(p_document #> '{rows,02 Gen 1 Roster}'), 0) <> 151
     or coalesce(jsonb_array_length(p_document #> '{rows,03 Type Membership}'), 0) <> 218
     or coalesce(jsonb_array_length(p_document #> '{rows,04 Type Workshop}'), 0) <> 18
     or coalesce(jsonb_array_length(p_document #> '{rows,05 Pokemon Ideas}'), 0) <> 151
     or coalesce(jsonb_array_length(p_document #> '{rows,06 Create Catalog}'), 0) <> 11
     or coalesce(jsonb_array_length(p_document #> '{rows,07 Idea Backlog}'), 0) <> 12 then
    raise sqlstate '22023' using message = 'The reviewed document does not match the locked Gen 1 workbook counts.';
  end if;
  select * into v_run from public.import_runs where source_sha256 = p_expected_source_sha256 and status = 'completed' order by completed_at desc limit 1;
  if found then
    return jsonb_build_object('run_id', v_run.id, 'already_applied', true, 'summary', v_run.summary);
  end if;

  insert into public.import_runs(source_kind, source_filename, source_sha256, importer_version, schema_version, status, summary, started_at)
  values('xlsx', coalesce(p_document #>> '{source,file_name}', 'gen1-workbook.xlsx'), p_expected_source_sha256,
    coalesce(p_document ->> 'importer_version', '1.0.0'), '1.0.0', 'applying', '{}'::jsonb, clock_timestamp())
  returning * into v_run;

  -- Record source rows first so review/quarantine records never need to be
  -- inferred from browser input.
  for v_row in select value from jsonb_array_elements(
    coalesce(p_document #> '{rows,02 Gen 1 Roster}', '[]'::jsonb) ||
    coalesce(p_document #> '{rows,03 Type Membership}', '[]'::jsonb) ||
    coalesce(p_document #> '{rows,04 Type Workshop}', '[]'::jsonb) ||
    coalesce(p_document #> '{rows,05 Pokemon Ideas}', '[]'::jsonb) ||
    coalesce(p_document #> '{rows,06 Create Catalog}', '[]'::jsonb) ||
    coalesce(p_document #> '{rows,07 Idea Backlog}', '[]'::jsonb) ||
    coalesce(p_document #> '{rows,08 Sources & Lists}', '[]'::jsonb)
  ) loop
    insert into public.import_rows(import_run_id, sheet_name, source_row, stable_key, row_fingerprint, status, normalized_data, transformations)
    values(v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key', v_row ->> 'fingerprint',
      'imported', jsonb_build_object('fields', coalesce(v_row -> 'fields','{}'::jsonb), 'derived', coalesce(v_row -> 'derived','{}'::jsonb)), '[]'::jsonb)
    returning id into v_import_row_id;
  end loop;

  -- Controlled values are built from the reviewed workbook, not browser input.
  for v_row in select value from jsonb_array_elements(p_document #> '{rows,04 Type Workshop}') loop
    v_type_identifier := private.studio_slug(v_row #>> '{fields,type}');
    insert into public.pokemon_types(identifier, display_name)
    values(v_type_identifier, v_row #>> '{fields,type}')
    on conflict(identifier) do update set display_name = excluded.display_name
    returning id into v_type_id;
  end loop;

  -- Roster, one default form per species, current and original typing.
  for v_row in select value from jsonb_array_elements(p_document #> '{rows,02 Gen 1 Roster}') loop
    v_fields := v_row -> 'fields';
    v_derived := v_row -> 'derived';
    v_dex := (v_fields ->> 'national_dex')::integer;
    v_public_id := v_derived ->> 'public_id';
    v_slug := private.studio_slug(v_fields ->> 'api_slug');
    v_content := jsonb_build_object(
      'facts', v_fields - 'pokedex_entry',
      'typing', jsonb_build_object(
        'current', coalesce(v_derived -> 'current_types', '[]'::jsonb),
        'original_gen_i', coalesce(v_derived -> 'original_gen1_types', '[]'::jsonb),
        'type_changed', coalesce(v_derived -> 'type_changed', 'false'::jsonb)
      ),
      'design', '{}'::jsonb,
      'work', jsonb_build_object('readiness', 'not_started', 'machine_id', null, 'job_id', null),
      'balance', jsonb_build_object('efficiency', 1.0, 'public_rationale', ''),
      'testing', '{}'::jsonb,
      'private_note', '',
      'import', jsonb_build_object('fingerprint', v_row ->> 'fingerprint', 'sheet', v_row ->> 'sheet', 'source_key', v_row ->> 'stable_key')
    );
    select record_id, operation into v_species_id, v_operation from private.import_upsert_record(
      v_public_id, v_slug, v_fields ->> 'pokemon', 'pokemon_species', v_content, v_row ->> 'fingerprint',
      v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key'
    );
    if v_operation = 'review' then
      update public.import_rows set status = 'manual_review' where import_run_id = v_run.id and sheet_name = v_row ->> 'sheet' and source_row = (v_row ->> 'row')::integer;
      select id into v_import_row_id from public.import_rows where import_run_id = v_run.id and sheet_name = v_row ->> 'sheet' and source_row = (v_row ->> 'row')::integer;
      insert into public.import_field_reviews(import_row_id, field_name, classification, raw_value, normalized_value, reason)
      values(v_import_row_id, 'record', 'overwrite_conflict', v_fields, jsonb_build_object('public_id', v_public_id), 'A prior imported record has maintainer edits; no field was overwritten.');
      v_summary := jsonb_set(v_summary, '{manual_review}', to_jsonb((v_summary ->> 'manual_review')::integer + 1));
    else
      perform private.import_record_provenance(v_species_id, v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key', v_fields - 'pokedex_entry', v_row -> 'field_hashes');
      v_summary := jsonb_set(v_summary, array[v_operation], to_jsonb((v_summary ->> v_operation)::integer + 1), true);
    end if;

    insert into public.pokemon_species(record_id, national_dex, generation_id, cobblemon_species_id, api_slug, genus, habitat, height_decimeters, weight_hectograms, capture_rate, base_friendship, growth_rate, shape, color, is_legendary, is_mythical, source_data)
    values(v_species_id, v_dex, 1, v_derived ->> 'cobblemon_id', v_fields ->> 'api_slug', v_fields ->> 'genus', v_fields ->> 'habitat',
      round(coalesce((v_fields ->> 'height_m')::numeric, 0) * 10)::integer, round(coalesce((v_fields ->> 'weight_kg')::numeric, 0) * 10)::integer,
      nullif(v_fields ->> 'capture_rate','')::integer, nullif(v_fields ->> 'base_friendship','')::integer, v_fields ->> 'growth_rate', v_fields ->> 'shape', v_fields ->> 'color',
      coalesce((v_derived ->> 'legendary')::boolean, false), coalesce((v_derived ->> 'mythical')::boolean, false), v_fields - 'pokedex_entry')
    on conflict(record_id) do update set national_dex = excluded.national_dex, generation_id = excluded.generation_id,
      cobblemon_species_id = excluded.cobblemon_species_id, api_slug = excluded.api_slug;

    select record_id into v_form_id from private.import_upsert_record(
      v_derived ->> 'form_public_id', v_slug || '-default', (v_fields ->> 'pokemon') || ' (Default Form)', 'pokemon_form',
      jsonb_build_object('species_public_id', v_public_id, 'form_key', 'default', 'import', jsonb_build_object('fingerprint', v_row ->> 'fingerprint')),
      v_row ->> 'fingerprint', v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key' || ':default'
    );
    insert into public.pokemon_forms(record_id, species_record_id, cobblemon_form_id, form_key, is_default, base_stats, abilities, attributes)
    values(v_form_id, v_species_id, v_derived ->> 'cobblemon_id', 'default', true,
      jsonb_build_object('hp', v_fields -> 'hp', 'attack', v_fields -> 'attack', 'defense', v_fields -> 'defense', 'special_attack', v_fields -> 'special_attack', 'special_defense', v_fields -> 'special_defense', 'speed', v_fields -> 'speed'),
      array_remove(array[v_fields ->> 'standard_abilities', v_fields ->> 'hidden_ability'], null), '{}'::jsonb)
    on conflict(record_id) do update set species_record_id = excluded.species_record_id, base_stats = excluded.base_stats, abilities = excluded.abilities;

    delete from public.pokemon_form_types where form_record_id = v_form_id and compatibility_set_id = '00000000-0000-4000-8000-000000000702';
    for v_type_identifier in select jsonb_array_elements_text(coalesce(v_derived -> 'current_types', '[]'::jsonb)) loop
      select id into v_type_id from public.pokemon_types where identifier = private.studio_slug(v_type_identifier);
      insert into public.pokemon_form_types(form_record_id, compatibility_set_id, typing_context, type_id, slot)
      values(v_form_id, '00000000-0000-4000-8000-000000000702', 'current', v_type_id,
        (select count(*) + 1 from public.pokemon_form_types where form_record_id = v_form_id and compatibility_set_id = '00000000-0000-4000-8000-000000000702' and typing_context = 'current'));
    end loop;
    for v_type_identifier in select jsonb_array_elements_text(coalesce(v_derived -> 'original_gen1_types', '[]'::jsonb)) loop
      select id into v_type_id from public.pokemon_types where identifier = private.studio_slug(v_type_identifier);
      insert into public.pokemon_form_types(form_record_id, compatibility_set_id, typing_context, type_id, slot)
      values(v_form_id, '00000000-0000-4000-8000-000000000702', 'original_gen_i', v_type_id,
        (select count(*) + 1 from public.pokemon_form_types where form_record_id = v_form_id and compatibility_set_id = '00000000-0000-4000-8000-000000000702' and typing_context = 'original_gen_i'));
    end loop;

    -- Every species gets a neutral, deliberately unowned backlog item.
    select record_id into v_record_id from private.import_upsert_record(
      'cobblemon_kinetics:work-item/gen1-' || lpad(v_dex::text, 3, '0') || '-' || v_slug,
      'gen1-' || lpad(v_dex::text, 3, '0') || '-' || v_slug || '-design',
      'Design ' || (v_fields ->> 'pokemon') || ' for Gen 1', 'work_item',
      jsonb_build_object('planning', jsonb_build_object('status','backlog','priority','normal','definition_of_done','Document a reviewed design direction, constraints, balance rationale, and validation plan.'),
        'import', jsonb_build_object('fingerprint', v_row ->> 'fingerprint', 'generated', true), 'private_note',''),
      v_row ->> 'fingerprint', v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, 'generated:gen1:' || v_dex::text
    );
    insert into public.work_items(record_id, status, priority, handoff_note, source_key)
    values(v_record_id, 'backlog', 'normal', '', 'generated:gen1:' || v_dex::text)
    on conflict(record_id) do nothing;
    insert into public.work_item_links(work_item_record_id, target_record_id, relation)
    values(v_record_id, v_species_id, 'develops') on conflict do nothing;
  end loop;

  -- Eighteen type plans retain every planning column, including uncertainty
  -- and legacy owner wording as nonbinding imported history.
  for v_row in select value from jsonb_array_elements(p_document #> '{rows,04 Type Workshop}') loop
    v_fields := v_row -> 'fields';
    v_slug := private.studio_slug(v_fields ->> 'type');
    select id into v_type_id from public.pokemon_types where identifier = v_slug;
    select record_id, operation into v_record_id, v_operation from private.import_upsert_record(
      'cobblemon_kinetics:type-workshop/' || v_slug, 'type-workshop-' || v_slug,
      (v_fields ->> 'type') || ' Type Workshop', 'type_workshop',
      jsonb_build_object('planning', v_fields, 'private_note','', 'import', jsonb_build_object('fingerprint', v_row ->> 'fingerprint', 'sheet', v_row ->> 'sheet', 'source_key', v_row ->> 'stable_key')),
      v_row ->> 'fingerprint', v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key'
    );
    insert into public.type_workshop_plans(record_id, type_id, planning, source_key)
    values(v_record_id, v_type_id, v_fields, v_row ->> 'stable_key')
    on conflict(record_id) do update set planning = excluded.planning, source_key = excluded.source_key;
    perform private.import_record_provenance(v_record_id, v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key', v_fields, v_row -> 'field_hashes');
  end loop;

  for v_row in select value from jsonb_array_elements(p_document #> '{rows,05 Pokemon Ideas}') loop
    v_fields := v_row -> 'fields';
    v_dex := (v_fields ->> 'national_dex')::integer;
    select record_id into v_species_id from public.pokemon_species where national_dex = v_dex;
    select public_id, slug into v_public_id, v_slug from public.records where id = v_species_id;
    select record_id, operation into v_record_id, v_operation from private.import_upsert_record(
      'cobblemon_kinetics:pokemon-idea/' || v_slug, v_slug || '-design-idea', (v_fields ->> 'pokemon') || ' Design Idea', 'pokemon_idea',
      jsonb_build_object('planning', v_fields, 'private_note','', 'import', jsonb_build_object('fingerprint',v_row ->> 'fingerprint','sheet',v_row ->> 'sheet','source_key',v_row ->> 'stable_key')),
      v_row ->> 'fingerprint', v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key'
    );
    insert into public.pokemon_design_ideas(record_id, species_record_id, planning, source_key)
    values(v_record_id, v_species_id, v_fields, v_row ->> 'stable_key')
    on conflict(record_id) do update set planning = excluded.planning, source_key = excluded.source_key;
    perform private.import_record_provenance(v_record_id, v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key', v_fields, v_row -> 'field_hashes');
    -- The planning record remains first-class, while a safe editable copy is
    -- mirrored into the linked Pokémon workspace for the two-maintainer flow.
    -- A changed imported idea becomes `review` above and never overwrites a
    -- maintainer's current species design section.
    if v_operation in ('imported', 'updated') then
      select * into v_species_record from public.records where id = v_species_id for update;
      v_content := v_species_record.content || jsonb_build_object('design', v_fields);
      v_revision := v_species_record.current_revision + 1;
      update public.records
      set content = v_content,
          checksum = encode(extensions.digest(v_content::text, 'sha256'), 'hex'),
          current_revision = v_revision,
          workflow_state = 'draft',
          approved_revision = null,
          approved_at = null,
          approved_by = null
      where id = v_species_record.id returning * into v_species_record;
      insert into public.record_revisions(record_id, revision_number, schema_version, snapshot, checksum, change_summary)
      values(v_species_record.id, v_revision, v_species_record.schema_version, v_species_record.content, v_species_record.checksum, 'Imported Pokémon design idea');
      insert into public.audit_events(record_id, action, before_revision, after_revision, metadata)
      values(v_species_record.id, 'record.imported_design_idea', v_revision - 1, v_revision,
        jsonb_build_object('import_run_id', v_run.id, 'idea_record_id', v_record_id));
    end if;
  end loop;

  for v_row in select value from jsonb_array_elements(p_document #> '{rows,06 Create Catalog}') loop
    v_fields := v_row -> 'fields';
    v_slug := private.studio_slug(v_fields ->> 'system_id');
    select record_id, operation into v_record_id, v_operation from private.import_upsert_record(
      'cobblemon_kinetics:machine-research/' || v_slug, 'machine-research-' || v_slug, coalesce(v_fields ->> 'system_family', v_fields ->> 'system_id'), 'machine_research',
      jsonb_build_object('planning', v_fields, 'private_note','', 'import', jsonb_build_object('fingerprint',v_row ->> 'fingerprint','sheet',v_row ->> 'sheet','source_key',v_row ->> 'stable_key')),
      v_row ->> 'fingerprint', v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key'
    );
    insert into public.machine_research(record_id, system_id, planning, source_key)
    values(v_record_id, v_slug, v_fields, v_row ->> 'stable_key')
    on conflict(record_id) do update set planning = excluded.planning, source_key = excluded.source_key;
    perform private.import_record_provenance(v_record_id, v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key', v_fields, v_row -> 'field_hashes');
  end loop;

  for v_row in select value from jsonb_array_elements(p_document #> '{rows,07 Idea Backlog}') loop
    v_fields := v_row -> 'fields';
    v_slug := private.studio_slug(v_fields ->> 'idea_id');
    select record_id, operation into v_record_id, v_operation from private.import_upsert_record(
      'cobblemon_kinetics:work-item/' || v_slug, v_slug, v_fields ->> 'idea_task', 'work_item',
      jsonb_build_object('planning', v_fields, 'imported_legacy_owner', v_fields -> 'explicit_owner', 'private_note','',
        'import',jsonb_build_object('fingerprint',v_row ->> 'fingerprint','sheet',v_row ->> 'sheet','source_key',v_row ->> 'stable_key')),
      v_row ->> 'fingerprint', v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key'
    );
    insert into public.work_items(record_id, status, priority, handoff_note, due_date, labels, source_key)
    values(v_record_id, private.studio_work_item_status(v_fields ->> 'status'), private.studio_priority(v_fields ->> 'priority'),
      coalesce(v_fields ->> 'ownership_handoff_notes',''), nullif(v_fields ->> 'target_date','')::date, '{}'::text[], v_row ->> 'stable_key')
    on conflict(record_id) do update set status = excluded.status, priority = excluded.priority, handoff_note = excluded.handoff_note;
    if (v_fields ->> 'related_dex_type') ~ '^#?[0-9]+$' then
      select record_id into v_species_id from public.pokemon_species where national_dex = regexp_replace(v_fields ->> 'related_dex_type', '^#', '')::integer;
      if v_species_id is not null then
        insert into public.work_item_links(work_item_record_id, target_record_id, relation) values(v_record_id, v_species_id, 'develops') on conflict do nothing;
      end if;
    end if;
    perform private.import_record_provenance(v_record_id, v_run.id, v_row ->> 'sheet', (v_row ->> 'row')::integer, v_row ->> 'stable_key', v_fields, v_row -> 'field_hashes');
  end loop;

  -- Flavor text is intentionally quarantined in a private review table.
  for v_row in select value from jsonb_array_elements(coalesce(p_document -> 'quarantine', '[]'::jsonb)) loop
    select id into v_import_row_id from public.import_rows
    where import_run_id = v_run.id and sheet_name = v_row ->> 'sheet' and source_row = (v_row ->> 'row')::integer;
    insert into public.import_field_reviews(import_row_id, field_name, classification, raw_value, normalized_value, reason)
    values(v_import_row_id, v_row ->> 'field', 'quarantined', v_row -> 'value', null, v_row ->> 'reason');
    v_summary := jsonb_set(v_summary, '{quarantined}', to_jsonb((v_summary ->> 'quarantined')::integer + 1));
  end loop;

  update public.import_runs set status = 'completed', summary = v_summary, completed_at = clock_timestamp() where id = v_run.id;
  return jsonb_build_object('run_id', v_run.id, 'already_applied', false, 'summary', v_summary);
exception when others then
  if v_run.id is not null then
    update public.import_runs set status = 'failed', completed_at = clock_timestamp(), summary = jsonb_build_object('error', sqlerrm) where id = v_run.id;
  end if;
  raise;
end;
$$;

-- Explicit public RPC facade.  The application CLI uses the service key;
-- browser sessions can never run a private workbook import.
create or replace function public.list_editor_records(
  p_kind text default null,
  p_query text default null,
  p_type text default null,
  p_workflow text default null,
  p_task_status text default null,
  p_limit integer default 50,
  p_cursor text default null
)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.list_editor_records(p_kind,p_query,p_type,p_workflow,p_task_status,p_limit,p_cursor); $$;

create or replace function public.get_record_head(p_public_id text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.get_record_head(p_public_id); $$;

create or replace function public.add_record_comment(p_public_id text, p_body text)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.add_record_comment(p_public_id,p_body); $$;

create or replace function public.resolve_record_comment(p_comment_id uuid)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.resolve_record_comment(p_comment_id); $$;

create or replace function public.list_active_members()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.list_active_members(); $$;

create or replace function public.set_work_item_assignees(
  p_public_id text, p_expected_revision bigint, p_assignee_ids uuid[], p_handoff_note text, p_status text default null, p_priority text default null
)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.set_work_item_assignees(p_public_id,p_expected_revision,p_assignee_ids,p_handoff_note,p_status,p_priority); $$;

create or replace function public.apply_gen1_workbook_import(p_document jsonb, p_expected_source_sha256 text)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise sqlstate 'PGRST' using message = '{"code":"service_role_required","message":"Workbook application is restricted to the controlled service role."}', detail = '{"status":403,"status_text":"Forbidden"}';
  end if;
  return private.apply_gen1_workbook_import(p_document,p_expected_source_sha256);
end;
$$;

-- RLS stays deny-by-default.  Active members may inspect Studio planning
-- material; mutations remain in the security-definer RPCs above.
do $block$
declare v_table text;
begin
  foreach v_table in array array['record_field_provenance','type_workshop_plans','pokemon_design_ideas','machine_research','work_item_links'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.has_app_role(''viewer''::public.app_role)))', v_table || '_member_read', v_table);
  end loop;
end;
$block$;

-- The preceding foundation migration deliberately grants active members
-- read-only access to existing RLS-protected tables. New tables otherwise
-- inherit PostgreSQL's default PUBLIC privileges, so remove only those broad
-- grants and explicitly grant authenticated read access below.
revoke all on all tables in schema public from public, anon;
revoke all on function private.studio_slug(text) from public, anon, authenticated, service_role;
revoke all on function private.studio_work_item_status(text) from public, anon, authenticated, service_role;
revoke all on function private.studio_priority(text) from public, anon, authenticated, service_role;
revoke all on function private.sync_normalized_editor_record(public.records, uuid) from public, anon, authenticated, service_role;
revoke all on function private.editor_list_item_json(public.records) from public, anon, authenticated, service_role;
revoke all on function private.list_editor_records(text,text,text,text,text,integer,text) from public, anon, authenticated, service_role;
revoke all on function private.get_record_head(text) from public, anon, authenticated, service_role;
revoke all on function private.add_record_comment(text,text) from public, anon, authenticated, service_role;
revoke all on function private.resolve_record_comment(uuid) from public, anon, authenticated, service_role;
revoke all on function private.list_active_members() from public, anon, authenticated, service_role;
revoke all on function private.set_work_item_assignees(text,bigint,uuid[],text,text,text) from public, anon, authenticated, service_role;
revoke all on function private.import_upsert_record(text,text,text,text,jsonb,text,uuid,text,integer,text) from public, anon, authenticated, service_role;
revoke all on function private.import_record_provenance(uuid,uuid,text,integer,text,jsonb,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.apply_gen1_workbook_import(jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.list_editor_records(text,text,text,text,text,integer,text) from public, anon;
revoke all on function public.get_record_head(text) from public, anon;
revoke all on function public.add_record_comment(text,text) from public, anon;
revoke all on function public.resolve_record_comment(uuid) from public, anon;
revoke all on function public.list_active_members() from public, anon;
revoke all on function public.set_work_item_assignees(text,bigint,uuid[],text,text,text) from public, anon;
revoke all on function public.apply_gen1_workbook_import(jsonb,text) from public, anon, authenticated;

grant all privileges on public.record_field_provenance, public.type_workshop_plans, public.pokemon_design_ideas, public.machine_research, public.work_item_links to service_role;
revoke all privileges on public.record_field_provenance, public.type_workshop_plans, public.pokemon_design_ideas, public.machine_research, public.work_item_links from authenticated;
grant select on public.record_field_provenance, public.type_workshop_plans, public.pokemon_design_ideas, public.machine_research, public.work_item_links to authenticated;
grant execute on function private.get_editor_record(text), private.save_record_revision(text,bigint,uuid,jsonb), private.approve_record_revision(text,bigint), private.list_editor_records(text,text,text,text,text,integer,text), private.get_record_head(text), private.add_record_comment(text,text), private.resolve_record_comment(uuid), private.list_active_members(), private.set_work_item_assignees(text,bigint,uuid[],text,text,text) to authenticated, service_role;
grant execute on function private.apply_gen1_workbook_import(jsonb,text) to service_role;
grant execute on function public.get_editor_record(text), public.save_record_revision(text,bigint,uuid,jsonb), public.approve_record_revision(text,bigint), public.list_editor_records(text,text,text,text,text,integer,text), public.get_record_head(text), public.add_record_comment(text,text), public.resolve_record_comment(uuid), public.list_active_members(), public.set_work_item_assignees(text,bigint,uuid[],text,text,text) to authenticated, service_role;
grant execute on function public.apply_gen1_workbook_import(jsonb,text) to service_role;

commit;
