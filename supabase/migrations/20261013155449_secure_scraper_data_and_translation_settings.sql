-- Restrict scraper tables to privileged server-side routes.
-- The API layer uses service-role access and enforces superadmin authorization.
revoke all on table public.scrape_searches from anon, authenticated;
revoke all on table public.scrape_runs from anon, authenticated;
revoke all on table public.scrape_run_events from anon, authenticated;
