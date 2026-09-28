// GitHub repo info, aggregates info, languages, tags, contributors, commits
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { githubHeaders } from '@/lib/github'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, GithubRepoSchema, Ok } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('github')

interface RepoInfo {
  owner?: { login?: string; avatar_url?: string }
  description?: string
  html_url?: string
  homepage?: string
  language?: string
  topics?: string[]
  license?: { spdx_id?: string; name?: string }
  fork?: boolean
  archived?: boolean
  parent?: { full_name?: string }
  created_at?: string
  updated_at?: string
  pushed_at?: string
  size?: number
  stargazers_count?: number
  forks_count?: number
  watchers_count?: number
  open_issues_count?: number
}

interface Tag {
  name: string
  commit?: { sha?: string }
  zipball_url?: string
  tarball_url?: string
}

interface Contributor {
  login?: string
  avatar_url?: string
  html_url?: string
  contributions?: number
}

interface CommitAuthor {
  name?: string
  date?: string
}

interface Commit {
  sha?: string
  commit?: { author?: CommitAuthor; message?: string }
  author?: { login?: string; avatar_url?: string }
}

const mapInfo = (info: RepoInfo) => ({
  ownerUsername: info.owner?.login ?? '',
  ownerAvatar: info.owner?.avatar_url ?? '',
  description: info.description ?? '',
  url: info.html_url ?? '',
  homepage: info.homepage ?? '',
  language: info.language ?? '',
  topics: info.topics ?? [],
  license: info.license?.spdx_id ?? '',
  licenseName: info.license?.name ?? '',
  isFork: info.fork ?? false,
  isArchived: info.archived ?? false,
  forkParent: info.parent?.full_name ?? '',
  createdAt: info.created_at ?? '',
  updatedAt: info.updated_at ?? '',
  pushedAt: info.pushed_at ?? '',
  size: info.size ?? 0,
  starCount: info.stargazers_count ?? 0,
  forksCount: info.forks_count ?? 0,
  watchersCount: info.watchers_count ?? 0,
  openIssues: info.open_issues_count ?? 0,
})

const mapVersion = (tag: Tag) => ({
  name: tag.name,
  commit: tag.commit?.sha ?? '',
  zipball: tag.zipball_url ?? '',
  tarball: tag.tarball_url ?? '',
})

const mapContributor = (person: Contributor) => ({
  username: person.login ?? '',
  avatar: person.avatar_url ?? '',
  url: person.html_url ?? '',
  contributions: person.contributions ?? 0,
})

const mapCommit = (commit: Commit) => ({
  sha: commit.sha ?? '',
  authorName: commit.commit?.author?.name ?? '',
  authorDate: commit.commit?.author?.date ?? '',
  message: commit.commit?.message ?? '',
  authorUsername: commit.author?.login ?? '',
  authorAvatar: commit.author?.avatar_url ?? '',
})

const route = createRoute({
  method: 'get',
  path: '/enrich/github/{owner}/{repo}',
  tags: ['Enrichment'],
  summary: 'GitHub repo info',
  request: { params: z.object({ owner: z.string(), repo: z.string() }) },
  responses: {
    200: Ok(GithubRepoSchema),
    401: ErrorResponse,
    500: ErrorResponse,
    502: ErrorResponse,
  },
})

// Fan out to the repo, languages, tags, contributors and commits endpoints
app.openapi(route, async (c) => {
  const { owner, repo } = c.req.valid('param')
  const slug = `${owner}/${repo}`
  const headers = githubHeaders(c.env.GITHUB_TOKEN)
  const data = await c.var.storage.fetch(`gh:${slug}`, FRESH_TTL, async () => {
    const base = `https://api.github.com/repos/${slug}`
    const [info, languages, tags, contributors, commits] = await Promise.all([
      fetchJson<RepoInfo>(base, { headers }),
      fetchJson<Record<string, number>>(`${base}/languages`, { headers }),
      fetchJson<Tag[]>(`${base}/tags`, { headers }),
      fetchJson<Contributor[]>(`${base}/contributors?per_page=100`, { headers }),
      fetchJson<Commit[]>(`${base}/commits`, { headers }),
    ])
    return {
      info: mapInfo(info),
      languages: languages ?? {},
      versions: tags.map(mapVersion),
      contributors: contributors.map(mapContributor),
      commits: commits.map(mapCommit),
    }
  })
  return c.json(data, 200)
})

export default app
