-- MOROTTO initial schema. Apply in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  phone text,
  city text,
  account_type text not null default 'individual'
    check (account_type in ('individual','dealer','garage','rental_agency')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'Cars' check (category in ('Cars','Motos','Scooters','Trucks')),
  brand text not null check (char_length(brand) between 1 and 60),
  model text not null check (char_length(model) between 1 and 100),
  year integer not null check (year between 1950 and extract(year from now())::integer + 1),
  price_mad numeric(12,2) not null check (price_mad > 0),
  fuel text not null default 'Autre',
  fiscal_power integer check (fiscal_power is null or fiscal_power between 1 and 100),
  mileage_km integer not null default 0 check (mileage_km >= 0),
  listing_type text not null default 'Occasion' check (listing_type in ('Neuf','Occasion','Location')),
  city text not null,
  image_url text,
  description text check (description is null or char_length(description) <= 5000),
  featured boolean not null default false,
  status text not null default 'pending' check (status in ('draft','pending','published','rejected','archived')),
  source text not null default 'seller' check (source in ('seller','dealer','authorized_import')),
  source_reference text,
  source_url text,
  source_authorized boolean not null default false,
  moderation_note text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint imported_listings_require_authorization check (source <> 'authorized_import' or source_authorized = true)
);

create index if not exists listings_public_search_idx on public.listings (status, city, category, price_mad);
create index if not exists listings_owner_created_idx on public.listings (owner_id, created_at desc);
create index if not exists listings_brand_model_idx on public.listings (brand, model);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at before update on public.listings for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users" on public.profiles
for select to authenticated using (true);
drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Published listings are public" on public.listings;
create policy "Published listings are public" on public.listings
for select to anon, authenticated using (status = 'published' and (expires_at is null or expires_at > now()));
drop policy if exists "Owners can view their listings" on public.listings;
create policy "Owners can view their listings" on public.listings
for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Authenticated users can submit listings for review" on public.listings;
create policy "Authenticated users can submit listings for review" on public.listings
for insert to authenticated with check (owner_id = (select auth.uid()) and status in ('draft','pending') and source in ('seller','dealer'));
drop policy if exists "Owners can edit unapproved listings" on public.listings;
create policy "Owners can edit unapproved listings" on public.listings
for update to authenticated using (owner_id = (select auth.uid()) and status in ('draft','pending','rejected'))
with check (owner_id = (select auth.uid()) and status in ('draft','pending','rejected') and source in ('seller','dealer'));
drop policy if exists "Owners can delete unapproved listings" on public.listings;
create policy "Owners can delete unapproved listings" on public.listings
for delete to authenticated using (owner_id = (select auth.uid()) and status in ('draft','pending','rejected'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images','listing-images',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Public can view listing images" on storage.objects;
create policy "Public can view listing images" on storage.objects
for select to anon, authenticated using (bucket_id = 'listing-images');
drop policy if exists "Users upload images to own folder" on storage.objects;
create policy "Users upload images to own folder" on storage.objects
for insert to authenticated with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update images in own folder" on storage.objects;
create policy "Users update images in own folder" on storage.objects
for update to authenticated using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete images in own folder" on storage.objects;
create policy "Users delete images in own folder" on storage.objects
for delete to authenticated using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
