// MCP HTTP/SSE endpoints, tools reuse the same data layer as public routes
import { Hono } from 'hono'
import { allServices, categories, findService, slugify } from '@/lib/data'
import { search } from '@/lib/search'
import type { HonoEnv } from '@/types'

const app = new Hono<HonoEnv>()

interface JsonRpcReq {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
})

const str = { type: 'string' }
const num = { type: 'number' }

const tools: Tool[] = [
  {
    name: 'search_services',
    description: 'Full-text search privacy services',
    inputSchema: obj({ q: str, limit: num }, ['q']),
  },
  {
    name: 'get_service',
    description: 'Fetch one service by slug',
    inputSchema: obj({ slug: str }, ['slug']),
  },
  {
    name: 'list_categories',
    description: 'List all categories with sections',
    inputSchema: obj({}),
  },
  {
    name: 'compare_services',
    description: 'Return two services side by side',
    inputSchema: obj({ a: str, b: str }, ['a', 'b']),
  },
  {
    name: 'recommend_alternative',
    description: 'Recommend services in the same section',
    inputSchema: obj({ slug: str, limit: num }, ['slug']),
  },
]

const summariseCategories = () =>
  categories().map((category) => ({
    name: category.name,
    slug: slugify(category.name),
    sections: (category.sections ?? []).map((section) => ({
      name: section.name,
      slug: slugify(section.name),
    })),
  }))

const recommend = (slug: string, limit: number) => {
  const service = findService(slug)
  if (!service) return { error: 'not_found' }
  const peers = allServices().filter(
    (peer) => peer.sectionSlug === service.sectionSlug && peer.slug !== service.slug,
  )
  return peers.slice(0, limit)
}

// Dispatch a single MCP tool call to the in-process handler
const runTool = (name: string, args: Record<string, unknown>): unknown => {
  if (name === 'search_services') {
    return search(String(args.q ?? ''), Number(args.limit ?? 20))
  }
  if (name === 'get_service') {
    return findService(String(args.slug)) ?? { error: 'not_found' }
  }
  if (name === 'list_categories') return summariseCategories()
  if (name === 'compare_services') {
    return { a: findService(String(args.a)), b: findService(String(args.b)) }
  }
  if (name === 'recommend_alternative') {
    return recommend(String(args.slug), Number(args.limit ?? 5))
  }
  return { error: `unknown_tool:${name}` }
}

const initializeResult = {
  protocolVersion: '2024-11-05',
  capabilities: { tools: {} },
  serverInfo: { name: 'awesome-privacy', version: '1.0.0' },
}

// MCP server, handles initialize, tools/list and tools/call
const handle = (req: JsonRpcReq) => {
  const id = req.id ?? null
  if (req.method === 'initialize') {
    return { jsonrpc: '2.0', id, result: initializeResult }
  }
  if (req.method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools } }
  }
  if (req.method === 'tools/call') {
    const params = req.params ?? {}
    const name = String(params.name)
    const args = (params.arguments ?? {}) as Record<string, unknown>
    const output = runTool(name, args)
    const content = [{ type: 'text', text: JSON.stringify(output) }]
    return { jsonrpc: '2.0', id, result: { content } }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }
}

app.post('/mcp', async (c) => c.json(handle(await c.req.json())))

// SSE handshake, emits the tool list once and stays open
app.get('/sse', () => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const payload = JSON.stringify({ tools })
      controller.enqueue(encoder.encode(`event: ready\ndata: ${payload}\n\n`))
    },
  })
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  })
})

export default app
