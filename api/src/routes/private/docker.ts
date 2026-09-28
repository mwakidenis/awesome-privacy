// Docker image info from Portainer templates plus Docker Hub metrics
import { createRoute, z } from '@hono/zod-openapi'
import { ApiError } from '@/lib/errors'
import { fetchJson } from '@/lib/fetch'
import { freshSeconds } from '@/lib/cache/freshness'
import { newApp } from '@/lib/openapi'
import { composeFile, normalize, runCommand, type Template } from '@/lib/docker'
import { DockerInfoSchema, ErrorResponse, Ok } from '@/schemas'

const app = newApp()

const FRESH_TTL = freshSeconds('docker')

const TEMPLATES_URL =
  'https://raw.githubusercontent.com/Lissy93/portainer-templates/main/templates.json'

interface TemplateList {
  templates?: Template[]
}

// Templates whose title or name loosely matches, preferring runnable (image-bearing) ones
const matchTemplate = (templates: Template[], query: string) => {
  const matches = templates.filter(
    (t) =>
      normalize(t.title ?? '').includes(query) || normalize(t.name ?? '').includes(query),
  )
  return matches.find((t) => t.image) ?? matches[0]
}

// Docker Hub repo metrics for an image, null when missing or unavailable
const getHubData = async (image: string, token?: string) => {
  const [name] = image.split(':')
  const [namespace, repo] = name.includes('/') ? name.split('/') : ['library', name]
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetchJson(
      `https://hub.docker.com/v2/repositories/${namespace}/${repo}/`,
      { headers },
    )
  } catch {
    return null
  }
}

const route = createRoute({
  method: 'get',
  path: '/enrich/docker/{name}',
  tags: ['Enrichment'],
  summary: 'Docker image info',
  request: { params: z.object({ name: z.string().min(1) }) },
  responses: {
    200: Ok(DockerInfoSchema),
    400: ErrorResponse,
    401: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
})

app.openapi(route, async (c) => {
  const { name } = c.req.valid('param')
  const query = normalize(name)
  if (!query) throw new ApiError('BAD_REQUEST', 'Invalid image name', 400)
  const data = await c.var.storage.fetch(`docker:${query}`, FRESH_TTL, async () => {
    const list = await fetchJson<TemplateList>(TEMPLATES_URL)
    const template = matchTemplate(list.templates ?? [], query)
    if (!template) {
      throw new ApiError('NOT_FOUND', `'${name}' not found in Portainer templates`, 404)
    }
    const dockerHubData = template.image
      ? await getHubData(template.image, c.env.DOCKERHUB_TOKEN)
      : null
    return {
      found: true,
      error: null,
      template,
      dockerHubData,
      usage: {
        dockerRunCommand: runCommand(template),
        dockerComposeFile: composeFile(template),
      },
    }
  })
  return c.json(data, 200)
})

export default app
