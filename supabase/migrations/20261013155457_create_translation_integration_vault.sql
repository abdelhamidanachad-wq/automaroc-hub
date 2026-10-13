-- Server-only encrypted integration settings and usage audit.
create table if not exists public.integration_secrets (
  provider text primary key check (provider in ('google_maps','google_translate','deepl','apify','openai','anthropic','google_ai')),
  encrypted_secret text,
  enabled boolean not null default false,
  daily_limit integer not null default 0 check (daily_limit >= 0),
  monthly_budget_usd numeric(12,2) not null default 0 check (monthly_budget_usd >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_usage (
  id bigint generated always as identity primary key,
  provider text not null,
  feature text not null check (char_length(feature) <= 100),
  units integer not null default 1 check (units >= 1),
  outcome text not null default 'success' check (outcome in ('success','error','blocked')),
  created_at timestamptz not null default now()
);

create index if not exists integration_usage_provider_created_idx
  on public.integration_usage(provider, created_at desc);

alter table public.integration_secrets enable row level security;
alter table public.integration_usage enable row level security;
revoke all on table public.integration_secrets from anon, authenticated;
revoke all on table public.integration_usage from anon, authenticated;

insert into public.integration_secrets(provider, encrypted_secret, enabled, daily_limit, monthly_budget_usd)
values
  ('google_translate', null, false, 0, 0),
  ('deepl', null, false, 0, 0)
on conflict (provider) do nothing;
