/**
 * JSON http fetch for outbound calls (used for /enrich/* routes)
 * Default timeout is 5 sec, any non-2xx responses return ApiError
 * Note that it only allows HTTPS fetches from allowed hosts list
 */

import { ApiError } from '@/lib/errors'
import { log } from '@/lib/log'

const ALLOWED_HOSTS = new Set([
  'api.tosdr.org',
  'api.github.com',
  'itunes.apple.com',
  'reports.exodus-privacy.eu.org',
  'discord.com',
  'www.reddit.com',
  'endpoint.apivoid.com',
  'raw.githubusercontent.com',
  'api.deps.dev',
  'plexus.techlore.tech',
  'hub.docker.com',
])

export interface FetchOpts {
  timeoutMs?: number
  headers?: Record<string, string>
}

export const fetchJson = async <T = unknown>(
  url: string,
  opts: FetchOpts = {},
): Promise<T> => {
  // Validate scheme + host against the allowlist before any network IO
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new ApiError('BAD_REQUEST', 'Invalid URL scheme', 400)
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new ApiError('BAD_REQUEST', `Host not allowed: ${parsed.hostname}`, 400)
  }
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 5000)
  let response: Response
  try {
    response = await fetch(url, { headers: opts.headers, signal })
  } catch (caught) {
    log.warn('fetch_failed', {
      host: parsed.hostname,
      err: (caught as Error).message,
    })
    throw new ApiError('UPSTREAM_ERROR', `Upstream fetch failed: ${parsed.hostname}`, 502)
  }
  if (!response.ok) {
    log.warn('upstream_status', { host: parsed.hostname, status: response.status })
    throw new ApiError(
      'UPSTREAM_ERROR',
      `Upstream ${parsed.hostname} returned ${response.status}`,
      502,
    )
  }
  return (await response.json()) as T
}
