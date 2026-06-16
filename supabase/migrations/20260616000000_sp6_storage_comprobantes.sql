insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy "Authenticated users can select comprobantes"
on storage.objects for select
to authenticated
using (bucket_id = 'comprobantes');

create policy "Authenticated users can upload comprobantes"
on storage.objects for insert
to authenticated
with check (bucket_id = 'comprobantes');
