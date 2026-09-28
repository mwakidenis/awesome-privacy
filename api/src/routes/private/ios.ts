// iTunes app lookup, accepts numeric id or bundle id, optional country
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { ApiError } from '@/lib/errors'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, ItunesAppSchema, Ok } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('ios')

interface ItunesResult {
  resultCount: number
  results: Record<string, unknown>[]
}

// iTunes accepts numeric ids prefixed with "id", strip that off
const normalize = (raw: string) => (raw.startsWith('id') ? raw.slice(2) : raw)

const route = createRoute({
  method: 'get',
  path: '/enrich/ios/{bundleId}',
  tags: ['Enrichment'],
  summary: 'iOS app info',
  request: {
    params: z.object({ bundleId: z.string() }),
    query: z.object({ country: z.string().length(2).optional() }),
  },
  responses: {
    200: Ok(ItunesAppSchema),
    401: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
    502: ErrorResponse,
  },
})

app.openapi(route, async (c) => {
  const { bundleId } = c.req.valid('param')
  const { country = 'us' } = c.req.valid('query')
  const id = normalize(bundleId)
  const idParam = /^\d+$/.test(id) ? `id=${id}` : `bundleId=${encodeURIComponent(id)}`
  const upstream = `https://itunes.apple.com/lookup?${idParam}&country=${country}`
  const data = await c.var.storage.fetch(`ios:${country}:${id}`, FRESH_TTL, async () => {
    const result = await fetchJson<ItunesResult>(upstream)
    const first = result.results?.[0]
    if (!result.resultCount || !first) {
      throw new ApiError('NOT_FOUND', `No app found for '${id}'`, 404)
    }
    return first
  })
  return c.json(data, 200)
})

export default app
