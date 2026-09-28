// Category and section lookup routes
import { createRoute, z } from '@hono/zod-openapi'
import { categories, findCategory, findSection, slugify } from '@/lib/data'
import { ApiError } from '@/lib/errors'
import { newApp } from '@/lib/openapi'
import {
  CategorySchema,
  Envelope,
  ErrorResponse,
  ListEnvelope,
  Ok,
  SectionSchema,
} from '@/schemas'
import type { Category } from '@/types'

const app = newApp()

const sectionSummary = (category: Category) =>
  (category.sections ?? []).map((section) => ({
    name: section.name,
    slug: slugify(section.name),
  }))

const listCategories = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Public'],
  summary: 'List categories',
  responses: {
    200: Ok(ListEnvelope(CategorySchema)),
  },
})

// Categories with their section names plus slugs, no service payload
app.openapi(listCategories, (c) => {
  const data = categories().map((category) => ({
    name: category.name,
    slug: slugify(category.name),
    sections: sectionSummary(category),
  }))
  return c.json({
    data,
    pagination: { page: 1, limit: data.length, total: data.length, hasMore: false },
  })
})

const oneCategory = createRoute({
  method: 'get',
  path: '/categories/{slug}',
  tags: ['Public'],
  summary: 'Get category',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: Ok(Envelope(CategorySchema)),
    404: ErrorResponse,
  },
})

app.openapi(oneCategory, (c) => {
  const { slug } = c.req.valid('param')
  const category = findCategory(slug)
  if (!category) throw new ApiError('NOT_FOUND', `Category '${slug}' not found`, 404)
  return c.json(
    {
      data: {
        name: category.name,
        slug: slugify(category.name),
        sections: sectionSummary(category),
      },
    },
    200,
  )
})

const oneSection = createRoute({
  method: 'get',
  path: '/sections/{slug}',
  tags: ['Public'],
  summary: 'Get section',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: Ok(Envelope(SectionSchema)),
    404: ErrorResponse,
  },
})

app.openapi(oneSection, (c) => {
  const { slug } = c.req.valid('param')
  const hit = findSection(slug)
  if (!hit) throw new ApiError('NOT_FOUND', `Section '${slug}' not found`, 404)
  const { section } = hit
  return c.json(
    {
      data: {
        name: section.name,
        slug: slugify(section.name),
        intro: section.intro,
        furtherInfo: section.furtherInfo,
        wordOfWarning: section.wordOfWarning,
        alternativeTo: section.alternativeTo,
        services: section.services ?? [],
      },
    },
    200,
  )
})

export default app
