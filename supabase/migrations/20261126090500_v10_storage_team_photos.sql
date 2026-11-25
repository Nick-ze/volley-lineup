-- v10.0 — team and player photos (see docs/SUPABASE.md).
--
-- Private bucket `team-photos`, object name '<teamId>/<photoId>'. Photos are immutable: a new
-- picture gets a new photoId, so there is no UPDATE policy. Members read; managers upload and
-- delete. Profile photos never leave the device.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-photos', 'team-photos', false, 262144,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Members of the team named by the first folder read its photos.
create policy team_photos_select_members on storage.objects
  for select to authenticated
  using (bucket_id = 'team-photos'
         and (storage.foldername(name))[1] in (select private.my_team_ids()));

-- Managers upload directly into their team's folder (exactly one folder level).
create policy team_photos_insert_managers on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-photos'
              and array_length(storage.foldername(name), 1) = 1
              and (storage.foldername(name))[1] in (select private.my_managed_team_ids()));

-- Managers delete their team's photos (photo clean-up, "Delete for everyone", account deletion).
create policy team_photos_delete_managers on storage.objects
  for delete to authenticated
  using (bucket_id = 'team-photos'
         and (storage.foldername(name))[1] in (select private.my_managed_team_ids()));
