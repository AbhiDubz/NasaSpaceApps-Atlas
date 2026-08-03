/**
 * IndexedDB cache for Earth History remote payloads (GWS / PBDB).
 * Best-effort — memory callers keep working if IDB is unavailable.
 */

const DB_NAME = 'atlas-earth-history'
const STORE = 'responses'
const DB_VERSION = 1
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no idb'))
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => reject(req.error || new Error('idb open failed'))
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
    })
  }
  return dbPromise
}

/**
 * @param {string} key
 * @returns {Promise<unknown | null>}
 */
export async function ehCacheGet(key) {
  try {
    const db = await openDb()
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
    if (!row) return null
    if (row.expiresAt && Date.now() > row.expiresAt) {
      ehCacheDelete(key).catch(() => {})
      return null
    }
    return row.value
  } catch {
    return null
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {{ ttlMs?: number }} [opts]
 */
export async function ehCacheSet(key, value, opts = {}) {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        key,
        value,
        expiresAt: Date.now() + ttlMs,
        savedAt: Date.now(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
}

export async function ehCacheDelete(key) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
}
