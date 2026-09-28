// Defensive `fetch` wrapper for build-time + runtime calls.
// Currently enforces a timeout; future: retries, error normalisation, etc.
const DEFAULT_TIMEOUT_MS = 6000;

export const safeFetch = (
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> =>
  fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
