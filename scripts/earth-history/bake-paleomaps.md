# Baking paleogeography keyframes for ATLAS Earth History

This document describes how to produce **scientific paleomap textures** and **offline coastline GeoJSON** from GPlates / EarthByte (via the public GPlates Web Service).

## Runtime policy

- The web app loads **static** frames from `public/geo/earth-history/` via `manifest.json`.
- Do **not** call GPlates Web Service on every slider tick for full-globe rasters.
- Coastlines prefer the self-hosted bake under `public/geo/earth-history/coastlines/` and fall back to live GWS only when needed.

## Recommended stack

| Tool | Role |
|------|------|
| [GPlates Web Service](https://gws.gplates.org/) | Bake-time raster + coastline export (no local pyGPlates required) |
| EarthByte **CAO2024** | Rotation + static polygons + coastlines (0–1800 Ma) |
| Optional: desktop GPlates / pyGPlates / Scotese PALEOMAP | Higher-fidelity painted rasters if you replace the GWS PNG bake |

Pin the exact model id and citation in `manifest.json` → `modelCitation` / `modelId`.

## Suggested age density (full bake)

| Interval | Step |
|----------|------|
| 4540 → 541 Ma | every 200 Ma |
| 541 → 66 Ma | every 20 Ma |
| 66 → 2.58 Ma | every 5 Ma |
| 2.58 → 0 Ma | every 0.5 Ma + Holocene keys + present |

Shipped pack: **26 milestone frames** (`scripts/earth-history/ages.mjs`). Ages **≤1800 Ma** are CAO2024 scientific bakes; **>1800 Ma** stay illustrative Precambrian placeholders (model span).

## Export settings (texture bake)

- Projection: equirectangular (plate carrée), 360° × 180°
- Resolution: **2048×1024** desktop / **1024×512** mobile (bilinear resample + latitude shading)
- Format: PNG
- Naming: `ma-{age}.png` / `ma-{age}-m.png` (match manifest paths)
- Source endpoint: `reconstruct/coastlines/?fmt=png&model=CAO2024` (continental outlines; avoids filling oceanic plates)

## Bake commands

Scientific textures + coastline CDN + manifest:

```bash
npm run earth-history:bake
```

Or stepwise:

```bash
npm run earth-history:bake-textures    # GWS static_polygons → textures/
npm run earth-history:bake-coastlines  # GWS coastlines → coastlines/
npm run earth-history:manifest         # rewrite manifest.json citations
```

Requires network access to `gws.gplates.org`. Scripts throttle requests (~900 ms) to be polite.

### Dev / illustrative-only (legacy)

```bash
npm run earth-history:textures
```

Procedural land/ocean blobs — **not** plate reconstructions. Prefer `earth-history:bake` for anything demoed as scientific.

## Coastline CDN layout

```
public/geo/earth-history/coastlines/
  index.json          # ages + paths + model citation
  ma-0.json
  ma-66.json
  …
```

Runtime: [`fetchPaleocoastlines.js`](../../src/services/earthHistory/fetchPaleocoastlines.js) loads `index.json`, picks the nearest baked age within tolerance, else falls back to live GWS + IndexedDB cache.

## License checklist

- [x] EarthByte / GPlates model license allows redistribution of derived rasters (cite Cao et al. 2024 / GWS)
- [ ] Scotese / PaleoAtlas license reviewed if you swap in painted PaleoAtlas frames
- [x] Citations written into `manifest.json` and `atlas/docs/EARTH_HISTORY.md`
- [x] Uncertainty notes for Precambrian frames (illustrative; no CAO2024 coverage)

## GPlates Web Service (live fallback)

- Docs: https://gwsdoc.gplates.org/
- Runtime: `src/services/earthHistory/fetchPaleocoastlines.js`
- Model pinned: **CAO2024** (0–1800 Ma)
- Use for coastlines at age `t` Ma when local bake misses — **not** as the scrubber raster backend
- Quantize + debounce in the client; cache ~14 ages in memory + IndexedDB
