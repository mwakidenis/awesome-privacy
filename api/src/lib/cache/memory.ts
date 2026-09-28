/* In-process Map storage cache for Node/Bun */
import type { Storage, StoredEntry } from '@/lib/cache'
import { wrapFetch } from '@/lib/cache'

const store = new Map<string, StoredEntry>()

export const memoryStorage = (): Storage => {
  const storage: Storage = {
    async get<T>(key: string) {
      return (store.get(key) as StoredEntry<T>) ?? null
    },
    async set<T>(key: string, value: T) {
      // Kept indefinitely, freshness is decided by the caller not by expiry
      store.set(key, { value, cachedAt: Date.now() })
    },
    fetch: async () => {
      throw new Error('uninit')
    },
  }
  storage.fetch = wrapFetch(storage)
  return storage
}
