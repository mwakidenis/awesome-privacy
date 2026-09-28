import { error, warn } from './logger';
import { safeFetch } from './safe-fetch';
import { apiBase, enrichHeaders } from './api-config';

interface EnrichOptions {
  // Yeah, it's legit got no upstream record, so 404 is correct/expected
  missingIsExpected?: boolean;
}

export const fetchEnrich = async <T>(
  source: string,
  path: string,
  subject: string,
  { missingIsExpected = false }: EnrichOptions = {},
): Promise<T | null> => {
  const endpoint = `${apiBase}${path}`;
  try {
    const res = await safeFetch(endpoint, { headers: enrichHeaders() });
    if (res.ok) return (await res.json()) as T;
    if (res.status !== 404) {
      error(source, `HTTP ${res.status} for ${subject} (${endpoint})`);
    } else if (!missingIsExpected) {
      warn(source, `No upstream record for ${subject} (${endpoint})`);
    }
    return null;
  } catch (err) {
    error(source, `Network error for ${subject}: ${err}`);
    return null;
  }
};
