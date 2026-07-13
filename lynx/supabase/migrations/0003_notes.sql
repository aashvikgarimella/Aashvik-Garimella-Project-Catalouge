create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  pinned boolean not null default false,
  archived boolean not null default false,
  daily_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_search_idx on public.notes using gin (to_tsvector('english', title || ' ' || content_text));
create unique index if not exists notes_daily_unique on public.notes (user_id, daily_date) where daily_date is not null;

alter table public.notes enable row level security;

drop policy if exists "notes - select own" on public.notes;
create policy "notes - select own" on public.notes for select using (auth.uid() = user_id);
drop policy if exists "notes - insert own" on public.notes;
create policy "notes - insert own" on public.notes for insert with check (auth.uid() = user_id);
drop policy if exists "notes - update own" on public.notes;
create policy "notes - update own" on public.notes for update using (auth.uid() = user_id);
drop policy if exists "notes - delete own" on public.notes;
create policy "notes - delete own" on public.notes for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists notes_touch_updated on public.notes;
create trigger notes_touch_updated before update on public.notes
  for each row execute function public.touch_updated_at();
