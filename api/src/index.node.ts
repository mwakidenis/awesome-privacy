// Bun/Node entry, serves the same app with env from process.env
import { buildApp } from '@/app'
import { readEnv } from '@/lib/env'
import { log } from '@/lib/log'

const app = buildApp()
const env = readEnv()
const port = Number(process.env.PORT ?? 8787)

// Hand each incoming request the unified env as c.env
const handler = (request: Request) => app.fetch(request, env)

if (typeof Bun !== 'undefined') {
  Bun.serve({ port, fetch: handler })
  log.info('listening', { port, runtime: 'bun' })
} else {
  // Node fallback for non-Bun runtime
  const { serve } = await import('@hono/node-server')
  serve({ fetch: handler, port }, () => {
    log.info('listening', { port, runtime: 'node' })
  })
}
