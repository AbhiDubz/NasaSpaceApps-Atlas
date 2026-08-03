import route from './_lib/routes/ingest.js'
import { asVercelHandler } from './_lib/httpCompat.js'

export { config } from './_lib/routes/ingest.js'
export default asVercelHandler(route)
