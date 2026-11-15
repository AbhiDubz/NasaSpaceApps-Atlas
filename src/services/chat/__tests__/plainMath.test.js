import { describe, expect, it } from 'vitest'
import { plainMath } from '../plainMath.js'

describe('plainMath', () => {
  it('drops dollar delimiters around simple math', () => {
    expect(plainMath('rising by 0.068 per decade ($p < 0.001$), measured')).toBe('rising by 0.068 per decade (p < 0.001), measured')
  })

  it('turns common LaTeX commands into characters', () => {
    expect(plainMath('falling $1.11 \\times 10^{15}$ per cm²')).toBe('falling 1.11 × 10¹⁵ per cm²')
    expect(plainMath('$p \\leq 0.05$ and $\\approx 2.9^\\circ$C')).toBe('p ≤ 0.05 and ≈ 2.9°C')
    expect(plainMath('$0.5\\,\\text{mm/day}$')).toBe('0.5 mm/day')
    expect(plainMath('\\(p = 0.02\\)')).toBe('p = 0.02')
  })

  it('leaves prices and text without math alone', () => {
    expect(plainMath('It cost $5 and $10 to fix.')).toBe('It cost $5 and $10 to fix.')
    expect(plainMath('**Seattle** is warming.')).toBe('**Seattle** is warming.')
  })
})
