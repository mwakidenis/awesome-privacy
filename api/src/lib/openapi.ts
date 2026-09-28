/**
 * OpenAPI Hono factory used by every public route module
 * Also wires a shared zod validation hook, for 400 responses
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { envelope } from '@/lib/errors'
import type { HonoEnv } from '@/types'

interface ZodIssue {
  path: (string | number)[]
  message: string
}
interface ZodLike {
  issues?: ZodIssue[]
}

// Translate zod validation failures into the shared error envelope
const defaultHook = (result: { success: boolean; error?: unknown }, c: Context) => {
  if (result.success) return
  const issues = (result.error as ZodLike).issues ?? []
  const message = issues.length
    ? issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    : 'Invalid input'
  return c.json(envelope('BAD_REQUEST', message, 400), 400)
}

// Build a fresh OpenAPIHono, optionally with extra Hono options like strict
export const newApp = (opts: { strict?: boolean } = {}) =>
  new OpenAPIHono<HonoEnv>({ defaultHook, ...opts })
