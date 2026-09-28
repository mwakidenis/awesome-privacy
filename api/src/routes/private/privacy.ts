// ToS;DR v3 lookup by service id
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, Ok, TosdrServiceSchema } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('privacy')

const route = createRoute({
  method: 'get',
  path: '/enrich/privacy/{tosdrId}',
  tags: ['Enrichment'],
  summary: 'Privacy policy info',
  request: { params: z.object({ tosdrId: z.string() }) },
  responses: {
    200: Ok(TosdrServiceSchema),
    401: ErrorResponse,
    500: ErrorResponse,
    502: ErrorResponse,
  },
})

// Pass through the ToS;DR v3 service shape
app.openapi(route, async (c) => {
  const { tosdrId } = c.req.valid('param')
  const upstream = `https://api.tosdr.org/service/v3?id=${encodeURIComponent(tosdrId)}`
  const data = await c.var.storage.fetch(`tosdr:${tosdrId}`, FRESH_TTL, () =>
    fetchJson(upstream, { timeoutMs: 8000 }),
  )
  return c.json(data as Record<string, unknown>, 200)
})

export default app
