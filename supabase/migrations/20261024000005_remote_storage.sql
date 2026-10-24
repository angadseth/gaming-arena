-- Game key art. Public read by URL; only admins upload, replace or
-- delete. No SVG (it can carry script), 500 KB cap. There is no broad
-- SELECT policy, so the bucket cannot be listed by players.
-- ("_remote_" in the file name: the local PGlite tests skip it, since
-- they have no storage schema.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-art', 'game-art', true, 512000, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = 512000,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/avif'];

create policy game_art_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'game-art' and (select public.is_admin()));
create policy game_art_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'game-art' and (select public.is_admin()));
create policy game_art_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'game-art' and (select public.is_admin()))
  with check (bucket_id = 'game-art' and (select public.is_admin()));
create policy game_art_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'game-art' and (select public.is_admin()));
