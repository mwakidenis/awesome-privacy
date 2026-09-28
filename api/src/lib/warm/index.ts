/**
 * Hit this endpoint to repopulate hot data, called as cron,
 * so requests after cache expiry don't pay the cold-path cost
 * TODO: Not working, lol. Either fix, or remove.
 */

import type { Storage } from '@/lib/cache'
import { log } from '@/lib/log'

const TOUCH = ['stats', 'services:all', 'categories:all']

export const warmCache = async (storage: Storage) => {
  for (const key of TOUCH) {
    const cached = await storage.get(key)
    if (!cached) log.info('warm_miss', { key })
  }
  log.info('warm_done', { count: TOUCH.length })
}
