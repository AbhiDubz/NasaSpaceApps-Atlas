/**
 * Curated civilization / ancient-place GIS for Earth History.
 * Inspired by Pleiades / Chronas — not a full dump; major places with age spans.
 * Ages: years before present (YBP). Present = 0.
 */

/** @typedef {{ id: string, name: string, lat: number, lng: number, startYbp: number, endYbp: number, kind: string, summary?: string }} CivPlace */

/** Holocene-focused civilization GIS (≈12 ka → now). */
export const CIV_MAX_SUPPORTED_YBP = 12_000
export const CIV_CITATION =
  'Curated ancient places (Pleiades / WHG-inspired). Approximate occupation spans — not authoritative borders.'

/**
 * Representative places with rough occupation windows (YBP).
 * @type {CivPlace[]}
 */
export const CIVILIZATION_PLACES = Object.freeze([
  { id: 'gobekli', name: 'Göbekli Tepe', lat: 37.223, lng: 38.922, startYbp: 11500, endYbp: 10000, kind: 'ritual', summary: 'Early monumental ritual complex.' },
  { id: 'jericho', name: 'Jericho', lat: 31.871, lng: 35.444, startYbp: 11000, endYbp: 2000, kind: 'city', summary: 'Early Levantine settlement continuum.' },
  { id: 'catalhoyuk', name: 'Çatalhöyük', lat: 37.666, lng: 32.825, startYbp: 9400, endYbp: 7700, kind: 'city', summary: 'Neolithic urban experiment in Anatolia.' },
  { id: 'mehrgarh', name: 'Mehrgarh', lat: 29.383, lng: 67.617, startYbp: 9000, endYbp: 5500, kind: 'city', summary: 'Early farming settlement in South Asia.' },
  { id: 'uruk', name: 'Uruk', lat: 31.322, lng: 45.636, startYbp: 5900, endYbp: 2300, kind: 'city', summary: 'Early Mesopotamian urban center.' },
  { id: 'ur', name: 'Ur', lat: 30.962, lng: 46.103, startYbp: 4800, endYbp: 2400, kind: 'city', summary: 'Sumerian city-state.' },
  { id: 'memphis', name: 'Memphis', lat: 29.845, lng: 31.251, startYbp: 5100, endYbp: 1500, kind: 'city', summary: 'Old Kingdom Egyptian capital region.' },
  { id: 'mohenjo', name: 'Mohenjo-daro', lat: 27.329, lng: 68.139, startYbp: 4600, endYbp: 3900, kind: 'city', summary: 'Indus Valley urban center.' },
  { id: 'harappa', name: 'Harappa', lat: 30.629, lng: 72.864, startYbp: 4600, endYbp: 3900, kind: 'city', summary: 'Indus Valley urban center.' },
  { id: 'knossos', name: 'Knossos', lat: 35.298, lng: 25.163, startYbp: 4000, endYbp: 3100, kind: 'city', summary: 'Minoan palace center.' },
  { id: 'mycenae', name: 'Mycenae', lat: 37.730, lng: 22.756, startYbp: 3600, endYbp: 3100, kind: 'city', summary: 'Mycenaean citadel.' },
  { id: 'babylon', name: 'Babylon', lat: 32.542, lng: 44.421, startYbp: 4300, endYbp: 2200, kind: 'city', summary: 'Mesopotamian imperial capital.' },
  { id: 'nineveh', name: 'Nineveh', lat: 36.359, lng: 43.153, startYbp: 4000, endYbp: 2600, kind: 'city', summary: 'Assyrian capital.' },
  { id: 'hattusa', name: 'Hattusa', lat: 40.02, lng: 34.615, startYbp: 3700, endYbp: 3100, kind: 'city', summary: 'Hittite capital.' },
  { id: 'thebes-eg', name: 'Thebes (Egypt)', lat: 25.72, lng: 32.61, startYbp: 4100, endYbp: 2300, kind: 'city', summary: 'New Kingdom religious-political center.' },
  { id: 'anyangs', name: 'Anyang (Yinxu)', lat: 36.12, lng: 114.32, startYbp: 3400, endYbp: 3000, kind: 'city', summary: 'Late Shang capital.' },
  { id: 'athens', name: 'Athens', lat: 37.971, lng: 23.726, startYbp: 3400, endYbp: 1400, kind: 'city', summary: 'Classical Greek polis.' },
  { id: 'sparta', name: 'Sparta', lat: 37.082, lng: 22.423, startYbp: 3100, endYbp: 2100, kind: 'city', summary: 'Peloponnesian city-state.' },
  { id: 'rome', name: 'Rome', lat: 41.891, lng: 12.486, startYbp: 2770, endYbp: 0, kind: 'city', summary: 'Roman and later Mediterranean capital.' },
  { id: 'carthage', name: 'Carthage', lat: 36.853, lng: 10.323, startYbp: 2800, endYbp: 1400, kind: 'city', summary: 'Punic maritime power.' },
  { id: 'alexandria', name: 'Alexandria', lat: 31.214, lng: 29.886, startYbp: 2340, endYbp: 0, kind: 'city', summary: 'Hellenistic and later Mediterranean hub.' },
  { id: 'persepolis', name: 'Persepolis', lat: 29.935, lng: 52.891, startYbp: 2500, endYbp: 2300, kind: 'city', summary: 'Achaemenid ceremonial capital.' },
  { id: 'taxila', name: 'Taxila', lat: 33.746, lng: 72.784, startYbp: 2600, endYbp: 1500, kind: 'city', summary: 'Gandharan learning and trade center.' },
  { id: 'pataliputra', name: 'Pataliputra', lat: 25.6, lng: 85.15, startYbp: 2500, endYbp: 1400, kind: 'city', summary: 'Mauryan / later Magadha capital.' },
  { id: 'xian', name: "Chang'an (Xi'an)", lat: 34.266, lng: 108.942, startYbp: 2200, endYbp: 600, kind: 'city', summary: 'Han / Tang imperial capital.' },
  { id: 'teotihuacan', name: 'Teotihuacan', lat: 19.692, lng: -98.844, startYbp: 2200, endYbp: 1400, kind: 'city', summary: 'Central Mexican metropolis.' },
  { id: 'monte-alban', name: 'Monte Albán', lat: 17.044, lng: -96.768, startYbp: 2500, endYbp: 1200, kind: 'city', summary: 'Zapotec highland capital.' },
  { id: 'tikal', name: 'Tikal', lat: 17.222, lng: -89.624, startYbp: 2400, endYbp: 1100, kind: 'city', summary: 'Classic Maya city.' },
  { id: 'chichen', name: 'Chichen Itza', lat: 20.683, lng: -88.569, startYbp: 1500, endYbp: 800, kind: 'city', summary: 'Postclassic Maya / Toltec-influenced center.' },
  { id: 'cusco', name: 'Cusco', lat: -13.516, lng: -71.979, startYbp: 900, endYbp: 400, kind: 'city', summary: 'Inca imperial capital.' },
  { id: 'tiwanaku', name: 'Tiwanaku', lat: -16.555, lng: -68.673, startYbp: 1600, endYbp: 900, kind: 'city', summary: 'Andean highland polity.' },
  { id: 'great-zimbabwe', name: 'Great Zimbabwe', lat: -20.268, lng: 30.933, startYbp: 900, endYbp: 500, kind: 'city', summary: 'Southern African stone city.' },
  { id: 'timbuktu', name: 'Timbuktu', lat: 16.773, lng: -3.007, startYbp: 900, endYbp: 200, kind: 'city', summary: 'Sahelian trade and scholarship hub.' },
  { id: 'kilwa', name: 'Kilwa', lat: -8.959, lng: 39.508, startYbp: 1000, endYbp: 400, kind: 'city', summary: 'Swahili coast trading city.' },
  { id: 'baghdad', name: 'Baghdad', lat: 33.315, lng: 44.366, startYbp: 1260, endYbp: 0, kind: 'city', summary: 'Abbasid and later capital.' },
  { id: 'cordoba', name: 'Córdoba', lat: 37.888, lng: -4.78, startYbp: 1400, endYbp: 700, kind: 'city', summary: 'Umayyad Iberian capital.' },
  { id: 'constantinople', name: 'Constantinople', lat: 41.008, lng: 28.978, startYbp: 1700, endYbp: 100, kind: 'city', summary: 'Byzantine / Ottoman capital (Istanbul).' },
  { id: 'kyoto', name: 'Kyoto', lat: 35.012, lng: 135.768, startYbp: 1220, endYbp: 150, kind: 'city', summary: 'Imperial Japanese capital.' },
  { id: 'angkor', name: 'Angkor', lat: 13.412, lng: 103.867, startYbp: 1200, endYbp: 500, kind: 'city', summary: 'Khmer imperial complex.' },
  { id: 'borobudur', name: 'Borobudur', lat: -7.608, lng: 110.204, startYbp: 1200, endYbp: 900, kind: 'ritual', summary: 'Buddhist monumental complex, Java.' },
  { id: 'cahokia', name: 'Cahokia', lat: 38.655, lng: -90.062, startYbp: 1050, endYbp: 600, kind: 'city', summary: 'Mississippian urban center.' },
  { id: 'tenochtitlan', name: 'Tenochtitlan', lat: 19.433, lng: -99.133, startYbp: 700, endYbp: 500, kind: 'city', summary: 'Aztec capital.' },
  { id: 'venice', name: 'Venice', lat: 45.438, lng: 12.336, startYbp: 1400, endYbp: 200, kind: 'city', summary: 'Maritime republic.' },
  { id: 'london', name: 'London', lat: 51.507, lng: -0.128, startYbp: 1900, endYbp: 0, kind: 'city', summary: 'Roman Londinium → modern metropolis.' },
  { id: 'paris', name: 'Paris', lat: 48.856, lng: 2.352, startYbp: 2000, endYbp: 0, kind: 'city', summary: 'Medieval → modern European capital.' },
  { id: 'delhi', name: 'Delhi', lat: 28.656, lng: 77.241, startYbp: 1200, endYbp: 0, kind: 'city', summary: 'Sultanate / Mughal / modern capital region.' },
  { id: 'istanbul-mod', name: 'Istanbul', lat: 41.008, lng: 28.978, startYbp: 100, endYbp: 0, kind: 'city', summary: 'Modern megacity continuity.' },
  { id: 'new-york', name: 'New York', lat: 40.713, lng: -74.006, startYbp: 400, endYbp: 0, kind: 'city', summary: 'Early modern → contemporary global city.' },
  { id: 'beijing', name: 'Beijing', lat: 39.904, lng: 116.407, startYbp: 800, endYbp: 0, kind: 'city', summary: 'Ming / Qing / modern capital.' },
  { id: 'mexico-city', name: 'Mexico City', lat: 19.433, lng: -99.133, startYbp: 500, endYbp: 0, kind: 'city', summary: 'Colonial capital on Tenochtitlan.' },
  // Pleiades / WHG-inspired denser Holocene spine (approximate spans)
  { id: 'susa', name: 'Susa', lat: 32.189, lng: 48.258, startYbp: 6000, endYbp: 1800, kind: 'city', summary: 'Elamite / Achaemenid administrative center.' },
  { id: 'byblos', name: 'Byblos', lat: 34.121, lng: 35.646, startYbp: 7000, endYbp: 1500, kind: 'city', summary: 'Levantine port with deep occupation.' },
  { id: 'tyre', name: 'Tyre', lat: 33.274, lng: 35.194, startYbp: 3500, endYbp: 1200, kind: 'city', summary: 'Phoenician maritime city.' },
  { id: 'sidon', name: 'Sidon', lat: 33.563, lng: 35.371, startYbp: 3500, endYbp: 1200, kind: 'city', summary: 'Phoenician city-state.' },
  { id: 'damascus', name: 'Damascus', lat: 33.513, lng: 36.292, startYbp: 4000, endYbp: 0, kind: 'city', summary: 'Long-lived Levantine capital.' },
  { id: 'jerusalem', name: 'Jerusalem', lat: 31.778, lng: 35.235, startYbp: 3000, endYbp: 0, kind: 'city', summary: 'Judean / later imperial holy city.' },
  { id: 'palmyra', name: 'Palmyra', lat: 34.55, lng: 38.269, startYbp: 2300, endYbp: 1400, kind: 'city', summary: 'Syrian desert caravan city.' },
  { id: 'petra', name: 'Petra', lat: 30.329, lng: 35.444, startYbp: 2300, endYbp: 1400, kind: 'city', summary: 'Nabataean rock-cut capital.' },
  { id: 'ephesus', name: 'Ephesus', lat: 37.941, lng: 27.342, startYbp: 3000, endYbp: 1400, kind: 'city', summary: 'Ionian / Roman Asian metropolis.' },
  { id: 'pergamon', name: 'Pergamon', lat: 39.132, lng: 27.184, startYbp: 2300, endYbp: 1600, kind: 'city', summary: 'Hellenistic Attalid capital.' },
  { id: 'antioch', name: 'Antioch', lat: 36.202, lng: 36.161, startYbp: 2300, endYbp: 800, kind: 'city', summary: 'Seleucid / Roman Syrian capital.' },
  { id: 'ctesiphon', name: 'Ctesiphon', lat: 33.094, lng: 44.581, startYbp: 2200, endYbp: 1400, kind: 'city', summary: 'Parthian / Sasanian capital.' },
  { id: 'nishapur', name: 'Nishapur', lat: 36.214, lng: 58.796, startYbp: 1400, endYbp: 700, kind: 'city', summary: 'Khorasanian cultural center.' },
  { id: 'samarkand', name: 'Samarkand', lat: 39.655, lng: 66.96, startYbp: 2500, endYbp: 400, kind: 'city', summary: 'Sogdian / Timurid Silk Road hub.' },
  { id: 'bukhara', name: 'Bukhara', lat: 39.768, lng: 64.421, startYbp: 2200, endYbp: 200, kind: 'city', summary: 'Transoxiana scholarship center.' },
  { id: 'kairouan', name: 'Kairouan', lat: 35.678, lng: 10.101, startYbp: 1350, endYbp: 700, kind: 'city', summary: 'Aghlabid North African capital.' },
  { id: 'fez', name: 'Fez', lat: 34.018, lng: -5.008, startYbp: 1200, endYbp: 200, kind: 'city', summary: 'Maghrebi intellectual capital.' },
  { id: 'marrakesh', name: 'Marrakesh', lat: 31.63, lng: -7.989, startYbp: 950, endYbp: 200, kind: 'city', summary: 'Almoravid / Almohad capital.' },
  { id: 'aachen', name: 'Aachen', lat: 50.775, lng: 6.084, startYbp: 1250, endYbp: 800, kind: 'city', summary: 'Carolingian imperial seat.' },
  { id: 'prague', name: 'Prague', lat: 50.088, lng: 14.421, startYbp: 1100, endYbp: 0, kind: 'city', summary: 'Bohemian royal capital.' },
  { id: 'krakow', name: 'Kraków', lat: 50.062, lng: 19.937, startYbp: 1100, endYbp: 200, kind: 'city', summary: 'Polish royal capital.' },
  { id: 'novgorod', name: 'Novgorod', lat: 58.523, lng: 31.276, startYbp: 1200, endYbp: 500, kind: 'city', summary: 'Rus trading republic.' },
  { id: 'kiev', name: 'Kyiv', lat: 50.45, lng: 30.524, startYbp: 1400, endYbp: 700, kind: 'city', summary: 'Kievan Rus capital.' },
  { id: 'gaza', name: 'Gaza', lat: 31.5, lng: 34.467, startYbp: 3500, endYbp: 0, kind: 'city', summary: 'Coastal Levantine city.' },
  { id: 'varanasi', name: 'Varanasi', lat: 25.317, lng: 83.01, startYbp: 3000, endYbp: 0, kind: 'city', summary: 'Ganges sacred city.' },
  { id: 'nara', name: 'Nara', lat: 34.685, lng: 135.805, startYbp: 1300, endYbp: 1100, kind: 'city', summary: 'Early Japanese imperial capital.' },
  { id: 'nanjing', name: 'Nanjing', lat: 32.06, lng: 118.797, startYbp: 1800, endYbp: 100, kind: 'city', summary: 'Southern Chinese dynastic capital.' },
  { id: 'hangzhou', name: 'Hangzhou', lat: 30.274, lng: 120.155, startYbp: 1400, endYbp: 200, kind: 'city', summary: 'Southern Song capital.' },
  { id: 'gyeongju', name: 'Gyeongju', lat: 35.856, lng: 129.225, startYbp: 2000, endYbp: 1000, kind: 'city', summary: 'Silla capital.' },
  { id: 'thang-long', name: 'Thăng Long (Hanoi)', lat: 21.028, lng: 105.854, startYbp: 1000, endYbp: 0, kind: 'city', summary: 'Đại Việt capital.' },
  { id: 'bagan', name: 'Bagan', lat: 21.172, lng: 94.858, startYbp: 1100, endYbp: 700, kind: 'city', summary: 'Pagan Kingdom temple city.' },
  { id: 'sukothai', name: 'Sukhothai', lat: 17.007, lng: 99.76, startYbp: 750, endYbp: 550, kind: 'city', summary: 'Early Thai kingdom capital.' },
  { id: 'copan', name: 'Copán', lat: 14.84, lng: -89.142, startYbp: 1800, endYbp: 1100, kind: 'city', summary: 'Classic Maya city.' },
  { id: 'palenque', name: 'Palenque', lat: 17.484, lng: -92.046, startYbp: 1600, endYbp: 1100, kind: 'city', summary: 'Classic Maya city.' },
  { id: 'chan-chan', name: 'Chan Chan', lat: -8.11, lng: -79.075, startYbp: 900, endYbp: 500, kind: 'city', summary: 'Chimú capital, north Peru.' },
  { id: 'caral', name: 'Caral', lat: -10.892, lng: -77.521, startYbp: 5000, endYbp: 3800, kind: 'city', summary: 'Norte Chico urban complex.' },
  { id: 'ile-ife', name: 'Ile-Ife', lat: 7.467, lng: 4.56, startYbp: 1200, endYbp: 400, kind: 'city', summary: 'Yoruba sacred city.' },
  { id: 'benin-city', name: 'Benin City', lat: 6.335, lng: 5.622, startYbp: 800, endYbp: 100, kind: 'city', summary: 'Edo kingdom capital.' },
  { id: 'aksum', name: 'Aksum', lat: 14.13, lng: 38.718, startYbp: 2200, endYbp: 1200, kind: 'city', summary: 'Aksumite imperial capital.' },
  { id: 'lalibela', name: 'Lalibela', lat: 12.032, lng: 39.041, startYbp: 900, endYbp: 500, kind: 'ritual', summary: 'Rock-hewn church complex.' },
  { id: 'mogadishu', name: 'Mogadishu', lat: 2.046, lng: 45.318, startYbp: 1000, endYbp: 200, kind: 'city', summary: 'Somali coast trading city.' },
  { id: 'malacca', name: 'Malacca', lat: 2.19, lng: 102.25, startYbp: 600, endYbp: 200, kind: 'city', summary: 'Strait entrepôt sultanate.' },
  { id: 'seville', name: 'Seville', lat: 37.389, lng: -5.984, startYbp: 2200, endYbp: 0, kind: 'city', summary: 'Iberian / Almohad / Castilian hub.' },
  { id: 'toledo', name: 'Toledo', lat: 39.862, lng: -4.027, startYbp: 2200, endYbp: 400, kind: 'city', summary: 'Visigothic / Castilian capital.' },
  { id: 'florence', name: 'Florence', lat: 43.77, lng: 11.256, startYbp: 1200, endYbp: 200, kind: 'city', summary: 'Renaissance republic.' },
  { id: 'vienna', name: 'Vienna', lat: 48.208, lng: 16.373, startYbp: 1000, endYbp: 0, kind: 'city', summary: 'Habsburg imperial capital.' },
  { id: 'moscow', name: 'Moscow', lat: 55.756, lng: 37.617, startYbp: 850, endYbp: 0, kind: 'city', summary: 'Muscovite / Russian capital.' },
  { id: 'isfahan', name: 'Isfahan', lat: 32.654, lng: 51.668, startYbp: 1400, endYbp: 200, kind: 'city', summary: 'Safavid imperial capital.' },
  { id: 'lahore', name: 'Lahore', lat: 31.52, lng: 74.358, startYbp: 1200, endYbp: 0, kind: 'city', summary: 'Punjab / Mughal cultural capital.' },
  { id: 'agra', name: 'Agra', lat: 27.177, lng: 78.008, startYbp: 500, endYbp: 200, kind: 'city', summary: 'Mughal capital (Taj Mahal era).' },
])

const KIND_COLOR = {
  city: 'rgba(240, 190, 90, 0.95)',
  ritual: 'rgba(220, 150, 255, 0.95)',
  empire: 'rgba(255, 140, 90, 0.95)',
}

/**
 * @param {number} ybp
 */
export function isCivilizationAgeSupported(ybp) {
  return Number(ybp) <= CIV_MAX_SUPPORTED_YBP + 1e-6
}

/**
 * Places whose occupation window contains the playhead.
 * @param {number} playheadYbp
 * @param {{ limit?: number }} [opts]
 */
export function placesAtYbp(playheadYbp, opts = {}) {
  const t = Math.max(0, Number(playheadYbp) || 0)
  const limit = opts.limit ?? 120
  if (!isCivilizationAgeSupported(t)) return []

  const hits = []
  for (const p of CIVILIZATION_PLACES) {
    if (t <= p.startYbp + 1e-6 && t >= p.endYbp - 1e-6) {
      hits.push({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        kind: p.kind,
        summary: p.summary || '',
        color: KIND_COLOR[p.kind] || KIND_COLOR.city,
        radius: 0.55,
        altitude: 0.018,
        __ehKind: 'civilization',
        source: 'curated',
      })
    }
    if (hits.length >= limit) break
  }
  return hits
}

/**
 * Sync "fetch" matching remote overlay result shape.
 * @param {number} playheadYbp
 */
export function fetchCivilizationPlaces(playheadYbp) {
  const t = Math.max(0, Number(playheadYbp) || 0)
  if (!isCivilizationAgeSupported(t)) {
    return {
      ok: false,
      reason: `Civilization GIS focuses on the last ${CIV_MAX_SUPPORTED_YBP / 1000} ka (Holocene).`,
      ageYbp: t,
    }
  }
  const points = placesAtYbp(t)
  return {
    ok: true,
    ageYbp: t,
    ageMa: t / 1e6,
    points,
    count: points.length,
    source: 'curated',
  }
}
