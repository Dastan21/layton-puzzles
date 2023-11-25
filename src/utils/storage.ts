const LOCAL_STORAGE_KEY = 'nds'

function set (key: string, value: string): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${key}`, value)
  } catch (err) {
    console.error(err)
  }
}

function get (key: string): string | null {
  return localStorage.getItem(`${LOCAL_STORAGE_KEY}-${key}`)
}

function store<T extends object> (data: T): T {
  return new Proxy<T>(data, {
    get (obj, prop) {
      if (prop.toString().startsWith('_')) return obj[prop as keyof T]
      const value = get(String(prop)) ?? obj[prop as keyof T]
      if (Array.isArray(value)) return value
      try {
        return JSON.parse(String(value))
      } catch (_) {
        return value
      }
    },
    set (target, prop, value) {
      target[prop as keyof T] = value
      if (!prop.toString().startsWith('_')) set(String(prop), JSON.stringify(value))
      return true
    }
  })
}

export const local = {
  get, set, store
}

class NDSDB {
  private static readonly DB_NAME = 'NintendoDS'
  private static readonly STORE_NAME = 'NDSCache'

  public async open (): Promise<IDBDatabase> {
    const openRequest = indexedDB.open(NDSDB.DB_NAME, 4)
    return await new Promise((resolve, reject) => {
      openRequest.onerror = () => { reject(new Error('Error loading database')) }
      openRequest.onsuccess = () => { resolve(openRequest.result) }
      openRequest.onupgradeneeded = () => {
        openRequest.result.onerror = () => { reject(new Error('Error loading database')) }
        const request = openRequest.result.createObjectStore(NDSDB.STORE_NAME)
        request.transaction.oncomplete = () => { resolve(openRequest.result) }
      }
    })
  }

  public async get (key: string): Promise<Uint8Array | null> {
    const db = await this.open()
    let state: Uint8Array | null
    return await new Promise((resolve) => {
      const transaction = db.transaction(NDSDB.STORE_NAME)
      const objectStore = transaction.objectStore(NDSDB.STORE_NAME)
      const request = objectStore.get(key)
      request.onerror = () => { throw new Error(request.error?.message) }
      request.onsuccess = () => { state = request.result }
      transaction.onabort = () => { throw new Error(transaction.error?.message) }
      transaction.oncomplete = () => {
        db.close()
        resolve(state)
      }
    })
  }

  public async set (key: string, state: Uint8Array): Promise<void> {
    if (state == null) throw new Error('State is null')
    const db = await this.open()
    const transaction = db.transaction(NDSDB.STORE_NAME, 'readwrite')
    const objectStore = transaction.objectStore(NDSDB.STORE_NAME)
    objectStore.put(state, key)
    transaction.onabort = () => { throw new Error(transaction.error?.message) }
    transaction.oncomplete = () => { db.close() }
  }

  public async remove (stateId: string): Promise<void> {
    if (stateId == null) throw new Error('State id is null')
    const db = await this.open()
    const transaction = db.transaction(NDSDB.STORE_NAME, 'readwrite')
    const objectStore = transaction.objectStore(NDSDB.STORE_NAME)
    objectStore.delete(stateId)
    transaction.onabort = () => { throw new Error(transaction.error?.message) }
    transaction.oncomplete = () => { db.close() }
  }
}

export const ndsdb = new NDSDB()
