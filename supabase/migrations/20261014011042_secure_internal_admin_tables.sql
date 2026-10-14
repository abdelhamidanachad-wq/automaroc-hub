-- Internal integration credentials and scraper orchestration are accessed only by
-- server-side handlers using the service role after validating superadmin access.
revoke all on table public.integration_secrets from anon, authenticated;
revoke all on table public.integration_usage from anon, authenticated;
revoke all on table public.scrape_run_events from anon, authenticated;
revoke all on table public.scrape_runs from anon, authenticated;
revoke all on table public.scrape_searches from anon, authenticated;

create index if not exists demo_test_accounts_auth_user_id_idx on public.demo_test_accounts(auth_user_id);
create index if not exists forum_topics_author_id_idx on public.forum_topics(author_id);
create index if not exists forum_replies_author_id_idx on public.forum_replies(author_id);
create index if not exists forum_replies_topic_id_created_at_idx on public.forum_replies(topic_id, created_at);
create index if not exists integration_secrets_updated_by_idx on public.integration_secrets(updated_by);
create index if not exists scrape_run_events_search_id_idx on public.scrape_run_events(search_id);
create index if not exists scrape_runs_requested_by_idx on public.scrape_runs(requested_by);
create index if not exists scrape_runs_search_id_idx on public.scrape_runs(search_id);
create index if not exists scrape_searches_authorized_by_idx on public.scrape_searches(authorized_by);
create index if not exists scrape_searches_created_by_idx on public.scrape_searches(created_by);
