# MOROTTO: plan for 15,000 real vehicle listings

## Non-negotiable data rule
MOROTTO must not fabricate vehicles, sellers, prices, availability, or source permissions. Demo records are not inventory and must never be represented as real listings. A listing is publicly searchable only after the source is authorized, vehicle data is validated, and a moderator approves it.

## Inventory acquisition: all authorized sources
1. Dealer and garage onboarding: obtain written permission and a named feed contact; collect existing inventory exports; verify the right to display photos, descriptions, prices, contact details, and listing URLs.
2. Seller submissions: let verified individuals and professional sellers create listings directly. Require accurate details, contact verification, consent to publish, and moderation before publication.
3. Authorized partner feeds: use only API/CSV feeds with written terms permitting storage, display, image use, refresh cadence, and removal. Do not scrape competing marketplaces or republish their data without permission.
4. Refresh and removal: each source should provide a stable external listing reference, last-seen/updated time, and expiry rule. Retire sold, expired, withdrawn, or stale listings promptly.
5. Moderation: inspect duplicates, suspicious prices, incomplete specs, misleading photos, personal registration data, prohibited content, and source authorization. Imports remain pending; nothing is auto-published.

## Suggested acquisition milestones (targets, not claimed inventory)
- Pilot: 100–300 authorized listings from 5–10 cooperative dealers.
- Validate: 1,000 listings across main regions and categories; measure feed freshness, duplicate rate, and moderation capacity.
- Scale: 5,000 listings from multiple dealers/partners with scheduled refreshes and seller self-service.
- Goal: 15,000 current, deduplicated, authorized listings. Do not count expired, pending, demo, or duplicate records toward the goal.

## Data and performance design
- Supabase/Postgres remains the source of truth.
- Use indexed filtering and text search, server-side pagination (24–48 cards per page), and never fetch all 15,000 rows into the browser at once.
- Use stable source + source_reference keys for import idempotency.
- Keep imports behind a server/terminal process using the Supabase service-role key. Never put that key in frontend variables, browser code, GitHub, or a CSV file.
- Import in batches, validate before writing, log inserted/skipped/error counts, and retain an auditable source URL.
- Monitor counts by status/source/city, feed age, import failures, duplicate rate, and published listing removals.

## Authorized CSV import
A bulk importer should accept only dealer or authorized partner data, require documented authorization, source URLs and stable references, validate fields, skip already-imported references, and insert all new records as pending. Required columns: owner_id, source, source_reference, source_url, source_authorized, category, brand, model, year, price_mad, fuel, mileage_km, listing_type, city. Optional: fiscal_power, image_url, description. The owner_id must be an existing Supabase auth user UUID representing the responsible dealer/account. Source must be dealer or authorized_import. Category must be Cars, Motos, Scooters, or Trucks.

## Release checklist
- [ ] Apply migrations 202610110001, 202610110002, then 202610110003 in Supabase SQL Editor.
- [ ] Test with a small authorized CSV (5–10 listings) first.
- [ ] Verify importing the same file twice creates no duplicates.
- [ ] Verify pending listings are not public.
- [ ] Verify approved listings appear in search and pagination.
- [ ] Verify stale/withdrawn listings are archived or expired.
- [ ] Ramp to hundreds and thousands only after validation.
