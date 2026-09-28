// Subreddit info and top monthly posts
import { createRoute, z } from '@hono/zod-openapi'
import { fetchJson } from '@/lib/fetch'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { ErrorResponse, Ok, SubredditSchema } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('reddit')

interface AboutData {
  data?: {
    display_name_prefixed?: string
    title?: string
    public_description?: string
    description?: string
    community_icon?: string
    banner_background_image?: string
    primary_color?: string
    subscribers?: number
    accounts_active?: number
    created?: number
    description_html?: string
  }
}

interface RedditPost {
  data: {
    title: string
    selftext: string
    ups: number
    downs: number
    created: number
    url: string
  }
}

interface PostListing {
  data?: { children?: RedditPost[] }
}

// Reddit blocks generic UAs, it wants a descriptive one with a contact handle
const headers = { 'User-Agent': 'awesome-privacy-api/1.0 by /u/Lissy93' }

const stripQuery = (raw?: string) => raw?.split('?')[0] ?? null

const mapInfo = (about: AboutData) => {
  const d = about.data ?? {}
  return {
    name: d.display_name_prefixed ?? null,
    title: d.title ?? null,
    description: d.public_description ?? null,
    longDescription: d.description ?? null,
    icon: stripQuery(d.community_icon),
    banner: stripQuery(d.banner_background_image),
    color: d.primary_color ?? null,
    subscribers: d.subscribers ?? null,
    activeSubscribers: d.accounts_active ?? null,
    dateCreated: d.created ?? null,
    descriptionHtml: d.description_html ?? null,
  }
}

const mapPosts = (top: PostListing) =>
  (top.data?.children ?? []).map(({ data }) => ({
    title: data.title,
    body: data.selftext,
    upVotes: data.ups,
    downVotes: data.downs,
    date: data.created,
    url: data.url,
  }))

const route = createRoute({
  method: 'get',
  path: '/enrich/reddit/{sub}',
  tags: ['Enrichment'],
  summary: 'Subreddit info',
  request: { params: z.object({ sub: z.string() }) },
  responses: {
    200: Ok(SubredditSchema),
    401: ErrorResponse,
    500: ErrorResponse,
    502: ErrorResponse,
  },
})

// Two Reddit reads in parallel, cached as one object
app.openapi(route, async (c) => {
  const { sub } = c.req.valid('param')
  const aboutUrl = `https://www.reddit.com/r/${sub}/about.json`
  const topUrl = `https://www.reddit.com/r/${sub}/top.json?t=month&limit=10`
  const data = await c.var.storage.fetch(`reddit:${sub}`, FRESH_TTL, async () => {
    const [about, top] = await Promise.all([
      fetchJson<AboutData>(aboutUrl, { headers }),
      fetchJson<PostListing>(topUrl, { headers }),
    ])
    return { info: mapInfo(about), posts: mapPosts(top) }
  })
  return c.json(data, 200)
})

export default app
