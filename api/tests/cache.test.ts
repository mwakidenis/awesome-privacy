// Unit tests for the cache freshness + serve-stale-on-failure behaviour
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wrapFetch, type Storage, type StoredEntry } from '@/lib/cache'

const FRESH = 60 // seconds

// Minimal in-test storage that stamps the time on set, like the real backends
const makeStorage = () => {
  const map = new Map<string, StoredEntry>()
  const storage: Storage = {
    async get<T>(key: string) {
      return (map.get(key) as StoredEntry<T>) ?? null
    },
    async set<T>(key: string, value: T) {
      map.set(key, { value, cachedAt: Date.now() })
    },
    fetch: async () => {
      throw new Error('uninit')
    },
  }
  storage.fetch = wrapFetch(storage)
  return { storage, map }
}

describe('cache wrapFetch', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('miss runs the loader, stores, and returns the value', async () => {
    const { storage, map } = makeStorage()
    const loader = vi.fn().mockResolvedValue('v1')
    expect(await storage.fetch('k', FRESH, loader)).toBe('v1')
    expect(loader).toHaveBeenCalledTimes(1)
    expect(map.get('k')).toMatchObject({ value: 'v1' })
  })

  it('fresh cache is served without touching the loader', async () => {
    const { storage } = makeStorage()
    await storage.fetch('k', FRESH, vi.fn().mockResolvedValue('v1'))
    vi.advanceTimersByTime(30_000) // still inside the window
    const loader = vi.fn().mockResolvedValue('v2')
    expect(await storage.fetch('k', FRESH, loader)).toBe('v1')
    expect(loader).not.toHaveBeenCalled()
  })

  it('stale cache refreshes and re-stores on success', async () => {
    const { storage, map } = makeStorage()
    await storage.fetch('k', FRESH, vi.fn().mockResolvedValue('v1'))
    vi.advanceTimersByTime(61_000) // past the window
    const loader = vi.fn().mockResolvedValue('v2')
    expect(await storage.fetch('k', FRESH, loader)).toBe('v2')
    expect(loader).toHaveBeenCalledTimes(1)
    expect(map.get('k')).toMatchObject({ value: 'v2' })
  })

  it('stale cache falls back to the stale value on failure, without overwriting', async () => {
    const { storage, map } = makeStorage()
    await storage.fetch('k', FRESH, vi.fn().mockResolvedValue('v1'))
    vi.advanceTimersByTime(61_000)
    const failing = vi.fn().mockRejectedValue(new Error('upstream down'))
    expect(await storage.fetch('k', FRESH, failing)).toBe('v1')
    expect(map.get('k')).toMatchObject({ value: 'v1' })
  })

  it('miss with a failing loader throws and caches nothing', async () => {
    const { storage, map } = makeStorage()
    const failing = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(storage.fetch('k', FRESH, failing)).rejects.toThrow('boom')
    expect(map.has('k')).toBe(false)
  })

  it('entries never expire, a year-old value still serves when upstream fails', async () => {
    const { storage } = makeStorage()
    await storage.fetch('k', FRESH, vi.fn().mockResolvedValue('v1'))
    vi.advanceTimersByTime(365 * 24 * 60 * 60 * 1000)
    const failing = vi.fn().mockRejectedValue(new Error('down'))
    expect(await storage.fetch('k', FRESH, failing)).toBe('v1')
  })

  it('an undefined loader result throws instead of caching an empty body', async () => {
    const { storage, map } = makeStorage()
    const loader = vi.fn().mockResolvedValue(undefined)
    await expect(storage.fetch('k', FRESH, loader)).rejects.toThrow()
    expect(map.has('k')).toBe(false)
  })

  it('a corrupted undefined cached value is treated as a miss, not served empty', async () => {
    const { storage, map } = makeStorage()
    map.set('k', { value: undefined, cachedAt: Date.now() })
    expect(await storage.fetch('k', FRESH, vi.fn().mockResolvedValue('fresh'))).toBe(
      'fresh',
    )
  })
})
