# Hazard GLB pack

Pin-shaped 3D markers for ATLAS Google Map3D (`gmp-model-3d`).

## Provenance

| Piece | Source |
|-------|--------|
| Hazard ↔ emoji map | [Twemoji](https://github.com/jdecked/twemoji) shortnames (CC-BY 4.0) |
| Approach | Inspired by [3d-emoji-assets-generator](https://github.com/wangyz1999/3d-emoji-assets-generator) (MIT) — pin base + Three.js GLB export |
| Generator | `generate.mjs` in this folder (family accent-colored pin meshes) |

L0 sprites continue to use ATLAS Lucide/Iconify hazard glyphs; GLBs provide the Map3D L1 channel.

## Regenerate

```bash
npm run hazards:glb
```

Outputs to `public/models/hazards/*.glb` plus `ATTRIBUTION.txt`.

## Mapping

See `manifest.json` for `modelId` ↔ Twemoji unicode. Hazard → `modelId` lives in `src/core/environmentHazardEffects.js`.
