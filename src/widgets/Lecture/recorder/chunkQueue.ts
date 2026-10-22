// Local, durable queue of recorded chunks (option B): every chunk is written
// to IndexedDB *before* upload and deleted only after the server stored it,
// so a dead Wi-Fi in the lecture hall, a closed tab or a crash loses nothing —
// the next visit to the lecture re-sends what's left. Falls back to memory
// when IndexedDB is unavailable (private mode).

export interface QueuedChunk {
  lectureId: string
  seq: number
  startMs: number
  durationMs: number
  mime: string
  blob: Blob
}

const DB_NAME = 'gw-lecture'
const STORE = 'chunks'
const memory = new Map<string, QueuedChunk>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function key(lectureId: string, seq: number) {
  return `${lectureId}:${String(seq).padStart(6, '0')}`
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(db => {
    if (!db) return null
    return new Promise<T | null>(resolve => {
      try {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  })
}

export async function putChunk(chunk: QueuedChunk): Promise<void> {
  memory.set(key(chunk.lectureId, chunk.seq), chunk)
  await run('readwrite', s => s.put(chunk, key(chunk.lectureId, chunk.seq)))
}

export async function deleteChunk(lectureId: string, seq: number): Promise<void> {
  memory.delete(key(lectureId, seq))
  await run('readwrite', s => s.delete(key(lectureId, seq)))
}

/** Everything still waiting for this lecture, in seq order. */
export async function pendingChunks(lectureId: string): Promise<QueuedChunk[]> {
  const range = IDBKeyRange.bound(`${lectureId}:`, `${lectureId}:￿`)
  const stored = (await run<QueuedChunk[]>('readonly', s => s.getAll(range) as IDBRequest<QueuedChunk[]>)) ?? []
  const byKey = new Map<string, QueuedChunk>()
  for (const c of stored) byKey.set(key(c.lectureId, c.seq), c)
  for (const [k, c] of memory) if (c.lectureId === lectureId) byKey.set(k, c)
  return [...byKey.values()].sort((a, b) => a.seq - b.seq)
}
