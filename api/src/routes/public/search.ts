// Full-text search via MiniSearch
import { createRoute, z } from '@hono/zod-openapi'
import { search } from '@/lib/search'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, ListEnvelope, Ok, SearchHitSchema } from '@/schemas'

const app = newApp()

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const route = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Public'],
  summary: 'Search',
  request: { query: querySchema },
  responses: {
    200: Ok(ListEnvelope(SearchHitSchema)),
    400: ErrorResponse,
  },
})

app.openapi(route, (c) => {
  const { q, limit } = c.req.valid('query')
  const hits = search(q, limit).map((hit) => ({
    slug: hit.slug,
    name: hit.name,
    url: hit.url,
    description: hit.description,
    category: hit.category,
    categorySlug: hit.categorySlug,
    section: hit.section,
    sectionSlug: hit.sectionSlug,
    score: hit.score,
  }))
  return c.json(
    {
      data: hits,
      pagination: { page: 1, limit, total: hits.length, hasMore: false },
    },
    200,
  )
})

export default app
