export type QcPendingMarked = {
  id: string
  sourceDrawingId: string
  sourceTitle: string
  fileName: string
  mimeType: string
  blob: Blob
}

const DB_NAME = 'msa-qc-marked'
const STORE = 'files'
const KEY_PREFIX = 'msa-qc-marked:'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const database = await db()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const request = run(store)
    let result: T | undefined
    if (request) {
      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => reject(request.error)
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadPendingMarked(projectId: string): Promise<QcPendingMarked[]> {
  if (typeof window === 'undefined') return []
  const rows = await withStore<QcPendingMarked[]>('readonly', (store) => store.get(`${KEY_PREFIX}${projectId}`))
  return Array.isArray(rows) ? rows : []
}

function uniqueFileName(name: string, existing: string[]) {
  const used = new Set(existing)
  const cleaned = name.replace(/[^\w.\u0600-\u06FF-]+/g, '_') || 'drawing-marked.png'
  if (!used.has(cleaned)) return cleaned
  const dot = cleaned.lastIndexOf('.')
  const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned
  const ext = dot > 0 ? cleaned.slice(dot) : ''
  let index = 2
  let next = `${stem}-${index}${ext}`
  while (used.has(next)) {
    index += 1
    next = `${stem}-${index}${ext}`
  }
  return next
}

export async function addPendingMarked(projectId: string, file: QcPendingMarked): Promise<void> {
  const current = await loadPendingMarked(projectId)
  const nextFile = {
    ...file,
    fileName: uniqueFileName(
      file.fileName,
      current.map((row) => row.fileName)
    ),
  }
  const next = [...current.filter((row) => row.id !== nextFile.id), nextFile]
  await withStore('readwrite', (store) => store.put(next, `${KEY_PREFIX}${projectId}`))
}

export async function removePendingMarked(projectId: string, id: string): Promise<void> {
  const current = await loadPendingMarked(projectId)
  const next = current.filter((row) => row.id !== id)
  if (next.length === 0) {
    await clearPendingMarked(projectId)
    return
  }
  await withStore('readwrite', (store) => store.put(next, `${KEY_PREFIX}${projectId}`))
}

export async function clearPendingMarked(projectId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(`${KEY_PREFIX}${projectId}`))
}

export function pendingToFiles(rows: QcPendingMarked[]): File[] {
  return rows.map((row) => new File([row.blob], row.fileName, { type: row.mimeType || 'image/png' }))
}
