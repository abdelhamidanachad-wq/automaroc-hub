-- Apify run tracking for MOROTTO's server-side admin importer.
-- Apply after the existing account/roles migrations in the Supabase SQL Editor.
create table if not exists public.scrape_runs (
  run_id text primary key,
  requested_by uuid not null references auth.users(id) on delete restrict,
  target_url text not null check (target_url ~ '^https://([a-zA-Z0-9-]+\\.)*avito\\.ma(/|$)'),
  status text not null default 'running'
    check (status in ('running','completed','failed','aborted','timed-out')),
  imported_count integer not null default 0 check (imported_count >= 0),
  imported_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists scrape_runs_requested_by_created_idx
  on public.scrape_runs (requested_by, created_at desc);

alter table public.scrape_runs enable row level security;
revoke all on public.scrape_runs from anon, authenticated;
-- The Vercel serverless function accesses this table with the Supabase service-role key.
-- Never expose that key in browser code.
