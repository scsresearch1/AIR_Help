const USER_AGENT = 'ResearchHelper/1.0 (mailto:research@example.com)'

export async function fetchText(url, { timeoutMs = 20_000, headers = {} } = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.text()
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json()
}
