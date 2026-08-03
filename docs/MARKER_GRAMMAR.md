# Marker Archetype Visual Grammar

Five archetypes encode **what kind of map object** the user is looking at. This is orthogonal to dimension color and hazard shape (which encode **what domain**).

See also: [SOURCE_GEOLOCATION_REFERENCE.md](./SOURCE_GEOLOCATION_REFERENCE.md)

## Archetypes

| Archetype | Globe representation | Size | Opacity | Animation | Click |
|-----------|---------------------|------|---------|-----------|-------|
| **pin** | Filled hazard/dimension icon | `SEVERITY_SIZES` | Corroboration + authoritative floor | Recency pulse (top-N) + hazard L0 CSS | Inspector; Street View if precise |
| **track** | Directional sprite | Fixed per subtype | 1.0 | Position refresh; storms may use 3D model | Track HUD; no Street View |
| **field** | Surface overlay | N/A | 0.15–0.45 | Wind drift / static | Aggregate tooltip |
| **reference** | Hollow ring + glyph | 12px | 0.45 static | None | Reference card |
| **derived** | Amber diamond badge | 24px | Confidence tone | 2.4s breathe | Synthesis panel |

## Environment visual channel (LOD)

Environment pins/storms gain a **visual channel** orthogonal to archetype:

| Channel | When | Renderer |
|---------|------|----------|
| **sprite** (L0) | Far camera, quality `low`, mobile, reduced motion, over model budget, or severity &lt; 2 | Animated 2D hazard PNG (`atlas-hazard--*` CSS) on Marker3D / Globe.GL HTML / FlatMap circles |
| **model** (L1) | Quality medium/high (not mobile / reduced-motion); up to 48 models | Google Map3D `gmp-model-3d-interactive` with **camera-range-adaptive scale** + rAF spin/pulse |
| **hero** (L2) | Top wildfire / cyclone-family sites on Globe.GL only | `HazardHeroOverlay` canvas accents (capped at 5) |

### Modules

- `src/core/environmentHazardEffects.js` — per-hazard motion + `modelId` profiles
- `src/core/hazardModelCatalog.js` — `/models/hazards/*.glb` URLs + preload
- `src/core/hazardVisualLod.js` — LOD + model budget
- `src/hooks/useHazardModelAnimator.js` — Map3D orientation/scale rAF
- `src/components/Globe/Model3D.jsx` — web-component wrapper
- `src/components/Globe/HazardHeroOverlay.jsx` — Globe.GL L2

### 3D asset pack

| Piece | Source |
|-------|--------|
| Hazard ↔ emoji map | Twemoji shortnames ([jdecked/twemoji](https://github.com/jdecked/twemoji), CC-BY 4.0) |
| GLB pipeline | Inspired by [3d-emoji-assets-generator](https://github.com/wangyz1999/3d-emoji-assets-generator) (MIT) — pin mesh + Three.js GLTFExporter |
| Artifacts | `public/models/hazards/*.glb` + `ATTRIBUTION.txt` |
| Regenerate | `npm run hazards:glb` (see `scripts/hazard-glb/`) |

Map3D does not play glTF animation clips; live spin/pulse is applied in ATLAS via `useHazardModelAnimator`.

## Code modules

- `src/core/markerArchetype.js` — classify, behavior flags, truth labels
- `src/core/archetypeIcons.js` — canvas frames (reference / derived)
- `src/core/referenceCatalog.js` — nuclear + chokepoint VMs
- `src/globe-core/derivedMarkers.js` — anomaly → derived VMs
- `src/globe-core/viewModels.js` — unified VM pipeline (`hazardEffect`, `modelUrl` on env pins/storms)

## Layer toggles

| Key | Default | Catalog kind |
|-----|---------|--------------|
| `referenceNuclear` | off | reference |
| `referenceChokepoints` | off | reference |
| `derivedSignals` | off | derived |

## Design sync

UI polish specs live in `.stitch/DESIGN.md` and HTML references under `.stitch/designs/`. Regenerate via Google Stitch MCP when gcloud is configured.

## Extension guide

1. Add catalog entry in `layerCatalog.js` with appropriate `kind`
2. Extend `classifyMarkerArchetype()` if new entity shape
3. Add icon frame in `archetypeIcons.js` if new visual frame needed
4. Wire VM builder + renderer filter (`isSpriteArchetype` / `isTrackArchetype`)
5. Bump `CACHE_VERSION` in `markerIconCache.js` when icon geometry changes
6. For a new environment hazard 3D look: add profile in `environmentHazardEffects.js`, add Twemoji mapping + color in `scripts/hazard-glb/`, run `npm run hazards:glb`

## Icon pack (hazards / tracks / reference)

Globe glyphs are curated from Lucide/MDI via Iconify and baked into canvas PNG data URLs.

| Step | Command / path |
|------|----------------|
| Manifest | `scripts/atlas-marker-icons.txt` |
| Pull | `npm run icons:pull` |
| Normalize | `npm run icons:build` → `src/assets/markers/*.svg` + `glyphCatalog.js` |
| Draw | `markerGlyphDraw.js` → hazard / reference / tactical sprites |

**Scope:** environment hazards, tactical tracks (aircraft/vessel/satellite), and reference markers (nuclear/chokepoint). Non-environment event pins stay the unlabeled blue signal disc — do not add per-dimension globe glyphs without a grammar change.

Brand framing (border shapes, signal disc, hollow ring, amber diamond) remains ATLAS-owned canvas code; only the inner monochrome glyph comes from the pack.
