begin;

-- Kinetic Blueprint is an editor over the existing immutable record model.
-- New normalized rows are projections of record-backed facts and relationships;
-- the graph never becomes an independent source of truth.
alter table public.records
  drop constraint if exists records_record_kind_check;

alter table public.records
  add constraint records_record_kind_check check (record_kind in (
    'pokemon_species', 'pokemon_form', 'registry_entry', 'job', 'machine',
    'work_profile', 'work_item', 'asset', 'type_workshop', 'pokemon_idea',
    'machine_research', 'evolution_family', 'capability', 'work_target',
    'condition', 'result', 'relationship', 'blueprint_board'
  ));

create table public.controlled_fact_values (
  vocabulary text not null check (vocabulary in ('growth_rate', 'habitat', 'shape', 'color', 'pokemon_type', 'genus')),
  slug text not null check (slug ~ '^[a-z][a-z0-9-]{0,79}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  imported boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (vocabulary, slug)
);

create table public.fact_value_reviews (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records(id) on delete cascade,
  field_path text not null check (field_path in ('facts.genus')),
  proposed_value text not null check (length(btrim(proposed_value)) between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (record_id, field_path, proposed_value)
);

create table public.pokemon_fact_values (
  species_record_id uuid primary key references public.pokemon_species(record_id) on delete cascade,
  growth_rate_slug text,
  habitat_slug text,
  shape_slug text,
  color_slug text,
  updated_at timestamptz not null default now()
);

create table public.evolution_families (
  record_id uuid primary key references public.records(id) on delete restrict,
  generation_id smallint not null references public.generations(id) on delete restrict,
  family_key text not null unique check (family_key ~ '^[a-z][a-z0-9-]{0,79}$'),
  imported_label text not null check (length(imported_label) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evolution_family_members (
  family_record_id uuid not null references public.evolution_families(record_id) on delete cascade,
  form_record_id uuid not null references public.pokemon_forms(record_id) on delete restrict,
  stage_index smallint not null check (stage_index between 1 and 9),
  stage_label text not null check (stage_label in ('Stage 1', 'Stage 2', 'Stage 3', 'Standalone')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (family_record_id, form_record_id),
  unique (form_record_id)
);

create table public.capabilities (
  record_id uuid primary key references public.records(id) on delete restrict,
  category text not null check (category ~ '^[a-z][a-z0-9_]{0,63}$'),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_targets (
  record_id uuid primary key references public.records(id) on delete restrict,
  target_kind text not null check (target_kind in ('machine', 'farmland', 'water', 'storage', 'area', 'entity', 'world_workflow')),
  registry_entry_record_id uuid references public.registry_entries(record_id) on delete restrict,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conditions (
  record_id uuid primary key references public.records(id) on delete restrict,
  condition_kind text not null check (condition_kind in ('ownership', 'loading', 'weather', 'held_item', 'space', 'battle', 'other')),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.results (
  record_id uuid primary key references public.records(id) on delete restrict,
  result_kind text not null check (result_kind in ('block_change', 'item', 'energy', 'status', 'area_support', 'world_effect', 'other')),
  description text not null default '',
  bounds jsonb not null default '{}'::jsonb check (jsonb_typeof(bounds) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_relationships (
  record_id uuid primary key references public.records(id) on delete restrict,
  source_record_id uuid not null references public.records(id) on delete restrict,
  target_record_id uuid not null references public.records(id) on delete restrict,
  relationship_kind text not null check (relationship_kind in (
    'has_capability', 'requires_capability', 'assigned_to_job', 'operates_at',
    'constrained_by', 'produces_result', 'evolves_to'
  )),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  inheritance_decision text check (inheritance_decision is null or inheritance_decision in ('keep', 'raise', 'lower', 'replace', 'remove', 'add')),
  parent_relationship_record_id uuid references public.studio_relationships(record_id) on delete restrict,
  inheritance_state text not null default 'not_applicable' check (inheritance_state in ('not_applicable', 'current', 'outdated')),
  parent_revision_at_review bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_record_id <> target_record_id),
  unique (source_record_id, target_record_id, relationship_kind)
);
create index studio_relationships_source_kind_idx on public.studio_relationships(source_record_id, relationship_kind);
create index studio_relationships_target_kind_idx on public.studio_relationships(target_record_id, relationship_kind);
create index studio_relationships_parent_idx on public.studio_relationships(parent_relationship_record_id) where parent_relationship_record_id is not null;

create table public.evolution_edges (
  relationship_record_id uuid primary key references public.studio_relationships(record_id) on delete restrict,
  family_record_id uuid not null references public.evolution_families(record_id) on delete cascade,
  from_form_record_id uuid not null references public.pokemon_forms(record_id) on delete restrict,
  to_form_record_id uuid not null references public.pokemon_forms(record_id) on delete restrict,
  trigger_summary text not null default 'Level or condition defined by Cobblemon',
  created_at timestamptz not null default now(),
  check (from_form_record_id <> to_form_record_id),
  unique (family_record_id, from_form_record_id, to_form_record_id)
);

create table public.form_capabilities (
  relationship_record_id uuid primary key references public.studio_relationships(record_id) on delete restrict,
  form_record_id uuid not null references public.pokemon_forms(record_id) on delete restrict,
  capability_record_id uuid not null references public.capabilities(record_id) on delete restrict,
  tier smallint not null check (tier between 1 and 4),
  explicit_values jsonb not null default '{}'::jsonb check (jsonb_typeof(explicit_values) = 'object'),
  unique (form_record_id, capability_record_id)
);

create table public.job_capability_requirements (
  relationship_record_id uuid primary key references public.studio_relationships(record_id) on delete restrict,
  job_record_id uuid not null references public.jobs(record_id) on delete restrict,
  capability_record_id uuid not null references public.capabilities(record_id) on delete restrict,
  minimum_tier smallint not null check (minimum_tier between 1 and 4),
  unique (job_record_id, capability_record_id)
);

create table public.type_capability_suggestions (
  id uuid primary key default gen_random_uuid(),
  type_workshop_record_id uuid not null references public.type_workshop_plans(record_id) on delete cascade,
  capability_record_id uuid not null references public.capabilities(record_id) on delete restrict,
  suggested_tier smallint not null check (suggested_tier between 1 and 4),
  rationale text not null default '',
  accepted_relationship_record_id uuid references public.studio_relationships(record_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (type_workshop_record_id, capability_record_id)
);

-- A Type Workshop suggestion can be reviewed independently for every form.
-- Keeping acceptance in a join table prevents one species from globally
-- accepting a suggestion for every Pokémon that shares its type.
create table public.type_capability_acceptances (
  suggestion_id uuid not null references public.type_capability_suggestions(id) on delete cascade,
  form_record_id uuid not null references public.pokemon_forms(record_id) on delete restrict,
  relationship_record_id uuid not null references public.studio_relationships(record_id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz not null default now(),
  primary key (suggestion_id, form_record_id),
  unique (relationship_record_id)
);

create table public.blueprint_boards (
  record_id uuid primary key references public.records(id) on delete restrict,
  family_record_id uuid not null unique references public.evolution_families(record_id) on delete restrict,
  board_revision bigint not null default 1 check (board_revision > 0),
  layout_checksum text not null default repeat('0', 64) check (layout_checksum ~ '^[0-9a-f]{64}$'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blueprint_nodes (
  board_record_id uuid not null references public.blueprint_boards(record_id) on delete cascade,
  record_id uuid not null references public.records(id) on delete restrict,
  node_family text not null check (node_family in ('worker', 'capability', 'job', 'worksite', 'interlock', 'result')),
  position_x numeric(10,2) not null default 0,
  position_y numeric(10,2) not null default 0,
  width numeric(10,2) check (width is null or width between 80 and 1200),
  height numeric(10,2) check (height is null or height between 40 and 1200),
  group_key text check (group_key is null or group_key ~ '^[a-z][a-z0-9-]{0,79}$'),
  z_index integer not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (board_record_id, record_id)
);

create table public.blueprint_edges (
  board_record_id uuid not null references public.blueprint_boards(record_id) on delete cascade,
  relationship_record_id uuid not null references public.studio_relationships(record_id) on delete restrict,
  source_handle text not null,
  target_handle text not null,
  label text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (board_record_id, relationship_record_id)
);

create table public.blueprint_annotations (
  id uuid primary key default gen_random_uuid(),
  board_record_id uuid not null references public.blueprint_boards(record_id) on delete cascade,
  annotation_kind text not null check (annotation_kind in ('group', 'comment')),
  body text not null check (length(body) between 1 and 4000),
  position_x numeric(10,2) not null,
  position_y numeric(10,2) not null,
  width numeric(10,2) not null default 280 check (width between 80 and 1200),
  height numeric(10,2) not null default 140 check (height between 40 and 1200),
  group_key text check (group_key is null or group_key ~ '^[a-z][a-z0-9-]{0,79}$'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blueprint_user_preferences (
  board_record_id uuid not null references public.blueprint_boards(record_id) on delete cascade,
  auth_user_id uuid not null references public.app_users(auth_user_id) on delete cascade,
  viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb check (jsonb_typeof(viewport) = 'object'),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  hidden_record_ids uuid[] not null default '{}',
  last_view text not null default 'overview' check (last_view in ('overview', 'canvas', 'outline', 'facts', 'discussion')),
  updated_at timestamptz not null default now(),
  primary key (board_record_id, auth_user_id)
);

create table public.blueprint_mutations (
  board_record_id uuid not null references public.blueprint_boards(record_id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (board_record_id, actor_id, client_mutation_id)
);

create trigger evolution_families_set_updated_at before update on public.evolution_families
for each row execute function private.set_updated_at();
create trigger capabilities_set_updated_at before update on public.capabilities
for each row execute function private.set_updated_at();
create trigger work_targets_set_updated_at before update on public.work_targets
for each row execute function private.set_updated_at();
create trigger conditions_set_updated_at before update on public.conditions
for each row execute function private.set_updated_at();
create trigger results_set_updated_at before update on public.results
for each row execute function private.set_updated_at();
create trigger studio_relationships_set_updated_at before update on public.studio_relationships
for each row execute function private.set_updated_at();
create trigger blueprint_nodes_set_updated_at before update on public.blueprint_nodes
for each row execute function private.set_updated_at();
create trigger blueprint_annotations_set_updated_at before update on public.blueprint_annotations
for each row execute function private.set_updated_at();

insert into public.controlled_fact_values(vocabulary, slug, display_name, sort_order) values
  ('growth_rate','fast','Fast',1),
  ('growth_rate','medium','Medium',2),
  ('growth_rate','medium-slow','Medium Slow',3),
  ('growth_rate','slow','Slow',4),
  ('habitat','cave','Cave',1),
  ('habitat','forest','Forest',2),
  ('habitat','grassland','Grassland',3),
  ('habitat','mountain','Mountain',4),
  ('habitat','rare','Rare',5),
  ('habitat','rough-terrain','Rough Terrain',6),
  ('habitat','sea','Sea',7),
  ('habitat','urban','Urban',8),
  ('habitat','waters-edge','Waters Edge',9),
  ('shape','armor','Armor',1),
  ('shape','arms','Arms',2),
  ('shape','ball','Ball',3),
  ('shape','blob','Blob',4),
  ('shape','bug-wings','Bug Wings',5),
  ('shape','fish','Fish',6),
  ('shape','heads','Heads',7),
  ('shape','humanoid','Humanoid',8),
  ('shape','legs','Legs',9),
  ('shape','quadruped','Quadruped',10),
  ('shape','squiggle','Squiggle',11),
  ('shape','tentacles','Tentacles',12),
  ('shape','upright','Upright',13),
  ('shape','wings','Wings',14),
  ('color','black','Black',1),
  ('color','blue','Blue',2),
  ('color','brown','Brown',3),
  ('color','gray','Gray',4),
  ('color','green','Green',5),
  ('color','pink','Pink',6),
  ('color','purple','Purple',7),
  ('color','red','Red',8),
  ('color','white','White',9),
  ('color','yellow','Yellow',10);

insert into public.controlled_fact_values(vocabulary, slug, display_name, sort_order)
select 'pokemon_type', type.identifier, type.display_name, row_number() over(order by type.identifier)::smallint
from public.pokemon_types as type
on conflict(vocabulary,slug) do update set display_name = excluded.display_name;

create or replace function private.blueprint_node_family(p_record_kind text)
returns text language sql immutable strict set search_path = ''
as $$
  select case p_record_kind
    when 'pokemon_form' then 'worker'
    when 'capability' then 'capability'
    when 'job' then 'job'
    when 'machine' then 'worksite'
    when 'registry_entry' then 'worksite'
    when 'work_target' then 'worksite'
    when 'condition' then 'interlock'
    when 'result' then 'result'
    else null
  end;
$$;

create or replace function private.blueprint_relation_label(p_kind text)
returns text language sql immutable strict set search_path = ''
as $$
  select case p_kind
    when 'has_capability' then 'Has capability'
    when 'requires_capability' then 'Requires capability'
    when 'assigned_to_job' then 'Assigned to job'
    when 'operates_at' then 'Operates at worksite'
    when 'constrained_by' then 'Constrained by'
    when 'produces_result' then 'Produces result'
    when 'evolves_to' then 'Evolves to'
  end;
$$;

create or replace function private.blueprint_handles(p_kind text)
returns jsonb language sql immutable strict set search_path = ''
as $$
  select case p_kind
    when 'has_capability' then '{"source":"worker:capability","target":"capability:worker"}'::jsonb
    when 'requires_capability' then '{"source":"job:requirement","target":"capability:job"}'::jsonb
    when 'assigned_to_job' then '{"source":"worker:job","target":"job:worker"}'::jsonb
    when 'operates_at' then '{"source":"job:worksite","target":"worksite:job"}'::jsonb
    when 'constrained_by' then '{"source":"rule:condition","target":"interlock:rule"}'::jsonb
    when 'produces_result' then '{"source":"job:result","target":"result:job"}'::jsonb
    when 'evolves_to' then '{"source":"worker:evolution","target":"worker:evolution"}'::jsonb
  end;
$$;

create or replace function private.ensure_blueprint_record(
  p_public_id text,
  p_slug text,
  p_display_name text,
  p_record_kind text,
  p_content jsonb
)
returns uuid
language plpgsql volatile set search_path = ''
as $$
declare
  v_record public.records%rowtype;
  v_checksum text;
begin
  select * into v_record from public.records where public_id = p_public_id;
  if found then return v_record.id; end if;
  v_checksum := encode(extensions.digest(p_content::text, 'sha256'), 'hex');
  insert into public.records(public_id,slug,display_name,record_kind,workflow_state,schema_version,current_revision,content,checksum)
  values(p_public_id,p_slug,p_display_name,p_record_kind,'draft','2.0.0',1,p_content,v_checksum)
  returning * into v_record;
  insert into public.record_revisions(record_id,revision_number,schema_version,snapshot,checksum,change_summary)
  values(v_record.id,1,v_record.schema_version,v_record.content,v_record.checksum,'Created Kinetic Blueprint record');
  insert into public.audit_events(record_id,action,before_revision,after_revision,metadata)
  values(v_record.id,'blueprint.record_created',0,1,jsonb_build_object('record_kind',p_record_kind));
  return v_record.id;
end;
$$;

create or replace function private.ensure_blueprint_relationship(
  p_source_record_id uuid,
  p_target_record_id uuid,
  p_kind text,
  p_metadata jsonb default '{}'::jsonb,
  p_inheritance_decision text default null,
  p_parent_relationship_record_id uuid default null
)
returns uuid
language plpgsql volatile set search_path = ''
as $$
declare
  v_source public.records%rowtype;
  v_target public.records%rowtype;
  v_relationship_id uuid;
  v_public_id text;
  v_slug text;
  v_parent_revision bigint;
begin
  select relationship.record_id into v_relationship_id
  from public.studio_relationships
  as relationship
  where relationship.source_record_id=p_source_record_id and relationship.target_record_id=p_target_record_id and relationship.relationship_kind=p_kind;
  if found then return v_relationship_id; end if;
  select * into v_source from public.records where id=p_source_record_id;
  select * into v_target from public.records where id=p_target_record_id;
  if v_source.id is null or v_target.id is null then raise exception 'Relationship endpoints must exist'; end if;
  v_slug := 'relationship-' || substring(encode(extensions.digest(v_source.public_id || ':' || p_kind || ':' || v_target.public_id,'sha256'),'hex') from 1 for 16);
  v_public_id := 'cobblemon_kinetics:relationship/' || substring(v_slug from 14);
  v_relationship_id := private.ensure_blueprint_record(
    v_public_id,v_slug,private.blueprint_relation_label(p_kind) || ': ' || v_source.display_name || ' → ' || v_target.display_name,
    'relationship',jsonb_build_object('source_public_id',v_source.public_id,'target_public_id',v_target.public_id,'relationship_kind',p_kind,'metadata',coalesce(p_metadata,'{}'::jsonb))
  );
  if p_parent_relationship_record_id is not null then
    select current_revision into v_parent_revision from public.records where id=p_parent_relationship_record_id;
  end if;
  insert into public.studio_relationships(record_id,source_record_id,target_record_id,relationship_kind,metadata,inheritance_decision,parent_relationship_record_id,inheritance_state,parent_revision_at_review)
  values(v_relationship_id,p_source_record_id,p_target_record_id,p_kind,coalesce(p_metadata,'{}'::jsonb),p_inheritance_decision,p_parent_relationship_record_id,
    case when p_parent_relationship_record_id is null then 'not_applicable' else 'current' end,v_parent_revision);
  return v_relationship_id;
end;
$$;

create or replace function private.mark_inheritance_outdated()
returns trigger language plpgsql volatile set search_path = ''
as $$
begin
  with recursive descendants(record_id) as (
    select relationship.record_id
    from public.studio_relationships as relationship
    where relationship.parent_relationship_record_id=new.record_id
    union all
    select relationship.record_id
    from descendants
    join public.studio_relationships as relationship
      on relationship.parent_relationship_record_id=descendants.record_id
  )
  update public.studio_relationships as relationship
  set inheritance_state='outdated'
  where relationship.record_id in (select record_id from descendants);
  return new;
end;
$$;
create trigger record_revision_marks_inheritance_outdated
after insert on public.record_revisions
for each row execute function private.mark_inheritance_outdated();

create or replace function private.validate_blueprint_relationship(
  p_source public.records,
  p_target public.records,
  p_kind text,
  p_metadata jsonb
)
returns void language plpgsql stable set search_path = ''
as $$
declare v_tier integer;
begin
  if p_kind='has_capability' and not ((p_source).record_kind='pokemon_form' and (p_target).record_kind='capability') then
    raise exception 'has_capability requires Worker → Capability';
  elsif p_kind='requires_capability' and not ((p_source).record_kind='job' and (p_target).record_kind='capability') then
    raise exception 'requires_capability requires Job → Capability';
  elsif p_kind='assigned_to_job' and not ((p_source).record_kind='pokemon_form' and (p_target).record_kind='job') then
    raise exception 'assigned_to_job requires Worker → Job';
  elsif p_kind='operates_at' and not ((p_source).record_kind='job' and (p_target).record_kind in ('work_target','machine','registry_entry')) then
    raise exception 'operates_at requires Job → Worksite';
  elsif p_kind='constrained_by' and not ((p_source).record_kind in ('pokemon_form','job','work_target','machine') and (p_target).record_kind='condition') then
    raise exception 'constrained_by requires a worker, job, or worksite → Interlock';
  elsif p_kind='produces_result' and not ((p_source).record_kind='job' and (p_target).record_kind='result') then
    raise exception 'produces_result requires Job → Result';
  elsif p_kind='evolves_to' and not ((p_source).record_kind='pokemon_form' and (p_target).record_kind='pokemon_form') then
    raise exception 'evolves_to requires Worker → Worker';
  end if;
  if p_kind in ('has_capability','requires_capability') then
    v_tier := coalesce(nullif(p_metadata->>'tier','')::integer,nullif(p_metadata->>'minimum_tier','')::integer);
    if v_tier is null or v_tier not between 1 and 4 then raise exception 'Capability tiers must be between 1 and 4'; end if;
  end if;
end;
$$;

create or replace function private.ensure_evolution_edge(
  p_family_record_id uuid,
  p_board_record_id uuid,
  p_from_form_record_id uuid,
  p_to_form_record_id uuid
)
returns uuid language plpgsql volatile set search_path = ''
as $$
declare
  v_relationship_id uuid;
  v_handles jsonb := private.blueprint_handles('evolves_to');
begin
  if not exists(select 1 from public.evolution_family_members where family_record_id=p_family_record_id and form_record_id=p_from_form_record_id)
     or not exists(select 1 from public.evolution_family_members where family_record_id=p_family_record_id and form_record_id=p_to_form_record_id) then
    raise exception 'Evolution endpoints must be members of the same family';
  end if;
  v_relationship_id := private.ensure_blueprint_relationship(p_from_form_record_id,p_to_form_record_id,'evolves_to','{}'::jsonb,null,null);
  insert into public.evolution_edges(relationship_record_id,family_record_id,from_form_record_id,to_form_record_id)
  values(v_relationship_id,p_family_record_id,p_from_form_record_id,p_to_form_record_id)
  on conflict(relationship_record_id) do update set family_record_id=excluded.family_record_id,from_form_record_id=excluded.from_form_record_id,to_form_record_id=excluded.to_form_record_id;
  insert into public.blueprint_edges(board_record_id,relationship_record_id,source_handle,target_handle,label)
  values(p_board_record_id,v_relationship_id,v_handles->>'source',v_handles->>'target','Evolves to')
  on conflict(board_record_id,relationship_record_id) do update set source_handle=excluded.source_handle,target_handle=excluded.target_handle,label=excluded.label;
  return v_relationship_id;
end;
$$;

create or replace function private.reconcile_gen1_evolution_blueprints()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_family record;
  v_member record;
  v_family_id uuid;
  v_board_id uuid;
  v_chain text[];
  v_branches text[];
  v_previous_name text;
  v_target_name text;
  v_from_form_id uuid;
  v_to_form_id uuid;
  v_branch text;
  v_species_count integer;
  v_family_count integer;
  v_edge_count integer;
  v_capability_id uuid;
  v_job_id uuid;
  v_work_target_id uuid;
  v_condition_id uuid;
  v_result_id uuid;
  v_grass_type_id uuid;
  v_relation_id uuid;
  v_parent_capability_id uuid;
  v_parent_job_id uuid;
  v_handles jsonb;
  v_suggestion_id uuid;
  v_bulbasaur_form_id uuid;
begin
  -- Existing values become searchable suggestions without becoming factual
  -- defaults for any other species.
  insert into public.controlled_fact_values(vocabulary,slug,display_name,sort_order,imported)
  select 'genus',private.studio_slug(species.genus),species.genus,row_number() over(order by species.genus collate "C")::smallint,true
  from (select distinct genus from public.pokemon_species where genus is not null and btrim(genus)<>'') as species
  on conflict(vocabulary,slug) do update set display_name=excluded.display_name,imported=true;

  insert into public.controlled_fact_values(vocabulary,slug,display_name,sort_order,imported)
  select 'pokemon_type',type.identifier,type.display_name,row_number() over(order by type.identifier)::smallint,true
  from public.pokemon_types as type
  on conflict(vocabulary,slug) do update set display_name=excluded.display_name,imported=true;

  insert into public.pokemon_fact_values(species_record_id,growth_rate_slug,habitat_slug,shape_slug,color_slug)
  select species.record_id,
    private.studio_slug(species.growth_rate),private.studio_slug(species.habitat),
    private.studio_slug(species.shape),private.studio_slug(species.color)
  from public.pokemon_species as species
  where species.growth_rate is not null and species.habitat is not null and species.shape is not null and species.color is not null
  on conflict(species_record_id) do update set
    growth_rate_slug=excluded.growth_rate_slug,habitat_slug=excluded.habitat_slug,
    shape_slug=excluded.shape_slug,color_slug=excluded.color_slug,updated_at=clock_timestamp();

  for v_family in
    select record.content #>> '{facts,evolution_family}' as imported_label,
      min(species.national_dex) as root_dex,
      (array_agg(record.slug order by species.national_dex))[1] as root_slug,
      (array_agg(record.display_name order by species.national_dex))[1] as root_name
    from public.pokemon_species as species
    join public.records as record on record.id=species.record_id
    where species.generation_id=1 and nullif(btrim(record.content #>> '{facts,evolution_family}'),'') is not null
    group by record.content #>> '{facts,evolution_family}'
    order by min(species.national_dex)
  loop
    v_family_id := private.ensure_blueprint_record(
      'cobblemon_kinetics:evolution-family/' || v_family.root_slug,
      'evolution-family-' || v_family.root_slug,
      v_family.root_name || ' family',
      'evolution_family',
      jsonb_build_object('generation',1,'imported_label',v_family.imported_label,'root_dex',v_family.root_dex)
    );
    insert into public.evolution_families(record_id,generation_id,family_key,imported_label)
    values(v_family_id,1,v_family.root_slug,v_family.imported_label)
    on conflict(record_id) do update set imported_label=excluded.imported_label;

    v_board_id := private.ensure_blueprint_record(
      'cobblemon_kinetics:blueprint/' || v_family.root_slug,
      'blueprint-' || v_family.root_slug,
      v_family.root_name || ' family Kinetic Blueprint',
      'blueprint_board',
      jsonb_build_object('family_public_id','cobblemon_kinetics:evolution-family/' || v_family.root_slug,'mode','family')
    );
    insert into public.blueprint_boards(record_id,family_record_id,board_revision,layout_checksum)
    values(v_board_id,v_family_id,1,encode(extensions.digest(v_family.imported_label,'sha256'),'hex'))
    on conflict(record_id) do update set family_record_id=excluded.family_record_id;

    delete from public.evolution_family_members where family_record_id=v_family_id;
    for v_member in
      select form.record_id as form_record_id,species.national_dex,record.display_name,
        case record.content #>> '{facts,evolution_stage}'
          when 'Stage 1' then 1 when 'Stage 2' then 2 when 'Stage 3' then 3 else 1 end as stage_index,
        case when record.content #>> '{facts,evolution_stage}' in ('Stage 1','Stage 2','Stage 3','Standalone')
          then record.content #>> '{facts,evolution_stage}' else 'Standalone' end as stage_label,
        row_number() over(partition by record.content #>> '{facts,evolution_stage}' order by species.national_dex) as branch_order
      from public.pokemon_species as species
      join public.records as record on record.id=species.record_id
      join public.pokemon_forms as form on form.species_record_id=species.record_id and form.is_default
      where species.generation_id=1 and record.content #>> '{facts,evolution_family}'=v_family.imported_label
      order by species.national_dex
    loop
      insert into public.evolution_family_members(family_record_id,form_record_id,stage_index,stage_label,sort_order)
      values(v_family_id,v_member.form_record_id,v_member.stage_index,v_member.stage_label,v_member.national_dex)
      on conflict(family_record_id,form_record_id) do update set stage_index=excluded.stage_index,stage_label=excluded.stage_label,sort_order=excluded.sort_order;
      insert into public.blueprint_nodes(board_record_id,record_id,node_family,position_x,position_y,width,height)
      values(v_board_id,v_member.form_record_id,'worker',60+(v_member.stage_index-1)*320,70+(v_member.branch_order-1)*190,250,136)
      on conflict(board_record_id,record_id) do nothing;
    end loop;

    -- Explicit arrows become durable evolution edges. A slash-only family,
    -- notably Hitmonlee / Hitmonchan, deliberately creates no edge.
    v_chain := string_to_array(v_family.imported_label,' → ');
    if coalesce(array_length(v_chain,1),0)>1 then
      v_previous_name := btrim(v_chain[1]);
      for v_index in 2..array_length(v_chain,1) loop
        v_branches := string_to_array(v_chain[v_index],' / ');
        foreach v_branch in array v_branches loop
          v_target_name := btrim(v_branch);
          select form.record_id into v_from_form_id
          from public.evolution_family_members as member
          join public.pokemon_forms as form on form.record_id=member.form_record_id
          join public.records as species_record on species_record.id=form.species_record_id
          where member.family_record_id=v_family_id and species_record.display_name=v_previous_name;
          select form.record_id into v_to_form_id
          from public.evolution_family_members as member
          join public.pokemon_forms as form on form.record_id=member.form_record_id
          join public.records as species_record on species_record.id=form.species_record_id
          where member.family_record_id=v_family_id and species_record.display_name=v_target_name;
          if v_from_form_id is null or v_to_form_id is null then
            raise exception 'Evolution member could not be resolved: % → %',v_previous_name,v_target_name;
          end if;
          perform private.ensure_evolution_edge(v_family_id,v_board_id,v_from_form_id,v_to_form_id);
        end loop;
        if array_length(v_branches,1)=1 then v_previous_name:=btrim(v_branches[1]); end if;
      end loop;
    end if;
  end loop;

  -- Bulbasaur → Ivysaur → Venusaur is the first complete, deliberately draft
  -- planning slice. Values are explicit; evolution never computes balance.
  select family.record_id,board.record_id into v_family_id,v_board_id
  from public.evolution_families as family
  join public.blueprint_boards as board on board.family_record_id=family.record_id
  where family.family_key='bulbasaur';
  if v_family_id is not null then
    v_capability_id:=private.ensure_blueprint_record('cobblemon_kinetics:capability/plant-care','capability-plant-care','Plant Care','capability',
      jsonb_build_object('category','care','description','Tend crops and plant-like blocks within an explicit bounded area.'));
    insert into public.capabilities(record_id,category,description) values(v_capability_id,'care','Tend crops and plant-like blocks within an explicit bounded area.') on conflict(record_id) do nothing;

    v_job_id:=private.ensure_blueprint_record('cobblemon_kinetics:job/plant-tender','job-plant-tender','Plant Tender','job',
      jsonb_build_object('category','farming','description','Provide bounded crop and plant care without replacing player progression.','work',jsonb_build_object('readiness','candidate')));
    select id into v_grass_type_id from public.pokemon_types where identifier='grass';
    insert into public.jobs(record_id,category,description,required_type_id,capability_ids,adapter_id,constraints)
    values(v_job_id,'farming','Provide bounded crop and plant care without replacing player progression.',v_grass_type_id,array['cobblemon_kinetics:capability/plant-care'],'cobblemon_kinetics:plant_tender',jsonb_build_object('requires_owner',true))
    on conflict(record_id) do nothing;

    v_work_target_id:=private.ensure_blueprint_record('cobblemon_kinetics:work-target/ordinary-farmland','work-target-ordinary-farmland','Ordinary Farmland','work_target',
      jsonb_build_object('target_kind','farmland','description','Vanilla-style crop plots; no Create machine is implied.'));
    insert into public.work_targets(record_id,target_kind,description) values(v_work_target_id,'farmland','Vanilla-style crop plots; no Create machine is implied.') on conflict(record_id) do nothing;

    v_condition_id:=private.ensure_blueprint_record('cobblemon_kinetics:condition/owner-permission','condition-owner-permission','Owner Permission','condition',
      jsonb_build_object('condition_kind','ownership','description','Only the owning player can authorize this work.'));
    insert into public.conditions(record_id,condition_kind,description) values(v_condition_id,'ownership','Only the owning player can authorize this work.') on conflict(record_id) do nothing;

    v_result_id:=private.ensure_blueprint_record('cobblemon_kinetics:result/tended-crops','result-tended-crops','Tended Crops','result',
      jsonb_build_object('result_kind','area_support','description','A bounded, rate-limited crop-tending outcome.'));
    insert into public.results(record_id,result_kind,description,bounds) values(v_result_id,'area_support','A bounded, rate-limited crop-tending outcome.',jsonb_build_object('no_free_drops',true)) on conflict(record_id) do nothing;

    insert into public.blueprint_nodes(board_record_id,record_id,node_family,position_x,position_y,width,height) values
      (v_board_id,v_capability_id,'capability',380,360,220,116),
      (v_board_id,v_job_id,'job',680,360,220,116),
      (v_board_id,v_work_target_id,'worksite',980,260,230,116),
      (v_board_id,v_condition_id,'interlock',980,430,230,116),
      (v_board_id,v_result_id,'result',1280,340,230,116)
    on conflict(board_record_id,record_id) do nothing;

    v_parent_capability_id:=null; v_parent_job_id:=null;
    for v_member in
      select member.form_record_id,member.stage_index,species.national_dex
      from public.evolution_family_members as member
      join public.pokemon_forms as form on form.record_id=member.form_record_id
      join public.pokemon_species as species on species.record_id=form.species_record_id
      where member.family_record_id=v_family_id order by member.stage_index,species.national_dex
    loop
      v_relation_id:=private.ensure_blueprint_relationship(v_member.form_record_id,v_capability_id,'has_capability',
        jsonb_build_object('tier',least(v_member.stage_index,3),'tier_label',case v_member.stage_index when 1 then 'Basic' when 2 then 'Capable' else 'Advanced' end,
          'radius',case v_member.stage_index when 1 then 2 when 2 then 4 else 6 end,
          'reliability',case v_member.stage_index when 1 then 'learning' when 2 then 'reliable' else 'area_support' end,
          'speed_modifier',case when v_member.stage_index=3 then 0.85 else 1 end),
        case when v_parent_capability_id is null then 'add' else 'raise' end,v_parent_capability_id);
      insert into public.form_capabilities(relationship_record_id,form_record_id,capability_record_id,tier,explicit_values)
      values(v_relation_id,v_member.form_record_id,v_capability_id,least(v_member.stage_index,3),
        jsonb_build_object('radius',case v_member.stage_index when 1 then 2 when 2 then 4 else 6 end,'speed_modifier',case when v_member.stage_index=3 then 0.85 else 1 end))
      on conflict(relationship_record_id) do update set tier=excluded.tier,explicit_values=excluded.explicit_values;
      v_handles:=private.blueprint_handles('has_capability');
      insert into public.blueprint_edges(board_record_id,relationship_record_id,source_handle,target_handle,label)
      values(v_board_id,v_relation_id,v_handles->>'source',v_handles->>'target','Plant Care · Tier '||least(v_member.stage_index,3)) on conflict do nothing;
      v_parent_capability_id:=v_relation_id;

      v_relation_id:=private.ensure_blueprint_relationship(v_member.form_record_id,v_job_id,'assigned_to_job',
        jsonb_build_object('status','candidate','explicit',true),case when v_parent_job_id is null then 'add' else 'keep' end,v_parent_job_id);
      v_handles:=private.blueprint_handles('assigned_to_job');
      insert into public.blueprint_edges(board_record_id,relationship_record_id,source_handle,target_handle,label)
      values(v_board_id,v_relation_id,v_handles->>'source',v_handles->>'target','Candidate job') on conflict do nothing;
      v_parent_job_id:=v_relation_id;
    end loop;

    select form.record_id into v_bulbasaur_form_id
    from public.evolution_family_members as member
    join public.pokemon_forms as form on form.record_id=member.form_record_id
    join public.pokemon_species as species on species.record_id=form.species_record_id
    where member.family_record_id=v_family_id and species.national_dex=1;

    select relationship.record_id into v_relation_id
    from public.studio_relationships as relationship
    where relationship.source_record_id=v_bulbasaur_form_id
      and relationship.target_record_id=v_capability_id
      and relationship.relationship_kind='has_capability';

    insert into public.type_capability_suggestions(
      type_workshop_record_id,capability_record_id,suggested_tier,rationale
    )
    select plan.record_id,v_capability_id,1,
      'Grass Workshop suggestion: review Plant Care explicitly for this form.'
    from public.type_workshop_plans as plan
    where plan.type_id=v_grass_type_id
    on conflict(type_workshop_record_id,capability_record_id) do update
      set suggested_tier=excluded.suggested_tier,rationale=excluded.rationale
    returning id into v_suggestion_id;

    if v_suggestion_id is not null and v_relation_id is not null then
      insert into public.type_capability_acceptances(
        suggestion_id,form_record_id,relationship_record_id
      ) values(v_suggestion_id,v_bulbasaur_form_id,v_relation_id)
      on conflict(suggestion_id,form_record_id) do update
        set relationship_record_id=excluded.relationship_record_id;
    end if;

    v_relation_id:=private.ensure_blueprint_relationship(v_job_id,v_capability_id,'requires_capability',jsonb_build_object('minimum_tier',1),null,null);
    insert into public.job_capability_requirements(relationship_record_id,job_record_id,capability_record_id,minimum_tier)
    values(v_relation_id,v_job_id,v_capability_id,1) on conflict(relationship_record_id) do nothing;
    v_handles:=private.blueprint_handles('requires_capability');
    insert into public.blueprint_edges values(v_board_id,v_relation_id,v_handles->>'source',v_handles->>'target','Requires Tier 1',0,now()) on conflict do nothing;

    v_relation_id:=private.ensure_blueprint_relationship(v_job_id,v_work_target_id,'operates_at','{}'::jsonb,null,null);
    v_handles:=private.blueprint_handles('operates_at');
    insert into public.blueprint_edges values(v_board_id,v_relation_id,v_handles->>'source',v_handles->>'target','Operates at',0,now()) on conflict do nothing;
    v_relation_id:=private.ensure_blueprint_relationship(v_job_id,v_condition_id,'constrained_by','{}'::jsonb,null,null);
    v_handles:=private.blueprint_handles('constrained_by');
    insert into public.blueprint_edges values(v_board_id,v_relation_id,v_handles->>'source',v_handles->>'target','Requires permission',0,now()) on conflict do nothing;
    v_relation_id:=private.ensure_blueprint_relationship(v_job_id,v_result_id,'produces_result',jsonb_build_object('bounded',true),null,null);
    v_handles:=private.blueprint_handles('produces_result');
    insert into public.blueprint_edges values(v_board_id,v_relation_id,v_handles->>'source',v_handles->>'target','Produces',0,now()) on conflict do nothing;
  end if;

  select count(*) into v_species_count from public.pokemon_species where generation_id=1;
  select count(*) into v_family_count from public.evolution_families where generation_id=1;
  select count(*) into v_edge_count from public.evolution_edges;
  if v_species_count=151 and v_family_count<>78 then raise exception 'Expected 78 Gen 1 families, found %',v_family_count; end if;
  if exists(
    select 1 from public.evolution_edges as edge
    join public.pokemon_forms as source_form on source_form.record_id=edge.from_form_record_id
    join public.pokemon_species as source_species on source_species.record_id=source_form.species_record_id
    join public.pokemon_forms as target_form on target_form.record_id=edge.to_form_record_id
    join public.pokemon_species as target_species on target_species.record_id=target_form.species_record_id
    where source_species.national_dex in (106,107) or target_species.national_dex in (106,107)
  ) then raise exception 'No Gen 1 Hitmon evolution edge may be invented'; end if;
  return jsonb_build_object('species',v_species_count,'families',v_family_count,'evolution_edges',v_edge_count,'bulbasaur_fixture',v_family_id is not null);
end;
$$;

create or replace function private.get_pokemon_workspace(p_public_id text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_actor uuid;
  v_species_id uuid;
  v_form_id uuid;
  v_family_id uuid;
  v_board_id uuid;
  v_record jsonb;
  v_family jsonb;
  v_controlled jsonb;
  v_capabilities jsonb;
  v_suggestions jsonb;
begin
  v_actor:=private.require_app_role('viewer'::public.app_role);
  select species.record_id,form.record_id into v_species_id,v_form_id
  from public.pokemon_species as species
  join public.records as record on record.id=species.record_id
  join public.pokemon_forms as form on form.species_record_id=species.record_id and form.is_default
  where record.public_id=p_public_id;
  if v_species_id is null then raise sqlstate 'PGRST' using message='{"code":"record_not_found","message":"Pokémon workspace not found."}',detail='{"status":404,"status_text":"Not Found"}'; end if;
  select member.family_record_id,board.record_id into v_family_id,v_board_id
  from public.evolution_family_members as member
  join public.blueprint_boards as board on board.family_record_id=member.family_record_id
  where member.form_record_id=v_form_id;
  v_record:=private.get_editor_record(p_public_id);
  select jsonb_build_object(
    'public_id',family_record.public_id,'display_name',family_record.display_name,'board_public_id',board_record.public_id,
    'stage',jsonb_build_object('index',own_member.stage_index,'label',own_member.stage_label),
    'members',coalesce(jsonb_agg(jsonb_build_object(
      'public_id',species_record.public_id,'form_public_id',form_record.public_id,'display_name',species_record.display_name,
      'national_dex',species.national_dex,'stage_index',member.stage_index,'stage_label',member.stage_label
    ) order by member.stage_index,member.sort_order),'[]'::jsonb)
  ) into v_family
  from public.evolution_families as family
  join public.records as family_record on family_record.id=family.record_id
  join public.blueprint_boards as board on board.family_record_id=family.record_id
  join public.records as board_record on board_record.id=board.record_id
  join public.evolution_family_members as own_member on own_member.family_record_id=family.record_id and own_member.form_record_id=v_form_id
  join public.evolution_family_members as member on member.family_record_id=family.record_id
  join public.pokemon_forms as form on form.record_id=member.form_record_id
  join public.records as form_record on form_record.id=form.record_id
  join public.pokemon_species as species on species.record_id=form.species_record_id
  join public.records as species_record on species_record.id=species.record_id
  where family.record_id=v_family_id
  group by family_record.public_id,family_record.display_name,board_record.public_id,own_member.stage_index,own_member.stage_label;
  select coalesce(jsonb_object_agg(vocabulary,items),'{}'::jsonb) into v_controlled from (
    select vocabulary,jsonb_agg(jsonb_build_object('slug',slug,'label',display_name,'review_required',false) order by sort_order,display_name) as items
    from public.controlled_fact_values where is_active group by vocabulary
  ) as vocabulary_values;
  select coalesce(jsonb_agg(jsonb_build_object(
    'relationship_public_id',relationship_record.public_id,'capability_public_id',capability_record.public_id,
    'name',capability_record.display_name,'tier',form_capability.tier,'tier_label',case form_capability.tier when 1 then 'Basic' when 2 then 'Capable' when 3 then 'Advanced' else 'Exceptional' end,
    'inheritance_decision',relationship.inheritance_decision,'inheritance_state',relationship.inheritance_state,'explicit_values',form_capability.explicit_values
  ) order by capability_record.display_name),'[]'::jsonb) into v_capabilities
  from public.form_capabilities as form_capability
  join public.studio_relationships as relationship on relationship.record_id=form_capability.relationship_record_id
  join public.records as relationship_record on relationship_record.id=relationship.record_id
  join public.records as capability_record on capability_record.id=form_capability.capability_record_id
  where form_capability.form_record_id=v_form_id and relationship_record.workflow_state<>'archived';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',suggestion.id,'capability_public_id',capability_record.public_id,'name',capability_record.display_name,
    'suggested_tier',suggestion.suggested_tier,'rationale',suggestion.rationale,
    'accepted',acceptance.relationship_record_id is not null
  )),'[]'::jsonb) into v_suggestions
  from public.pokemon_form_types as form_type
  join public.type_workshop_plans as plan on plan.type_id=form_type.type_id
  join public.type_capability_suggestions as suggestion on suggestion.type_workshop_record_id=plan.record_id
  join public.records as capability_record on capability_record.id=suggestion.capability_record_id
  left join public.type_capability_acceptances as acceptance
    on acceptance.suggestion_id=suggestion.id and acceptance.form_record_id=v_form_id
  where form_type.form_record_id=v_form_id and form_type.typing_context='current';
  return v_record || jsonb_build_object('family',v_family,'controlled_values',v_controlled,'capabilities',v_capabilities,'type_suggestions',v_suggestions,'preferred_view',
    coalesce((select preference.last_view from public.blueprint_user_preferences as preference where preference.board_record_id=v_board_id and preference.auth_user_id=v_actor),'overview'));
end;
$$;

create or replace function private.get_family_blueprint(p_family_public_id text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid; v_family_id uuid; v_board public.blueprint_boards%rowtype;
begin
  v_actor:=private.require_app_role('viewer'::public.app_role);
  select family.record_id into v_family_id from public.evolution_families as family join public.records as record on record.id=family.record_id where record.public_id=p_family_public_id;
  select * into v_board from public.blueprint_boards where family_record_id=v_family_id;
  if v_board.record_id is null then raise sqlstate 'PGRST' using message='{"code":"blueprint_not_found","message":"Family Blueprint not found."}',detail='{"status":404,"status_text":"Not Found"}'; end if;
  return jsonb_build_object(
    'board',jsonb_build_object('public_id',(select public_id from public.records where id=v_board.record_id),'family_public_id',p_family_public_id,'revision',v_board.board_revision,'checksum',v_board.layout_checksum),
    'nodes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',record.public_id,'record_kind',record.record_kind,'node_family',node.node_family,'display_name',record.display_name,'workflow_state',record.workflow_state,'record_revision',record.current_revision,
      'position',jsonb_build_object('x',node.position_x,'y',node.position_y),'width',node.width,'height',node.height,'group_key',node.group_key,'collapsed',node.collapsed,
      'national_dex',species.national_dex,'types',coalesce(types.identifiers,'[]'::jsonb),'data',record.content
    ) order by node.z_index,record.display_name)
    from public.blueprint_nodes as node join public.records as record on record.id=node.record_id
    left join public.pokemon_forms as form on form.record_id=record.id
    left join public.pokemon_species as species on species.record_id=form.species_record_id
    left join lateral(select jsonb_agg(type.identifier order by form_type.slot) as identifiers from public.pokemon_form_types as form_type join public.pokemon_types as type on type.id=form_type.type_id where form_type.form_record_id=form.record_id and form_type.typing_context='current') as types on true
    where node.board_record_id=v_board.record_id),'[]'::jsonb),
    'edges',coalesce((select jsonb_agg(jsonb_build_object(
      'id',relationship_record.public_id,'relationship_kind',relationship.relationship_kind,'source',source_record.public_id,'target',target_record.public_id,
      'source_handle',edge.source_handle,'target_handle',edge.target_handle,'label',edge.label,'metadata',relationship.metadata,
      'inheritance_decision',relationship.inheritance_decision,'inheritance_state',relationship.inheritance_state,
      'workflow_state',relationship_record.workflow_state,'record_revision',relationship_record.current_revision
    ) order by edge.sort_order,relationship_record.public_id)
    from public.blueprint_edges as edge join public.studio_relationships as relationship on relationship.record_id=edge.relationship_record_id
    join public.records as relationship_record on relationship_record.id=relationship.record_id
    join public.records as source_record on source_record.id=relationship.source_record_id
    join public.records as target_record on target_record.id=relationship.target_record_id
    where edge.board_record_id=v_board.record_id and relationship_record.workflow_state<>'archived'),'[]'::jsonb),
    'annotations',coalesce((select jsonb_agg(to_jsonb(annotation) order by annotation.created_at) from public.blueprint_annotations as annotation where annotation.board_record_id=v_board.record_id),'[]'::jsonb),
    'preference',coalesce((select jsonb_build_object('viewport',preference.viewport,'filters',preference.filters,'hidden_nodes',coalesce((select jsonb_agg(record.public_id) from unnest(preference.hidden_record_ids) as hidden(id) join public.records as record on record.id=hidden.id),'[]'::jsonb),'last_view',preference.last_view) from public.blueprint_user_preferences as preference where preference.board_record_id=v_board.record_id and preference.auth_user_id=v_actor),jsonb_build_object('viewport',jsonb_build_object('x',0,'y',0,'zoom',1),'filters','{}'::jsonb,'hidden_nodes','[]'::jsonb,'last_view','overview'))
  );
end;
$$;

create or replace function private.list_studio_relationships(
  p_kinds text[] default null,
  p_query text default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_items jsonb;
begin
  perform private.require_app_role('viewer'::public.app_role);
  if p_limit not between 1 and 2000 then raise exception 'limit must be between 1 and 2000'; end if;
  if p_kinds is not null and exists(
    select 1 from unnest(p_kinds) as kind(value)
    where kind.value not in ('has_capability','requires_capability','assigned_to_job','operates_at','constrained_by','produces_result','evolves_to')
  ) then raise exception 'Unknown relationship kind'; end if;

  select coalesce(jsonb_agg(item.payload order by item.public_id collate "C"),'[]'::jsonb)
  into v_items
  from (
    select relationship_record.public_id,
      jsonb_build_object(
        'public_id',relationship_record.public_id,
        'relationship_kind',relationship.relationship_kind,
        'workflow_state',relationship_record.workflow_state,
        'revision',relationship_record.current_revision,
        'source',jsonb_build_object(
          'public_id',source_record.public_id,
          'record_kind',source_record.record_kind,
          'display_name',source_record.display_name,
          'species_public_id',source_species_record.public_id
        ),
        'target',jsonb_build_object(
          'public_id',target_record.public_id,
          'record_kind',target_record.record_kind,
          'display_name',target_record.display_name,
          'species_public_id',target_species_record.public_id
        ),
        'metadata',relationship.metadata,
        'inheritance_decision',relationship.inheritance_decision,
        'inheritance_state',relationship.inheritance_state
      ) as payload
    from public.studio_relationships as relationship
    join public.records as relationship_record on relationship_record.id=relationship.record_id
    join public.records as source_record on source_record.id=relationship.source_record_id
    join public.records as target_record on target_record.id=relationship.target_record_id
    left join public.pokemon_forms as source_form on source_form.record_id=source_record.id
    left join public.pokemon_species as source_species on source_species.record_id=source_form.species_record_id
    left join public.records as source_species_record on source_species_record.id=source_species.record_id
    left join public.pokemon_forms as target_form on target_form.record_id=target_record.id
    left join public.pokemon_species as target_species on target_species.record_id=target_form.species_record_id
    left join public.records as target_species_record on target_species_record.id=target_species.record_id
    where relationship_record.workflow_state<>'archived'
      and (p_kinds is null or relationship.relationship_kind=any(p_kinds))
      and (
        nullif(btrim(p_query),'') is null
        or relationship_record.public_id ilike '%'||btrim(p_query)||'%'
        or source_record.public_id ilike '%'||btrim(p_query)||'%'
        or source_record.display_name ilike '%'||btrim(p_query)||'%'
        or target_record.public_id ilike '%'||btrim(p_query)||'%'
        or target_record.display_name ilike '%'||btrim(p_query)||'%'
      )
    order by relationship_record.public_id
    limit p_limit
  ) as item;
  return jsonb_build_object('items',v_items);
end;
$$;

create or replace function private.list_blueprint_library(p_query text default null,p_kinds text[] default null,p_filters jsonb default '{}'::jsonb,p_limit integer default 50,p_cursor text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_items jsonb; v_next text;
begin
  perform private.require_app_role('viewer'::public.app_role);
  if p_limit not between 1 and 100 then raise exception 'limit must be between 1 and 100'; end if;
  with candidates as (
    select record.*,private.blueprint_node_family(record.record_kind) as node_family
    from public.records as record
    where private.blueprint_node_family(record.record_kind) is not null and record.workflow_state<>'archived'
      and (p_kinds is null or record.record_kind=any(p_kinds))
      and (nullif(btrim(p_query),'') is null or record.display_name ilike '%'||btrim(p_query)||'%' or record.public_id ilike '%'||btrim(p_query)||'%')
      and (p_cursor is null or record.public_id>p_cursor)
    order by record.public_id limit p_limit+1
  ), page as (select * from candidates limit p_limit)
  select coalesce(jsonb_agg(jsonb_build_object('public_id',public_id,'display_name',display_name,'record_kind',record_kind,'node_family',node_family,'workflow_state',workflow_state,'revision',current_revision) order by public_id),'[]'::jsonb),max(public_id)
  into v_items,v_next from page;
  return jsonb_build_object('items',v_items,'next_cursor',case when jsonb_array_length(v_items)=p_limit then v_next else null end,'filters',coalesce(p_filters,'{}'::jsonb));
end;
$$;

create or replace function private.get_blueprint_head(p_board_public_id text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_board public.blueprint_boards%rowtype;
begin
  perform private.require_app_role('viewer'::public.app_role);
  select board.* into v_board from public.blueprint_boards as board join public.records as record on record.id=board.record_id where record.public_id=p_board_public_id;
  if v_board.record_id is null then raise sqlstate 'PGRST' using message='{"code":"blueprint_not_found"}',detail='{"status":404,"status_text":"Not Found"}'; end if;
  return jsonb_build_object('public_id',p_board_public_id,'revision',v_board.board_revision,'checksum',v_board.layout_checksum,'updated_at',v_board.updated_at);
end;
$$;

create or replace function private.revision_blueprint_record(
  p_record_id uuid,p_actor uuid,p_client_mutation_id uuid,p_content jsonb,p_summary text
)
returns bigint language plpgsql volatile set search_path = ''
as $$
declare v_record public.records%rowtype; v_revision bigint; v_checksum text;
begin
  select * into v_record from public.records where id=p_record_id for update;
  if v_record.id is null then raise exception 'Blueprint record not found'; end if;
  if v_record.content=p_content then return v_record.current_revision; end if;
  v_revision:=v_record.current_revision+1;
  v_checksum:=encode(extensions.digest(p_content::text,'sha256'),'hex');
  update public.records set content=p_content,checksum=v_checksum,current_revision=v_revision,
    workflow_state=case when workflow_state='approved' then 'draft' else workflow_state end,
    approved_revision=null,approved_by=null,approved_at=null,updated_by=p_actor
  where id=p_record_id;
  insert into public.record_revisions(record_id,revision_number,schema_version,snapshot,checksum,actor_id,client_mutation_id,change_summary)
  values(p_record_id,v_revision,v_record.schema_version,p_content,v_checksum,p_actor,p_client_mutation_id,p_summary);
  insert into public.audit_events(record_id,actor_id,action,before_revision,after_revision,request_id,metadata)
  values(p_record_id,p_actor,'blueprint.record_changed',v_record.current_revision,v_revision,p_client_mutation_id,jsonb_build_object('summary',p_summary));
  return v_revision;
end;
$$;

create or replace function private.apply_blueprint_change_set(
  p_board_id text,
  p_expected_board_revision bigint,
  p_expected_record_heads jsonb,
  p_operations jsonb,
  p_layout jsonb,
  p_client_mutation_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid;
  v_board public.blueprint_boards%rowtype;
  v_board_record public.records%rowtype;
  v_existing jsonb;
  v_stale jsonb:='[]'::jsonb;
  v_head record;
  v_operation jsonb;
  v_type text;
  v_record public.records%rowtype;
  v_source public.records%rowtype;
  v_target public.records%rowtype;
  v_relationship public.studio_relationships%rowtype;
  v_relationship_id uuid;
  v_parent_id uuid;
  v_metadata jsonb;
  v_decision text;
  v_handles jsonb;
  v_node record;
  v_annotation_id uuid;
  v_stub_kind text;
  v_stub_id uuid;
  v_stub_slug text;
  v_stub_public_id text;
  v_stub_content jsonb;
  v_layout_checksum text;
  v_board_content jsonb;
  v_result jsonb;
  v_revision bigint;
  v_source_port text;
  v_target_port text;
  v_suggestion public.type_capability_suggestions%rowtype;
  v_accept_form_id uuid;
begin
  v_actor:=private.require_app_role('editor'::public.app_role);
  if p_client_mutation_id is null or p_expected_board_revision is null or p_expected_board_revision<1 then raise exception 'A board revision and mutation ID are required'; end if;
  if jsonb_typeof(coalesce(p_expected_record_heads,'{}'::jsonb))<>'object'
     or jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_layout,'{}'::jsonb))<>'object'
     or jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>200
     or octet_length(coalesce(p_operations,'[]'::jsonb)::text)>1048576 then raise exception 'The Blueprint change set is invalid or too large'; end if;
  select board.* into v_board
  from public.blueprint_boards as board join public.records as record on record.id=board.record_id
  where record.public_id=p_board_id for update of board;
  if v_board.record_id is null then raise sqlstate 'PGRST' using message='{"code":"blueprint_not_found"}',detail='{"status":404,"status_text":"Not Found"}'; end if;
  select * into v_board_record from public.records where id=v_board.record_id for update;
  select mutation.result into v_existing from public.blueprint_mutations as mutation
  where mutation.board_record_id=v_board.record_id and mutation.actor_id=v_actor and mutation.client_mutation_id=p_client_mutation_id;
  if found then return v_existing; end if;
  if v_board.board_revision<>p_expected_board_revision then
    raise sqlstate 'PGRST' using message=json_build_object('code','blueprint_conflict','message','The shared board changed after it was loaded.','expected_board_revision',p_expected_board_revision,'current_board_revision',v_board.board_revision,'stale_entities',jsonb_build_array(p_board_id))::text,detail='{"status":409,"status_text":"Conflict"}';
  end if;
  for v_head in
    select record.public_id as key,record.current_revision as value
    from public.blueprint_nodes as node
    join public.records as record on record.id=node.record_id
    where node.board_record_id=v_board.record_id
    union all
    select record.public_id as key,record.current_revision as value
    from public.blueprint_edges as edge
    join public.records as record on record.id=edge.relationship_record_id
    where edge.board_record_id=v_board.record_id
  loop
    if not coalesce(p_expected_record_heads,'{}'::jsonb) ? v_head.key then
      v_stale:=v_stale||jsonb_build_array(jsonb_build_object(
        'public_id',v_head.key,
        'expected_revision',null,
        'current_revision',v_head.value,
        'reason','missing_expected_head'
      ));
    end if;
  end loop;
  for v_head in
    select layout_node.value->>'record_public_id' as key
    from jsonb_array_elements(coalesce(p_layout->'nodes','[]'::jsonb)) as layout_node(value)
  loop
    if v_head.key is null then raise exception 'Every layout node requires a record ID'; end if;
    if not coalesce(p_expected_record_heads,'{}'::jsonb) ? v_head.key
       and not exists(
         select 1
         from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) as operation(value)
         where operation.value->>'type'='create_stub'
           and operation.value->>'record_public_id'=v_head.key
       ) then
      select * into v_record from public.records where public_id=v_head.key;
      v_stale:=v_stale||jsonb_build_array(jsonb_build_object(
        'public_id',v_head.key,
        'expected_revision',null,
        'current_revision',v_record.current_revision,
        'reason','missing_expected_head'
      ));
    end if;
  end loop;
  for v_head in select key,value from jsonb_each_text(coalesce(p_expected_record_heads,'{}'::jsonb)) loop
    select * into v_record from public.records where public_id=v_head.key;
    if v_record.id is null or v_record.current_revision<>v_head.value::bigint then
      v_stale:=v_stale||jsonb_build_array(jsonb_build_object('public_id',v_head.key,'expected_revision',v_head.value::bigint,'current_revision',v_record.current_revision));
    end if;
  end loop;
  if jsonb_array_length(v_stale)>0 then
    raise sqlstate 'PGRST' using message=json_build_object('code','blueprint_conflict','message','One or more Blueprint entities changed.','stale_entities',v_stale)::text,detail='{"status":409,"status_text":"Conflict"}';
  end if;

  for v_operation in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    v_type:=v_operation->>'type';
    if v_type in ('add_node','remove_node','move_node') then
      select * into v_record from public.records where public_id=v_operation->>'record_public_id';
      if v_record.id is null or private.blueprint_node_family(v_record.record_kind) is null then raise exception 'The Blueprint node is missing or incompatible'; end if;
      if v_type='remove_node' then
        delete from public.blueprint_edges as edge
        using public.studio_relationships as relationship
        where edge.board_record_id=v_board.record_id
          and edge.relationship_record_id=relationship.record_id
          and (relationship.source_record_id=v_record.id or relationship.target_record_id=v_record.id);
        delete from public.blueprint_nodes where board_record_id=v_board.record_id and record_id=v_record.id;
      else
        insert into public.blueprint_nodes(board_record_id,record_id,node_family,position_x,position_y,group_key,collapsed)
        values(v_board.record_id,v_record.id,private.blueprint_node_family(v_record.record_kind),
          coalesce((v_operation#>>'{position,x}')::numeric,0),coalesce((v_operation#>>'{position,y}')::numeric,0),nullif(v_operation->>'group_key',''),coalesce((v_operation->>'collapsed')::boolean,false))
        on conflict(board_record_id,record_id) do update set
          position_x=case when v_type='move_node' then excluded.position_x else public.blueprint_nodes.position_x end,
          position_y=case when v_type='move_node' then excluded.position_y else public.blueprint_nodes.position_y end,
          group_key=coalesce(excluded.group_key,public.blueprint_nodes.group_key),collapsed=excluded.collapsed;
      end if;
    elsif v_type='create_stub' then
      v_stub_kind:=v_operation->>'record_kind';
      if v_stub_kind not in ('capability','job','work_target','condition','result') or length(btrim(v_operation->>'display_name')) not between 1 and 120 then raise exception 'Draft stubs require a supported kind and name'; end if;
      if length(btrim(coalesce(v_operation->>'description',''))) not between 1 and 1000 then raise exception 'Complete the draft description before applying the Blueprint'; end if;
      v_stub_public_id:=v_operation->>'record_public_id';
      if v_stub_public_id is null
         or v_stub_public_id !~ ('^cobblemon_kinetics:'||replace(v_stub_kind,'_','-')||'/draft-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
         or exists(select 1 from public.records where public_id=v_stub_public_id) then
        raise exception 'Draft stubs require a unique client-generated record ID';
      end if;
      v_stub_slug:=private.studio_slug(v_operation->>'display_name')||'-'||substring(replace(gen_random_uuid()::text,'-','') from 1 for 8);
      v_stub_content:=jsonb_build_object('draft_stub',true,'needs_completion',false,'description',btrim(v_operation->>'description'));
      if v_stub_kind='capability' then v_stub_content:=v_stub_content||jsonb_build_object('category','other','tier_min',1,'tier_max',4);
      elsif v_stub_kind='job' then v_stub_content:=v_stub_content||jsonb_build_object('planning',jsonb_build_object('description',btrim(v_operation->>'description')));
      elsif v_stub_kind='work_target' then v_stub_content:=v_stub_content||jsonb_build_object('target_kind','world_workflow');
      elsif v_stub_kind='condition' then v_stub_content:=v_stub_content||jsonb_build_object('condition_kind','other');
      elsif v_stub_kind='result' then v_stub_content:=v_stub_content||jsonb_build_object('result_kind','other','bounds','{}'::jsonb);
      end if;
      v_stub_id:=private.ensure_blueprint_record(v_stub_public_id,v_stub_slug,btrim(v_operation->>'display_name'),v_stub_kind,v_stub_content);
      if v_stub_kind='capability' then insert into public.capabilities(record_id,category,description) values(v_stub_id,'other',coalesce(v_operation->>'description',''));
      elsif v_stub_kind='job' then insert into public.jobs(record_id,category,description,adapter_id) values(v_stub_id,'other',coalesce(v_operation->>'description',''),'cobblemon_kinetics:draft_stub');
      elsif v_stub_kind='work_target' then insert into public.work_targets(record_id,target_kind,description) values(v_stub_id,'world_workflow',coalesce(v_operation->>'description',''));
      elsif v_stub_kind='condition' then insert into public.conditions(record_id,condition_kind,description) values(v_stub_id,'other',coalesce(v_operation->>'description',''));
      elsif v_stub_kind='result' then insert into public.results(record_id,result_kind,description) values(v_stub_id,'other',coalesce(v_operation->>'description',''));
      end if;
      insert into public.blueprint_nodes(board_record_id,record_id,node_family,position_x,position_y)
      values(v_board.record_id,v_stub_id,private.blueprint_node_family(v_stub_kind),coalesce((v_operation#>>'{position,x}')::numeric,0),coalesce((v_operation#>>'{position,y}')::numeric,0));
    elsif v_type in ('upsert_relationship','set_inheritance_decision') then
      if v_type='set_inheritance_decision' then
        select relationship.* into v_relationship from public.studio_relationships as relationship join public.records as record on record.id=relationship.record_id where record.public_id=v_operation->>'relationship_public_id';
        if v_relationship.record_id is null then raise exception 'Relationship not found'; end if;
        select * into v_source from public.records where id=v_relationship.source_record_id;
        select * into v_target from public.records where id=v_relationship.target_record_id;
        v_metadata:=v_relationship.metadata||coalesce(v_operation->'metadata','{}'::jsonb);
        v_decision:=v_operation->>'decision';
        v_parent_id:=v_relationship.parent_relationship_record_id;
      else
        select * into v_source from public.records where public_id=v_operation->>'source_public_id';
        select * into v_target from public.records where public_id=v_operation->>'target_public_id';
        if v_source.id is null or v_target.id is null then raise exception 'Relationship endpoints do not exist'; end if;
        v_metadata:=coalesce(v_operation->'metadata','{}'::jsonb);
        v_decision:=nullif(v_operation->>'inheritance_decision','');
        select relationship.record_id into v_parent_id from public.studio_relationships as relationship join public.records as record on record.id=relationship.record_id where record.public_id=nullif(v_operation->>'parent_relationship_public_id','');
        select relationship.record_id into v_relationship_id
        from public.studio_relationships as relationship
        join public.records as record on record.id=relationship.record_id
        where relationship.source_record_id=v_source.id
          and relationship.target_record_id=v_target.id
          and relationship.relationship_kind=v_operation->>'relationship_kind'
          and record.workflow_state<>'archived';
        if v_relationship_id is not null then
          raise exception 'The same typed relationship already exists';
        end if;
      end if;
      if v_decision is not null and v_decision not in ('keep','raise','lower','replace','remove','add') then raise exception 'Unknown inheritance decision'; end if;
      perform private.validate_blueprint_relationship(v_source,v_target,coalesce(v_operation->>'relationship_kind',v_relationship.relationship_kind),v_metadata);
      v_handles:=private.blueprint_handles(coalesce(v_operation->>'relationship_kind',v_relationship.relationship_kind));
      v_source_port:=coalesce(nullif(v_operation->>'source_handle',''),v_handles->>'source');
      v_target_port:=coalesce(nullif(v_operation->>'target_handle',''),v_handles->>'target');
      if v_source_port<>v_handles->>'source' or v_target_port<>v_handles->>'target' then raise exception 'The selected ports are incompatible with this relationship'; end if;
      if coalesce(v_operation->>'relationship_kind',v_relationship.relationship_kind)='evolves_to' then
        if not exists(select 1 from public.evolution_family_members as left_member join public.evolution_family_members as right_member on right_member.family_record_id=left_member.family_record_id where left_member.form_record_id=v_source.id and right_member.form_record_id=v_target.id) then raise exception 'Evolution endpoints must share a family'; end if;
        if exists(with recursive path(record_id) as (
          select v_target.id union select relationship.target_record_id from path join public.studio_relationships as relationship on relationship.source_record_id=path.record_id join public.records as relationship_record on relationship_record.id=relationship.record_id where relationship.relationship_kind='evolves_to' and relationship_record.workflow_state<>'archived'
        ) select 1 from path where record_id=v_source.id) then raise exception 'Evolution cycles are not allowed'; end if;
      end if;
      if v_type='set_inheritance_decision' then v_relationship_id:=v_relationship.record_id;
      else v_relationship_id:=private.ensure_blueprint_relationship(v_source.id,v_target.id,v_operation->>'relationship_kind',v_metadata,v_decision,v_parent_id); end if;
      select * into v_relationship from public.studio_relationships where record_id=v_relationship_id for update;
      update public.studio_relationships set metadata=v_metadata,inheritance_decision=v_decision,parent_relationship_record_id=v_parent_id,
        inheritance_state=case when v_parent_id is null then 'not_applicable' else 'current' end,
        parent_revision_at_review=(select current_revision from public.records where id=v_parent_id)
      where record_id=v_relationship_id returning * into v_relationship;
      perform private.revision_blueprint_record(v_relationship_id,v_actor,p_client_mutation_id,
        jsonb_build_object('source_public_id',v_source.public_id,'target_public_id',v_target.public_id,'relationship_kind',v_relationship.relationship_kind,'metadata',v_metadata,'inheritance_decision',v_decision),
        'Applied staged Blueprint relationship');
      insert into public.blueprint_edges(board_record_id,relationship_record_id,source_handle,target_handle,label)
      values(v_board.record_id,v_relationship_id,v_source_port,v_target_port,private.blueprint_relation_label(v_relationship.relationship_kind))
      on conflict(board_record_id,relationship_record_id) do update set source_handle=excluded.source_handle,target_handle=excluded.target_handle,label=excluded.label;
      if v_relationship.relationship_kind='has_capability' then
        insert into public.form_capabilities(relationship_record_id,form_record_id,capability_record_id,tier,explicit_values)
        values(v_relationship_id,v_source.id,v_target.id,(v_metadata->>'tier')::smallint,v_metadata-'tier'-'tier_label')
        on conflict(relationship_record_id) do update set tier=excluded.tier,explicit_values=excluded.explicit_values;
      elsif v_relationship.relationship_kind='requires_capability' then
        insert into public.job_capability_requirements(relationship_record_id,job_record_id,capability_record_id,minimum_tier)
        values(v_relationship_id,v_source.id,v_target.id,(v_metadata->>'minimum_tier')::smallint)
        on conflict(relationship_record_id) do update set minimum_tier=excluded.minimum_tier;
      end if;
    elsif v_type='remove_edge' then
      select relationship.record_id into v_relationship_id from public.studio_relationships as relationship join public.records as record on record.id=relationship.record_id where record.public_id=v_operation->>'relationship_public_id';
      delete from public.blueprint_edges where board_record_id=v_board.record_id and relationship_record_id=v_relationship_id;
    elsif v_type='archive_relationship' then
      if coalesce((v_operation->>'confirmed')::boolean,false) is not true then raise exception 'Archival must be explicitly confirmed'; end if;
      select relationship.record_id into v_relationship_id from public.studio_relationships as relationship join public.records as record on record.id=relationship.record_id where record.public_id=v_operation->>'relationship_public_id';
      update public.records set workflow_state='archived',archived_at=clock_timestamp(),updated_by=v_actor where id=v_relationship_id and workflow_state<>'archived';
      delete from public.blueprint_edges where board_record_id=v_board.record_id and relationship_record_id=v_relationship_id;
    elsif v_type='add_annotation' then
      insert into public.blueprint_annotations(board_record_id,annotation_kind,body,position_x,position_y,width,height,group_key,created_by,updated_by)
      values(v_board.record_id,coalesce(v_operation->>'annotation_kind','comment'),v_operation->>'body',coalesce((v_operation#>>'{position,x}')::numeric,0),coalesce((v_operation#>>'{position,y}')::numeric,0),coalesce((v_operation->>'width')::numeric,280),coalesce((v_operation->>'height')::numeric,140),nullif(v_operation->>'group_key',''),v_actor,v_actor);
    elsif v_type in ('update_annotation','remove_annotation') then
      v_annotation_id:=(v_operation->>'annotation_id')::uuid;
      if v_type='remove_annotation' then delete from public.blueprint_annotations where id=v_annotation_id and board_record_id=v_board.record_id;
      else update public.blueprint_annotations set body=coalesce(v_operation->>'body',body),position_x=coalesce((v_operation#>>'{position,x}')::numeric,position_x),position_y=coalesce((v_operation#>>'{position,y}')::numeric,position_y),updated_by=v_actor where id=v_annotation_id and board_record_id=v_board.record_id;
      end if;
    elsif v_type='accept_type_suggestion' then
      select * into v_suggestion
      from public.type_capability_suggestions
      where id=(v_operation->>'suggestion_id')::uuid;
      if v_suggestion.id is null then raise exception 'Type suggestion not found'; end if;

      select record.* into v_source
      from public.records as record
      where record.public_id=v_operation->>'form_public_id'
        and record.record_kind='pokemon_form';
      if v_source.id is null then raise exception 'Suggestion acceptance requires a Pokémon form'; end if;
      v_accept_form_id:=v_source.id;
      if not exists(
        select 1
        from public.evolution_family_members as member
        where member.family_record_id=v_board.family_record_id
          and member.form_record_id=v_accept_form_id
      ) then raise exception 'The accepted form is not a member of this Blueprint family'; end if;
      if not exists(
        select 1
        from public.type_workshop_plans as plan
        join public.pokemon_form_types as form_type on form_type.type_id=plan.type_id
        where plan.record_id=v_suggestion.type_workshop_record_id
          and form_type.form_record_id=v_accept_form_id
          and form_type.typing_context='current'
      ) then raise exception 'The Type Workshop suggestion does not apply to this form'; end if;

      select * into v_target from public.records where id=v_suggestion.capability_record_id;
      v_metadata:=jsonb_build_object(
        'tier',coalesce((v_operation->>'tier')::integer,v_suggestion.suggested_tier),
        'tier_label',case coalesce((v_operation->>'tier')::integer,v_suggestion.suggested_tier)
          when 1 then 'Basic' when 2 then 'Capable' when 3 then 'Advanced' else 'Exceptional' end,
        'accepted_type_suggestion',v_suggestion.id
      );
      perform private.validate_blueprint_relationship(v_source,v_target,'has_capability',v_metadata);
      v_relationship_id:=private.ensure_blueprint_relationship(
        v_source.id,v_target.id,'has_capability',v_metadata,'add',null
      );
      update public.studio_relationships
      set metadata=v_metadata,inheritance_decision='add',inheritance_state='not_applicable'
      where record_id=v_relationship_id;
      perform private.revision_blueprint_record(
        v_relationship_id,v_actor,p_client_mutation_id,
        jsonb_build_object(
          'source_public_id',v_source.public_id,'target_public_id',v_target.public_id,
          'relationship_kind','has_capability','metadata',v_metadata,
          'inheritance_decision','add'
        ),
        'Accepted a Type Workshop capability suggestion'
      );
      insert into public.form_capabilities(
        relationship_record_id,form_record_id,capability_record_id,tier,explicit_values
      ) values(
        v_relationship_id,v_accept_form_id,v_suggestion.capability_record_id,
        (v_metadata->>'tier')::smallint,'{}'::jsonb
      ) on conflict(relationship_record_id) do update set tier=excluded.tier;
      insert into public.blueprint_nodes(
        board_record_id,record_id,node_family,position_x,position_y
      ) values(
        v_board.record_id,v_suggestion.capability_record_id,'capability',
        coalesce((v_operation#>>'{position,x}')::numeric,400),
        coalesce((v_operation#>>'{position,y}')::numeric,360)
      ) on conflict(board_record_id,record_id) do nothing;
      v_handles:=private.blueprint_handles('has_capability');
      insert into public.blueprint_edges(
        board_record_id,relationship_record_id,source_handle,target_handle,label
      ) values(
        v_board.record_id,v_relationship_id,v_handles->>'source',v_handles->>'target',
        'Accepted Type suggestion · Tier '||(v_metadata->>'tier')
      ) on conflict(board_record_id,relationship_record_id) do update
        set label=excluded.label;
      insert into public.type_capability_acceptances(
        suggestion_id,form_record_id,relationship_record_id,accepted_by
      ) values(v_suggestion.id,v_accept_form_id,v_relationship_id,v_actor)
      on conflict(suggestion_id,form_record_id) do update
        set relationship_record_id=excluded.relationship_record_id,
            accepted_by=excluded.accepted_by,
            accepted_at=clock_timestamp();
    elsif v_type is null or v_type not in ('auto_layout') then
      raise exception 'Unsupported Blueprint operation: %',coalesce(v_type,'(missing)');
    end if;
  end loop;

  for v_node in select value from jsonb_array_elements(coalesce(p_layout->'nodes','[]'::jsonb)) loop
    select * into v_record from public.records where public_id=v_node.value->>'record_public_id';
    if v_record.id is null then raise exception 'Layout references an unknown record'; end if;
    update public.blueprint_nodes set position_x=(v_node.value#>>'{position,x}')::numeric,position_y=(v_node.value#>>'{position,y}')::numeric,
      group_key=nullif(v_node.value->>'group_key',''),collapsed=coalesce((v_node.value->>'collapsed')::boolean,collapsed)
    where board_record_id=v_board.record_id and record_id=v_record.id;
  end loop;

  select encode(extensions.digest(private.canonical_jsonb(jsonb_build_object(
    'nodes',coalesce((select jsonb_agg(jsonb_build_object('record_id',node.record_id,'x',node.position_x,'y',node.position_y,'group_key',node.group_key,'collapsed',node.collapsed) order by node.record_id) from public.blueprint_nodes as node where node.board_record_id=v_board.record_id),'[]'::jsonb),
    'edges',coalesce((select jsonb_agg(edge.relationship_record_id order by edge.relationship_record_id) from public.blueprint_edges as edge where edge.board_record_id=v_board.record_id),'[]'::jsonb),
    'annotations',coalesce((select jsonb_agg(jsonb_build_object('id',annotation.id,'body',annotation.body,'x',annotation.position_x,'y',annotation.position_y) order by annotation.id) from public.blueprint_annotations as annotation where annotation.board_record_id=v_board.record_id),'[]'::jsonb)
  )),'sha256'),'hex') into v_layout_checksum;
  v_revision:=v_board.board_revision+1;
  update public.blueprint_boards set board_revision=v_revision,layout_checksum=v_layout_checksum,updated_by=v_actor where record_id=v_board.record_id;
  v_board_content:=v_board_record.content||jsonb_build_object('board_revision',v_revision,'layout_checksum',v_layout_checksum);
  perform private.revision_blueprint_record(v_board.record_id,v_actor,p_client_mutation_id,v_board_content,'Applied staged Kinetic Blueprint change set');
  insert into public.audit_events(record_id,actor_id,action,before_revision,after_revision,request_id,metadata)
  values(v_board.record_id,v_actor,'blueprint.applied',p_expected_board_revision,v_revision,p_client_mutation_id,jsonb_build_object('operation_count',jsonb_array_length(p_operations)));
  v_result:=private.get_family_blueprint((select record.public_id from public.records as record where record.id=v_board.family_record_id));
  insert into public.blueprint_mutations(board_record_id,actor_id,client_mutation_id,result) values(v_board.record_id,v_actor,p_client_mutation_id,v_result);
  return v_result;
end;
$$;

create or replace function private.save_blueprint_user_view(p_board_id text,p_viewport jsonb,p_filters jsonb,p_hidden_nodes text[])
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare v_actor uuid; v_board_id uuid; v_hidden_ids uuid[]; v_last_view text;
begin
  v_actor:=private.require_app_role('viewer'::public.app_role);
  if jsonb_typeof(p_viewport)<>'object' or jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>65536 then raise exception 'Invalid personal Blueprint view'; end if;
  if coalesce((p_viewport->>'zoom')::numeric,1) not between 0.1 and 4 then raise exception 'Blueprint zoom must be between 0.1 and 4'; end if;
  select board.record_id into v_board_id from public.blueprint_boards as board join public.records as record on record.id=board.record_id where record.public_id=p_board_id;
  if v_board_id is null then raise exception 'Blueprint board not found'; end if;
  select coalesce(array_agg(record.id),'{}'::uuid[]) into v_hidden_ids from unnest(coalesce(p_hidden_nodes,'{}'::text[])) as hidden(public_id) join public.records as record on record.public_id=hidden.public_id;
  v_last_view:=coalesce(nullif(p_filters->>'last_view',''),'overview');
  if v_last_view not in ('overview','canvas','outline','facts','discussion') then raise exception 'Unknown Studio view'; end if;
  insert into public.blueprint_user_preferences(board_record_id,auth_user_id,viewport,filters,hidden_record_ids,last_view)
  values(v_board_id,v_actor,p_viewport,p_filters-'last_view',v_hidden_ids,v_last_view)
  on conflict(board_record_id,auth_user_id) do update set viewport=excluded.viewport,filters=excluded.filters,hidden_record_ids=excluded.hidden_record_ids,last_view=excluded.last_view,updated_at=clock_timestamp();
  return jsonb_build_object('board_public_id',p_board_id,'viewport',p_viewport,'filters',p_filters-'last_view','hidden_nodes',to_jsonb(coalesce(p_hidden_nodes,'{}'::text[])),'last_view',v_last_view);
end;
$$;

create or replace function private.canonicalize_pokemon_fact_values()
returns trigger language plpgsql volatile set search_path = ''
as $$
declare v_slug text;
begin
  if new.growth_rate is not null then v_slug:=private.studio_slug(new.growth_rate); if not exists(select 1 from public.controlled_fact_values where vocabulary='growth_rate' and slug=v_slug and is_active) then raise exception 'Unknown growth-rate value'; end if; new.growth_rate:=v_slug; end if;
  if new.habitat is not null then v_slug:=private.studio_slug(new.habitat); if not exists(select 1 from public.controlled_fact_values where vocabulary='habitat' and slug=v_slug and is_active) then raise exception 'Unknown habitat value'; end if; new.habitat:=v_slug; end if;
  if new.shape is not null then v_slug:=private.studio_slug(new.shape); if not exists(select 1 from public.controlled_fact_values where vocabulary='shape' and slug=v_slug and is_active) then raise exception 'Unknown shape value'; end if; new.shape:=v_slug; end if;
  if new.color is not null then v_slug:=private.studio_slug(new.color); if not exists(select 1 from public.controlled_fact_values where vocabulary='color' and slug=v_slug and is_active) then raise exception 'Unknown color value'; end if; new.color:=v_slug; end if;
  return new;
end;
$$;
create trigger pokemon_species_controlled_facts
before insert or update of growth_rate,habitat,shape,color on public.pokemon_species
for each row execute function private.canonicalize_pokemon_fact_values();

create or replace function private.sync_pokemon_workspace_facts()
returns trigger language plpgsql volatile set search_path = ''
as $$
declare v_form_id uuid; v_compatibility_id uuid; v_type_slug text; v_type_id uuid; v_genus text;
begin
  if new.record_kind<>'pokemon_species' then return new; end if;
  if new.content#>>'{facts,evolution_stage}' is distinct from old.content#>>'{facts,evolution_stage}' and exists(select 1 from public.pokemon_forms as form join public.evolution_family_members as member on member.form_record_id=form.record_id where form.species_record_id=new.id) then raise exception 'Evolution stage is derived from the family graph and cannot be edited as a fact'; end if;
  v_genus:=nullif(btrim(new.content#>>'{facts,genus}'),'');
  if v_genus is not null and not exists(select 1 from public.controlled_fact_values where vocabulary='genus' and slug=private.studio_slug(v_genus)) then
    insert into public.fact_value_reviews(record_id,field_path,proposed_value,requested_by) values(new.id,'facts.genus',v_genus,new.updated_by) on conflict(record_id,field_path,proposed_value) do nothing;
  end if;
  if new.content#>'{facts,primary_type}' is not null then
    select form.record_id into v_form_id from public.pokemon_forms as form where form.species_record_id=new.id and form.is_default;
    select id into v_compatibility_id from public.compatibility_sets where is_active order by created_at desc limit 1;
    delete from public.pokemon_form_types where form_record_id=v_form_id and compatibility_set_id=v_compatibility_id and typing_context='current';
    v_type_slug:=new.content#>>'{facts,primary_type}'; select id into v_type_id from public.pokemon_types where identifier=v_type_slug;
    if v_type_id is null then raise exception 'Unknown primary type'; end if;
    insert into public.pokemon_form_types(form_record_id,compatibility_set_id,typing_context,type_id,slot) values(v_form_id,v_compatibility_id,'current',v_type_id,1);
    v_type_slug:=nullif(new.content#>>'{facts,secondary_type}','');
    if v_type_slug is not null then select id into v_type_id from public.pokemon_types where identifier=v_type_slug; if v_type_id is null then raise exception 'Unknown secondary type'; end if; insert into public.pokemon_form_types(form_record_id,compatibility_set_id,typing_context,type_id,slot) values(v_form_id,v_compatibility_id,'current',v_type_id,2); end if;
  end if;
  return new;
end;
$$;
create trigger records_sync_pokemon_workspace_facts
after update of content on public.records
for each row execute function private.sync_pokemon_workspace_facts();

-- Replace the beta normalizer's section-wide provenance marking. The Studio
-- sends complete structured sections for deterministic autosave, so override
-- state must compare each imported field to its previous value.
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
  if p_actor is null then raise exception 'An editor actor is required'; end if;
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

    insert into public.pokemon_fact_values(
      species_record_id,growth_rate_slug,habitat_slug,shape_slug,color_slug
    )
    select species.record_id,species.growth_rate,species.habitat,species.shape,species.color
    from public.pokemon_species as species
    where species.record_id=(p_record).id
    on conflict(species_record_id) do update set
      growth_rate_slug=excluded.growth_rate_slug,
      habitat_slug=excluded.habitat_slug,
      shape_slug=excluded.shape_slug,
      color_slug=excluded.color_slug,
      updated_at=clock_timestamp();
  elsif (p_record).record_kind = 'type_workshop' then
    update public.type_workshop_plans set planning=v_planning where record_id=(p_record).id;
  elsif (p_record).record_kind = 'pokemon_idea' then
    update public.pokemon_design_ideas set planning=v_planning where record_id=(p_record).id;
  elsif (p_record).record_kind = 'machine_research' then
    update public.machine_research set planning=v_planning where record_id=(p_record).id;
  elsif (p_record).record_kind = 'work_item' then
    update public.work_items
    set status=private.studio_work_item_status((p_record).content #>> '{planning,status}'),
        priority=private.studio_priority((p_record).content #>> '{planning,priority}'),
        handoff_note=coalesce((p_record).content #>> '{planning,handoff_note}',handoff_note),
        labels=coalesce(
          array(select jsonb_array_elements_text((p_record).content #> '{planning,labels}')),
          labels
        )
    where record_id=(p_record).id;
  end if;
end;
$$;

create or replace function private.mark_precise_record_field_overrides()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  update public.record_field_provenance as provenance
  set overridden_at=clock_timestamp(),overridden_by=new.updated_by
  where provenance.record_id=new.id
    and (
      provenance.field_path like 'facts.%'
      or provenance.field_path like 'planning.%'
    )
    and old.content #> string_to_array(provenance.field_path,'.')
      is distinct from new.content #> string_to_array(provenance.field_path,'.');
  return new;
end;
$$;

drop trigger if exists records_mark_precise_field_overrides on public.records;
create trigger records_mark_precise_field_overrides
after update of content on public.records
for each row execute function private.mark_precise_record_field_overrides();

-- Approval uses the same generic record RPC as the rest of Studio. Extend the
-- validator to the graph-backed record kinds without permitting arbitrary
-- document shapes or identity fields.
create or replace function private.validate_editor_content(p_record public.records)
returns void language plpgsql stable set search_path=''
as $$
declare
  v_content jsonb := (p_record).content;
  v_private_note text;
  v_efficiency numeric;
  v_machine_id text;
  v_job_id text;
begin
  if (p_record).record_kind not in (
    'pokemon_species','pokemon_form','registry_entry','job','machine','work_profile','work_item',
    'type_workshop','pokemon_idea','machine_research','capability','work_target','condition','result','relationship'
  ) then raise sqlstate 'PGRST' using message='{"code":"record_not_editable","message":"This record kind does not have an editor contract."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if jsonb_typeof(v_content)<>'object' or octet_length(v_content::text)>1048576 then raise sqlstate 'PGRST' using message='{"code":"invalid_record_content","message":"Record content must be a bounded JSON object."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if exists(select 1 from jsonb_object_keys(v_content) as key(name) where key.name in ('id','public_id','slug','record_kind','checksum','revision')) then raise sqlstate 'PGRST' using message='{"code":"reserved_content_key","message":"Record identity fields are not editable content."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  foreach v_private_note in array array['private_note','internal_notes'] loop
    if v_content?v_private_note and (jsonb_typeof(v_content->v_private_note)<>'string' or length(v_content->>v_private_note)>10000) then raise sqlstate 'PGRST' using message='{"code":"invalid_private_note","message":"Private notes must be text no longer than 10,000 characters."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  end loop;
  if (p_record).record_kind='pokemon_species' and v_content?'facts' and jsonb_typeof(v_content->'facts')<>'object' then raise sqlstate 'PGRST' using message='{"code":"invalid_facts","message":"Pokémon facts must be a JSON object."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if (p_record).record_kind in ('pokemon_idea','type_workshop','machine_research') and v_content?'planning' and jsonb_typeof(v_content->'planning')<>'object' then raise sqlstate 'PGRST' using message='{"code":"invalid_planning","message":"Planning data must be a JSON object."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if v_content?'work' and jsonb_typeof(v_content->'work')<>'object' then raise sqlstate 'PGRST' using message='{"code":"invalid_work","message":"Work details must be a JSON object."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if v_content?'balance' and jsonb_typeof(v_content->'balance')<>'object' then raise sqlstate 'PGRST' using message='{"code":"invalid_balance","message":"Balance details must be a JSON object."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if jsonb_typeof(v_content#>'{balance,efficiency}') not in ('null','number') then raise sqlstate 'PGRST' using message='{"code":"invalid_efficiency","message":"Efficiency must be a number."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if jsonb_typeof(v_content#>'{balance,efficiency}')='number' then v_efficiency:=(v_content#>>'{balance,efficiency}')::numeric; if v_efficiency<0 or v_efficiency>4 then raise sqlstate 'PGRST' using message='{"code":"invalid_efficiency","message":"Efficiency must be between 0 and 4."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if; end if;
  if v_content#>'{balance,public_rationale}' is not null and (jsonb_typeof(v_content#>'{balance,public_rationale}')<>'string' or length(v_content#>>'{balance,public_rationale}')>2000) then raise sqlstate 'PGRST' using message='{"code":"invalid_public_rationale","message":"Public rationale must be text no longer than 2,000 characters."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  v_machine_id:=nullif(v_content#>>'{work,machine_id}',''); v_job_id:=nullif(v_content#>>'{work,job_id}','');
  if v_machine_id is not null and v_machine_id!~'^[a-z0-9_.-]+:[a-z0-9_./-]+$' then raise sqlstate 'PGRST' using message='{"code":"invalid_machine_id","message":"Machine IDs must use a namespaced identifier."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if v_job_id is not null and v_job_id!~'^[a-z0-9_.-]+:[a-z0-9_./-]+$' then raise sqlstate 'PGRST' using message='{"code":"invalid_job_id","message":"Job IDs must use a namespaced identifier."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;

  if (p_record).record_kind='pokemon_form' and (
    coalesce(v_content->>'species_public_id','')!~'^[a-z0-9_.-]+:[a-z0-9_./-]+$'
    or coalesce(v_content->>'form_key','')!~'^[a-z0-9][a-z0-9_.-]{0,79}$'
  ) then raise sqlstate 'PGRST' using message='{"code":"invalid_pokemon_form","message":"A form needs stable species and form identifiers."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if (p_record).record_kind='capability' and (
    coalesce(v_content->>'category','')!~'^[a-z][a-z0-9_]{0,63}$'
    or length(btrim(coalesce(v_content->>'description',''))) not between 1 and 1000
    or coalesce(nullif(v_content->>'tier_min','')::integer,1) not between 1 and 4
    or coalesce(nullif(v_content->>'tier_max','')::integer,4) not between 1 and 4
    or coalesce(nullif(v_content->>'tier_min','')::integer,1)>coalesce(nullif(v_content->>'tier_max','')::integer,4)
  ) then raise sqlstate 'PGRST' using message='{"code":"invalid_capability","message":"A capability needs a category, description, and valid tier range."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if (p_record).record_kind='work_target' and (v_content->>'target_kind' not in ('machine','farmland','water','storage','area','entity','world_workflow') or length(btrim(coalesce(v_content->>'description',''))) not between 1 and 1000) then raise sqlstate 'PGRST' using message='{"code":"invalid_work_target","message":"A worksite needs a supported target kind and description."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if (p_record).record_kind='condition' and (v_content->>'condition_kind' not in ('ownership','loading','weather','held_item','space','battle','other') or length(btrim(coalesce(v_content->>'description',''))) not between 1 and 1000) then raise sqlstate 'PGRST' using message='{"code":"invalid_condition","message":"An interlock needs a supported condition kind and description."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if (p_record).record_kind='result' and (v_content->>'result_kind' not in ('block_change','item','energy','status','area_support','world_effect','other') or length(btrim(coalesce(v_content->>'description',''))) not between 1 and 1000 or jsonb_typeof(coalesce(v_content->'bounds','{}'::jsonb))<>'object') then raise sqlstate 'PGRST' using message='{"code":"invalid_result","message":"A result needs a supported kind, description, and bounds object."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if (p_record).record_kind='relationship' and (
    coalesce(v_content->>'source_public_id','')!~'^[a-z0-9_.-]+:[a-z0-9_./-]+$'
    or coalesce(v_content->>'target_public_id','')!~'^[a-z0-9_.-]+:[a-z0-9_./-]+$'
    or v_content->>'relationship_kind' not in ('has_capability','requires_capability','assigned_to_job','operates_at','constrained_by','produces_result','evolves_to')
    or jsonb_typeof(coalesce(v_content->'metadata','{}'::jsonb))<>'object'
    or (v_content?'inheritance_decision' and v_content->'inheritance_decision'<>'null'::jsonb and v_content->>'inheritance_decision' not in ('keep','raise','lower','replace','remove','add'))
  ) then raise sqlstate 'PGRST' using message='{"code":"invalid_relationship","message":"The Blueprint relationship contract is invalid."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
end;
$$;

-- Blueprint publication remains revision-first.  Every projection below is
-- derived only from the frozen approved record snapshot and immutable record
-- identity, never from a mutable normalized table or board layout.
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
  v_resource_location text;
begin
  if jsonb_typeof(p_snapshot) <> 'object' then
    raise sqlstate 'PGRST' using
      message = '{"code":"invalid_revision_snapshot","message":"The approved revision has no object snapshot."}',
      detail = '{"status":422,"status_text":"Unprocessable Entity"}';
  end if;

  if (p_record).record_kind = 'pokemon_form' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'pokemon_form',
      'name', (p_record).display_name,
      'status', 'approved',
      'species_public_id', p_snapshot ->> 'species_public_id',
      'form_key', coalesce(nullif(p_snapshot ->> 'form_key', ''), 'default'),
      'aspects', coalesce(p_snapshot -> 'aspects', '[]'::jsonb)
    );
  elsif (p_record).record_kind = 'capability' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'capability',
      'name', (p_record).display_name,
      'status', 'approved',
      'category', coalesce(nullif(p_snapshot ->> 'category', ''), 'other'),
      'description', coalesce(nullif(p_snapshot ->> 'description', ''), (p_record).display_name),
      'tier_min', coalesce(nullif(p_snapshot ->> 'tier_min', '')::integer, 1),
      'tier_max', coalesce(nullif(p_snapshot ->> 'tier_max', '')::integer, 4)
    );
  elsif (p_record).record_kind = 'work_target' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'work_target',
      'name', (p_record).display_name,
      'status', 'approved',
      'target_kind', coalesce(nullif(p_snapshot ->> 'target_kind', ''), 'world_workflow'),
      'description', coalesce(nullif(p_snapshot ->> 'description', ''), (p_record).display_name)
    );
  elsif (p_record).record_kind = 'condition' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'condition',
      'name', (p_record).display_name,
      'status', 'approved',
      'condition_kind', coalesce(nullif(p_snapshot ->> 'condition_kind', ''), 'other'),
      'description', coalesce(nullif(p_snapshot ->> 'description', ''), (p_record).display_name)
    );
  elsif (p_record).record_kind = 'result' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'result',
      'name', (p_record).display_name,
      'status', 'approved',
      'result_kind', coalesce(nullif(p_snapshot ->> 'result_kind', ''), 'other'),
      'description', coalesce(nullif(p_snapshot ->> 'description', ''), (p_record).display_name),
      'bounds', coalesce(p_snapshot -> 'bounds', '{}'::jsonb)
    );
  elsif (p_record).record_kind = 'registry_entry' then
    v_resource_location := coalesce(nullif(p_snapshot ->> 'resource_location', ''), (p_record).public_id);
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'registry_entry',
      'name', (p_record).display_name,
      'status', 'approved',
      'registry_kind', coalesce(nullif(p_snapshot ->> 'registry_kind', ''), 'block'),
      'resource_location', v_resource_location,
      'source_mod', coalesce(nullif(p_snapshot ->> 'source_mod', ''), split_part(v_resource_location, ':', 1)),
      'lifecycle_state', coalesce(nullif(p_snapshot ->> 'lifecycle_state', ''), 'candidate')
    );
  elsif (p_record).record_kind = 'relationship' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'record_kind', 'relationship',
      'name', (p_record).display_name,
      'status', 'approved',
      'source_public_id', p_snapshot ->> 'source_public_id',
      'target_public_id', p_snapshot ->> 'target_public_id',
      'relationship_kind', p_snapshot ->> 'relationship_kind',
      'metadata', coalesce(p_snapshot -> 'metadata', '{}'::jsonb),
      'inheritance_decision', coalesce(p_snapshot -> 'inheritance_decision', 'null'::jsonb),
      'parent_relationship_public_id', coalesce(p_snapshot -> 'parent_relationship_public_id', 'null'::jsonb)
    );
  elsif jsonb_typeof(p_snapshot -> 'publication') = 'object' then
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
      'summary', coalesce(nullif(p_snapshot ->> 'public_summary', ''), nullif(p_snapshot #>> '{planning,description}', ''), (p_record).display_name),
      'status', (p_record).workflow_state
    );
  elsif (p_record).record_kind = 'machine' then
    v_projection := jsonb_build_object(
      'format_version', 1,
      'public_id', (p_record).public_id,
      'slug', (p_record).slug,
      'name', (p_record).display_name,
      'summary', coalesce(nullif(p_snapshot ->> 'public_summary', ''), nullif(p_snapshot #>> '{planning,description}', ''), (p_record).display_name),
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
  v_blueprints jsonb;
  v_assets jsonb;
begin
  select * into v_batch from public.publication_batches where id=p_batch_id;
  if not found then raise sqlstate 'PGRST' using message='{"code":"publication_not_found","message":"No publication batch exists for the requested ID."}',detail='{"status":404,"status_text":"Not Found"}'; end if;
  if not exists(select 1 from public.publication_batch_records where batch_id=v_batch.id) then raise sqlstate 'PGRST' using message='{"code":"publication_empty","message":"A publication batch must contain at least one approved record revision."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if exists(
    select 1 from public.publication_batch_records as batch_record
    join public.records as record on record.id=batch_record.record_id
    where batch_record.batch_id=v_batch.id and record.record_kind not in (
      'pokemon_species','pokemon_form','registry_entry','job','machine','work_profile','asset',
      'capability','work_target','condition','result','relationship'
    )
  ) then raise sqlstate 'PGRST' using message='{"code":"unsupported_publication_record","message":"The batch contains a record kind that has no canonical public projection."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;
  if exists(select 1 from public.publication_batch_records where batch_id=v_batch.id and private.contains_forbidden_public_key(public_projection)) then raise sqlstate 'PGRST' using message='{"code":"private_publication_field","message":"A public projection contains a private or identity-bearing field."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;

  select
    coalesce(jsonb_agg(batch_record.public_projection order by record.public_id) filter(where record.record_kind='pokemon_species'),'[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by record.public_id) filter(where record.record_kind='job'),'[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by record.public_id) filter(where record.record_kind='machine'),'[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by record.public_id) filter(where record.record_kind='work_profile'),'[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by record.public_id) filter(where record.record_kind in ('pokemon_form','registry_entry','capability','work_target','condition','result','relationship')),'[]'::jsonb),
    coalesce(jsonb_agg(batch_record.public_projection order by record.public_id) filter(where record.record_kind='asset'),'[]'::jsonb)
  into v_pokemon,v_jobs,v_machines,v_work_profiles,v_blueprints,v_assets
  from public.publication_batch_records as batch_record
  join public.records as record on record.id=batch_record.record_id
  where batch_record.batch_id=v_batch.id;

  return jsonb_build_object(
    'bundle_version',1,
    'schema_version',v_batch.schema_version,
    'batch_id','cobblemon_kinetics:publication/'||regexp_replace(v_batch.public_id,'^publication-',''),
    'records',jsonb_build_object(
      'pokemon',v_pokemon,'jobs',v_jobs,'machines',v_machines,
      'work_profiles',v_work_profiles
    ) || case
      when v_batch.schema_version<>'1.0.0' or jsonb_array_length(v_blueprints)>0
        then jsonb_build_object('blueprints',v_blueprints)
      else '{}'::jsonb
    end,
    'asset_manifest',jsonb_build_object('manifest_version',1,'assets',v_assets)
  );
end;
$$;

create or replace function private.expected_publication_manifest_files(p_payload jsonb)
returns jsonb language sql stable strict set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('path',expected.path,'kind',expected.kind,'record_count',expected.record_count) order by expected.path collate "C"),'[]'::jsonb)
  from (
    select 'assets/manifest.json'::text as path,'asset_manifest'::text as kind,jsonb_array_length(p_payload#>'{asset_manifest,assets}') as record_count
    union all select 'blueprints/records.json','blueprint_collection',jsonb_array_length(p_payload#>'{records,blueprints}')
    where (p_payload#>'{records}') ? 'blueprints'
    union all select 'pokemon/gen1.json','pokemon_collection',jsonb_array_length(p_payload#>'{records,pokemon}')
    union all select 'jobs/'||(entry.value->>'slug')||'.json','job',1 from jsonb_array_elements(p_payload#>'{records,jobs}') as entry(value)
    union all select 'machines/'||(entry.value->>'slug')||'.json','machine',1 from jsonb_array_elements(p_payload#>'{records,machines}') as entry(value)
    union all select 'work_profiles/'||regexp_replace(entry.value->>'id','^.*[:/]','')||'.json','work_profile',1 from jsonb_array_elements(p_payload#>'{records,work_profiles}') as entry(value)
  ) as expected;
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
  v_actor:=private.require_app_role('maintainer'::public.app_role);
  if p_public_ids is null or cardinality(p_public_ids)<1 or cardinality(p_public_ids)>200 then raise sqlstate '22023' using message='select one to 200 approved records for a publication batch'; end if;
  if cardinality(array(select distinct value from unnest(p_public_ids) as value))<>cardinality(p_public_ids) then raise sqlstate '22023' using message='publication records must be distinct'; end if;
  if (select count(*) from public.records where public_id=any(p_public_ids))<>cardinality(p_public_ids) then raise sqlstate 'PGRST' using message='{"code":"publication_record_not_found","message":"One or more selected records do not exist."}',detail='{"status":404,"status_text":"Not Found"}'; end if;

  with recursive closure(id) as (
    select record.id from public.records as record where record.public_id=any(p_public_ids)
    union
    select dependency.id
    from closure as current
    join public.records as current_record on current_record.id=current.id
    cross join lateral (
      select form.record_id as id
      from public.pokemon_forms as form
      join public.records as form_record on form_record.id=form.record_id
      where current_record.record_kind='pokemon_species' and form.species_record_id=current.id and form.is_default
        and form_record.workflow_state='approved' and form_record.approved_revision=form_record.current_revision
      union
      select form.species_record_id
      from public.pokemon_forms as form
      where current_record.record_kind='pokemon_form' and form.record_id=current.id
      union
      select assignment.work_profile_record_id
      from public.pokemon_forms as form
      join public.pokemon_work_assignments as assignment on assignment.form_record_id=form.record_id
      where current_record.record_kind='pokemon_species' and form.species_record_id=current.id and form.is_default and assignment.status in ('candidate','active')
      union
      select profile.job_record_id from public.work_profiles as profile where current_record.record_kind='work_profile' and profile.record_id=current.id
      union
      select profile.machine_record_id from public.work_profiles as profile where current_record.record_kind='work_profile' and profile.record_id=current.id and profile.machine_record_id is not null
      union
      select relationship.record_id
      from public.studio_relationships as relationship
      join public.records as relationship_record on relationship_record.id=relationship.record_id
      where relationship.source_record_id=current.id
        and relationship_record.workflow_state='approved'
        and relationship_record.approved_revision=relationship_record.current_revision
      union
      select relationship.source_record_id from public.studio_relationships as relationship where current_record.record_kind='relationship' and relationship.record_id=current.id
      union
      select relationship.target_record_id from public.studio_relationships as relationship where current_record.record_kind='relationship' and relationship.record_id=current.id
      union
      select relationship.parent_relationship_record_id from public.studio_relationships as relationship where current_record.record_kind='relationship' and relationship.record_id=current.id and relationship.parent_relationship_record_id is not null
    ) as dependency
  )
  select array_agg(id order by id) into v_record_ids from closure;

  if exists(select 1 from public.records where id=any(v_record_ids) and (workflow_state<>'approved' or approved_revision is null or approved_revision<>current_revision)) then raise sqlstate 'PGRST' using message='{"code":"publication_requires_approved_head","message":"Every selected record and dependency must have its exact current revision approved."}',detail='{"status":409,"status_text":"Conflict"}'; end if;
  if exists(select 1 from public.records where id=any(v_record_ids) and record_kind not in ('pokemon_species','pokemon_form','registry_entry','job','machine','work_profile','asset','capability','work_target','condition','result','relationship')) then raise sqlstate 'PGRST' using message='{"code":"unsupported_publication_record","message":"Planning-only record kinds cannot enter a public publication batch."}',detail='{"status":422,"status_text":"Unprocessable Entity"}'; end if;

  v_publication_id:='publication-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||substring(gen_random_uuid()::text from 1 for 12);
  insert into public.publication_batches(public_id,state,schema_version,notes,created_by)
  values(v_publication_id,'draft','1.1.0','Generic Studio publication batch',v_actor)
  returning * into v_batch;
  for v_record in select * from public.records where id=any(v_record_ids) order by public_id loop
    select * into v_revision from public.record_revisions where record_id=v_record.id and revision_number=v_record.approved_revision;
    if not found or v_revision.snapshot<>v_record.content or v_revision.checksum<>v_record.checksum then raise sqlstate 'PGRST' using message='{"code":"publication_revision_integrity","message":"An approved revision no longer matches the record head."}',detail='{"status":409,"status_text":"Conflict"}'; end if;
    insert into public.publication_batch_records(batch_id,record_id,revision_number,public_projection,checksum)
    values(v_batch.id,v_record.id,v_revision.revision_number,private.generic_public_projection(v_record,v_revision.snapshot),v_revision.checksum);
  end loop;
  v_payload:=private.build_publication_payload(v_batch.id);
  v_hash:=private.publication_payload_hash(v_payload);
  update public.publication_batches set state='validated',content_hash=v_hash,validated_by=v_actor,validated_at=clock_timestamp() where id=v_batch.id returning * into v_batch;
  insert into public.audit_events(record_id,actor_id,action,metadata)
  select record_id,v_actor,'publication.frozen',jsonb_build_object('publication_id',v_batch.public_id) from public.publication_batch_records where batch_id=v_batch.id;
  return private.get_publication_bundle(v_batch.public_id);
end;
$$;

create or replace function public.get_pokemon_workspace(p_public_id text)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_pokemon_workspace(p_public_id); $$;
create or replace function public.get_family_blueprint(p_family_public_id text)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_family_blueprint(p_family_public_id); $$;
create or replace function public.list_blueprint_library(p_query text default null,p_kinds text[] default null,p_filters jsonb default '{}'::jsonb,p_limit integer default 50,p_cursor text default null)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_blueprint_library(p_query,p_kinds,p_filters,p_limit,p_cursor); $$;
create or replace function public.get_blueprint_head(p_board_public_id text)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_blueprint_head(p_board_public_id); $$;
create or replace function public.list_studio_relationships(p_kinds text[] default null,p_query text default null,p_limit integer default 1000)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_studio_relationships(p_kinds,p_query,p_limit); $$;
create or replace function public.apply_blueprint_change_set(p_board_id text,p_expected_board_revision bigint,p_expected_record_heads jsonb,p_operations jsonb,p_layout jsonb,p_client_mutation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.apply_blueprint_change_set(p_board_id,p_expected_board_revision,p_expected_record_heads,p_operations,p_layout,p_client_mutation_id); $$;
create or replace function public.save_blueprint_user_view(p_board_id text,p_viewport jsonb,p_filters jsonb,p_hidden_nodes text[])
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.save_blueprint_user_view(p_board_id,p_viewport,p_filters,p_hidden_nodes); $$;
create or replace function public.reconcile_gen1_evolution_blueprints()
returns jsonb language plpgsql volatile security invoker set search_path=''
as $$ begin if current_user<>'service_role' then raise sqlstate 'PGRST' using message='{"code":"service_role_required"}',detail='{"status":403,"status_text":"Forbidden"}'; end if; return private.reconcile_gen1_evolution_blueprints(); end; $$;

do $block$
declare v_table text;
begin
  foreach v_table in array array[
    'controlled_fact_values','fact_value_reviews','pokemon_fact_values','evolution_families','evolution_family_members',
    'capabilities','work_targets','conditions','results','studio_relationships','evolution_edges','form_capabilities',
    'job_capability_requirements','type_capability_suggestions','type_capability_acceptances',
    'blueprint_boards','blueprint_nodes','blueprint_edges',
    'blueprint_annotations','blueprint_user_preferences','blueprint_mutations'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('alter table public.%I force row level security',v_table);
    execute format('revoke all on table public.%I from authenticated',v_table);
    if v_table='blueprint_user_preferences' then
      execute format('create policy %I on public.%I for select to authenticated using (auth_user_id=(select auth.uid()) and (select private.has_app_role(''viewer''::public.app_role)))',v_table||'_owner_read',v_table);
    elsif v_table='blueprint_mutations' then
      execute format('create policy %I on public.%I for select to authenticated using (actor_id=(select auth.uid()) and (select private.has_app_role(''editor''::public.app_role)))',v_table||'_owner_read',v_table);
    else
      execute format('create policy %I on public.%I for select to authenticated using ((select private.has_app_role(''viewer''::public.app_role)))',v_table||'_member_read',v_table);
    end if;
  end loop;
end;
$block$;

revoke all on all tables in schema public from public,anon;
revoke all on function private.blueprint_node_family(text),private.blueprint_relation_label(text),private.blueprint_handles(text) from public,anon,authenticated,service_role;
revoke all on function private.ensure_blueprint_record(text,text,text,text,jsonb),private.ensure_blueprint_relationship(uuid,uuid,text,jsonb,text,uuid),private.ensure_evolution_edge(uuid,uuid,uuid,uuid),private.reconcile_gen1_evolution_blueprints() from public,anon,authenticated,service_role;
revoke all on function private.validate_blueprint_relationship(public.records,public.records,text,jsonb),private.revision_blueprint_record(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function private.mark_precise_record_field_overrides() from public,anon,authenticated,service_role;
revoke all on function private.get_pokemon_workspace(text),private.get_family_blueprint(text),private.list_blueprint_library(text,text[],jsonb,integer,text),private.get_blueprint_head(text),private.list_studio_relationships(text[],text,integer),private.apply_blueprint_change_set(text,bigint,jsonb,jsonb,jsonb,uuid),private.save_blueprint_user_view(text,jsonb,jsonb,text[]) from public,anon,authenticated,service_role;
revoke all on function public.get_pokemon_workspace(text),public.get_family_blueprint(text),public.list_blueprint_library(text,text[],jsonb,integer,text),public.get_blueprint_head(text),public.list_studio_relationships(text[],text,integer),public.apply_blueprint_change_set(text,bigint,jsonb,jsonb,jsonb,uuid),public.save_blueprint_user_view(text,jsonb,jsonb,text[]),public.reconcile_gen1_evolution_blueprints() from public,anon,authenticated;

grant all privileges on public.controlled_fact_values,public.fact_value_reviews,public.pokemon_fact_values,public.evolution_families,public.evolution_family_members,public.capabilities,public.work_targets,public.conditions,public.results,public.studio_relationships,public.evolution_edges,public.form_capabilities,public.job_capability_requirements,public.type_capability_suggestions,public.type_capability_acceptances,public.blueprint_boards,public.blueprint_nodes,public.blueprint_edges,public.blueprint_annotations,public.blueprint_user_preferences,public.blueprint_mutations to service_role;
grant select on public.controlled_fact_values,public.fact_value_reviews,public.pokemon_fact_values,public.evolution_families,public.evolution_family_members,public.capabilities,public.work_targets,public.conditions,public.results,public.studio_relationships,public.evolution_edges,public.form_capabilities,public.job_capability_requirements,public.type_capability_suggestions,public.type_capability_acceptances,public.blueprint_boards,public.blueprint_nodes,public.blueprint_edges,public.blueprint_annotations,public.blueprint_user_preferences,public.blueprint_mutations to authenticated;
grant execute on function private.get_pokemon_workspace(text),private.get_family_blueprint(text),private.list_blueprint_library(text,text[],jsonb,integer,text),private.get_blueprint_head(text),private.list_studio_relationships(text[],text,integer),private.apply_blueprint_change_set(text,bigint,jsonb,jsonb,jsonb,uuid),private.save_blueprint_user_view(text,jsonb,jsonb,text[]) to authenticated,service_role;
grant execute on function private.reconcile_gen1_evolution_blueprints(),public.reconcile_gen1_evolution_blueprints() to service_role;
grant execute on function public.get_pokemon_workspace(text),public.get_family_blueprint(text),public.list_blueprint_library(text,text[],jsonb,integer,text),public.get_blueprint_head(text),public.list_studio_relationships(text[],text,integer),public.apply_blueprint_change_set(text,bigint,jsonb,jsonb,jsonb,uuid),public.save_blueprint_user_view(text,jsonb,jsonb,text[]) to authenticated,service_role;

commit;
