// Repo security report: deps.dev scorecard + OSS-Fuzz + GitHub advisories
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { githubHeaders } from '@/lib/github'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, Ok, SecurityReportSchema } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('security')

interface Check {
  name?: string
  score?: number
  reason?: string
  documentation?: { url?: string }
}

interface Project {
  scorecard?: { date?: string; overallScore?: number; checks?: Check[] }
  ossFuzz?: unknown
}

interface Vuln {
  vulnerable_version_range?: string | null
  // Repo advisories carry the fix here, the global advisory db uses first_patched_version
  patched_versions?: string | null
  first_patched_version?: { identifier?: string } | null
}

interface Advisory {
  ghsa_id?: string
  cve_id?: string | null
  summary?: string
  severity?: string
  cvss?: { score?: number | null }
  published_at?: string
  withdrawn_at?: string | null
  state?: string
  html_url?: string
  vulnerabilities?: Vuln[] | null
}

const mapCheck = (check: Check) => ({
  name: check.name ?? '',
  score: check.score ?? -1,
  reason: check.reason ?? '',
  url: check.documentation?.url ?? '',
})

// A lone strict "< x" range names the fix version, otherwise unknown
const deriveFix = (ranges: string[]) => {
  const match = ranges.length === 1 ? ranges[0].match(/^<\s*([\w.+-]+)$/) : null
  return match ? match[1] : null
}

const mapAdvisory = (a: Advisory) => {
  const vulns = a.vulnerabilities ?? []
  const ranges = [
    ...new Set(
      vulns
        .map((v) => v.vulnerable_version_range?.trim())
        .filter((r): r is string => !!r),
    ),
  ]
  const vulnerableRange = ranges.join('; ')
  const explicit = vulns
    .map((v) => v.patched_versions?.trim() || v.first_patched_version?.identifier)
    .find(Boolean)
  const firstPatchedVersion = explicit ?? deriveFix(ranges)
  return {
    ghsaId: a.ghsa_id ?? '',
    cveId: a.cve_id ?? null,
    summary: a.summary ?? '',
    severity: a.severity ?? '',
    cvssScore: a.cvss?.score ?? null,
    publishedAt: a.published_at ?? '',
    url: a.html_url ?? '',
    firstPatchedVersion,
    vulnerableRange,
    // an upper bound means later versions are safe, so a fix exists
    isPatched: Boolean(firstPatchedVersion) || vulnerableRange.includes('<'),
  }
}

// OpenSSF Scorecard + fuzzing signal from deps.dev, degrades to empty
const getPosture = async (slug: string) => {
  try {
    const key = encodeURIComponent(`github.com/${slug}`)
    const project = await fetchJson<Project>(`https://api.deps.dev/v3/projects/${key}`)
    const card = project.scorecard
    return {
      scorecard: {
        available: Boolean(card),
        overallScore: card?.overallScore ?? null,
        generatedAt: card?.date ?? '',
        checks: (card?.checks ?? []).map(mapCheck),
      },
      fuzzed: Boolean(project.ossFuzz),
    }
  } catch {
    return {
      scorecard: { available: false, overallScore: null, generatedAt: '', checks: [] },
      fuzzed: false,
    }
  }
}

// Maintainer-published GitHub security advisories, degrades to empty
const getAdvisories = async (slug: string, token?: string) => {
  try {
    const list = await fetchJson<Advisory[]>(
      `https://api.github.com/repos/${slug}/security-advisories?per_page=100&state=published`,
      { headers: githubHeaders(token) },
    )
    const items = list.filter((a) => !a.withdrawn_at).map(mapAdvisory)
    return { count: items.length, items }
  } catch {
    return { count: 0, items: [] }
  }
}

const route = createRoute({
  method: 'get',
  path: '/enrich/security/{owner}/{repo}',
  tags: ['Enrichment'],
  summary: 'Repo security',
  request: { params: z.object({ owner: z.string(), repo: z.string() }) },
  responses: {
    200: Ok(SecurityReportSchema),
    401: ErrorResponse,
    500: ErrorResponse,
  },
})

app.openapi(route, async (c) => {
  const { owner, repo } = c.req.valid('param')
  const slug = `${owner}/${repo}`
  const data = await c.var.storage.fetch(`sec:${slug}`, FRESH_TTL, async () => {
    const [posture, advisories] = await Promise.all([
      getPosture(slug),
      getAdvisories(slug, c.env.GITHUB_TOKEN),
    ])
    return { repo: slug, ...posture, advisories }
  })
  return c.json(data, 200)
})

export default app
