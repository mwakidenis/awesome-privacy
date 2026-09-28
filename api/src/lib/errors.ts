/**
 * Standard error envelope for all API error responses
 * Known errors get suitable response message + code,
 * Anything unhandled is Internal Server Error and logs
 */

import type { Context } from 'hono'
import { log } from '@/lib/log'

export type ErrorCode =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'

export class ApiError extends Error {
  // Carries the wire code + http status alongside the message
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 500,
  ) {
    super(message)
  }
}

export const envelope = (code: ErrorCode, message: string, status: number) => ({
  error: { code, message, status },
})

// Maps known ApiErrors to their envelope, logs everything else as INTERNAL
export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof ApiError) {
    return c.json(envelope(err.code, err.message, err.status), err.status as 400)
  }
  log.error('unhandled', { err: err.message, stack: err.stack })
  return c.json(envelope('INTERNAL', 'Internal server error', 500), 500)
}

export const notFound = (c: Context) =>
  c.json(envelope('NOT_FOUND', `Route ${c.req.path} not found`, 404), 404)
