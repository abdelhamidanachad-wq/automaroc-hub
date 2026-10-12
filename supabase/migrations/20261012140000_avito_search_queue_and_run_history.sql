-- Avito search queue, per-search status and run event history.
-- The admin API accesses these tables with the server-only service role key.
create table if not exists public.scrape_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  brand text,
  model text,
  city text not null default 'Maroc',
  target_url text not null check (target_url like 'https://avito.ma/%' or target_url like 'https://www.avito.ma/%' or target_url like 'https://%.avito.ma/%'),
  max_pages integer not null default 5 check (max_pages between 1 and 50),
  enabled boolean not null default true,
  authorized_by uuid references auth.users(id) on delete set null,
  authorization_confirmed_at timestamptz,
  last_status text not null default 'pending' check (last_status in ('pending','queued','running','completed','failed','skipped')),
  last_run_id text,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_seen_count integer not null default 0 check (last_seen_count >= 0),
  last_imported_count integer not null default 0 check (last_imported_count >= 0),
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scrape_searches_status_idx on public.scrape_searches(enabled,last_status,created_at);
create index if not exists scrape_searches_updated_idx on public.scrape_searches(updated_at desc);
alter table public.scrape_searches enable row level security;
revoke all on public.scrape_searches from anon, authenticated;
grant all on public.scrape_searches to service_role;

create table if not exists public.scrape_runs (
  run_id text primary key,
  search_id uuid references public.scrape_searches(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  target_url text not null check (target_url like 'https://avito.ma/%' or target_url like 'https://www.avito.ma/%' or target_url like 'https://%.avito.ma/%'),
  status text not null default 'running'
    check (status in ('queued','running','completed','failed','aborted','timed-out','skipped')),
  dataset_count integer not null default 0 check (dataset_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists scrape_runs_search_created_idx on public.scrape_runs(search_id,created_at desc);
create index if not exists scrape_runs_status_created_idx on public.scrape_runs(status,created_at desc);
alter table public.scrape_runs enable row level security;
revoke all on public.scrape_runs from anon, authenticated;
grant all on public.scrape_runs to service_role;

create table if not exists public.scrape_run_events (
  id bigint generated always as identity primary key,
  run_id text references public.scrape_runs(run_id) on delete cascade,
  search_id uuid references public.scrape_searches(id) on delete set null,
  level text not null default 'info' check (level in ('info','warning','error')),
  event text not null check (char_length(event) <= 120),
  message text not null check (char_length(message) <= 1200),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scrape_run_events_run_created_idx on public.scrape_run_events(run_id,created_at);
alter table public.scrape_run_events enable row level security;
revoke all on public.scrape_run_events from anon, authenticated;
grant all on public.scrape_run_events to service_role;
