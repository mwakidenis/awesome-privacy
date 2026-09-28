// Exodus tracker analysis merged with Plexus de-Googled compatibility
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { ApiError } from '@/lib/errors'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { summarizeRatings, type PlexusRating } from '@/lib/plexus'
import { AndroidReportSchema, ErrorResponse, Ok } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('android')

interface AppDetails {
  trackers: number[]
  [key: string]: unknown
}
interface TrackerLookup {
  trackers: Record<string, unknown>
}

const EXODUS_BASE = 'https://reports.exodus-privacy.eu.org/api'
const PLEXUS_BASE = 'https://plexus.techlore.tech/api/v1'

// Exodus apk details with tracker ids resolved to records, null if unavailable
const getExodus = async (pkg: string, token: string) => {
  try {
    const headers = { Authorization: `Token ${token}` }
    const details = await fetchJson<AppDetails[]>(
      `${EXODUS_BASE}/search/${encodeURIComponent(pkg)}/details`,
      { headers, timeoutMs: 10000 },
    )
    const appInfo = details?.[0]
    if (!appInfo) return null
    const { trackers } = await fetchJson<TrackerLookup>(`${EXODUS_BASE}/trackers`, {
      headers,
      timeoutMs: 10000,
    })
    return { ...appInfo, trackers: appInfo.trackers.map((id) => trackers[String(id)]) }
  } catch {
    return null
  }
}

// Plexus crowdsourced de-Googled compatibility, null if the app has no ratings
const getDegoogled = async (pkg: string) => {
  try {
    const { data } = await fetchJson<{ data: PlexusRating[] }>(
      `${PLEXUS_BASE}/apps/${encodeURIComponent(pkg)}/ratings`,
    )
    return data?.length ? summarizeRatings(data) : null
  } catch {
    return null
  }
}

const route = createRoute({
  method: 'get',
  path: '/enrich/android/{pkg}',
  tags: ['Enrichment'],
  summary: 'Android app info',
  request: { params: z.object({ pkg: z.string() }) },
  responses: {
    200: Ok(AndroidReportSchema),
    401: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
})

// Merge Exodus trackers with Plexus de-Googled status, 404 only if both miss
app.openapi(route, async (c) => {
  const { pkg } = c.req.valid('param')
  const token = c.env.EXODUS_TOKEN
  if (!token) throw new ApiError('INTERNAL', 'EXODUS_TOKEN not configured', 500)
  const data = await c.var.storage.fetch(`android:${pkg}`, FRESH_TTL, async () => {
    const [exodus, degoogled] = await Promise.all([
      getExodus(pkg, token),
      getDegoogled(pkg),
    ])
    if (!exodus && !degoogled) {
      throw new ApiError(
        'NOT_FOUND',
        `Package '${pkg}' not found on Exodus or Plexus`,
        404,
      )
    }
    return { ...exodus, degoogled: degoogled ?? null }
  })
  return c.json(data, 200)
})

export default app
