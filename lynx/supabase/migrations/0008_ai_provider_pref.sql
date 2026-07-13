-- Per-user AI provider preference: '' = auto-detect, else 'openai' | 'anthropic'.
alter table public.profiles
  add column if not exists ai_provider text not null default '';
