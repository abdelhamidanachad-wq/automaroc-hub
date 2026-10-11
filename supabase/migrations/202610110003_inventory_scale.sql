-- MOROTTO inventory scale: indexed search and safe source-reference deduplication.
-- Apply after 202610110001_initial_schema.sql and 202610110002_accounts_roles.sql.
create extension if not exists pg_trgm;
create index if not exists listings_public_newest_idx on public.listings (created_at desc, id) where status = 'published';
create index if not exists listings_public_category_price_idx on public.listings (category, price_mad, created_at desc) where status = 'published';
create index if not exists listings_public_city_idx on public.listings (city) where status = 'published';
create index if not exists listings_brand_trgm_idx on public.listings using gin (brand gin_trgm_ops);
create index if not exists listings_model_trgm_idx on public.listings using gin (model gin_trgm_ops);
create index if not exists listings_city_trgm_idx on public.listings using gin (city gin_trgm_ops);
-- NULL source_reference values remain allowed for ordinary seller listings.
create unique index if not exists listings_source_reference_uidx on public.listings (source, source_reference);
comment on index public.listings_source_reference_uidx is 'Idempotency key for inventory imports; use stable IDs supplied by authorized sources.';
