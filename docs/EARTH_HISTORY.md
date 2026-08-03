# Earth History (ATLAS ecosystem)

Deep-time paleogeography explorer — a **sibling product** to live ATLAS OSINT, not an OSINT layer.

## Route

- URL: `/earth-history`
- Entry: Landing footer → **Earth History**
- Isolation: does **not** mount `useNewsData`, fetchManager, or workspace HUD

## MVP scope

- Piecewise deep-time slider (Earth birth → present)
- Editable start/end range + presets
- Precomputed paleogeography keyframes on Globe.GL (**2048×1024** desktop / **1024×512** mobile)
- ICS-inspired era context panel
- URL sync: `t`, `t0`/`t1`, `cam`, Holocene `year`

## Assets

| Path | Role |
|------|------|
| `public/geo/earth-history/manifest.json` | Frame list + citations |
| `public/geo/earth-history/eras.json` | Blurbs |
| `public/geo/earth-history/textures/` | Equirectangular PNGs (CAO2024 ≤1800 Ma) |
| `public/geo/earth-history/coastlines/` | Self-hosted coastline GeoJSON + `index.json` |
| `public/geo/earth-history/polities/` | Cliopatria year slices (CC BY 4.0) + `index.json` |
| `scripts/earth-history/bake-paleomaps.md` | Bake pipeline docs |
| `scripts/earth-history/bake-gplates-textures.mjs` | GWS → texture bake |
| `scripts/earth-history/upsample-textures.mjs` | Local 2048 upsample when GWS flaky |
| `scripts/earth-history/bake-coastlines.mjs` | GWS → coastline CDN bake |
| `scripts/earth-history/bake-cliopatria-polities.mjs` | Cliopatria → Holocene polity slices |

**Textures ≤1800 Ma** are CAO2024 coastline reconstructions via GWS. **Precambrian frames older than 1800 Ma** remain illustrative placeholders (outside model span). Near present (`≤0.05 Ma`), the globe uses a modern Blue Marble basemap + topology bump.

## Code

```
src/earth-history/          # UI + store + time math
src/services/earthHistory/  # manifest / texture cache / coastlines / PBDB / polities
```

## Tests

```bash
npm run test:earth-history
```

## Bake

```bash
npm run earth-history:bake
npm run earth-history:bake-polities   # Cliopatria download + year slices
# or
npm run earth-history:bake-all
```

## Phase 2+

Shipped:

- Timeline event markers (extinctions, life, geology, civilization milestones)
- Event detail in the geological context panel (near playhead + pin on click)
- Play / pause autoplay at constant slider-space speed
- Soft texture crossfade on frame change
- **GWS paleocoastline overlay** (`CAO2024`, ≤1800 Ma) — debounced; **local bake preferred**
- **Chaptered narrative tours** (Big Five, Path to humanity, Deep life)
- Layer toggles: Events / Coastlines / **Life** / **Geology** / **Civ** / **Quaternary**
- **PBDB life overlay** — fossil occurrences with paleocoordinates when available (≤540 Ma)
- Life taxon filters + genera diversity sparkline (`occs/quickdiv`)
- IndexedDB response cache for GWS coastlines + PBDB + Macrostrat + Neotoma payloads
- **CAO2024 keyframe texture bake** (26 milestones; Precambrian illustrative; 2048×1024)
- **Self-hosted coastline CDN** under `public/geo/earth-history/coastlines/`
- **Macrostrat geology** — stratigraphic columns overlapping playhead age (≤2500 Ma)
- **Civilization GIS** — curated ancient places (Pleiades-inspired denser spine) + **Cliopatria polity polygons** (Holocene ≤12 ka)
- Polity labels + click details; Holocene calendar-year playhead / era bands / `year=` URL
- **Neotoma Quaternary** — paleoecology sites (≤5.2 Ma) with offline sample fallback

### GWS notes

- Endpoint: `https://gws.gplates.org/reconstruct/coastlines/?time={Ma}&model=CAO2024`
- Local first: `/geo/earth-history/coastlines/index.json` → nearest baked age
- Live GWS only when local miss / index absent; never per drag frame
- Ages older than 1800 Ma show “unavailable” (model span); textures still scrub via local keyframes

### PBDB notes

- Endpoint: `https://paleobiodb.org/data1.2/occs/list.json`
- Windowed by `min_ma` / `max_ma` around playhead; `show=coords,paleoloc,class&pgm=gplates`
- Prefer `paleolat`/`paleolng`; fall back to modern lat/lng
- Cap ~220 points; debounce like coastlines; toggle via **Life** layer
- Taxon chips pass `base_name` (Chordata, Mollusca, Dinosauria, …)
- Diversity spark: `occs/quickdiv.json?count=genera` (cached in IndexedDB)

### Macrostrat notes

- Endpoint: `https://macrostrat.org/api/v2/columns?age={Ma}&format=geojson`
- Column polygons colored by dominant lithology class; cap ~180
- Toggle via **Geology**; unsupported beyond ~2500 Ma

### Civilization notes

- Curated place catalog in `src/earth-history/core/civilizationPlaces.js`
- Filtered by playhead occupation window (startYbp–endYbp); Holocene ≤12 ka
- **Cliopatria** polity polygons: self-hosted year slices under `public/geo/earth-history/polities/` (CC BY 4.0)
- Toggle via **Civ**; Chronas is UX reference only — no Chronas API dependency

### Neotoma notes

- Endpoint: `https://api.neotomadb.org/v2.0/data/sites?minage=&maxage=` (years BP)
- Quaternary focus ≤5.2 Ma; curated fallback sample if API times out
- Toggle via **Quaternary**
