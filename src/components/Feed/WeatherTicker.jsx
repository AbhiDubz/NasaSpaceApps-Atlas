/**
 * WeatherTicker — bottom scrolling strip of current conditions for major
 * world cities (Open-Meteo, no key). Clicking a city flies the globe there
 * and opens the weather inspector for that point.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from 'lucide-react'
import { useAtlasStore } from '../../store/atlasStore'
import { fetchCitiesWeather } from '../../services/weather/openMeteoService.js'

const REFRESH_MS = 10 * 60 * 1000
const UNITS_KEY = 'atlas_weather_units'

const CITIES = [
  { name: 'Seattle', country: 'United States', iso: 'US', lat: 47.61, lng: -122.33 },
  { name: 'New York', country: 'United States', iso: 'US', lat: 40.71, lng: -74.01 },
  { name: 'Los Angeles', country: 'United States', iso: 'US', lat: 34.05, lng: -118.24 },
  { name: 'Mexico City', country: 'Mexico', iso: 'MX', lat: 19.43, lng: -99.13 },
  { name: 'São Paulo', country: 'Brazil', iso: 'BR', lat: -23.55, lng: -46.63 },
  { name: 'London', country: 'United Kingdom', iso: 'GB', lat: 51.51, lng: -0.13 },
  { name: 'Paris', country: 'France', iso: 'FR', lat: 48.86, lng: 2.35 },
  { name: 'Lagos', country: 'Nigeria', iso: 'NG', lat: 6.52, lng: 3.38 },
  { name: 'Cairo', country: 'Egypt', iso: 'EG', lat: 30.04, lng: 31.24 },
  { name: 'Moscow', country: 'Russia', iso: 'RU', lat: 55.75, lng: 37.62 },
  { name: 'Dubai', country: 'United Arab Emirates', iso: 'AE', lat: 25.2, lng: 55.27 },
  { name: 'Delhi', country: 'India', iso: 'IN', lat: 28.61, lng: 77.21 },
  { name: 'Mumbai', country: 'India', iso: 'IN', lat: 19.08, lng: 72.88 },
  { name: 'Beijing', country: 'China', iso: 'CN', lat: 39.9, lng: 116.41 },
  { name: 'Shanghai', country: 'China', iso: 'CN', lat: 31.23, lng: 121.47 },
  { name: 'Seoul', country: 'South Korea', iso: 'KR', lat: 37.57, lng: 126.98 },
  { name: 'Tokyo', country: 'Japan', iso: 'JP', lat: 35.68, lng: 139.69 },
  { name: 'Singapore', country: 'Singapore', iso: 'SG', lat: 1.35, lng: 103.82 },
  { name: 'Sydney', country: 'Australia', iso: 'AU', lat: -33.87, lng: 151.21 },
  { name: 'Johannesburg', country: 'South Africa', iso: 'ZA', lat: -26.2, lng: 28.05 },
]

function readUnits() {
  try {
    return localStorage.getItem(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

function ConditionIcon({ code, isDay }) {
  const props = { size: 12, strokeWidth: 1.75, className: 'shrink-0 text-white/70', 'aria-hidden': true }
  if (code == null) return <Cloud {...props} />
  if (code === 0) return isDay === false ? <Cloud {...props} /> : <Sun {...props} />
  if (code <= 2) return <CloudSun {...props} />
  if (code === 3) return <Cloud {...props} />
  if (code === 45 || code === 48) return <CloudFog {...props} />
  if (code >= 51 && code <= 57) return <CloudDrizzle {...props} />
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain {...props} />
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnow {...props} />
  if (code >= 95) return <CloudLightning {...props} />
  return <Cloud {...props} />
}

export default function WeatherTicker() {
  const mobileMode = useAtlasStore((s) => s.mobileMode)
  const flyToLocation = useAtlasStore((s) => s.flyToLocation)
  const openCountryInspect = useAtlasStore((s) => s.openCountryInspect)
  const [rows, setRows] = useState([])
  const [units, setUnits] = useState(readUnits)

  useEffect(() => {
    let controller = null
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      fetchCitiesWeather({ points: CITIES, signal: controller.signal })
        .then((data) => setRows(data.map((w, i) => ({ ...CITIES[i], ...w }))))
        .catch((err) => {
          if (err?.name !== 'AbortError') console.warn('[WeatherTicker]', err)
        })
      setUnits(readUnits())
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    // Pick up unit changes made in the weather inspector.
    const onStorage = (e) => { if (e.key === UNITS_KEY) setUnits(readUnits()) }
    window.addEventListener('storage', onStorage)
    return () => {
      clearInterval(id)
      controller?.abort()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const items = useMemo(() => {
    const imperial = units === 'imperial'
    return rows.map((r) => ({
      ...r,
      temp: r.temperatureC == null
        ? '—'
        : `${Math.round(imperial ? (r.temperatureC * 9) / 5 + 32 : r.temperatureC)}°${imperial ? 'F' : 'C'}`,
      wind: r.windKmh == null
        ? null
        : `${Math.round(imperial ? r.windKmh * 0.621371 : r.windKmh)} ${imperial ? 'mph' : 'km/h'}`,
    }))
  }, [rows, units])

  if (items.length === 0) return null

  const displayItems = [...items, ...items]

  const handleClick = (item) => {
    setUnits(readUnits())
    flyToLocation({ lat: item.lat, lng: item.lng, rangeM: 1_500_000 })
    openCountryInspect('weather', {
      country: { name: item.country, iso: item.iso, lat: item.lat, lng: item.lng },
      place: { label: `${item.name}, ${item.country}` },
      lat: item.lat,
      lng: item.lng,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.35 }}
      className="fixed bottom-0 left-0 right-0 z-30"
    >
      <div className="glass border-t border-white/5 ticker-shell" aria-label="Current weather in major cities">
        <div className="ticker-hover-line" />
        <div className="ticker-track" style={{ animationDuration: `${items.length * 5}s` }}>
          {displayItems.map((item, i) => (
            <button
              key={`${item.name}-${i}`}
              type="button"
              onClick={() => handleClick(item)}
              title={`${item.name}: ${item.weatherLabel} — open weather`}
              className="flex items-center gap-2 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <ConditionIcon code={item.weatherCode} isDay={item.isDay} />
              <span className="font-data text-[9px] uppercase tracking-[0.06em] text-white/45">
                {item.name}
              </span>
              <span className="font-data text-[11px] font-semibold text-white/90">{item.temp}</span>
              <span className={`font-data text-[11px] text-white/60 truncate ${mobileMode ? 'max-w-[110px]' : 'max-w-[160px]'}`}>
                {item.weatherLabel}
              </span>
              {item.wind && !mobileMode && (
                <span className="font-data text-[10px] text-white/40">{item.wind}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
