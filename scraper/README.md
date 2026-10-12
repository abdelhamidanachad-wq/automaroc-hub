# MOROTTO Avito authorized-import worker

The worker processes only rows explicitly saved by a superadmin in `public.scrape_searches` where `enabled = true`, `authorization_confirmed_at` is present, and `target_url` is an HTTPS Avito URL. It records a run for each search and status/event data in Supabase.

## GitHub Actions secrets

Add these repository secrets:
- `SUPABASE_URL`: MOROTTO project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side/service-role key. Never use in browser variables.
- `AVITO_IMPORT_AUTHORIZED`: set to `true` only after confirming that MOROTTO is allowed to collect and reuse the specified data.

Use the workflow's manual dispatch input `search_id` for one search; leave blank to run all enabled/authorized searches. `dry_run` defaults to true for manual runs. Scheduled runs are write-enabled but still require `AVITO_IMPORT_AUTHORIZED=true` and each search's stored authorization confirmation.

## Important

- Only run against sources and content you are authorized to collect and reuse; honor Avito's terms, robots directives, applicable law and individual rights.
- The worker uses conservative pacing (2–5 seconds between pages), a hard page cap, and stops on access-denied, rate-limit, CAPTCHA or challenge responses. It does not rotate identities, evade challenges, or try to defeat anti-bot controls.
- DOM selectors and markup can change. Validate the current Avito result-page structure with an approved account/source before relying on it.
- Uncertain fields remain null. Never publish imported rows automatically; imported vehicle listings use `status = 'pending'`.
