# AutoMaroc Hub

Responsive automotive marketplace prototype tailored to Morocco, built with React + Vite.

## Features
- Home landing page with vehicle search and feature navigation
- Vehicle marketplace with category, brand, fuel, and budget filters
- Short/long-term rental offer switching
- Tiered workshop price reference table
- Interactive insurance estimate simulator
- Stylized map with clickable garage / technical inspection POIs and animated demo route
- Knowledge center with legal-information cautions and official links
- Professional plans and demo signup interactions
- Responsive mobile navigation, role switcher, and favorite toggles

## Local development
```bash
cd automaroc-hub
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Deploy on Vercel
Import the Git repository `abdelhamidanachad-wq/smollan-hub` in Vercel and set **Root Directory** to `automaroc-hub`. Framework: Vite. Build command: `npm run build`; output directory: `dist`. The Vercel API connection used by the assistant currently returns HTTP 403 when creating a project/deployment, so the first deployment must be completed from the Vercel dashboard after account permissions are corrected.

## Prototype and data note
Vehicle listings, locations, rental rates, insurance estimates, workshop pricing, and subscription plans are illustrative mock data. Map routing is an SVG-based visual simulation, not live GPS navigation. Verify applicable Moroccan laws and tax guidance with official sources before production use.
