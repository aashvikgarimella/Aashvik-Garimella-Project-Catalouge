create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists attachments_note_idx on public.attachments (note_id);
alter table public.attachments enable row level security;
drop policy if exists "attachments - all own" on public.attachments;
create policy "attachments - all own" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', false)
on conflict (id) do nothing;

-- Each user may only touch objects under a top-level folder equal to their uid.
drop policy if exists "note-images - own folder" on storage.objects;
create policy "note-images - own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
