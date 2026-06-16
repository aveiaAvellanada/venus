insert into storage.buckets (id, name, public) values ('productos', 'productos', true) on conflict do nothing;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'productos' );
create policy "Auth Insert" on storage.objects for insert to authenticated with check ( bucket_id = 'productos' );
