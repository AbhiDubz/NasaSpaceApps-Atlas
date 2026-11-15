/**
 * Gemini sometimes writes inline math as LaTeX ("$p < 0.001$",
 * "$0.5 \times 10^{15}$"). The chat panel shows plain text, so turn those
 * spans into readable characters. Pure, no I/O.
 */

const SYMBOLS = [
  [/\\times/g, '×'],
  [/\\cdot/g, '·'],
  [/\\leq?/g, '≤'],
  [/\\geq?/g, '≥'],
  [/\\approx/g, '≈'],
  [/\\pm/g, '±'],
  [/\\sim/g, '~'],
  [/\\%/g, '%'],
  [/\^\{?\\circ\}?/g, '°'],
  [/\\circ/g, '°'],
  [/\\degree/g, '°'],
  [/\\(?:text|mathrm|mathbf|rm)\{([^}]*)\}/g, '$1'],
  [/\\,|\\;|\\!|~/g, ' '],
]

const SUPERSCRIPT = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '−': '⁻', '+': '⁺' }

function superscript(s) {
  return [...s].every((c) => SUPERSCRIPT[c]) ? [...s].map((c) => SUPERSCRIPT[c]).join('') : `^${s}`
}

function plainSpan(tex) {
  let out = tex
  for (const [re, to] of SYMBOLS) out = out.replace(re, to)
  out = out.replace(/\^\{([^}]*)\}/g, (_, s) => superscript(s)).replace(/\^([0-9+\-−])/g, (_, s) => superscript(s))
  out = out.replace(/_\{([^}]*)\}/g, '$1').replace(/[{}]/g, '')
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * Replace `$…$` and `\(…\)` math spans with plain text. A lone dollar sign
 * (prices) is left alone: the span must not start or end with a space.
 * @param {string} text
 */
export function plainMath(text) {
  return text
    .replace(/\$\$([^$]{1,200}?)\$\$/g, (_, tex) => plainSpan(tex))
    .replace(/\$(?!\s)([^$\n]{1,120}?)(?<!\s)\$/g, (_, tex) => plainSpan(tex))
    .replace(/\\\((.{1,120}?)\\\)/g, (_, tex) => plainSpan(tex))
}
