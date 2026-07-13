-- Reminders are attached to notes.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  remind_at timestamptz not null,
  message text not null default '',
  recurrence text not null default 'none',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders (user_id, remind_at);
create index if not exists reminders_note_idx on public.reminders (note_id);
alter table public.reminders enable row level security;
drop policy if exists "reminders - all own" on public.reminders;
create policy "reminders - all own" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- How the user wants notes grouped in the menu + main page: 'date' or 'category'.
alter table public.profiles
  add column if not exists note_grouping text not null default 'date';
