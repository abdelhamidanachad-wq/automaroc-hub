alter table public.scrape_searches
  add column if not exists last_github_run_id bigint,
  add column if not exists last_worker_run_id text;

create or replace function public.morotto_set_scrape_search_status(
  p_search_id uuid,
  p_status text,
  p_run_id text default null,
  p_imported_count integer default null,
  p_seen_count integer default null,
  p_error text default null,
  p_github_run_id bigint default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.scrape_searches
  set last_status = p_status,
      last_run_id = coalesce(p_run_id, last_run_id),
      last_worker_run_id = coalesce(p_run_id, last_worker_run_id),
      last_github_run_id = coalesce(p_github_run_id, last_github_run_id),
      last_started_at = case when p_status in ('queued','running') then coalesce(last_started_at, now()) else last_started_at end,
      last_finished_at = case when p_status in ('completed','failed','skipped') then now() else last_finished_at end,
      last_imported_count = coalesce(p_imported_count, last_imported_count),
      last_seen_count = coalesce(p_seen_count, last_seen_count),
      last_error = p_error,
      updated_at = now()
  where id = p_search_id;
end;
$$;
revoke all on function public.morotto_set_scrape_search_status(uuid,text,text,integer,integer,text,bigint) from public, anon, authenticated;
grant execute on function public.morotto_set_scrape_search_status(uuid,text,text,integer,integer,text,bigint) to service_role;
