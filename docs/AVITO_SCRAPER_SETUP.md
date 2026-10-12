# MOROTTO Avito scraper: setup and operations

This is a cautious, permission-gated importer for exact Avito search URLs that a superadmin has saved. It does not try to bypass access controls or anti-bot challenges. Import is stopped on access denial, rate limiting, CAPTCHA, or challenge pages. Imported marketplace listings always remain pending moderation.

## 1. Supabase

The queue/history schema has been applied to the connected MOROTTO project and is also versioned in `supabase/migrations/`:

- `scrape_searches`: one row per saved search; stores target URL, authorization confirmation, status and last result.
- `scrape_runs`: one row per search execution, including status, start/finish and counts.
- `scrape_run_events`: event timeline for pages, errors and final status.

RLS is enabled. Direct API access is revoked from `anon` and `authenticated`; server-side work uses only the service-role key. Never add that key to `VITE_*` variables or commit it.

## 2. GitHub Actions secrets

Repository Settings → Secrets and variables → Actions → New repository secret:

- `SUPABASE_URL`: `https://vfgoqusttddyjjkitesd.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role key from the Supabase project; keep it server/CI-only.
- `AVITO_IMPORT_AUTHORIZED`: set to `true` only after MOROTTO is authorized to collect and reuse data from the saved URLs.
- `AUTHORIZED_IMPORT_OWNER_ID`: optional fallback UUID. Normally the worker uses the user UUID recorded as the admin who confirmed the search.

## 3. Workflow

GitHub Actions → **MOROTTO authorized Avito import**:
- Scheduled every six hours at minute 17 (UTC).
- Manual dispatch supports an optional `search_id` UUID.
- Manual `dry_run` defaults to `true`; review parsed counts before write-enabled runs.
- Scheduled runs are write-enabled but require `AVITO_IMPORT_AUTHORIZED=true` and a saved search authorization record.

The parser relies on Avito’s HTML structure and intentionally skips uncertain listings. Review a dry run before using production imports.

## 4. Admin launch integration

The new admin API is `api/admin/scrape-searches.js`. To launch GitHub Actions from the admin UI, the hosting environment must set:

- `GITHUB_ACTIONS_TOKEN`: fine-grained GitHub token or app token with Actions: write and Contents: read for this repository.
- `GITHUB_ACTIONS_OWNER`: `abdelhamidanachad-wq` (optional default).
- `GITHUB_ACTIONS_REPO`: `automaroc-hub` (optional default).
- `GITHUB_SCRAPE_WORKFLOW`: `scrape-avito.yml` (optional default).
- `AVITO_IMPORT_AUTHORIZED=true` to allow the admin endpoint to dispatch.

The `GITHUB_ACTIONS_TOKEN` must be stored only in the server environment, never in a `VITE_*` variable. If it is not configured, use manual workflow dispatch from GitHub Actions.

## 5. Deployment status

Vercel project creation was blocked by the connected account with HTTP 403 (permission denied). No deployment was created by this change. A team owner must grant project-creation permissions or link this repository to an existing Vercel project, then set the required environment variables in that project.

Frontend public variables:
- `VITE_SUPABASE_URL=https://vfgoqusttddyjjkitesd.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: the publishable key from Supabase.

Server-only variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AVITO_IMPORT_AUTHORIZED`
- `GITHUB_ACTIONS_TOKEN` (only for admin-triggered dispatch)

## 6. Source use

Use only sources and records whose collection and reuse you are allowed to perform. Honor website terms, applicable law, personal data rights and media licences. Do not upload, distribute or republish personal seller contact details without a valid legal basis and permission.
