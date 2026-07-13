-- Transparent, reviewable log of every AI action (PRD: agentic activity log).
create table if not exists public.ai_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete set null,
  action text not null,
  input_preview text not null default '',
  output_preview text not null default '',
  status text not null default 'completed',
  created_at timestamptz not null default now()
);
create index if not exists ai_log_user_idx on public.ai_activity_log (user_id, created_at desc);
alter table public.ai_activity_log enable row level security;
drop policy if exists "ai log - all own" on public.ai_activity_log;
create policy "ai log - all own" on public.ai_activity_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
