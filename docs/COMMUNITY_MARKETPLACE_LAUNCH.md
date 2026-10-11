# MOROTTO community marketplace rollout

## What is now in the code

- A Community hub for published rental offers, insurance offers, verified mechanics/garages, authorized parts listings, community posts, and destination hand-off to Google Maps or Waze.
- Supabase tables and row-level security for those categories in `supabase/migrations/202610110004_community_marketplace.sql`.
- Commercial offers are displayed only when their database records are published and authorized. Service providers must be verified or have an authorized source. User-generated community posts are separate from commercial inventory.
- The navigation feature opens a destination in Google Maps or Waze. It does not claim to be an in-app GPS engine or provide its own live traffic, voice guidance, or route recalculation.

## Required Supabase setup

Run migrations in this order in the Supabase SQL Editor, if not already applied:

1. `202610110001_initial_schema.sql`
2. `202610110002_accounts_roles.sql`
3. `202610110003_inventory_scale.sql`
4. `202610110004_community_marketplace.sql`

Check each query completes successfully before continuing. Do not run only migration 004 on a database that is missing the earlier tables or the `public.has_role(text)` function.

## Data requirements — do not seed fake offers

The requested targets are launch goals, not inventory currently present in the repository:

- 1,500+ current, unique, authorized vehicle listings.
- 50+ current rental offers.
- 10+ real insurance offers.
- Real mechanics, garages, parts shops, and parts listings.

No synthetic data should be counted toward these targets. Each commercial record needs a traceable provider/source, current availability, appropriate permission to publish its data and images, and a moderation decision. Public web pages alone do not grant permission to republish their content.

### Vehicle inventory acceptance checklist

- Stable source reference and canonical source URL.
- Written authorization, or an approved partner feed/API agreement.
- Vehicle is available, not sold, withdrawn, expired, or duplicated.
- Required attributes validated and source checked.
- Imported as pending and published only after moderation.
- Periodic expiry/reconciliation with each partner feed.

### Rental acceptance checklist

Collect partner name, vehicle/category, city, day/week/month rate, deposit, mileage policy, availability dates, insurance/assistance terms, contact details, source URL and publishing authorization. Reconfirm availability and rates before publishing.

### Insurance acceptance checklist

Collect insurer/intermediary identity, product name, coverage summary, official quote URL or documented price source, validity date, and permission to display the offer. A simulated premium is not an insurer offer; use the calculator only as an explicitly illustrative estimate.

### Service providers and parts

Verify business identity and location, phone, service/parts categories, and authorization for any imported content/photos. Parts listings need fitment, condition, price, seller contact, and current stock status. Do not present unverified user submissions as verified businesses.

## How to reach the targets

1. Recruit and onboard authorized dealers, rental companies, insurers/intermediaries, garages, and parts shops.
2. Obtain CSV/API exports and written publication permission.
3. Validate a small sample with each partner before bulk import.
4. Import into pending status, deduplicate, moderate, and publish.
5. Track published counts by category and source; exclude expired, sold, withdrawn, unverified, and unauthorized records from target metrics.
6. Reconcile feeds regularly so the public catalog remains current.

## Navigation roadmap

The current navigation integration hands a typed destination to Google Maps or Waze. A native in-app, Waze-like navigation experience would require a map/routing provider, location permissions, usage/billing configuration, and mobile/background-location considerations. Do not market the external hand-off as a custom live GPS service.
