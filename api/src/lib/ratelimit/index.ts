/**
 * Rate limit middleware factory
 * Basic measure to prevent obvious abuse for public routes
 * Uses CF's native rate-limiting API, configurable in wrangler.toml
 * The binding is selectable, so different routes can use different limits
 * By default, there's no rate-limiting on self-hosted/Bun versions
 */
import type { MiddlewareHandler } from 'hono'
import { ApiError } from '@/lib/errors'
import type { AppEnv, HonoEnv, RateLimiter } from '@/types'

export const rateLimit =
  (
    pick: (env: AppEnv) => RateLimiter | undefined = (env) => env.RATE_LIMIT,
  ): MiddlewareHandler<HonoEnv> =>
  async (c, next) => {
    const limiter = pick(c.env)
    if (!limiter) return next()
    const key =
      c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'anon'
    const { success } = await limiter.limit({ key })
    if (!success) throw new ApiError('RATE_LIMITED', 'Too many requests', 429)
    return next()
  }
