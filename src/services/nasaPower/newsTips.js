/**
 * News as the "tip" — turn GDELT headlines into suggestions of which NASA
 * variable to test, and where.
 *
 * GDELT only suggests where to look. It is news data, not Earth science
 * data, and is never fed into the trend test.
 */

/** Headlines needed before a country's news counts as "heavy" on a theme. */
export const MIN_HEADLINES_FOR_TIP = 2

/**
 * Headline matcher. Latin-script terms need a letter boundary on both sides
 * (so "rain" does not fire on "Ukraine"); CJK terms match anywhere because
 * those scripts have no spaces between words.
 */
const terms = (latin, cjk) =>
  new RegExp(`(?<![\\p{L}])(?:${latin})(?![\\p{L}])${cjk ? `|${cjk}` : ''}`, 'iu')

/** @type {{ id: string, label: string, variables: string[], pattern: RegExp }[]} */
export const NEWS_THEMES = [
  {
    id: 'drought',
    label: 'drought',
    variables: ['GWETROOT', 'PRECTOTCORR'],
    pattern: terms(
      'droughts?|water shortages?|sequ[ií]as?|secas?|estiagem|s[ée]cheresses?|dürren?|trockenheit|siccità|kekeringan|kuraklık|засух[аиу]',
      '干旱|乾旱|旱情|旱灾|旱災|가뭄|干ばつ',
    ),
  },
  {
    id: 'flood',
    label: 'flooding',
    variables: ['PRECTOTCORR'],
    pattern: terms(
      'flood(?:s|ed|ing)?|flash floods?|inundaci[oó]n(?:es)?|inunda[cç][aã]o|inunda[cç][oõ]es|enchentes?|alagamentos?|inondations?|crues?|hochwasser|überschwemmung(?:en)?|alluvion[ei]|banjir|sel felaket\\p{L}*|наводнени[еяй]|паводк[аиов]*',
      '洪水|洪灾|洪災|水灾|水災|防洪|홍수|洪水被害',
    ),
  },
  {
    id: 'heat',
    label: 'heat waves',
    variables: ['T2M_MAX', 'T2M'],
    pattern: terms(
      'heat ?waves?|extreme heat|record heat|record[- ]high temperatures?|scorching|olas? de calor|ondas? de calor|calor extremo|canicules?|vagues? de chaleur|hitzewellen?|ondat[ae] di caldo|gelombang panas|sıcak dalgası|аномальн\\p{L}* жар\\p{L}*',
      '热浪|熱浪|高温|高溫|폭염|猛暑|熱波',
    ),
  },
  {
    id: 'snow',
    label: 'snow and water supply',
    variables: ['SNODP'],
    pattern: terms(
      'snow ?pack|snowfall|snowstorms?|blizzards?|snow drought|water supply|ski season|nevadas?|nevascas?|chutes? de neige|schneefall|schneemangel|nevicat[ae]|снегопад\\p{L}*',
      '降雪|暴雪|积雪|積雪|폭설|大雪',
    ),
  },
]

const isGdelt = (evt) => String(evt?.source || '').toLowerCase().includes('gdelt')

/** GDELT news events carry their outlet country as the last tag, e.g. ['news','gdelt','safety','US']. */
function countryCode(evt) {
  const tags = evt?.tags
  if (!Array.isArray(tags) || !tags.includes('news')) return null
  const last = tags[tags.length - 1]
  return typeof last === 'string' && /^[A-Z]{2,3}$/.test(last) ? last : null
}

/**
 * Group theme-matching headlines by country.
 * @returns {Map<string, { iso: string, lat: number, lng: number, themes: Map<string, string[]> }>}
 */
export function indexNewsThemes(events) {
  const byCountry = new Map()
  const seen = new Set()
  for (const evt of events || []) {
    if (!isGdelt(evt) || !evt.title) continue
    const iso = countryCode(evt)
    if (!iso) continue
    const key = `${iso}|${evt.title}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const theme of NEWS_THEMES) {
      if (!theme.pattern.test(evt.title)) continue
      let entry = byCountry.get(iso)
      if (!entry) {
        entry = { iso, lat: evt.lat, lng: evt.lng, themes: new Map() }
        byCountry.set(iso, entry)
      }
      const list = entry.themes.get(theme.id) || []
      list.push(evt.title)
      entry.themes.set(theme.id, list)
    }
  }
  return byCountry
}

/** One GDELT search that pulls recent weather-themed coverage mentioning a country. */
export function newsTipQuery(countryName) {
  const name = String(countryName || '').replace(/["()]/g, '').trim()
  if (!name) return null
  return `"${name}" (flood OR flooding OR drought OR "water shortage" OR "heat wave" OR heatwave OR snowfall OR snowpack)`
}

/**
 * Tips from a plain list of headlines about one country (e.g. search results),
 * merged with any tips already found in the live feed.
 */
export function tipsFromHeadlines(titles, base = [], min = MIN_HEADLINES_FOR_TIP) {
  const unique = [...new Set((titles || []).filter(Boolean))]
  const baseByTheme = new Map(base.map((t) => [t.theme, t]))
  const out = []
  for (const theme of NEWS_THEMES) {
    const hits = unique.filter((title) => theme.pattern.test(title))
    const prior = baseByTheme.get(theme.id)
    const count = Math.max(hits.length, prior?.count || 0)
    if (count < min) continue
    out.push({
      ...(prior || {}),
      theme: theme.id,
      label: theme.label,
      variables: theme.variables,
      count,
      headline: hits[0] || prior?.headline,
    })
  }
  return out
}

function toTips(entry, min) {
  if (!entry) return []
  return NEWS_THEMES.filter((t) => (entry.themes.get(t.id)?.length || 0) >= min).map((t) => ({
    iso: entry.iso,
    lat: entry.lat,
    lng: entry.lng,
    theme: t.id,
    label: t.label,
    variables: t.variables,
    count: entry.themes.get(t.id).length,
    headline: entry.themes.get(t.id)[0],
  }))
}

/** Tips for the country a case is in. */
export function tipsForCountry(events, iso, min = MIN_HEADLINES_FOR_TIP) {
  if (!iso) return []
  return toTips(indexNewsThemes(events).get(String(iso).toUpperCase()), min)
}

/** The strongest tips anywhere, for the guided start (most headlines first). */
export function topNewsTips(events, limit = 3, min = MIN_HEADLINES_FOR_TIP) {
  const all = []
  for (const entry of indexNewsThemes(events).values()) {
    if (Number.isFinite(entry.lat) && Number.isFinite(entry.lng)) all.push(...toTips(entry, min))
  }
  return all.sort((a, b) => b.count - a.count).slice(0, limit)
}
