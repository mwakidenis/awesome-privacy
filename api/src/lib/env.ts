/**
 * Reads and returns environmental variables for secrets/config
 * Handles both the CF worker bindings and Node/Bun process.env
 */

import type { AppEnv } from '@/types'

export const readEnv = (workersEnv?: Partial<AppEnv>): AppEnv => {
  const proc = typeof process !== 'undefined' ? process.env : {}
  const env = proc as Record<string, string | undefined>
  return {
    API_TOKEN: workersEnv?.API_TOKEN ?? env.API_TOKEN,
    REQUIRE_AUTH: workersEnv?.REQUIRE_AUTH ?? env.REQUIRE_AUTH,
    DISCORD_BOT_TOKEN: workersEnv?.DISCORD_BOT_TOKEN ?? env.DISCORD_BOT_TOKEN,
    APIVOID_API_KEY: workersEnv?.APIVOID_API_KEY ?? env.APIVOID_API_KEY,
    EXODUS_TOKEN: workersEnv?.EXODUS_TOKEN ?? env.EXODUS_TOKEN,
    GITHUB_TOKEN: workersEnv?.GITHUB_TOKEN ?? env.GITHUB_TOKEN,
    DOCKERHUB_TOKEN: workersEnv?.DOCKERHUB_TOKEN ?? env.DOCKERHUB_TOKEN,
    CACHE: workersEnv?.CACHE,
    RATE_LIMIT: workersEnv?.RATE_LIMIT,
    ENRICH_RATE_LIMIT: workersEnv?.ENRICH_RATE_LIMIT,
    API_BASE: workersEnv?.API_BASE ?? env.API_BASE,
  }
}
