import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { PBDB_CITATION } from '../../services/earthHistory/fetchPbdbLife'

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function plotCoords(p) {
  const modernLat = Number(p.modernLat)
  const modernLng = Number(p.modernLng)
  if (Number.isFinite(modernLat) && Number.isFinite(modernLng)) {
    return { lat: modernLat, lng: modernLng, source: 'modern' }
  }
  return { lat: Number(p.lat), lng: Number(p.lng), source: p.paleo ? 'paleo' : 'plot' }
}

function uniqueLocalities(points) {
  const map = new Map()
  for (const p of points) {
    const key = p.collectionNo || p.id
    if (!key || map.has(key)) continue
    map.set(key, p)
  }
  return Array.from(map.values())
}

function localitiesCsv(points) {
  const rows = [
    `# ${PBDB_CITATION}`,
    'collection_no,name,lat,lng,coord_source,paleo_lat,paleo_lng,modern_lat,modern_lng,max_ma,min_ma,phylum',
  ]
  for (const p of uniqueLocalities(points)) {
    const c = plotCoords(p)
    rows.push(
      [
        p.collectionNo,
        p.name,
        c.lat,
        c.lng,
        c.source,
        p.paleoLat,
        p.paleoLng,
        p.modernLat,
        p.modernLng,
        p.maxMa,
        p.minMa,
        p.phylum,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return `${rows.join('\n')}\n`
}

function occurrencesCsv(points) {
  const rows = [
    `# ${PBDB_CITATION}`,
    'id,name,collection_no,lat,lng,coord_source,paleo_lat,paleo_lng,modern_lat,modern_lng,taxon_id,phylum,class,max_ma,min_ma',
  ]
  for (const p of points) {
    const c = plotCoords(p)
    rows.push(
      [
        p.id,
        p.name,
        p.collectionNo,
        c.lat,
        c.lng,
        c.source,
        p.paleoLat,
        p.paleoLng,
        p.modernLat,
        p.modernLng,
        p.taxonId,
        p.phylum,
        p.className,
        p.maxMa,
        p.minMa,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return `${rows.join('\n')}\n`
}

function toGeoJson(points) {
  const features = []
  for (const p of points) {
    const c = plotCoords(p)
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        id: p.id,
        name: p.name,
        collectionNo: p.collectionNo,
        taxonId: p.taxonId,
        phylum: p.phylum,
        className: p.className,
        paleoLat: p.paleoLat,
        paleoLng: p.paleoLng,
        modernLat: p.modernLat,
        modernLng: p.modernLng,
        coordSource: c.source,
        maxMa: p.maxMa,
        minMa: p.minMa,
      },
    })
  }
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      metadata: { citation: PBDB_CITATION, source: 'ATLAS Earth History' },
      features,
    },
    null,
    2,
  )
}

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toKml(points) {
  const placemarks = []
  for (const p of points) {
    const c = plotCoords(p)
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue
    placemarks.push(`  <Placemark>
    <name>${xmlEscape(p.name)}</name>
    <description>${xmlEscape(
      [p.collectionNo && `Collection ${p.collectionNo}`, p.phylum, PBDB_CITATION]
        .filter(Boolean)
        .join(' · '),
    )}</description>
    <ExtendedData>
      <Data name="paleoLat"><value>${xmlEscape(p.paleoLat)}</value></Data>
      <Data name="paleoLng"><value>${xmlEscape(p.paleoLng)}</value></Data>
    </ExtendedData>
    <Point><coordinates>${c.lng},${c.lat},0</coordinates></Point>
  </Placemark>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${PBDB_CITATION} -->
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>ATLAS Earth History life points</name>
  <description>${xmlEscape(PBDB_CITATION)}</description>
${placemarks.join('\n')}
</Document>
</kml>
`
}

export default function ExportMenu() {
  const showLife = useEarthHistoryStore((s) => s.layers.life)
  const lifePoints = useEarthHistoryStore((s) => s.lifePoints)
  const lifeStatus = useEarthHistoryStore((s) => s.lifeStatus)

  if (!showLife) return null

  const disabled = lifeStatus !== 'ready' || !lifePoints?.length
  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <div className="eh-export" role="group" aria-label="Export life points">
      <span className="eh-export__label">Export</span>
      <button
        type="button"
        className="eh-export__btn"
        disabled={disabled}
        onClick={() =>
          downloadBlob(`eh-localities-${stamp}.csv`, localitiesCsv(lifePoints), 'text/csv;charset=utf-8')
        }
      >
        Localities CSV
      </button>
      <button
        type="button"
        className="eh-export__btn"
        disabled={disabled}
        onClick={() =>
          downloadBlob(
            `eh-occurrences-${stamp}.csv`,
            occurrencesCsv(lifePoints),
            'text/csv;charset=utf-8',
          )
        }
      >
        Occurrences CSV
      </button>
      <button
        type="button"
        className="eh-export__btn"
        disabled={disabled}
        onClick={() =>
          downloadBlob(
            `eh-life-${stamp}.geojson`,
            toGeoJson(lifePoints),
            'application/geo+json;charset=utf-8',
          )
        }
      >
        GeoJSON
      </button>
      <button
        type="button"
        className="eh-export__btn"
        disabled={disabled}
        onClick={() =>
          downloadBlob(
            `eh-life-${stamp}.kml`,
            toKml(lifePoints),
            'application/vnd.google-earth.kml+xml;charset=utf-8',
          )
        }
      >
        KML
      </button>
    </div>
  )
}
