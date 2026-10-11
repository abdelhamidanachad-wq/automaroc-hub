# MOROTTO admin control center

## Apply the database migration

Run `supabase/migrations/202610110008_platform_admin_ads.sql` in the Supabase SQL Editor after migrations 001–007. The migration creates private platform settings and ad campaign tables and permits encrypted OAuth credential records in the integration vault. Do not run it before the existing integration-vault migration 006.

## Required Vercel server-only environment variables

Keep these as ordinary server environment variables; never prefix them with `VITE_`.

- `SUPABASE_URL`: the project's Supabase URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role secret.
- `APP_ENCRYPTION_KEY`: exactly 64 hexadecimal characters generated locally, for example with `openssl rand -hex 32`.
- `SUPABASE_PROJECT_REF`: the Supabase project reference.
- `SUPABASE_ACCESS_TOKEN`: a Supabase Management API personal access token with permission to update this project’s Auth configuration.

The Management API token is powerful. Use a dedicated token with the minimum available access, store it only in Vercel, and rotate it if exposed. The admin OAuth panel will return an explicit error and make no changes if the token or project reference is missing.

## Google and Facebook OAuth

1. Create a Web OAuth client in Google Cloud and configure Facebook Login in Meta for Developers.
2. Add this callback URL to both provider consoles: `https://vfgoqusttddyjjkitesd.supabase.co/auth/v1/callback`.
3. Deploy this version and open **Administration → Réglages de la plateforme → Google & Facebook OAuth**.
4. Enter the provider Client ID and Client Secret, tick the enable checkbox, and choose **Enregistrer & appliquer**.
5. Verify the provider status in Supabase Auth and test both sign-in and first-time account creation.

The OAuth secrets are encrypted at rest. The UI never returns saved secrets to the browser. Supabase's Management API is required because saving a client ID in the MOROTTO database alone cannot enable the provider in Supabase Auth.

## Platform settings

- Site name updates the browser document title.
- Maintenance mode serves a maintenance screen to non-superadmins; superadmins retain access.
- Disabling account creation is applied to Supabase Auth. It requires the Management API environment variables.
- Support email, default city, and inventory page size are saved for platform configuration. Features that do not yet consume a setting must not be assumed to change merely because the setting is stored.

## Advertising

Create an ad in **Réglages de la plateforme → Publicités locales & Google Ads**. Choose a page placement, advertiser, active status, and priority. Local advertisements take priority over a Google AdSense fallback. Configure an AdSense publisher client ID in general settings and a slot ID for each Google campaign. Google AdSense approval, consent requirements, and publisher policy compliance remain the operator’s responsibility.

Local campaigns can include a destination URL, image URL, optional city targeting, and text. Use HTTPS URLs and only publish campaigns supplied by clients who authorized their use. The public ad resolver exposes only campaign display fields, not credentials or private platform settings.

## Scraping reliability and authorization

The importer now uses the Apify token selected in the encrypted vault for both run creation and dataset downloads. Configure and enable Apify in the superadmin integrations panel, set `AVITO_IMPORT_AUTHORIZED=true` only after you have documented permission to collect and reuse the source data, and set `AUTHORIZED_IMPORT_OWNER_ID` to the UUID of the authorized inventory owner. `APIFY_AVITO_ACTOR_ID` can override the default actor identifier; verify the actor’s input schema before running it.

Imports are bounded and go to moderation as pending listings. The importer does not grant rights to scrape or reuse third-party content and does not turn scraped rows into published inventory automatically.

## What still requires external configuration or real data

- Google Cloud and Meta must approve/configure OAuth applications.
- Google Maps, AI, and scraping keys must be supplied by the account owner.
- AdSense must be approved by Google; an AdSense client/slot ID does not guarantee ads will serve.
- Provider budgets shown in MOROTTO are governance metadata, not guaranteed external billing caps.
- Real inventory, rental offers, insurance offers, garages, and parts require authorized, accurate records; this code does not fabricate those records.


## Morocco vehicle model scrape priorities

The admin scraper now has a first-wave selector backed by `src/moroccoPriceGuide.js`. It includes priority models and indicative year, fuel, and MAD price ranges transcribed from the owner-supplied market reference. These figures are a planning baseline only, not live listings, verified valuations, or proof that stock exists.

1. In **Administration → Import d’annonces autorisées**, choose the next priority model.
2. Copy its suggested search phrase, open Avito in a separate tab, and run that search.
3. Paste the exact resulting HTTPS Avito URL into the form. The selected model is a workflow aid only; it does not alter Avito filters or the actor's input.
4. Confirm collection/reuse permission only when documented authorization covers the source and media, then start the run.
5. Review imported rows under **Modération des annonces**. Imports remain pending and must be reviewed before publication.

Start with common high-volume models (Dacia Logan/Sandero/Duster, Renault Clio/Megane, Peugeot 208/3008, Volkswagen Golf/Polo, then Toyota, Hyundai/Kia, and premium models). This selector is a first-wave priority subset; the app's existing `vehicleCatalog.js` remains the broader make/model autocomplete source.

**Important:** a model price range is not a vehicle listing and must never be inserted as inventory. The admin scraper only fills the marketplace when the configured actor returns real records with a valid model, year, price, city, source reference, and permitted source URL. No inventory totals are promised until real rows are imported and approved.
