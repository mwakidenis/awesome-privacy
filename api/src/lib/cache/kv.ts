/* Workers KV backed Storage */
import type { Storage, StoredEntry } from '@/lib/cache'
import { wrapFetch } from '@/lib/cache'

export const kvStorage = (kv: KVNamespace): Storage => {
  const storage: Storage = {
    async get<T>(key: string) {
      return (await kv.get<StoredEntry<T>>(key, 'json')) ?? null
    },
    async set<T>(key: string, value: T) {
      // No expirationTtl, entries are kept indefinitely
      await kv.put(
        key,
        JSON.stringify({ value, cachedAt: Date.now() } satisfies StoredEntry<T>),
      )
    },
    fetch: async () => {
      throw new Error('uninit')
    },
  }
  storage.fetch = wrapFetch(storage)
  return storage
}
