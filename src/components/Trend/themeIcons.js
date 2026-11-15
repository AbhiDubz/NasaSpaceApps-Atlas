/**
 * Lucide icon for each NASA POWER theme. Kept out of variables.js, which the
 * API routes also import and should stay free of React.
 */
import { CloudRain, Droplets, Haze, Leaf, Snowflake, Sun, Thermometer } from 'lucide-react'
import { POWER_VARIABLES } from '../../services/nasaPower/variables.js'

export const THEME_ICONS = {
  heat: Thermometer,
  rain: CloudRain,
  water: Droplets,
  snow: Snowflake,
  sun: Sun,
  air: Haze,
  plants: Leaf,
}

/** Icon for a variable code, via its theme. */
export function variableIcon(code) {
  return THEME_ICONS[POWER_VARIABLES[code]?.theme] ?? null
}
