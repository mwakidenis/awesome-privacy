// Core runtime types shared across the app
import type { Storage } from '@/lib/cache'

export interface ShortService {
  name: string
  url: string
  description?: string
  icon?: string
}

export interface Service extends ShortService {
  github?: string
  followWith?: string
  securityAudited?: boolean
  openSource?: boolean
  acceptsCrypto?: boolean
  tosdrId?: number | string
  androidApp?: string
  iosApp?: string
  subreddit?: string
  discordInvite?: string
}

export interface Section {
  name: string
  services: Service[]
  intro?: string
  notableMentions?: ShortService[] | string
  furtherInfo?: string
  wordOfWarning?: string
  alternativeTo?: string[]
}

export interface Category {
  name: string
  sections: Section[]
}

export interface AwesomePrivacy {
  categories: Category[]
}

// Flattened service for listing and search, with slug context
export interface FlatService extends Service {
  slug: string
  category: string
  categorySlug: string
  section: string
  sectionSlug: string
}

export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>
}

// Unified environment seen by both Workers + Node
export interface AppEnv {
  API_TOKEN?: string
  // When truthy, /enrich/* requires a valid bearer token (off by default)
  REQUIRE_AUTH?: string
  DISCORD_BOT_TOKEN?: string
  APIVOID_API_KEY?: string
  EXODUS_TOKEN?: string
  GITHUB_TOKEN?: string
  DOCKERHUB_TOKEN?: string
  CACHE?: KVNamespace
  RATE_LIMIT?: RateLimiter
  ENRICH_RATE_LIMIT?: RateLimiter
  API_BASE?: string
}

export type HonoEnv = {
  Bindings: AppEnv
  Variables: { storage: Storage }
}
