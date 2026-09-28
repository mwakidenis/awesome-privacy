// Cloudflare Workers entry, also handles the scheduled cache warmer
import { buildApp } from '@/app'
import { createStorage } from '@/lib/cache'
import { readEnv } from '@/lib/env'
import { warmCache } from '@/lib/warm'
import type { AppEnv } from '@/types'

const app = buildApp()

export default {
  fetch: app.fetch,
  // Cron-triggered warmer touches a small set of hot keys
  async scheduled(_evt: ScheduledController, env: AppEnv) {
    await warmCache(createStorage(readEnv(env)))
  },
}
