-- Profiles: 1:1 with auth.users, holds per-user settings. RLS-protected.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  theme text not null default 'system',
  accent text not null default 'orange',
  ai_enabled boolean not null default false,
  startup_preference text not null default 'dashboard',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile - select" on public.profiles;
create policy "own profile - select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile - update" on public.profiles;
create policy "own profile - update" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
