begin;

-- Both buckets begin private. A future, reviewed migration may mark the
-- public bucket public only after the site moves out of private prototype
-- mode and every resident object has passed the rights gate below.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values
  (
    'asset-candidates',
    'asset-candidates',
    false,
    10485760,
    array['image/png', 'image/webp', 'image/avif']::text[]
  ),
  (
    'published-assets',
    'published-assets',
    false,
    10485760,
    array['image/png', 'image/webp', 'image/avif']::text[]
  )
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy cobblemon_kinetics_asset_candidates_member_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'asset-candidates'
  and (select private.has_app_role('viewer'::public.app_role))
);

create policy cobblemon_kinetics_asset_candidates_editor_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'asset-candidates'
  and (select private.has_app_role('editor'::public.app_role))
);

create policy cobblemon_kinetics_asset_candidates_editor_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'asset-candidates'
  and (select private.has_app_role('editor'::public.app_role))
)
with check (
  bucket_id = 'asset-candidates'
  and (select private.has_app_role('editor'::public.app_role))
);

create policy cobblemon_kinetics_asset_candidates_editor_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'asset-candidates'
  and (select private.has_app_role('editor'::public.app_role))
);

-- Objects staged for future public delivery must already be registered and
-- rights-approved. No anonymous policy exists while the site is private.
create policy cobblemon_kinetics_published_assets_member_read_approved
on storage.objects
for select
to authenticated
using (
  bucket_id = 'published-assets'
  and (select private.has_app_role('viewer'::public.app_role))
  and exists (
    select 1
    from public.asset_variants as variant
    join public.assets as asset on asset.record_id = variant.asset_record_id
    where variant.bucket_id = storage.objects.bucket_id
      and variant.object_path = storage.objects.name
      and asset.rights_status = 'approved'
      and asset.permitted_visibility = 'public'
      and asset.publication_state = 'published'
  )
);

create policy cobblemon_kinetics_published_assets_maintainer_insert_approved
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'published-assets'
  and (select private.has_app_role('maintainer'::public.app_role))
  and exists (
    select 1
    from public.asset_variants as variant
    join public.assets as asset on asset.record_id = variant.asset_record_id
    where variant.bucket_id = storage.objects.bucket_id
      and variant.object_path = storage.objects.name
      and asset.rights_status = 'approved'
      and asset.permitted_visibility = 'public'
      and asset.publication_state = 'published'
  )
);

create policy cobblemon_kinetics_published_assets_maintainer_update_approved
on storage.objects
for update
to authenticated
using (
  bucket_id = 'published-assets'
  and (select private.has_app_role('maintainer'::public.app_role))
)
with check (
  bucket_id = 'published-assets'
  and (select private.has_app_role('maintainer'::public.app_role))
  and exists (
    select 1
    from public.asset_variants as variant
    join public.assets as asset on asset.record_id = variant.asset_record_id
    where variant.bucket_id = storage.objects.bucket_id
      and variant.object_path = storage.objects.name
      and asset.rights_status = 'approved'
      and asset.permitted_visibility = 'public'
      and asset.publication_state = 'published'
  )
);

create policy cobblemon_kinetics_published_assets_maintainer_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'published-assets'
  and (select private.has_app_role('maintainer'::public.app_role))
);

commit;
