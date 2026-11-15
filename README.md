# ATLAS — Global Intelligence

An interactive 3D globe for exploring live world events, natural hazards, and climate data. Built with Vite + React, with serverless API routes deployed on Vercel.

This fork is our **NASA Space Apps** submission. Its main feature is **Trend Detective**: click anywhere on the globe and test whether a climate variable is actually trending there, using NASA POWER data.

Product and engineering notes live in [`docs/`](./docs/).

## Features

- **Trend Detective (NASA POWER).** Pick a point and a variable and get a deseasonalized trend test on monthly data from 1981 to 2025. The result reports Sen's slope per decade, a Mann-Kendall p-value with Hamed-Rao correction, and an OLS cross-check with a 95% interval. The case-file panel has topic chips, plain-language variable definitions, a verdict card, charts, and a compare mode. GDELT headlines suggest which variable to test, but they are never used as input to the test itself.
- **Live globe.** Hazards (USGS, GDACS, EONET, FIRMS, NOAA NHC), news and GDELT events, satellites (CelesTrak), weather, cameras, and economic indicators, all with an inspector panel.
- **Earth History** at `/earth-history`. A deep-time paleogeography explorer with a timeline scrubber, fossil and locality data (PBDB, Neotoma, Macrostrat), and historical polities. See [`docs/EARTH_HISTORY.md`](docs/EARTH_HISTORY.md).
- **Analyst tools.** Workspaces and investigations, watchlists and alert rules, GDELT analytics (BigQuery), and report export (PDF and STIX).

### Trend Detective variables

| Code | Meaning |
|------|---------|
| `T2M` | Average air temperature |
| `T2M_MAX` | Hottest temperature |
| `PRECTOTCORR` | Precipitation |
| `GWETROOT` | Root-zone soil wetness |
| `RH2M` | Relative humidity |
| `SNODP` | Snow depth |
| `ALLSKY_SFC_SW_DWN` | Sunlight at the surface |

The saved demo case files (Snoqualmie Pass snow depth, and Dhaka vs. São Paulo precipitation) are cached in [`public/trend-demos/`](public/trend-demos/), so they work without a live API. To regenerate them, run `npm run trend:demos`.

By default, aircraft, ship, conflict, and crypto layers and feeds are hidden. Set `VITE_ATLAS_SHOW_ALL_LAYERS=true` to show them.

## Quick start

Requires **Node 20+**. The repo root is the app root.

```bash
git clone https://github.com/AbhiDubz/NasaSpaceApps-Atlas.git
cd NasaSpaceApps-Atlas
npm install
cp .env.example .env.local   # fill in only the keys you need
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).

`npm run dev` serves the `/api/*` routes itself through [`vite-plugin-atlas-api.js`](vite-plugin-atlas-api.js), which also loads `.env` and `.env.local` so server-only keys work. You don't need a second terminal. NASA POWER needs no API key, so Trend Detective works without any configuration.

If you prefer the real Vercel runtime, you can still run `npm run dev:api` (`vercel dev` on port 3001). Any `/api` path the plugin doesn't handle is proxied there.

## Environment variables

[`.env.example`](.env.example) lists every key, grouped by feature, with signup links.

- `VITE_*` keys are baked into the browser bundle at build time.
- Keys without the prefix are server-only and are read by the API routes. Examples: `GOOGLE_CLOUD_CREDENTIALS`, `NEWSAPI_KEY`, `FRED_KEY`, `INGEST_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
- Most features fail gracefully when their key is missing. The Google 3D globe needs `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP3D_MAP_ID`.
- Never commit `.env` or `.env.local`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Fetch country GeoJSON if missing, then start Vite with the API routes |
| `npm run dev:api` | `vercel dev --listen 3001` (optional) |
| `npm run build` / `npm run preview` | Production build to `dist/`, then preview it |
| `npm test` | Run the Vitest suite (`src/**/__tests__`) |
| `npm run trend:demos` | Rebuild the cached Trend Detective demo JSON |
| `npm run earth-history:bake-all` | Rebake Earth History textures, coastlines, and polities |
| `npm run icons` / `npm run hazards:glb` | Rebuild marker icons and the 3D hazard models |
| `npm run deploy` / `npm run deploy:preview` | Deploy to Vercel (production or preview) |

## Project layout

```
api/
  [...path].js          catch-all router (keeps us under Vercel Hobby's 12-function limit)
  gdelt-query.js, export-report*.js, ingest.js, seed-ontology.js   Node-runtime entries
  _lib/routes/          one handler per /api/<name> route (nasa-power, trend, news-proxy, ...)
  _lib/                 BigQuery, caching, rate limiting, report engine, stores
src/
  App.jsx               landing → globe → workstation views, plus /earth-history
  components/           Globe, Inspector, Trend, Workbench, Workspace, Landing, UI
  adapters/             normalized source adapters (USGS, GDACS, EONET, FIRMS, NHC, ...)
  services/             data clients (nasaPower, gdelt, indicators, earthHistory, newsAPI, ...)
  core/ globe-core/     event schema, layers, markers, entity resolution, view models
  earth-history/        Earth History app (components, store, time math)
  store/ hooks/ workers/
supabase/               migrations (profiles, watchlists, ontology, ingest schedule) + send-alert function
scripts/                GeoJSON, icon, hazard model, Earth History, and trend demo build scripts
templates/reports/      Handlebars report templates
public/                 GeoJSON, audio, trend demos, and other static assets
```

## Deploy on Vercel

1. **Import the repo** in Vercel with the root directory set to `/`. [`vercel.json`](vercel.json) sets the Vite framework, `npm run build`, the `dist/` output, function timeouts, and the SPA rewrite to `index.html`.
2. **Add environment variables** under Settings → Environment Variables (`VITE_*` and the server-only keys you need). Redeploy after any change.
3. Or **deploy from the CLI**: `npx vercel login`, `npx vercel link`, then `npm run deploy:preview` or `npm run deploy`.

Notes:
- New API routes go in `api/_lib/routes/<name>.js`. Register each one in both `api/[...path].js` and `vite-plugin-atlas-api.js`.
- The MP3s in `public/audio` ship with the static build, so keep an eye on deploy size.

## GDELT BigQuery backend

Historical GDELT analytics (country stability, theme timelines, actor networks, Visual GKG, TV AI, and more) go through `/api/gdelt-query`. This route reads `GOOGLE_CLOUD_CREDENTIALS` (the service-account JSON as a single line) and `GOOGLE_CLOUD_PROJECT`. Set both in Vercel for production and in `.env.local` for local dev.

Cost controls:
- `ATLAS_MAX_SCAN_BYTES` (default 500 MB) rejects any query whose `dryRun` estimate exceeds the limit.
- The named SQL templates in [`api/_lib/queryTemplates.js`](api/_lib/queryTemplates.js) are all `_PARTITIONTIME`-bounded and capped with `LIMIT @limit`.
- [`api/_lib/rateLimiter.js`](api/_lib/rateLimiter.js) caps each IP at 30 requests per minute.

## Scheduled ingestion

`POST /api/ingest?source=<id>` runs one source adapter end to end and persists the results as resolved ontology objects in Supabase. Requests must send `Authorization: Bearer $INGEST_SECRET`.

Two schedulers drive it:
- **pg_cron**, set up in [`supabase/migrations/009_ingest_schedule.sql`](supabase/migrations/009_ingest_schedule.sql).
- A **GitHub Actions fallback**, in [`.github/workflows/ingest.yml`](.github/workflows/ingest.yml). It runs every 15 minutes and needs the `ATLAS_INGEST_BASE_URL` and `ATLAS_INGEST_SECRET` repo secrets.

## Debug overlay

To toggle the dev-only **Fetch Status Overlay**, append `?debug=1` to any URL or set `localStorage.atlasDebug = '1'`. The overlay shows each source's live status, its event counts, and any partial-failure warnings.

## Credits

Climate data: NASA Prediction Of Worldwide Energy Resources ([POWER](https://power.larc.nasa.gov/)) Project, NASA Langley Research Center. Third-party data and asset licenses are listed in [`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md) and [`docs/SOURCES.md`](docs/SOURCES.md).
