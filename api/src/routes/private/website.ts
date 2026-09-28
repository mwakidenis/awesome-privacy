// APIVoid website report passthrough
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { ApiError } from '@/lib/errors'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, Ok, WebsiteReportSchema } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('website')

interface ApiVoidResp {
  data?: { report?: unknown }
}

const route = createRoute({
  method: 'get',
  path: '/enrich/website',
  tags: ['Enrichment'],
  summary: 'Website info',
  request: { query: z.object({ url: z.string().url() }) },
  responses: {
    200: Ok(WebsiteReportSchema),
    400: ErrorResponse,
    401: ErrorResponse,
    500: ErrorResponse,
    502: ErrorResponse,
  },
})

// Cache key is the host so different paths on the same domain share results
app.openapi(route, async (c) => {
  const { url: target } = c.req.valid('query')
  const host = new URL(target).hostname
  const key = c.env.APIVOID_API_KEY
  if (!key) throw new ApiError('INTERNAL', 'APIVOID_API_KEY not configured', 500)
  const upstream =
    'https://endpoint.apivoid.com/urlrep/v1/pay-as-you-go/' +
    `?key=${key}&url=${encodeURIComponent(target)}`
  const data = await c.var.storage.fetch(`website:${host}`, FRESH_TTL, async () => {
    const result = await fetchJson<ApiVoidResp>(upstream, { timeoutMs: 15000 })
    if (!result?.data?.report) {
      throw new ApiError('UPSTREAM_ERROR', 'APIVoid did not return a report', 502)
    }
    return result.data.report as Record<string, unknown>
  })
  return c.json(data as Record<string, unknown>, 200)
})

export default app
