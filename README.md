# MOROTTO

MOROTTO is a mobile-first automotive community and marketplace for Morocco. The current web app is React + Vite; backend integration is being introduced incrementally.

## Current milestone
- Supabase client bootstrap using Vite environment variables.
- Published vehicle listings can load from Supabase when configured.
- Demo listings remain available when Supabase credentials are absent or the request fails.
- Initial schema for profiles, listings, row-level security, and listing image storage.
- Provider evaluation notes for Mapbox vs Google Maps Platform in Morocco.

## Local development
```bash
npm install
cp .env.example .env.local
npm run dev
```

To run the app with live listings, create a Supabase project, apply `supabase/migrations/202610110001_initial_schema.sql`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Restart Vite after changing environment variables.

## Environment variables
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon client key. This key is designed for browser use only when Row Level Security is correctly configured.
- Never add a Supabase service-role key or OAuth client secret to a `VITE_*` variable or commit any real secrets.

## Supabase setup still required
1. Create the Supabase project and apply the SQL migration.
2. Enable email/password or magic-link auth as desired.
3. Configure Google and Facebook providers in Supabase Auth and in each provider's developer console.
4. Add the production Vercel URL and local callback URLs to Supabase Auth URL configuration and provider redirect allowlists.
5. Add the two public Supabase variables to Vercel Production/Preview environments.
6. Test anonymous listing reads, authenticated listing submission, and storage policies before inviting users.

The current UI does not yet implement a complete sign-in flow, listing creation form, dealer dashboard, moderation console, or real-time messaging. The SQL schema prepares the first data layer but does not itself create those screens.

## Maps decision
See [docs/MAP_PROVIDER_DECISION.md](docs/MAP_PROVIDER_DECISION.md). The current map remains a visual prototype until a provider, credentials, routing SDK, and Moroccan coverage have been tested.

## Data imports and dealer onboarding
Use seller uploads, dealer partnerships, and authorized feeds/import files. Imported listings should record source/permission metadata, be deduplicated, reviewed, and expired when stale. Do not scrape restricted sources or ingest personal contact details without permission.

## Build and deployment
```bash
npm run build
```
Vercel should use the repository root, build command `npm run build`, and output directory `dist`. A successful Git commit does not by itself prove that a deployment succeeded; verify the latest Vercel deployment before publishing the production URL.
