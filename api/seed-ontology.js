import route from './_lib/routes/seed-ontology.js'
import { asVercelHandler } from './_lib/httpCompat.js'

export { config } from './_lib/routes/seed-ontology.js'
export default asVercelHandler(route)
