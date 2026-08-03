/**
 * Country code reference shared by ingestion, geocoding, and entity resolution.
 *
 * Previously trapped inside fetchManager.worker.js, which meant the server had
 * no way to resolve "USA", "United States", and "US" to one country object.
 */

/** ISO 3166-1 alpha-2 → rough [lat, lng] centroid. */
export const COUNTRY_CENTROIDS = {
  AF:[33,65],AL:[41,20],DZ:[28,3],AO:[-12.5,18.5],AR:[-34,-64],AM:[40,45],AU:[-27,133],AT:[47.5,13.5],
  AZ:[40.5,47.5],BD:[24,90],BY:[53,28],BE:[50.8,4],BJ:[9.5,2.3],BO:[-17,-65],BA:[44,18],BR:[-10,-55],
  BG:[43,25],BF:[13,-1.5],BI:[-3.5,30],KH:[12.5,105],CM:[6,12.5],CA:[60,-95],CF:[7,21],TD:[15,19],
  CL:[-30,-71],CN:[35,105],CO:[4,-72],CD:[-4,22],CG:[-1,15],CR:[10,-84],CI:[8,-5.5],HR:[45.2,15.5],
  CU:[22,-80],CZ:[49.8,15.5],DK:[56,10],DJ:[11.5,43],DO:[19,-70.7],EC:[-2,-77.5],EG:[27,30],
  SV:[13.8,-88.9],ER:[15,39],ET:[8,38],FI:[64,26],FR:[46,2],GA:[-1,11.8],DE:[51,9],GH:[8,-1.2],
  GR:[39,22],GT:[15.5,-90.3],GN:[11,-10],HT:[19,-72.3],HN:[15,-86.5],HU:[47,20],IN:[20,77],
  ID:[-5,120],IR:[32,53],IQ:[33,44],IE:[53,-8],IL:[31.5,34.8],IT:[42.8,12.8],JM:[18.1,-77.3],
  JP:[36,138],JO:[31,36],KZ:[48,68],KE:[-1,38],KP:[40,127],KR:[37,127.5],KW:[29.5,47.8],
  KG:[41,75],LA:[18,105],LV:[57,25],LB:[33.8,35.8],LR:[6.5,-9.5],LY:[25,17],LT:[56,24],
  MG:[-20,47],MW:[-13.5,34],MY:[2.5,112.5],ML:[17,-4],MR:[20,-12],MX:[23,-102],MD:[47,29],
  MN:[46,105],MA:[32,-5],MZ:[-18.3,35],MM:[22,98],NA:[-22,17],NP:[28,84],NL:[52.5,5.8],
  NZ:[-42,174],NI:[13,-85],NE:[16,8],NG:[10,8],NO:[62,10],OM:[21,57],PK:[30,70],PA:[9,-80],
  PY:[-23,-58],PE:[-10,-76],PH:[13,122],PL:[52,20],PT:[39.5,-8],QA:[25.5,51.3],RO:[46,25],
  RU:[60,100],RW:[-2,30],SA:[25,45],SN:[14,-14],RS:[44,21],SL:[8.5,-11.8],SG:[1.4,103.8],
  SK:[48.7,19.5],SI:[46.1,15],SO:[5.2,46],ZA:[-29,24],ES:[40,-4],LK:[7,81],SD:[15,30],
  SE:[62,15],CH:[47,8],SY:[35,38],TW:[23.5,121],TJ:[39,71],TZ:[-6,35],TH:[15,100],
  TG:[8,1.2],TN:[34,9],TR:[39,35],TM:[40,60],UG:[1,32],UA:[49,32],AE:[24,54],
  GB:[54,-2],US:[38,-97],UY:[-33,-56],UZ:[41,64],VE:[8,-66],VN:[16,106],YE:[15,48],
  ZM:[-15,30],ZW:[-20,30],
}

/** Map GDELT ArtList `sourcecountry` (English labels) → ISO2. Keys: lowercase, no spaces. */
export const GDELT_COUNTRY_NAME_TO_ISO = {
  afghanistan: 'AF', albania: 'AL', algeria: 'DZ', angola: 'AO', argentina: 'AR', armenia: 'AM',
  australia: 'AU', austria: 'AT', azerbaijan: 'AZ', bangladesh: 'BD', belarus: 'BY', belgium: 'BE',
  benin: 'BJ', bolivia: 'BO', 'bosniaandherzegovina': 'BA', brazil: 'BR', bulgaria: 'BG', 'burkinafaso': 'BF',
  burundi: 'BI', cambodia: 'KH', cameroon: 'CM', canada: 'CA', 'centralafricanrepublic': 'CF', chad: 'TD',
  chile: 'CL', china: 'CN', colombia: 'CO', 'democraticrepublicofthecongo': 'CD', congo: 'CG', 'costarica': 'CR',
  croatia: 'HR', cuba: 'CU', czechia: 'CZ', czechrepublic: 'CZ', denmark: 'DK', djibouti: 'DJ', 'dominicanrepublic': 'DO',
  ecuador: 'EC', egypt: 'EG', 'elsalvador': 'SV', eritrea: 'ER', ethiopia: 'ET', finland: 'FI', france: 'FR',
  gabon: 'GA', germany: 'DE', ghana: 'GH', greece: 'GR', guatemala: 'GT', guinea: 'GN', haiti: 'HT', honduras: 'HN',
  hungary: 'HU', india: 'IN', indonesia: 'ID', iran: 'IR', iraq: 'IQ', ireland: 'IE', israel: 'IL', italy: 'IT',
  jamaica: 'JM', japan: 'JP', jordan: 'JO', kazakhstan: 'KZ', kenya: 'KE', 'northkorea': 'KP', 'southkorea': 'KR',
  kuwait: 'KW', kyrgyzstan: 'KG', laos: 'LA', latvia: 'LV', lebanon: 'LB', liberia: 'LR', libya: 'LY', lithuania: 'LT',
  luxembourg: 'LU', madagascar: 'MG', malawi: 'MW', malaysia: 'MY', mali: 'ML', malta: 'MT', mauritania: 'MR',
  mexico: 'MX', moldova: 'MD', mongolia: 'MN', montenegro: 'ME', morocco: 'MA', mozambique: 'MZ', myanmar: 'MM',
  namibia: 'NA', nepal: 'NP', netherlands: 'NL', 'newzealand': 'NZ', nicaragua: 'NI', niger: 'NE', nigeria: 'NG',
  norway: 'NO', oman: 'OM', pakistan: 'PK', panama: 'PA', paraguay: 'PY', peru: 'PE', philippines: 'PH', poland: 'PL',
  portugal: 'PT', qatar: 'QA', romania: 'RO', russia: 'RU', rwanda: 'RW', 'saudiarabia': 'SA', senegal: 'SN', serbia: 'RS',
  'sierraleone': 'SL', singapore: 'SG', slovakia: 'SK', slovenia: 'SI', somalia: 'SO', 'southafrica': 'ZA', spain: 'ES',
  'srilanka': 'LK', sudan: 'SD', sweden: 'SE', switzerland: 'CH', syria: 'SY', taiwan: 'TW', tajikistan: 'TJ',
  tanzania: 'TZ', thailand: 'TH', togo: 'TG', tunisia: 'TN', turkey: 'TR', turkmenistan: 'TM', uganda: 'UG', ukraine: 'UA',
  'unitedarabemirates': 'AE', 'unitedkingdom': 'GB', uk: 'GB', 'greatbritain': 'GB', 'unitedstates': 'US', usa: 'US',
  uruguay: 'UY', uzbekistan: 'UZ', venezuela: 'VE', vietnam: 'VN', yemen: 'YE', zambia: 'ZM', zimbabwe: 'ZW',
}

/**
 * ISO 3166-1 alpha-2 → alpha-3. GDELT actor codes and most economic series key
 * on alpha-3, so this is what joins those feeds to the same country object.
 */
export const ISO2_TO_ISO3 = {
  AF:'AFG',AL:'ALB',DZ:'DZA',AO:'AGO',AR:'ARG',AM:'ARM',AU:'AUS',AT:'AUT',AZ:'AZE',BD:'BGD',
  BY:'BLR',BE:'BEL',BJ:'BEN',BO:'BOL',BA:'BIH',BR:'BRA',BG:'BGR',BF:'BFA',BI:'BDI',KH:'KHM',
  CM:'CMR',CA:'CAN',CF:'CAF',TD:'TCD',CL:'CHL',CN:'CHN',CO:'COL',CD:'COD',CG:'COG',CR:'CRI',
  CI:'CIV',HR:'HRV',CU:'CUB',CZ:'CZE',DK:'DNK',DJ:'DJI',DO:'DOM',EC:'ECU',EG:'EGY',SV:'SLV',
  ER:'ERI',ET:'ETH',FI:'FIN',FR:'FRA',GA:'GAB',DE:'DEU',GH:'GHA',GR:'GRC',GT:'GTM',GN:'GIN',
  HT:'HTI',HN:'HND',HU:'HUN',IN:'IND',ID:'IDN',IR:'IRN',IQ:'IRQ',IE:'IRL',IL:'ISR',IT:'ITA',
  JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',KE:'KEN',KP:'PRK',KR:'KOR',KW:'KWT',KG:'KGZ',LA:'LAO',
  LV:'LVA',LB:'LBN',LR:'LBR',LY:'LBY',LT:'LTU',LU:'LUX',MG:'MDG',MW:'MWI',MY:'MYS',ML:'MLI',
  MT:'MLT',MR:'MRT',MX:'MEX',MD:'MDA',ME:'MNE',MN:'MNG',MA:'MAR',MZ:'MOZ',MM:'MMR',NA:'NAM',
  NP:'NPL',NL:'NLD',NZ:'NZL',NI:'NIC',NE:'NER',NG:'NGA',NO:'NOR',OM:'OMN',PK:'PAK',PA:'PAN',
  PY:'PRY',PE:'PER',PH:'PHL',PL:'POL',PT:'PRT',QA:'QAT',RO:'ROU',RU:'RUS',RW:'RWA',SA:'SAU',
  SN:'SEN',RS:'SRB',SL:'SLE',SG:'SGP',SK:'SVK',SI:'SVN',SO:'SOM',ZA:'ZAF',ES:'ESP',LK:'LKA',
  SD:'SDN',SE:'SWE',CH:'CHE',SY:'SYR',TW:'TWN',TJ:'TJK',TZ:'TZA',TH:'THA',TG:'TGO',TN:'TUN',
  TR:'TUR',TM:'TKM',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',US:'USA',UY:'URY',UZ:'UZB',VE:'VEN',
  VN:'VNM',YE:'YEM',ZM:'ZMB',ZW:'ZWE',
}

/** Display name per ISO2, derived from the GDELT label table. */
export const ISO_TO_COUNTRY_NAME = buildIsoToName()

function buildIsoToName() {
  /** Labels whose title-cased form is wrong or where a shorter name reads better. */
  const overrides = {
    US: 'United States', GB: 'United Kingdom', AE: 'United Arab Emirates',
    CD: 'Democratic Republic of the Congo', CF: 'Central African Republic',
    KP: 'North Korea', KR: 'South Korea', CZ: 'Czechia',
    BA: 'Bosnia and Herzegovina', DO: 'Dominican Republic', ZA: 'South Africa',
    NZ: 'New Zealand', SA: 'Saudi Arabia', LK: 'Sri Lanka', SL: 'Sierra Leone',
    BF: 'Burkina Faso', CR: 'Costa Rica', SV: 'El Salvador',
  }
  /** @type {Record<string, string>} */
  const out = { ...overrides }
  for (const [label, iso] of Object.entries(GDELT_COUNTRY_NAME_TO_ISO)) {
    if (out[iso]) continue
    out[iso] = label.charAt(0).toUpperCase() + label.slice(1)
  }
  return out
}

/**
 * Normalize a country label for lookup: lowercase, punctuation and spaces removed.
 * @param {string} label
 */
export function normalizeCountryLabel(label) {
  return String(label || '').toLowerCase().replace(/[\s._-]+/g, '').trim()
}

/**
 * Resolve a free-text country label (or ISO2 code) to a centroid.
 * @param {string} sourcecountry
 * @returns {{ lat: number, lng: number, iso: string } | null}
 */
export function lookupCountryCentroid(sourcecountry) {
  const key = normalizeCountryLabel(sourcecountry)
  if (!key) return null
  const iso = GDELT_COUNTRY_NAME_TO_ISO[key] || (key.length === 2 ? key.toUpperCase() : null)
  if (!iso || !COUNTRY_CENTROIDS[iso]) return null
  const [lat, lng] = COUNTRY_CENTROIDS[iso]
  return { lat, lng, iso }
}

/**
 * Every string that should resolve to a given country: ISO2, ISO3, canonical
 * name, and every GDELT label that maps to it.
 * @param {string} iso2
 * @returns {string[]}
 */
export function countryAliases(iso2) {
  const aliases = new Set([iso2])
  const iso3 = ISO2_TO_ISO3[iso2]
  if (iso3) aliases.add(iso3)
  const name = ISO_TO_COUNTRY_NAME[iso2]
  if (name) aliases.add(name)
  for (const [label, iso] of Object.entries(GDELT_COUNTRY_NAME_TO_ISO)) {
    if (iso === iso2) aliases.add(label)
  }
  return [...aliases]
}
