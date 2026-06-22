const KAGGLE_BASE = 'https://www.kaggle.com/api/v1'
const MAX_SEARCH_PAGES = 5

function credentials() {
  const username = process.env.KAGGLE_USERNAME?.trim()
  const key = process.env.KAGGLE_KEY?.trim()
  if (!username || !key) {
    return null
  }
  return { username, key }
}

export function isKaggleConfigured() {
  return credentials() !== null
}

function authHeader() {
  const creds = credentials()
  if (!creds) {
    throw new Error('Kaggle credentials not configured. Set KAGGLE_USERNAME and KAGGLE_KEY in .env')
  }
  const token = Buffer.from(`${creds.username}:${creds.key}`).toString('base64')
  return `Basic ${token}`
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = n
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function normalizeDataset(raw) {
  const ownerSlug = pick(raw, 'ownerSlug', 'ownerRef', 'creatorUrl')?.split?.('/')?.pop?.() ?? ''
  const datasetSlug = pick(raw, 'datasetSlug', 'slug', 'ref')?.split?.('/').pop?.() ?? ''
  const ref =
    pick(raw, 'ref') ??
    (ownerSlug && datasetSlug ? `${ownerSlug}/${datasetSlug}` : pick(raw, 'url', 'datasetUrl'))

  const sizeBytes = pick(raw, 'totalBytes', 'size', 'totalBytesUncompressed')

  return {
    ref: String(ref ?? ''),
    title: String(pick(raw, 'title', 'name') ?? 'Untitled dataset'),
    subtitle: String(pick(raw, 'subtitle', 'description') ?? ''),
    owner: String(pick(raw, 'ownerName', 'creatorName', 'ownerSlug', 'userName') ?? ownerSlug ?? '—'),
    sizeBytes: sizeBytes ?? null,
    sizeLabel: formatBytes(sizeBytes),
    lastUpdated: formatDate(pick(raw, 'lastUpdated', 'lastUpdatedDate', 'creationDate')),
    downloadCount: Number(pick(raw, 'downloadCount', 'totalDownloads') ?? 0) || 0,
    voteCount: Number(pick(raw, 'voteCount', 'totalVotes') ?? 0) || 0,
    usabilityRating: pick(raw, 'usabilityRating') ?? null,
    url: ref ? `https://www.kaggle.com/datasets/${ref}` : pick(raw, 'url', 'datasetUrl'),
  }
}

async function kaggleFetch(path, options = {}) {
  const response = await fetch(`${KAGGLE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
    signal: options.signal ?? AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Kaggle API error (${response.status}): ${body.slice(0, 240) || response.statusText}`)
  }

  return response
}

/** Search Kaggle datasets across multiple pages (20 per page). */
export async function searchDatasets(query, { maxPages = MAX_SEARCH_PAGES } = {}) {
  const search = query.trim()
  if (!search) {
    throw new Error('Search query is required')
  }

  const all = []
  const seen = new Set()

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      search,
      page: String(page),
      sortBy: 'hottest',
    })

    const response = await kaggleFetch(`/datasets/list?${params}`)
    const data = await response.json()
    const batch = Array.isArray(data) ? data : data.datasets ?? []

    if (batch.length === 0) break

    for (const item of batch) {
      const normalized = normalizeDataset(item)
      if (!normalized.ref || seen.has(normalized.ref)) continue
      seen.add(normalized.ref)
      all.push(normalized)
    }

    if (batch.length < 20) break
  }

  return all
}

/** Download full dataset archive as a zip buffer. */
export async function downloadDatasetZip(ref) {
  const cleanRef = ref.trim().replace(/^\/+/, '')
  const parts = cleanRef.split('/').filter(Boolean)
  if (parts.length < 2) {
    throw new Error('Dataset ref must be in owner/slug format')
  }

  const ownerSlug = parts[0]
  const datasetSlug = parts[1]

  const response = await fetch(`${KAGGLE_BASE}/datasets/download/${ownerSlug}/${datasetSlug}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(300_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Kaggle download failed (${response.status}): ${body.slice(0, 240) || response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') ?? 'application/zip'
  const filename = `${datasetSlug}.zip`

  return { buffer, contentType, filename, ref: cleanRef }
}
