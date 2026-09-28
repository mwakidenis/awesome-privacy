// Hono app assembler, the same instance runs on Workers and on Bun
import { cors } from 'hono/cors'
import { Scalar } from '@scalar/hono-api-reference'

import { createStorage } from '@/lib/cache'
import { ApiError, errorHandler, notFound } from '@/lib/errors'
import { hasValidToken, authRequired } from '@/lib/auth'
import { rateLimit } from '@/lib/ratelimit'
import { newApp } from '@/lib/openapi'
import type { AppEnv } from '@/types'

import services from '@/routes/public/services'
import categoriesRoute from '@/routes/public/categories'
import searchRoute from '@/routes/public/search'
import stats from '@/routes/public/stats'

import privacy from '@/routes/private/privacy'
import github from '@/routes/private/github'
import ios from '@/routes/private/ios'
import android from '@/routes/private/android'
import discord from '@/routes/private/discord'
import reddit from '@/routes/private/reddit'
import website from '@/routes/private/website'
import security from '@/routes/private/security'
import docker from '@/routes/private/docker'

import mcp from '@/routes/mcp'

const buildPublic = () => {
  // Public browse routes, shared middleware is applied at the app level
  const pub = newApp()
  pub.route('/', services)
  pub.route('/', categoriesRoute)
  pub.route('/', searchRoute)
  pub.route('/', stats)
  return pub
}

const buildPrivate = () => {
  // Enrichment routes, public but rate-limited (see rate-limit wiring below)
  const priv = newApp()
  priv.route('/', privacy)
  priv.route('/', github)
  priv.route('/', ios)
  priv.route('/', android)
  priv.route('/', discord)
  priv.route('/', reddit)
  priv.route('/', website)
  priv.route('/', security)
  priv.route('/', docker)
  return priv
}

export const buildApp = () => {
  const app = newApp({ strict: false })

  app.onError(errorHandler)
  app.notFound(notFound)

  // Inject per-request storage backed by KV or in-memory
  app.use('*', async (c, next) => {
    c.set('storage', createStorage(c.env as AppEnv))
    await next()
  })

  // CORS everywhere. Public browse routes get the standard limit; enrich routes
  // are public too, but anonymous callers hit a stricter limit while a valid
  // bearer token bypasses it. Edge caching stays off for enrich (below).
  app.use('*', cors({ origin: '*' }))
  const publicLimiter = rateLimit()
  const enrichLimiter = rateLimit((env) => env.ENRICH_RATE_LIMIT ?? env.RATE_LIMIT)
  app.use('/v1/*', (c, next) => {
    if (!c.req.path.startsWith('/v1/enrich')) return publicLimiter(c, next)
    const authed = hasValidToken(c.env.API_TOKEN, c.req.header('authorization'))
    if (authRequired(c.env.REQUIRE_AUTH) && !authed) {
      throw new ApiError('UNAUTHORIZED', 'Invalid or missing bearer token', 401)
    }
    if (authed) return next()
    return enrichLimiter(c, next)
  })
  app.use('/v1/*', async (c, next) => {
    if (c.req.path.startsWith('/v1/enrich')) return next()
    await next()
    c.header('Cache-Control', 'public, s-maxage=300')
  })

  app.route('/v1', buildPublic())
  app.route('/v1', buildPrivate())
  app.route('/v1', mcp)

  const description = `
  The API allows you to browse awesome-privacy's data programmatically.
  It also runs some lookups/checks on listings to surface useful insights
  to add additional context to listings, and save time when comparing software / services.
  <br>
  These endpoints are used by as part of the website generation,
  the PR review process and the scheduled listing audits.
  You're also free to use it for your own purposes.
  <br>
  > [!IMPORTANT]
  > It's very important not to rely on this data for any decision making,
  > as it only gives a very narrow slice of the picture.
  > There's also many real privacy issues which the automated lookups have no way of detecting,
  > as well as the possibility for false positives/negatives.
  > **Always do your own research**.

<details>
<summary>Authenticating</summary>

The enrichment endpoints are public, but anonymous requests are rate-limited.
On the hosted instance, sending a valid \`Authorization: Bearer <token>\` header
exempts the request from rate limiting. Self-hosters can set the \`API_TOKEN\`
env var to enable the same bypass for their own token.
To lock the endpoints down entirely, set \`REQUIRE_AUTH\` (alongside \`API_TOKEN\`):
requests without a valid token are then rejected with a 401.
</details>

<details>
<summary>Caching</summary>

Some responses are cached to reduce load on upstream services.
When configured, successful enrichment results are cached in KV and served while fresh
(from a week up to 90 days, depending on the endpoint). Stale entries are refreshed on
demand, falling back to the cached copy if the upstream is unavailable.
</details>

<details>
<summary>Self-Hosting</summary>

See the [repo](https://github.com/lissy93/awesome-privacy/tree/main/api) for
deployment and development guides, as well as instructions for self-hosting, contributing and usage.
</details>

  `

  const publicDescription =
    'Endpoints to browse the awesome-privacy dataset programatically'
  const enrichDescription =
    'Endpoints to fetch additional data about listings from external sources'

  // OpenAPI document plus Scalar UI
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Awesome Privacy API',
      version: '1.0.0',
      description,
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Public', description: publicDescription },
      { name: 'Enrichment', description: enrichDescription },
    ],
  })
  const blurb = 'Browse awesome-privacy data and enrichment insights programmatically.'
  app.get(
    '/docs',
    Scalar({
      url: '/openapi.json',
      theme: 'laserwave',
      persistAuth: true,
      favicon: 'https://awesome-privacy.xyz/favicon.svg',
      operationTitleSource: 'summary',
      operationsSorter: 'alpha',
      orderRequiredPropertiesFirst: true,
      mcp: { name: 'Awesome Privacy', url: '/v1/mcp' },
      metaData: {
        title: 'Awesome Privacy API',
        description: blurb,
        ogTitle: 'Awesome Privacy API',
        ogDescription: blurb,
        ogImage: 'https://awesome-privacy.xyz/banner.png',
        twitterCard: 'summary_large_image',
      },
    }),
  )

  app.get('/', (c) => c.redirect('/docs'))

  return app
}
