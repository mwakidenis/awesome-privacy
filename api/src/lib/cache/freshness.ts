/**
 * Central cache freshness windows, in days, per enrichment route.
 * A cached response is served as-is until it is this many days old, then a
 * refresh is attempted. To change how long a route caches, edit one number here.
 */

export const CACHE_DAYS = {
  privacy: 90,
  security: 14,
  android: 60,
  website: 60,
  ios: 60,
  github: 7,
  discord: 14,
  reddit: 14,
  docker: 90,
} as const

export type CacheRoute = keyof typeof CACHE_DAYS

const DAY_SECONDS = 24 * 60 * 60

// Freshness window in seconds for a route, as passed to storage.fetch()
export const freshSeconds = (route: CacheRoute): number => CACHE_DAYS[route] * DAY_SECONDS
