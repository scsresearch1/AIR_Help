/** Build API path. Dev uses Vite proxy; production uses Netlify Functions at the same `/api/*` paths. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalized
}

export function isApiConfiguredForDeploy(): boolean {
  return true
}

export function apiOfflineHelp(): string {
  if (import.meta.env.PROD) {
    return 'Cannot reach the API. In Netlify → Site settings → Environment variables, add UNPAYWALL_EMAIL (and KAGGLE_USERNAME / KAGGLE_KEY if needed), then redeploy.'
  }
  return 'Cannot reach the API server. Run npm run dev and open the localhost URL Vite prints (e.g. http://localhost:5175).'
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/health'), { signal: AbortSignal.timeout(8000) })
    const data = await response.json()
    return Boolean(data.ok)
  } catch {
    return false
  }
}
