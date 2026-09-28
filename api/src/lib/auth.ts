/**
 * Bearer token check for /enrich/* routes.
 * The endpoints are public by default, but a request carrying the correct
 * "Authorization: Bearer $API_TOKEN" header is exempt from rate limiting.
 * When API_TOKEN is unset (e.g. self-hosted), no request is privileged.
 * Setting REQUIRE_AUTH turns the token into a hard gate (see authRequired).
 */

// Compare two strings in constant time
const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index++) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

// True when a valid bearer token is present (auth must be configured)
export const hasValidToken = (
  expected: string | undefined,
  header: string | undefined,
): boolean => {
  if (!expected) return false
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return !!match && constantTimeEqual(match[1], expected)
}

// True when REQUIRE_AUTH is enabled, hard-gating enrich behind a valid token.
// Off by default; needs API_TOKEN set too, else every request fails closed.
export const authRequired = (value: string | undefined): boolean =>
  /^(1|true|yes|on)$/i.test(value ?? '')
