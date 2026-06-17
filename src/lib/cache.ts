interface Entry<T> { data: T; expiresAt: number }

class SimpleCache {
  private store = new Map<string, Entry<unknown>>()

  get<T>(key: string): T | undefined {
    const e = this.store.get(key)
    if (!e) return undefined
    if (Date.now() > e.expiresAt) { this.store.delete(key); return undefined }
    return e.data as T
  }

  set<T>(key: string, data: T, ttlMs = 10 * 60_000): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  del(key: string): void { this.store.delete(key) }

  delPrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }
}

export const appCache = new SimpleCache()
