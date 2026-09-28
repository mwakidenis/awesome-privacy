// Shared GitHub REST request headers, adds auth when a token is present
export const githubHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'User-Agent': 'awesome-privacy-api',
    Accept: 'application/vnd.github+json',
  }
  if (token) headers.Authorization = `token ${token}`
  return headers
}
