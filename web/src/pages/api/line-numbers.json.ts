import type { APIRoute } from 'astro';
import { fetchLineNumbers } from '@utils/fetch-line-numbers';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await fetchLineNumbers()), {
    headers: { 'content-type': 'application/json' },
  });
