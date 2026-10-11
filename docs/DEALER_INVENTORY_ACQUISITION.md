# MOROTTO dealer inventory acquisition kit

## Objective

Acquire **at least 1,500 genuine, current, permissioned vehicle listings** from Moroccan dealers, garages and approved data partners. This is a target, not a claim that MOROTTO currently has that inventory.

## Do not count these toward the target

- Demo or generated records
- Listings without documented permission to republish the data and photos
- Pending moderation, duplicate, expired, sold or withdrawn vehicles
- Records with missing/invalid price, year, category, source reference or responsible owner
- Third-party marketplace listings copied without the marketplace/data owner's permission

## Practical route to 1,500

Suggested pipeline (targets, not existing partners):

| Stage | Target |
|---|---:|
| Contact 100 dealerships, used-car groups and commercial vehicle sellers | 100 prospects |
| Secure written permission and obtain inventory exports from 15–30 partners | 15–30 signed partners |
| Collect an average of 50–100 valid vehicles per partner | 1,500–3,000 submitted records |
| Validate and deduplicate submissions | Remove invalid and duplicate records |
| Import in batches of 5–10, then 100–250 | Test before scale |
| Moderate and publish only approved, available vehicles | 1,500+ live published listings |

A realistic timeline depends on partner response, the size and freshness of each inventory export, and permission to display images and contact details. Do not promise a delivery date until partners confirm.

## Partner checklist

Before accepting a feed, record:
- Legal business name and business contact
- Named person who confirms the right to share the inventory
- Written permission covering storage, public display, photos, prices, contact details, refresh frequency and removal requests
- Responsible MOROTTO seller account UUID (owner_id)
- Stable external reference for each vehicle (source_reference)
- Source URL for each listing
- Last-updated timestamp and sold/withdrawn handling
- Contact path for corrections and takedowns

Keep written permission outside the CSV and restrict access to it. source_authorized=true is an assertion for the importer, not a substitute for retaining actual permission.

## Import workflow

1. Start from templates/authorized-inventory-template.csv; it contains headers only, no fake listings.
2. Use the exact owner UUID of an existing Supabase Auth account that is responsible for the inventory.
3. Include only vehicles that the partner is authorized to share. Use a stable reference from the partner's own inventory system.
4. Validate a small 5–10 row batch with the importer first.
5. Keep the Supabase service-role key in a secure terminal/secret manager only. Never put it in Vite variables, frontend code, CSVs, or GitHub.
6. Import: node scripts/import-authorized-listings.mjs path/to/authorized.csv.
7. Review inserted/skipped/error counts. New rows enter pending moderation and are not public.
8. Approve only after checking source authorization, vehicle details, photos, duplicates and availability.
9. Reconcile sold, withdrawn and stale vehicles on an agreed schedule. Do not keep unavailable listings live to preserve the count.

## Sample partner outreach (send only after checking the contact)

**Subject:** Partnership request — publish your available vehicle inventory on MOROTTO

Hello,

MOROTTO is building a Moroccan vehicle marketplace and is inviting professional sellers to publish their current inventory. We would like to discuss a permission-based partnership to display vehicles your business is authorized to advertise.

If you're interested, could you share the approximate number of available vehicles and whether you can provide a CSV or API feed? Before importing anything, we'd agree in writing on the fields we may display, use of photos and prices, update frequency, and how sold or withdrawn vehicles are removed.

We can start with a small sample of 5–10 vehicles for validation, then scale once the workflow is confirmed. No inventory will be published until the source is authorized and the listings pass moderation.

Thank you,
MOROTTO Partnerships

## Reporting

Track these counts separately: prospects contacted, partners with written permission, rows received, validation failures, duplicates, imported/pending, published/current, sold/withdrawn/expired. The 1,500 goal means **current published unique listings only**.
