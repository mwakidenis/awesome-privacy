// Service listings + single service lookup
import { createRoute, z } from '@hono/zod-openapi'
import { allServices, findService } from '@/lib/data'
import { ApiError } from '@/lib/errors'
import { newApp } from '@/lib/openapi'
import { Envelope, ErrorResponse, FlatServiceSchema, ListEnvelope, Ok } from '@/schemas'

const app = newApp()

const listRoute = createRoute({
  method: 'get',
  path: '/services',
  tags: ['Public'],
  summary: 'List services',
  request: {
    query: z.object({
      category: z.string().optional(),
      section: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  },
  responses: {
    200: Ok(ListEnvelope(FlatServiceSchema)),
    400: ErrorResponse,
  },
})

// Filter then paginate the flat service list
app.openapi(listRoute, (c) => {
  const { category, section, page, limit } = c.req.valid('query')
  let items = allServices()
  if (category) items = items.filter((service) => service.categorySlug === category)
  if (section) items = items.filter((service) => service.sectionSlug === section)
  const total = items.length
  const start = (page - 1) * limit
  const slice = items.slice(start, start + limit)
  return c.json(
    {
      data: slice,
      pagination: { page, limit, total, hasMore: start + slice.length < total },
    },
    200,
  )
})

const oneRoute = createRoute({
  method: 'get',
  path: '/services/{slug}',
  tags: ['Public'],
  summary: 'Get service',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: Ok(Envelope(FlatServiceSchema)),
    404: ErrorResponse,
  },
})

app.openapi(oneRoute, (c) => {
  const { slug } = c.req.valid('param')
  const service = findService(slug)
  if (!service) throw new ApiError('NOT_FOUND', `Service '${slug}' not found`, 404)
  return c.json({ data: service }, 200)
})

export default app
