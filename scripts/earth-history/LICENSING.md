# Earth History data licensing

This document records the license posture for every dataset used by ATLAS Earth History.
It is the gate for Phase 1 (PaleoDEM textures) and must stay current.

## Verified safe (redistribute with attribution)

| Source | License | Notes |
|--------|---------|-------|
| Macrostrat API | CC-BY 4.0 | Stated in API root (`/api/v2`). `/paleogeography` additionally requires citing Wright et al. 2013. **Fallback paleogeography path if PaleoDEM consent is refused.** |
| Cliopatria / Seshat | CC BY 4.0 | Attribution only, no share-alike. Already baked under `public/geo/earth-history/polities/`. |
| PhyloPic (via PBDB thumbs) | Public domain / CC | Silhouettes for taxon cards. |
| Nominatim / OSM | ODbL | Place search only. |
| Wikipedia REST | CC BY-SA | Displayed article text only — do not rebundle as our dataset. |
| Cao et al. 2024 via GWS (CAO2024) | Cite per EarthByte / Geoscience Frontiers | Coastline bake ≤1800 Ma. |

## Needs written confirmation / confirm before shipping derived rasters

### Scotese & Wright (2018) PaleoDEM numeric grids

- **Product:** Numeric elevation grids (lat/lon/elev), not the pre-rendered PaleoAtlas JPEGs.
- **Deposit:** Zenodo DOI [10.5281/zenodo.5460860](https://doi.org/10.5281/zenodo.5460860); EarthByte FTP ships `License.txt` stating **CC BY 4.0**.
- **Tension:** The 2010 notice at [scotese.com/license.htm](http://scotese.com/license.htm) prohibits commercial web-site use of PALEOMAP *map imagery* without written consent.
- **Our posture (pdmap-style):** Consume the **numeric grids**, render our own hypsometric ramp, attribute Scotese & Wright 2018. Do **not** ship Scotese's pre-colored PaleoAtlas images.
- **Action required:** Email `cscotese@gmail.com` (draft below) before shipping derived textures publicly.
- **Fallback if refused:** Macrostrat `/paleogeography` (CC-BY 4.0) + existing CAO2024 coastline bake.

### PBDB

- Service root (`/data1.2/`) does not state a license inline.
- Generally understood as **CC BY 4.0**; cite as Paleobiology Database.
- Confirm at [paleobiodb.org](https://paleobiodb.org/) / data policy before commercial redistribution of bulk dumps.
- Live API queries for display with citation in Sources panel are the intended use.

### Neotoma

- Data-use policy requires citing original data contributors, not only the aggregate database.
- Confirm at [neotomadb.org](https://www.neotomadb.org/) before expanding beyond our current site overlay.

### GPlates model data

- Licensed **per-model** via Zenodo DOIs.
- CAO2024 / MULLER2019: typically CC BY (EarthByte deposits) — verify DOI page.
- Bundled **PALEOMAP** model inherits Scotese restrictive terms — do not vendor those rasters.
- GWS *code* is GPL v2 (relevant only if modifying a self-hosted instance).

## Explicitly excluded

| Source | Why |
|--------|-----|
| Chronas data | CC BY-SA 4.0 would force share-alike onto our dataset |
| Euratlas | Proprietary; no third-party reproduction of vectors |
| GeaCron | All Rights Reserved |
| Scotese pre-rendered PaleoAtlas JPEGs | 2010 web-site prohibition without consent |

## Email draft — PaleoDEM web-app confirmation

```
To: cscotese@gmail.com
Subject: Permission to use Scotese & Wright (2018) PaleoDEM grids in ATLAS Earth History

Dear Dr. Scotese,

We are building ATLAS Earth History, an open educational / research globe for
deep-time paleogeography (non-classified, public-web).

We would like to use the Scotese & Wright (2018) PaleoDEM *numeric grids*
(Zenodo 10.5281/zenodo.5460860; EarthByte PaleoDEM resource), which ship with
a CC BY 4.0 License.txt, to generate our own hypsometric color and relief
textures (we will not redistribute your pre-rendered PaleoAtlas map images).

Please confirm that serving these derived textures in our web application is
acceptable under your terms, with citation:

  Scotese, C.R., and Wright, N., 2018. PALEOMAP Paleodigital Elevation Models
  (PaleoDEMS) for the Phanerozoic.
  https://doi.org/10.5281/zenodo.5460860

Thank you for the PaleoDEM resource and for clarifying.

Best regards,
```

## Runtime citation strings

Keep Sources disclosure in `EraContextPanel` in sync with whatever is actually loaded
(manifest `modelCitation`, Macrostrat, PBDB, Neotoma, Cliopatria, PaleoDEM when enabled).
