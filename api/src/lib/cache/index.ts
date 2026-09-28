/**
 * Storage cache, an in-memory Map on Bun/Node or KV on Cloudflare Workers.
 * Entries are kept indefinitely with their fetch time; a freshness window
 * decides serve-as-is vs refresh. On a failed refresh the stale value is
 * served, and failures are never cached.
 */

import { ApiError } from '@/lib/errors'
import type { AppEnv } from '@/types'
import { kvStorage } from '@/lib/cache/kv'
import { memoryStorage } from '@/lib/cache/memory'

export interface StoredEntry<T = unknown> {
  value: T
  // Epoch milliseconds when this value was fetched
  cachedAt: number
}

export interface Storage {
  get<T = unknown>(key: string): Promise<StoredEntry<T> | null>
  // Store a value indefinitely, stamped with the current time
  set<T = unknown>(key: string, value: T): Promise<void>
  // Serve a fresh cache, else refresh; on refresh failure fall back to stale
  fetch<T>(key: string, freshSec: number, loader: () => Promise<T>): Promise<T>
}

export const createStorage = (env: AppEnv): Storage =>
  env.CACHE ? kvStorage(env.CACHE) : memoryStorage()

// Shared fetch wrapper, caches only successes and serves stale on failure.
// Never resolves to undefined, a missing value yields an error not an empty body.
export const wrapFetch =
  (storage: Storage) =>
  async <T>(key: string, freshSec: number, loader: () => Promise<T>): Promise<T> => {
    const cached = await storage.get<T>(key)
    if (cached && cached.value !== undefined) {
      if (Date.now() - cached.cachedAt < freshSec * 1000) return cached.value
    }
    try {
      const value = await loader()
      if (value === undefined) {
        throw new ApiError('UPSTREAM_ERROR', 'Upstream returned no data', 502)
      }
      await storage.set(key, value)
      return value
    } catch (caught) {
      if (cached && cached.value !== undefined) return cached.value
      throw caught
    }
  }
