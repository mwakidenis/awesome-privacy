// Aggregate counts plus health route
import { createRoute } from '@hono/zod-openapi'
import { stats } from '@/lib/data'
import { newApp } from '@/lib/openapi'
import { Envelope, HealthSchema, Ok, StatsSchema } from '@/schemas'

const app = newApp()

const statsRoute = createRoute({
  method: 'get',
  path: '/stats',
  tags: ['Public'],
  summary: 'Stats',
  responses: { 200: Ok(Envelope(StatsSchema)) },
})

app.openapi(statsRoute, (c) => c.json({ data: stats() }))

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Public'],
  summary: 'Health',
  responses: { 200: Ok(Envelope(HealthSchema)) },
})

app.openapi(healthRoute, (c) =>
  c.json({
    data: {
      status: 'ok' as const,
      uptime: typeof process !== 'undefined' ? process.uptime() : 0,
    },
  }),
)

export default app
