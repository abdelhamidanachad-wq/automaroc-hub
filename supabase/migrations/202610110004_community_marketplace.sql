-- MOROTTO community marketplace: rentals, insurance, service providers, parts, and community.
-- Apply after migrations 001, 002, and 003 in Supabase SQL Editor.
-- All partner offers and listings start pending; only approved records are public.
create extension if not exists pgcrypto;

create table if not exists public.rental_offers (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  title text not null,
  vehicle_brand text not null,
  vehicle_model text not null,
  vehicle_year integer check (vehicle_year between 1950 and 2100),
  city text not null,
  price_mad numeric(12,2) not null check (price_mad >= 0),
  billing_period text not null check (billing_period in ('day','week','month')),
  deposit_mad numeric(12,2) check (deposit_mad is null or deposit_mad >= 0),
  availability_notes text,
  contact_phone text,
  source_url text,
  source_authorized boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected','expired')),
  available_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurance_offers (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  insurer_name text not null,
  offer_name text not null,
  coverage_summary text not null,
  price_from_mad numeric(12,2) check (price_from_mad is null or price_from_mad >= 0),
  quote_url text,
  contact_phone text,
  source_authorized boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected','expired')),
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  provider_type text not null check (provider_type in ('mechanic','garage','parts_shop','inspection_center','towing')),
  description text,
  address text,
  city text not null,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  phone text,
  website_url text,
  source_authorized boolean not null default false,
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parts_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  part_category text not null,
  brand text,
  compatible_vehicles text,
  condition text not null check (condition in ('new','used','refurbished')),
  price_mad numeric(12,2) not null check (price_mad >= 0),
  city text not null,
  description text,
  image_url text,
  contact_phone text,
  source_url text,
  source_authorized boolean not null default false,
  status text not null default 'pending' check (status in ('pending','published','rejected','sold','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  topic text not null default 'general' check (topic in ('general','buying_advice','maintenance','road_trip','parts','safety')),
  city text,
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rental_offers_public_idx on public.rental_offers (city, billing_period, price_mad) where status = 'published' and source_authorized = true;
create index if not exists insurance_offers_public_idx on public.insurance_offers (insurer_name) where status = 'published' and source_authorized = true;
create index if not exists service_providers_public_idx on public.service_providers (city, provider_type) where status = 'published';
create index if not exists parts_listings_public_idx on public.parts_listings (city, part_category, price_mad) where status = 'published' and source_authorized = true;
create index if not exists community_posts_recent_idx on public.community_posts (created_at desc) where status = 'published';

alter table public.rental_offers enable row level security;
alter table public.insurance_offers enable row level security;
alter table public.service_providers enable row level security;
alter table public.parts_listings enable row level security;
alter table public.community_posts enable row level security;

-- Public reads are restricted to approved and authorized commercial inventory.
drop policy if exists "Public can read authorized published rentals" on public.rental_offers;
create policy "Public can read authorized published rentals" on public.rental_offers
for select to anon, authenticated using (status = 'published' and source_authorized = true and (available_until is null or available_until >= current_date));
drop policy if exists "Owners can submit rentals" on public.rental_offers;
create policy "Owners can submit rentals" on public.rental_offers
for insert to authenticated with check (provider_id = (select auth.uid()) and status = 'pending' and source_authorized = false);
drop policy if exists "Owners can edit pending rentals" on public.rental_offers;
create policy "Owners can edit pending rentals" on public.rental_offers
for update to authenticated using (provider_id = (select auth.uid()) and status = 'pending') with check (provider_id = (select auth.uid()) and status = 'pending' and source_authorized = false);
drop policy if exists "Superadmins manage rentals" on public.rental_offers;
create policy "Superadmins manage rentals" on public.rental_offers
for all to authenticated using ((select public.has_role('superadmin'))) with check ((select public.has_role('superadmin')));

drop policy if exists "Public can read authorized published insurance offers" on public.insurance_offers;
create policy "Public can read authorized published insurance offers" on public.insurance_offers
for select to anon, authenticated using (status = 'published' and source_authorized = true and (valid_until is null or valid_until >= current_date));
drop policy if exists "Owners can submit insurance offers" on public.insurance_offers;
create policy "Owners can submit insurance offers" on public.insurance_offers
for insert to authenticated with check (provider_id = (select auth.uid()) and status = 'pending' and source_authorized = false);
drop policy if exists "Owners can edit pending insurance offers" on public.insurance_offers;
create policy "Owners can edit pending insurance offers" on public.insurance_offers
for update to authenticated using (provider_id = (select auth.uid()) and status = 'pending') with check (provider_id = (select auth.uid()) and status = 'pending' and source_authorized = false);
drop policy if exists "Superadmins manage insurance offers" on public.insurance_offers;
create policy "Superadmins manage insurance offers" on public.insurance_offers
for all to authenticated using ((select public.has_role('superadmin'))) with check ((select public.has_role('superadmin')));

drop policy if exists "Public can read published service providers" on public.service_providers;
create policy "Public can read published service providers" on public.service_providers
for select to anon, authenticated using (status = 'published' and (verified = true or source_authorized = true));
drop policy if exists "Owners can submit service providers" on public.service_providers;
create policy "Owners can submit service providers" on public.service_providers
for insert to authenticated with check (owner_id = (select auth.uid()) and status = 'pending' and verified = false and source_authorized = false);
drop policy if exists "Owners can edit pending service providers" on public.service_providers;
create policy "Owners can edit pending service providers" on public.service_providers
for update to authenticated using (owner_id = (select auth.uid()) and status = 'pending') with check (owner_id = (select auth.uid()) and status = 'pending' and verified = false);
drop policy if exists "Superadmins manage service providers" on public.service_providers;
create policy "Superadmins manage service providers" on public.service_providers
for all to authenticated using ((select public.has_role('superadmin'))) with check ((select public.has_role('superadmin')));

drop policy if exists "Public can read authorized published parts" on public.parts_listings;
create policy "Public can read authorized published parts" on public.parts_listings
for select to anon, authenticated using (status = 'published' and source_authorized = true);
drop policy if exists "Owners can submit parts" on public.parts_listings;
create policy "Owners can submit parts" on public.parts_listings
for insert to authenticated with check (seller_id = (select auth.uid()) and status = 'pending' and source_authorized = false);
drop policy if exists "Owners can edit pending parts" on public.parts_listings;
create policy "Owners can edit pending parts" on public.parts_listings
for update to authenticated using (seller_id = (select auth.uid()) and status = 'pending') with check (seller_id = (select auth.uid()) and status = 'pending' and source_authorized = false);
drop policy if exists "Superadmins manage parts" on public.parts_listings;
create policy "Superadmins manage parts" on public.parts_listings
for all to authenticated using ((select public.has_role('superadmin'))) with check ((select public.has_role('superadmin')));

drop policy if exists "Public can read community posts" on public.community_posts;
create policy "Public can read community posts" on public.community_posts
for select to anon, authenticated using (status = 'published');
drop policy if exists "Signed-in users can create community posts" on public.community_posts;
create policy "Signed-in users can create community posts" on public.community_posts
for insert to authenticated with check (author_id = (select auth.uid()) and status = 'published');
drop policy if exists "Authors can edit own community posts" on public.community_posts;
create policy "Authors can edit own community posts" on public.community_posts
for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "Superadmins manage community posts" on public.community_posts;
create policy "Superadmins manage community posts" on public.community_posts
for all to authenticated using ((select public.has_role('superadmin'))) with check ((select public.has_role('superadmin')));

grant select on public.rental_offers, public.insurance_offers, public.service_providers, public.parts_listings, public.community_posts to anon, authenticated;
grant insert, update on public.rental_offers, public.insurance_offers, public.service_providers, public.parts_listings, public.community_posts to authenticated;
