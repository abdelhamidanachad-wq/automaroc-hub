# MOROTTO maps provider evaluation (Morocco)

## Recommendation
Run a proof-of-coverage test in Casablanca, Rabat, Marrakech, Tangier, and rural routes before committing. The current SVG map is a mock, not navigation.

| Requirement | Mapbox | Google Maps Platform |
|---|---|---|
| Branded map styling | Strong styling control and vector-map customization | Mature basemaps and styling options |
| Turn-by-turn in native apps | Navigation SDKs available; verify Morocco coverage, terms, and platform costs for the exact SDK | Navigation SDKs available; verify supported features and regional terms for the exact SKU |
| Traffic and incidents | Product and regional availability must be validated | Traffic/routing products exist; validate coverage and feature availability in Morocco |
| Web implementation | Mapbox GL JS for interactive web maps | Maps JavaScript API for web maps |
| Cost model | Product-specific pricing; monitor token use | SKU/billing based; configure budgets, quotas, and key restrictions |
| Vendor lock-in | Moderate | Moderate to high when combining Google-specific Places, Routes, and Maps APIs |

## Evaluation checklist
1. Compare road geometry and address search in Casablanca, Rabat, Marrakech, Tangier, and a rural route.
2. Test routing quality, U-turns, road closures, toll roads, and Arabic/French labels.
3. Confirm live traffic and incident-report coverage, not just whether a traffic layer renders.
4. Check iOS and Android SDK availability, offline behaviour, background location requirements, and app-store policies.
5. Calculate projected costs for 10k, 100k, and 1M monthly active users, including map loads, route requests, places search, and navigation sessions.
6. Restrict API keys by origin/app, set quotas and billing alerts, and never expose server secrets in the client.

## Initial architecture
Keep a provider adapter boundary with methods for place search, route calculation, navigation, and incident reporting so the web and native clients are not tightly coupled to one SDK. Use the provider's supported SDK for live navigation rather than recreating turn-by-turn guidance from a static map.

## Official references
- Mapbox pricing: https://www.mapbox.com/pricing/
- Mapbox Navigation SDK: https://docs.mapbox.com/ios/navigation/ and https://docs.mapbox.com/android/navigation/
- Google Maps Platform pricing: https://mapsplatform.google.com/pricing/
- Google Maps Navigation SDK: https://developers.google.com/maps/documentation/navigation
- Google Maps JavaScript API: https://developers.google.com/maps/documentation/javascript

Pricing and availability change; verify current terms and regional coverage before implementation.
