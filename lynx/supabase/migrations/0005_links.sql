create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null,
  title text not null default '',
  description text not null default '',
  image_url text not null default '',
  note text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists links_user_idx on public.links (user_id, created_at desc);
alter table public.links enable row level security;
drop policy if exists "links - select own" on public.links;
create policy "links - select own" on public.links for select using (auth.uid() = user_id);
drop policy if exists "links - insert own" on public.links;
create policy "links - insert own" on public.links for insert with check (auth.uid() = user_id);
drop policy if exists "links - update own" on public.links;
create policy "links - update own" on public.links for update using (auth.uid() = user_id);
drop policy if exists "links - delete own" on public.links;
create policy "links - delete own" on public.links for delete using (auth.uid() = user_id);
