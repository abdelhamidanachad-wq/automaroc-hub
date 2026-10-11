-- MOROTTO admin controls, editable OAuth providers, platform settings, and advertising inventory.
alter table public.integration_secrets drop constraint if exists integration_secrets_provider_check;
alter table public.integration_secrets add constraint integration_secrets_provider_check
  check (provider in ('google_maps','apify','openai','anthropic','google_ai','google_oauth','facebook_oauth'));

create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant all on public.platform_settings to service_role;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null,
  placement text not null,
  mode text not null default 'local' check (mode in ('local','google','disabled')),
  title text not null default '',
  body text not null default '',
  image_url text,
  click_url text,
  city text,
  google_ad_slot text,
  active boolean not null default false,
  priority integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_placement_check check (placement in ('global','home','buy','rent','community','mechanic','insurance','map','learn','pro','vehicle_detail','listing_sidebar','footer')),
  constraint ad_campaigns_url_check check (
    (image_url is null or image_url ~* '^https?://') and
    (click_url is null or click_url ~* '^https?://')
  )
);
create index if not exists ad_campaigns_active_placement_idx on public.ad_campaigns(placement, active, priority);
alter table public.ad_campaigns enable row level security;
revoke all on public.ad_campaigns from anon, authenticated;
grant all on public.ad_campaigns to service_role;
