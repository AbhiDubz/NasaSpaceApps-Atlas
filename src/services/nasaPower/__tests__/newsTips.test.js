import { describe, expect, it } from 'vitest'
import { newsTipQuery, tipsForCountry, tipsFromHeadlines, topNewsTips } from '../newsTips.js'

const gdelt = (title, iso, lat = 10, lng = 20) => ({ source: 'GDELT', title, lat, lng, tags: ['news', 'gdelt', 'safety', iso] })

const events = [
  gdelt('Flash floods displace thousands in the north', 'BD', 24, 90),
  gdelt('Flooding closes schools across the delta', 'BD', 24, 90),
  gdelt('Flooding closes schools across the delta', 'BD', 24, 90), // duplicate
  gdelt('Ukraine talks resume as trainees arrive', 'BD', 24, 90), // "rain" inside other words must not match
  gdelt('Drought fears grow as reservoirs shrink', 'BR', -10, -55),
  gdelt('Sequía histórica golpea al sur', 'BR', -10, -55),
  gdelt('Heat wave warning issued', 'BR', -10, -55),
  { source: 'USGS', title: 'M5 earthquake floods inbox', lat: 0, lng: 0, tags: ['quake'] },
]

describe('news tips', () => {
  it('suggests variables only when a country has enough matching headlines', () => {
    const bd = tipsForCountry(events, 'bd')
    expect(bd).toHaveLength(1)
    expect(bd[0]).toMatchObject({ theme: 'flood', count: 2, variables: ['PRECTOTCORR'] })

    const br = tipsForCountry(events, 'BR')
    expect(br.map((t) => t.theme)).toEqual(['drought']) // one heat headline is not enough
    expect(br[0].variables).toEqual(['GWETROOT', 'PRECTOTCORR'])
    expect(tipsForCountry(events, 'US')).toEqual([])
    expect(tipsForCountry(events, null)).toEqual([])
  })

  it('ranks the strongest tips for the guided start', () => {
    const top = topNewsTips(events)
    expect(top).toHaveLength(2)
    expect(top[0]).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) })
    expect(top.map((t) => t.iso).sort()).toEqual(['BD', 'BR'])
  })

  it('merges search headlines with feed tips', () => {
    const tips = tipsFromHeadlines(
      ['Snowpack at record low', 'Ski season cut short', 'Snowpack at record low', 'Election results'],
      [{ theme: 'flood', label: 'flooding', variables: ['PRECTOTCORR'], count: 3, headline: 'x', iso: 'US' }],
    )
    expect(tips.map((t) => `${t.theme}:${t.count}`)).toEqual(['flood:3', 'snow:2'])
  })

  it('points smoke and air-quality headlines at the haze record', () => {
    const tips = tipsFromHeadlines(['Wildfire smoke blankets Spokane', 'Air quality alert issued for Yakima County', 'Smokey Bear turns 80'])
    expect(tips).toHaveLength(1)
    expect(tips[0]).toMatchObject({ theme: 'smoke', count: 2, variables: ['AOD_55'] })
  })

  it('builds a safe search query', () => {
    expect(newsTipQuery('Côte d"Ivoire (x)')).toMatch(/^"Côte dIvoire x" \(flood OR /)
    expect(newsTipQuery('')).toBeNull()
  })
})
