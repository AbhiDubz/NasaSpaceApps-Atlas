# ATLAS — Vision, Gap Analysis & Bridge Plan

> _"A live view of what's going on in the world realtime. The power of information in the palm of the user's hands."_

This document audits ATLAS in its current state, names the gaps between today's build and that vision, and lays out a concrete, code-grounded path to close them.

---

## 1. The Vision, Translated Honestly

The aspirational statement above contains three implicit promises:

1. **Liveness** — the user sees what is happening _now_, not yesterday's archive.
2. **Breadth** — every meaningful domain of human activity is on one canvas (news, geopolitics, economics, weather, military, satellite, imagery).
3. **Truth-seeking** — the user is given tools to corroborate, contextualize, and analyze, not just consume.

None of these is fully attainable with public APIs alone. The honest, achievable restatement is:

> _"A continuously refreshed, multi-domain map of the world's open signals — with corroboration tools that bring the user as close to ground truth as public data permits."_

The rest of this document is about how we close the distance between today's build and that achievable statement.

---

## 2. Where ATLAS Is Today

### 2.1 Source Inventory (what actually ships data to the globe)

From [`atlas/src/workers/fetchManager.worker.js`](atlas/src/workers/fetchManager.worker.js) (`SOURCE_CONFIGS`):

| Domain | Source(s) | Poll | Status |
|---|---|---|---|
| News & geopolitics | GDELT DOC ArtList (8 query legs), GDELT CAMEO 15-min CSV, GDELT VGKG | 5 / 15 / 30 min | Active |
| News (commercial) | NewsAPI, GNews, TheNewsAPI, YouTube | on-demand | Dock feed only, never plotted on globe |
| Natural disasters | USGS earthquakes, GDACS, NASA EONET, NASA FIRMS active fires | 2 / 5 / 10 min | Active |
| Space weather | NOAA Kp index, NOAA GOES X-ray, NOAA solar wind | 5 min | Active |
| Conflict | UCDP, ACLED (keyed) | 5–10 min | Active (ACLED requires key) |
| Health | WHO, ProMED, ReliefWeb | 15–30 min | Active |
| Economic | CoinGecko, Alt.me F&G, Finnhub, FRED VIX, EIA petroleum | 5 min – 1 hr | Active |
| Cyber | CISA KEV, Cloudflare Radar, AbuseIPDB, Shodan | 5–10 min | Some keyed |
| Energy/grid | Electricity Maps, ENTSO-E | 15 min | Keyed |
| Legal | LOC foreign-news RSS | 1 hr | Active |
| Weather | Open-Meteo (15 fixed city anchors) | 10 min | Active but sparse |

### 2.2 Globe Display Capabilities

Only **GDELT, EONET, and FIRMS** are eligible to render as globe pins per [`atlas/src/core/globeLayers.js`](atlas/src/core/globeLayers.js#L37). Everything else surfaces in the dock feed, alerts panel, or analytics HUD.

Visual grammar (from [`atlas/src/components/Globe/GoogleGlobe.jsx`](atlas/src/components/Globe/GoogleGlobe.jsx)):

- `Marker3D` sprites on Google Map3D, sized by severity, colored by dimension.
- Convex-hull cluster polygons when >= 5 events fall within 200 km.
- Optional GEO heatmap and country-tone choropleth overlays (off by default).
- Hard cap of **2,500 markers** on screen at once, ranked by recency × severity × priority.

### 2.3 Analysis Tools Present

- GDELT Analytics panel ([`GDELTAnalyticsPanel.jsx`](atlas/src/components/UI/GDELTAnalyticsPanel.jsx)) with Trends / TV / Context / Historical / Imagery / Network / Themes tabs, backed partly by REST and partly by BigQuery via [`/api/gdelt-query`](atlas/api/gdelt-query.js).
- Event panel, news card, alert rules, dimension/priority filters, time-window filter (Live / 24h / 7d / 30d).
- Street View overlay on event locations.
- Causal-thread, force-network graph, theme explorer for correlation work.

### 2.4 Honest Assessment of "Live"

- "Live" = a rolling **2-hour window**, not real time ([`TIME_FILTER_MAX_AGE_MS.live`](atlas/src/components/Globe/GoogleGlobe.jsx#L58)).
- Most globe pins are **country centroids**, not real coordinates — only CAMEO rows have true lat/lng.
- The 24h / 7d / 30d filters expand the age window over **whatever happens to be in memory**, not a historical pull. A fresh session in 7d mode still only shows what arrived in the last few minutes.

---

## 3. The Gap, Pillar by Pillar

### 3.1 News & Geopolitics — _Have, but shallow_

**Current:** GDELT firehose (capped at 5,000 CAMEO rows / 15 min, 8 × 250 DOC articles / 5 min). Three commercial news APIs in the dock.

**Gap:**
- No real-time wire-service ingestion (Reuters, AP, AFP) — those are paywalled but partner deals exist.
- Commercial news isn't geolocated, so it doesn't reach the globe.
- No multi-language coverage beyond what GDELT's own translation handles.

### 3.2 Macro/Micro Economics — _Surface-only_

**Current:** Crypto prices, VIX, oil spot, currency rates, fear & greed.

**Gap:**
- No equity-market breadth, sector flows, or live tick data.
- No commodity futures beyond petroleum.
- No supply-chain signals (Baltic Dry Index, Suez/Panama transit counts, port congestion).
- No central-bank rate calendar overlay, no live macroeconomic announcement feed.
- No company-level signals (earnings, SEC 8-K filings, insider trades).

### 3.3 Weather / Natural Events — _Partial_

**Current:** 15-city Open-Meteo snapshots, EONET, FIRMS fires, USGS quakes, GDACS, NOAA space weather.

**Gap:**
- No global wind / cloud / precipitation animated layers (WeatherLayers, Mapbox WebGL-wind, NASA GIBS WMS are listed in [`RESOURCES.md`](./RESOURCES.md) but not wired).
- No hurricane / typhoon track overlays (NOAA NHC, JMA RSMC).
- No flood forecast (GloFAS) or drought index (NOAA CPC).
- No air-quality (OpenAQ, NASA TEMPO) or radiation (Safecast — currently dock only).

### 3.4 Military Operations — _Largely missing_

**Current:** UCDP and ACLED give post-hoc conflict event data with a lag of days to weeks.

**Gap:**
- No live ADS-B / military aircraft tracking (ADS-B Exchange has free tier; OpenSky Network is fully open).
- No AIS ship tracking (AISStream.io, MarineTraffic free tier).
- No satellite-detected military signals (Sentinel-1 SAR for ship/vehicle detection — heavy lift but doable).
- No nuclear-test seismology overlay (USGS or CTBTO data).
- The static `NUCLEAR_FACILITIES` list in [`globeLayers.js`](atlas/src/core/globeLayers.js#L1) is hard-coded reference data, not a live layer.

### 3.5 Satellite Imagery (Open Source) — _Resources listed, none integrated_

**Current:** None on the globe. [`RESOURCES.md`](./RESOURCES.md) lists NASA GIBS, Worldview, Earthdata, but they are not wired to any layer.

**Gap:**
- No NASA GIBS WMS imagery overlay (true-color, fires, snow, dust — 1000+ layers, free, near-real-time).
- No Sentinel-2 recent-pass imagery (Copernicus, free, 5-day revisit).
- No Sentinel Hub on-demand tiles for AOIs.
- No Planet Labs / SkyFi commercial tiles (those cost money but matter for the vision).

### 3.6 Public CCTV / Cameras — _Missing entirely_

**Gap:**
- No traffic-cam ingest (511 systems in most US states, EU equivalents, Insecam aggregator with legal caveats).
- No public webcam feeds (Earthcam, Skyline Webcams have embeddable players).
- No buoy / weather-station live cams (USGS, NOAA buoys).
- No livestream search index (YouTube Live geolocated, Twitch IRL geo).
- Privacy / legality of unauthenticated CCTV needs careful curation — the "public" in "public CCTV" matters.

### 3.7 Truth-Seeking & Corroboration — _Half-built_

**Current:** GDELT Analytics panel does volume / tone / source-country / theme / network. Causal thread and force network exist. Event detail panel shows priority and corroboration counts.

**Gap:**
- No cross-source corroboration scoring (right now `corroborationCount` is per-event GDELT mentions, not _across_ feeds).
- No claim-extraction or fact-check overlay (Google Fact Check Tools API, ClaimReview schema, Snopes / PolitiFact RSS).
- No social-media reach view (Bluesky firehose, Mastodon federated feed, Telegram public channel search).
- No "what changed in the last X minutes" summarizer — currently the user must spot trends manually.
- No persistent event timelines (you can't follow Hurricane X over 5 days as a single thread).

### 3.8 User Power Features — _Mixed_

**Have:** Search, dimension filters, priority filter, time filter, alerts.

**Missing:**
- Saved views / saved searches.
- Shareable URLs that reproduce a globe state.
- Watchlists for places, entities, or topics.
- Push notifications (browser / mobile).
- Export to brief / report.
- API access for power users.

---

## 4. The Bridge Plan — What To Build

The plan below is sequenced by impact-per-effort, not by domain. Each phase is shippable on its own and listed sources are all in [`RESOURCES.md`](./RESOURCES.md) or are well-known free/keyed APIs.

### Phase 1 — Fix what's already promised (4–6 weeks)

These are existing layers that under-deliver and would close the credibility gap with users.

1. **De-approximate GDELT pins.** Today DOC articles fall on country centroids (`60.000° N, 95.000° W` for Canada). Options:
   - Promote CAMEO from supplemental to primary; cap raised to 20k–50k rows.
   - Run an in-worker geoparser (compromise.cloud, geonamescache) over article titles to extract a city/region before falling back to country centroid.
   - Tag every approximated pin with a visible "approx" cue so users trust the precise ones.
2. **Wire GDELT GEO PointData back on.** Currently disabled in [`SOURCE_CONFIGS`](atlas/src/workers/fetchManager.worker.js#L1040) because of 404s. Verify upstream, re-enable, throttle via the existing 5.5s gate. This is the only DOC-equivalent source with real coordinates.
3. **Fix the empty Analytics panel.** Test queries with sparse results (the "Blue Jays Birthdays" case) should render an empty state with a one-line explanation, not silent blank tabs. Surface the `errors` array from [`fetchGdeltAnalyticsBundle`](atlas/src/services/gdelt/analyticsService.js#L123).
4. **Honest time controls.** Either expand `live` to mean the actual data-in-memory window with a tooltip, or backfill recent history (e.g. pull last 24h of CAMEO on session start so 24h mode is real on first paint).
5. **Cross-source corroboration.** Build a deduplication-and-merge pass after all normalizers run: events within N km and similar titles get merged with a `corroborationSources: ['gdelt', 'reliefweb', 'ucdp']` array, surfaced in the event card.

### Phase 2 — Visual basemap upgrades (3–4 weeks)

These are texture/tile layers that don't need new ingestion infra — just renderer wiring.

1. **NASA GIBS imagery overlay** (true-color, MODIS fires, dust, snow, atmospheric). Free WMS / WMTS, no key. Drop into Map3D as a tile overlay with a layer toggle.
2. **Animated wind/clouds.** Add WeatherLayers WebGL or Mapbox WebGL-wind. Both render on top of the existing globe without disturbing pin logic. Visual liveness for nearly zero cognitive cost.
3. **Day/night terminator** + city lights at night (NASA Black Marble) for context.
4. **Sentinel-2 cloud-free recent imagery** for any AOI the user clicks. Copernicus is free; tile load is on-demand.

### Phase 3 — Real-time motion layers (6–8 weeks)

These bring kinetic energy to the globe and most directly serve the "live view" vision.

1. **ADS-B aircraft tracking** via OpenSky Network (free, ~10s latency). 8,000+ flights live. Sub-layer for military-flagged aircraft (ICAO-allocated ranges).
2. **AIS ship tracking** via AISStream.io (free WebSocket, free-tier filterable). 50k+ vessels live.
3. **Storm tracks** — NOAA NHC active storms, JMA RSMC tropical cyclones. Animated cone-of-error polygons.
4. **Earthquake aftershock animation.** Already have USGS data; animate magnitude over time instead of just plotting current events.

### Phase 4 — Economic & supply-chain depth (4–6 weeks)

1. **Equity / commodity tick data** via Finnhub upgrade or Polygon.io free tier (limited).
2. **Port congestion** via UN/CTAD or MarineTraffic port-call counts.
3. **Suez / Panama / Bab-el-Mandeb chokepoint transit counters** (computed from AIS).
4. **Central bank calendar** + macro announcement feed (TradingEconomics, Investing.com RSS, ForexFactory).
5. **SEC EDGAR live filings** for company-level economic signals.

### Phase 5 — Truth-seeking tooling (6–10 weeks)

This is the hardest pillar and the one that distinguishes ATLAS from a globe-shaped news ticker.

1. **Claim extraction.** Run an LLM (or local model via WebLLM) over incoming high-priority events to extract specific claims and entities. Store as structured records.
2. **Fact-check overlay.** Pull ClaimReview-marked-up articles (Google Fact Check Tools API is free with a key); show a checkmark/X on events with matching claims.
3. **Reach / virality view.** Per-event social signal via Bluesky firehose (free), Mastodon public timeline, and Telegram public-channel mentions.
4. **Source diversity score.** Already have `sourcecountry` per GDELT article — surface an event-level diversity index (Shannon entropy across country/language/political-leaning).
5. **Disagreement detection.** When tone diverges sharply across sources for the same event, flag it. The data is already in GDELT's tone field; the UI surfacing is missing.
6. **Event timelines.** Auto-thread events that share entities and locations across days/weeks. Hurricane X, Conflict Y, Election Z each become a navigable narrative.

### Phase 6 — Imagery & observation (8–12 weeks, partly stretch)

1. **Public webcam directory** (Earthcam, Skyline). Curated list, embedded video player on event click.
2. **Traffic-cam overlay** for major cities. 511 APIs for US states, similar EU/UK feeds.
3. **YouTube Live geolocated discovery.** Search live videos by location, surface as a click-through layer.
4. **Sentinel-1 SAR change detection** for high-priority AOIs (military mobilization, port activity, deforestation). Heavy lift, needs server-side processing pipeline.
5. **Planet Labs / SkyFi integration** behind a paid tier — true daily-revisit imagery is the only thing that makes "satellite imagery on demand" real.

### Phase 7 — Power-user platform (rolling)

1. **Saved views, watchlists, shareable URLs** (encode globe state in URL params, persist in Supabase).
2. **Browser push notifications** for watchlist hits (using the existing alert engine).
3. **Brief export** — PDF / Markdown snapshot of the current view + active events.
4. **Public read-only API** — what ATLAS sees, exposed.
5. **Mobile-responsive layout** — currently desktop-first; the "palm of the user's hands" line requires real mobile UX.

---

## 5. What Cannot Realistically Ship

Be honest about constraints so the vision statement doesn't oversell:

| Promise | Constraint | Adjusted reality |
|---|---|---|
| "Realtime" | Polling intervals 2–30 min on free APIs; WebSocket only on ADS-B/AIS/Bluesky | "Continuously refreshed" — 1–5 min for most signals |
| "Public CCTV" | Most are restricted, geoblocked, or hotlink-protected | "Curated public webcams + traffic cams in supported cities" |
| "Military operations" | True OPSEC data is not public | "Open-source military indicators (ADS-B, AIS, OSINT events from ACLED/UCDP)" |
| "Satellite imagery" | Sub-meter daily-revisit is paid; free imagery is 5–30 m and 1–5 day revisit | "Free Sentinel/Landsat/GIBS imagery; commercial tiles behind a tier" |
| "Truth" | No system reaches ground truth on contested events | "Multi-source corroboration, claim extraction, source diversity scoring" |

A revised public-facing statement that ATLAS can actually deliver against:

> _"ATLAS is a continuously refreshed map of the world's open signals — news, geopolitics, economics, weather, conflict, and earth observation — with tools to corroborate, contextualize, and follow events as they evolve."_

---

## 6. Hard Constraints to Plan Around

- **GDELT rate gate:** 5.5s minimum between any two REST calls ([`gdeltHttp.js`](atlas/src/services/gdelt/gdeltHttp.js#L26)). Every new analytics call competes with ingest.
- **GDELT DOC ceiling:** `maxrecords=250` is a hard API limit. The only way to get more is the CSV firehose or BigQuery.
- **BigQuery cost guard:** `ATLAS_MAX_SCAN_BYTES` defaults to 500 MB ([`README.md`](../README.md#L65)). Historical queries must stay within budget.
- **Browser memory:** 2,500-marker cap, 10k events max in store before ranking culls. Going beyond requires server-side rendering or vector tiles.
- **API keys:** Many high-value sources (FIRMS, ACLED, Finnhub, FRED, EIA, Cloudflare, AbuseIPDB, Shodan, ElectricityMap, ENTSO-E) require keys. Document setup loudly so deployments aren't silently degraded.
- **Free-tier quotas:** NewsAPI 100/day, GNews 100/day, TheNewsAPI 100/day. The fallback fan-out in [`newsAPI/fetcher.js`](atlas/src/services/newsAPI/fetcher.js) helps but tops out fast under real user load.
- **Legal:** Curated webcam lists must respect ToS and avoid privacy violations. AIS / ADS-B redistribution rules vary by jurisdiction.

---

## 7. Suggested First Sprint (concrete, two weeks)

If only one block of work happens next, the highest user-visible payoff is this:

1. Add a tooltip to the "Live" pill explaining it means "last 2 hours".
2. Render every approximated GDELT pin with a small `~` glyph in the news card so users see which coordinates are centroids.
3. Empty-state every analytics panel tab with a sentence explaining why it's empty.
4. Wire NASA GIBS true-color + active fires WMS as a basemap toggle.
5. Add OpenSky ADS-B as a new globe layer (separate sprite, separate toggle).

These five items hit credibility, breadth, and liveness in one sprint without touching the data model. They are the smallest bridge from today's globe to a globe that visibly does what the vision claims.

---

## 8. Open Questions for Product Direction

These are decisions a roadmap can't make on its own:

1. **Free vs. paid tier?** Several vision-critical sources (Planet imagery, paid news wires, commercial AIS) only work at scale with money. Is ATLAS positioning as fully-free, or freemium?
2. **Self-host vs. hosted backend?** Real-time WebSocket layers (ADS-B, AIS, Bluesky firehose) need a persistent server, not a Vercel function. Are we ready to run one?
3. **Curation vs. firehose?** Truth-seeking and noise reduction pull in opposite directions. Should the default view be filtered to "verified / high-corroboration" events, with firehose as opt-in?
4. **Editorial role?** A human curator picking lead stories changes ATLAS from a tool to a publication. Is that a direction we want?
5. **Mobile parity?** The "palm of the user's hands" line implies mobile-first. Current build is desktop-first. Aligning that is a significant lift.

---

---

## 9. Comparable Build: WorldView (Bilawal Sidhu) — Analysis & Adopted Patterns

In Feb 2026, ex-Google-Maps PM Bilawal Sidhu published [WorldView](https://www.youtube.com/watch?v=rXvU7bPJ8n4) — a "Google Earth meets Palantir" demo built in three days with AI coding agents. It went viral and Palantir's co-founder publicly weighed in. Watching the demo against ATLAS's current build is a useful triangulation point: WorldView and ATLAS share a stack but optimize for different things.

### 9.1 What WorldView Does (in 10 minutes of demo)

- Built on [Google Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile) (same tile API ATLAS already uses via Map3D).
- Three cinematic post-processing modes: **CRT, Night Vision, FLIR** — runtime shader effects on the whole globe with sensitivity and pixelation controls.
- **Camera presets per city** — keyboard shortcuts (Q/W/E/R/T) jump to landmarks, with OpenStreetMap 3D-volume centering so the camera frames the actual building, not naive lat/lng.
- **Live satellite tracking** — every satellite in orbit, click any one to render its orbital path. Sparse vs. full detection labels (NORAD IDs).
- **Live commercial flight tracking** via [OpenSky Network](https://opensky-network.org) — 6,700+ planes in real time. Click-to-track with persistent target HUD.
- **Military aircraft** via [ADS-B Exchange](https://adsbexchange.com) — military-flagged planes rendered in orange, filterable as a discrete layer.
- **Street traffic simulation** — particle system seeded from OpenStreetMap road network. Pure aesthetic; no real traffic data.
- **Real-time CCTV** — Austin Texas open traffic-cam feeds (1 frame/minute) projected onto 3D building geometry at the camera's actual position.
- **Seismic activity** tags across the globe (ATLAS already has this via USGS).
- **HUD detection mode** — sparse/dense target labels with reticles, IDs, and tracked-object overlays.

### 9.2 What This Validates About ATLAS

WorldView is a **single-developer 3-day demo**. The Palantir co-founder's specific critique was that it lacks "real proprietary data fusion." That is exactly where ATLAS has already invested:

| Capability | WorldView | ATLAS today |
|---|---|---|
| 3D globe basemap | Google 3D Tiles | Google Map3D (same tiles) |
| Source fan-out | ~6 live sources | ~25 sources with normalizers, dedup, corroboration |
| Truth-seeking tooling | None | GDELT Analytics panel, force network, themes, tone, BigQuery historical |
| News / geopolitics | None | GDELT firehose + 3 commercial APIs |
| Cinematic surveillance feel | Strong | Weak |
| Live aircraft / satellite layers | Strong | Missing (CelesTrak wired for conjunction events only) |
| Camera framing UX | Strong (POI presets) | Basic fly-to |

The honest read: **ATLAS has the data substrate WorldView lacks. WorldView has the surveillance aesthetic ATLAS lacks.** The gap is closeable in both directions, but ATLAS's gap is mostly UI polish on top of capabilities that already exist (or are one new layer away).

### 9.3 What's Worth Adopting (and What Isn't)

**Adopt — high value, low effort:**

1. **Live aircraft layer via OpenSky Network.** Free WebSocket-ish polling, ~10s latency, well-documented. This is already Phase 3 in the bridge plan — WorldView confirms it's achievable and visually transformative. Add as a new globe data layer (`adsb`) alongside `gdelt`/`eonet`/`firms` in [`globeLayers.js`](atlas/src/core/globeLayers.js#L37).
2. **Military aircraft sub-layer via ADS-B Exchange.** Their free tier requires a feeder contribution; their RapidAPI tier is paid. Treat as a keyed source like ACLED/FIRMS. Render military traffic in a distinct color so it reads as a discrete filter, not a tag.
3. **Live satellite orbit layer.** ATLAS already polls [CelesTrak](https://celestrak.org) (line 750 in [`fetchManager.worker.js`](atlas/src/workers/fetchManager.worker.js#L750)) but uses only the SOCRATES conjunction feed. Extend to pull general TLE catalogs (active satellites, ISS, Starlink, GPS, military-flagged via NORAD catalog), propagate orbits with `satellite.js`, and render dots + click-to-show-orbit. The polling already exists; the visualization is the only new code.
4. **Camera / landmark presets.** ATLAS already has search and fly-to. Add keyboard-shortcut POI presets per city (top-N landmarks from OSM Overpass API) with proper 3D-bounding-box centering instead of point-center. UX win that costs days, not weeks.
5. **Detection-mode HUD aesthetic.** Reticles, target IDs, sparse-vs-dense label modes. Fits ATLAS's intelligence-dashboard positioning more naturally than CRT filters do. Pure presentation work on top of existing markers — no new data needed.

**Adopt selectively — moderate value, moderate effort:**

6. **Cinematic shader modes (Night Vision, FLIR, CRT).** Pure post-processing — Three.js / WebGL shaders applied to the rendered globe. Risk: gimmicky if overdone. Recommendation: add ONE mode that fits ATLAS's existing dark UI (a subtle "Tactical" mode with desaturation + grain + green tint), make it a settings toggle, not a primary feature. Skip the CRT/scanline kitsch.
7. **AI-agent build velocity.** Sidhu used parallel Claude / Gemini / Codex agents across multiple terminals. ATLAS's bridge plan has many independent phases — running them as parallel agentic workstreams (one per data layer) is realistic given the existing modular `SOURCE_CONFIGS` + `NORMALIZERS` pattern in the worker.

**Skip — low intelligence value, high risk:**

8. **Street traffic particle simulation.** Zero data value — it's fake traffic seeded from road geometry. ATLAS's positioning is "real signals," not "looks like a movie." If we want the visual energy, real AIS ship tracks (Phase 3) deliver kinetic motion AND real intelligence.
9. **CCTV projected onto 3D geometry.** Genuinely cool, but: (a) requires per-camera homography calibration; (b) free public-cam coverage outside major US cities is sparse; (c) WorldView's own version updates at 1 frame/minute, not real-time. Lower-risk alternative: embed CCTV as a flat video element in the event panel when the user clicks a camera marker, no projection. Earthcam and Skyline have embeddable players.

### 9.4 Integration into the Bridge Plan

| WorldView pattern | Insert into |
|---|---|
| OpenSky aircraft layer | Phase 3.1 (already listed — confirmed scope) |
| ADS-B Exchange military sub-layer | Phase 3.1 (already listed — keyed source) |
| Live satellite orbits | **NEW Phase 3.5** — leverages existing CelesTrak poll |
| Camera / landmark presets | Phase 7 power-user platform (move up — small lift) |
| Detection-mode HUD aesthetic | **NEW Phase 2.5** — UI polish atop existing markers |
| Tactical shader mode | Phase 2 visual basemap upgrades (single mode, not full suite) |
| Parallel AI-agent execution | Engineering practice — not a feature, but adopt for the roadmap |

### 9.5 Revised First Sprint (informed by WorldView)

Replacing the original Section 7 sprint with a sharpened five-item list that hits both credibility AND surveillance feel in two weeks:

1. **OpenSky live aircraft layer** — single new entry in `SOURCE_CONFIGS`, new normalizer, new globe data layer key. 8K markers, sprite per aircraft, click-to-track.
2. **Satellite catalog overlay** — extend the CelesTrak poll to pull active-satellite TLE, propagate with `satellite.js`, render as small dots with click-to-show-orbit.
3. **Landmark presets** — top-10 POIs per major city via OSM Overpass, keyboard shortcuts, 3D-bounding-box camera framing.
4. **Tactical mode toggle** — single shader (desaturate + grain + subtle green) as a Settings option. No CRT, no FLIR, no scanlines.
5. **Empty-state every analytics tab** (carried over from original sprint) — credibility fix that costs hours.

This delivers visible aircraft, visible satellites, polished camera UX, and a surveillance aesthetic — closing the WorldView visual gap without abandoning ATLAS's data-fusion advantage.

### 9.6 Strategic Read

The strategic question WorldView raises is positioning, not technology. WorldView is a **3-day demo that looks like Palantir**. ATLAS is a **multi-month build that does the unglamorous fusion work Palantir actually gets paid for**. The risk is that ATLAS keeps building substance while WorldView clones absorb mindshare with surface polish. The mitigation is cheap: borrow the 20% of WorldView's UI that signals "intelligence platform" (HUD, aircraft, satellites, landmark framing) and keep investing in the corroboration / truth-seeking layer where the durable defensibility lives.

---

_Last updated: 2026-05-21. Maintained alongside [`../README.md`](../README.md) (deploy) and [`RESOURCES.md`](./RESOURCES.md) (source index)._
