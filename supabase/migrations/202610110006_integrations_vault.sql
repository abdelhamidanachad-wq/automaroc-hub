-- Secrets are AES-256-GCM encrypted by the Vercel serverless API.
-- APP_ENCRYPTION_KEY lives only in Vercel.
create table if not exists public.integration_secrets (
  provider text primary key check (provider in ('google_maps','apify','openai','anthropic','google_ai')),
  encrypted_secret text not null,
  enabled boolean not null default false,
  monthly_budget_usd numeric(12,2) not null default 0 check (monthly_budget_usd >= 0),
  daily_limit integer not null default 0 check (daily_limit >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;
grant all on public.integration_secrets to service_role;

create table if not exists public.integration_usage (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('google_maps','apify','openai','anthropic','google_ai')),
  feature text not null,
  units integer not null default 1 check (units > 0),
  outcome text not null default 'success' check (outcome in ('success','error','blocked')),
  created_at timestamptz not null default now()
);
create index if not exists integration_usage_provider_created_idx on public.integration_usage(provider, created_at desc);
create index if not exists integration_usage_feature_created_idx on public.integration_usage(feature, created_at desc);
alter table public.integration_usage enable row level security;
revoke all on public.integration_usage from anon, authenticated;
grant all on public.integration_usage to service_role;
