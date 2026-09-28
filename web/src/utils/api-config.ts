// Base URL and auth for the unified Awesome Privacy API.
const strip = (value: string): string => value.replace(/['";]+/g, '').trim();

export const apiBase =
  strip(import.meta.env.PUBLIC_API_URL || '').replace(/\/+$/, '') ||
  'https://api.awesome-privacy.xyz';

// Slug a listing name the way the API does, so /v1/services/{slug} resolves.
// Note: differs from the web's slugify, which keeps dots (e.g. "Rocket.Chat").
export const serviceSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Bearer header for enrichment routes; omitted when no token is set.
export const enrichHeaders = (): Record<string, string> => {
  const token = strip(import.meta.env.API_TOKEN || '');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
