// Integration tests against the assembled app (no upstream calls)
import { describe, it, expect } from 'vitest'
import { buildApp } from '../src/app'

const app = buildApp()
const env = { API_TOKEN: 'test' }

const hit = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init), env)

describe('public routes', () => {
  it('health returns ok envelope', async () => {
    const res = await hit('/v1/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ data: { status: 'ok' } })
  })

  it('stats has positive counts', async () => {
    const res = await hit('/v1/stats')
    const { data } = (await res.json()) as any
    expect(data.categories).toBeGreaterThan(0)
    expect(data.services).toBeGreaterThan(0)
  })

  it('categories returns wrapped list', async () => {
    const res = await hit('/v1/categories')
    const body = (await res.json()) as any
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0]).toHaveProperty('slug')
  })

  it('unknown service returns NOT_FOUND envelope', async () => {
    const res = await hit('/v1/services/nope-nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('search without q returns BAD_REQUEST envelope', async () => {
    const res = await hit('/v1/search')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } })
  })

  it('search returns results for known term', async () => {
    const res = await hit('/v1/search?q=password&limit=3')
    const body = (await res.json()) as any
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('services paginates', async () => {
    const res = await hit('/v1/services?limit=5')
    const body = (await res.json()) as any
    expect(body.data).toHaveLength(5)
    expect(body.pagination).toMatchObject({ page: 1, limit: 5, hasMore: true })
  })
})

describe('enrich rate limiting', () => {
  // A limiter that always denies, recording how many times it was consulted
  const denyLimiter = () => {
    const calls = { n: 0 }
    const limiter = {
      limit: async () => {
        calls.n++
        return { success: false }
      },
    }
    return { limiter, calls }
  }
  // A KV cache pre-seeded so handlers serve cached data without any upstream call
  const seededCache = (value: unknown) => ({
    get: async () => ({ value, cachedAt: Date.now() }),
    put: async () => {},
  })

  it('anonymous enrich request is rate-limited', async () => {
    const { limiter, calls } = denyLimiter()
    const res = await app.fetch(new Request('http://localhost/v1/enrich/privacy/1'), {
      API_TOKEN: 'test',
      ENRICH_RATE_LIMIT: limiter,
    })
    expect(res.status).toBe(429)
    expect(calls.n).toBe(1)
  })

  it('valid bearer token bypasses the enrich rate limit', async () => {
    const { limiter, calls } = denyLimiter()
    const res = await app.fetch(
      new Request('http://localhost/v1/enrich/privacy/1', {
        headers: { authorization: 'Bearer test' },
      }),
      { API_TOKEN: 'test', ENRICH_RATE_LIMIT: limiter, CACHE: seededCache({ id: 1 }) },
    )
    expect(res.status).toBe(200)
    expect(calls.n).toBe(0)
  })

  it('wrong token does not bypass the enrich rate limit', async () => {
    const { limiter, calls } = denyLimiter()
    const res = await app.fetch(
      new Request('http://localhost/v1/enrich/privacy/1', {
        headers: { authorization: 'Bearer wrong' },
      }),
      { API_TOKEN: 'test', ENRICH_RATE_LIMIT: limiter },
    )
    expect(res.status).toBe(429)
    expect(calls.n).toBe(1)
  })

  it('REQUIRE_AUTH rejects missing/invalid token with 401', async () => {
    const env = { API_TOKEN: 'test', REQUIRE_AUTH: 'true' }
    expect(
      (await app.fetch(new Request('http://localhost/v1/enrich/privacy/1'), env)).status,
    ).toBe(401)
    const wrong = await app.fetch(
      new Request('http://localhost/v1/enrich/privacy/1', {
        headers: { authorization: 'Bearer wrong' },
      }),
      env,
    )
    expect(wrong.status).toBe(401)
  })

  it('REQUIRE_AUTH still admits a valid token', async () => {
    const res = await app.fetch(
      new Request('http://localhost/v1/enrich/privacy/1', {
        headers: { authorization: 'Bearer test' },
      }),
      { API_TOKEN: 'test', REQUIRE_AUTH: 'true', CACHE: seededCache({ id: 1 }) },
    )
    expect(res.status).toBe(200)
  })
})

describe('middleware scoping', () => {
  it('public routes are edge cacheable', async () => {
    const res = await hit('/v1/stats')
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=300')
  })

  it('enrich routes are not advertised as public cacheable', async () => {
    // Seed the cache so the handler serves without an upstream call
    const cache = {
      get: async () => ({ value: { id: 1 }, cachedAt: Date.now() }),
      put: async () => {},
    }
    const res = await app.fetch(new Request('http://localhost/v1/enrich/privacy/1'), {
      API_TOKEN: 'test',
      CACHE: cache,
    })
    expect(res.headers.get('cache-control') ?? '').not.toContain('public')
  })
})

describe('mcp', () => {
  it('lists tools', async () => {
    const res = await hit('/v1/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const body = (await res.json()) as any
    expect(body.result.tools.length).toBeGreaterThan(0)
  })

  it('runs get_service tool', async () => {
    const res = await hit('/v1/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_service', arguments: { slug: 'bitwarden' } },
      }),
    })
    const body = (await res.json()) as any
    const out = JSON.parse(body.result.content[0].text)
    expect(out.name).toBe('Bitwarden')
  })
})
