create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'orange',
  icon text not null default 'folder',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories (user_id, sort_order);

alter table public.categories enable row level security;

drop policy if exists "categories - select own" on public.categories;
create policy "categories - select own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories - insert own" on public.categories;
create policy "categories - insert own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories - update own" on public.categories;
create policy "categories - update own" on public.categories
  for update using (auth.uid() = user_id);

drop policy if exists "categories - delete own" on public.categories;
create policy "categories - delete own" on public.categories
  for delete using (auth.uid() = user_id);
