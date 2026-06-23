import './env.mjs'
import express from 'express'
import cors from 'cors'
import { downloadPdfForDoi, resolveBestPdfUrl } from './pdfFromDoi.mjs'
import { downloadDatasetZip, getDatasetSizeBytes, isKaggleConfigured, searchDatasets } from './kaggle.mjs'
import { fetchCslMetadataForDois } from './references.mjs'

const RESOLVE_CONCURRENCY = 6
export const NETLIFY_MAX_DOWNLOAD_BYTES = 4_500_000
const NETLIFY_MAX_PDF_BYTES = NETLIFY_MAX_DOWNLOAD_BYTES

function isNetlifyRuntime() {
  return (
    process.env.NETLIFY === 'true' ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NETLIFY_DEV)
  )
}

function isZipBuffer(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
}

function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return 'unknown size'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = n
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function tooLargePayload(ref, sizeBytes) {
  const kaggleUrl = `https://www.kaggle.com/datasets/${ref}`
  return {
    error: `Dataset is ${formatBytes(sizeBytes)} — too large for cloud download (max ~4.5 MB on Netlify). Download on Kaggle instead.`,
    ref,
    url: kaggleUrl,
  }
}

async function parallelMap(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

export const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))

export const PDF_RESOLVER_VERSION = '3'

app.get('/api/health', (_req, res) => {
  const isNetlify = isNetlifyRuntime()
  res.json({
    ok: true,
    pdfResolverVersion: PDF_RESOLVER_VERSION,
    tlsInsecure: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0',
    unpaywall: Boolean(process.env.UNPAYWALL_EMAIL),
    kaggle: isKaggleConfigured(),
    runtime: isNetlify ? 'netlify' : 'node',
    maxDownloadBytes: isNetlify ? NETLIFY_MAX_DOWNLOAD_BYTES : null,
  })
})

/** Resolve direct PDF URLs for a list of DOIs (parallel). */
app.post('/api/resolve-urls', async (req, res) => {
  const dois = req.body?.dois
  if (!Array.isArray(dois) || dois.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty dois array' })
  }
  if (dois.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 DOIs per batch' })
  }

  try {
    const results = await parallelMap(dois, RESOLVE_CONCURRENCY, (doi) =>
      resolveBestPdfUrl(doi),
    )
    res.json({ results })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Resolve failed' })
  }
})

app.get('/api/urls', async (req, res) => {
  const doi = req.query.doi
  if (!doi || typeof doi !== 'string') {
    return res.status(400).json({ error: 'Missing doi' })
  }
  try {
    const result = await resolveBestPdfUrl(doi)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed' })
  }
})

/** Stream PDF file, or redirect to direct PDF URL. */
app.get('/api/pdf', async (req, res) => {
  const doi = req.query.doi
  if (!doi || typeof doi !== 'string') {
    return res.status(400).json({ error: 'Missing doi query parameter' })
  }

  const knownUrl = typeof req.query.url === 'string' ? req.query.url : null

  try {
    const result = await downloadPdfForDoi(doi, knownUrl)

    if (result.found && result.buffer) {
      if (
        process.env.NETLIFY === 'true' &&
        result.buffer.length > NETLIFY_MAX_PDF_BYTES &&
        result.pdfUrl
      ) {
        return res.redirect(302, result.pdfUrl)
      }

      const safeName = result.doi.replace(/[^\w.-]/g, '_')
      const contentType = result.contentType ?? 'application/pdf'
      const source = result.source ?? 'unknown'

      // Netlify Functions mangle raw binary as UTF-8; base64 JSON survives intact.
      if (req.query.format === 'base64') {
        return res.json({
          ok: true,
          filename: `${safeName}.pdf`,
          contentType,
          source,
          data: result.buffer.toString('base64'),
        })
      }

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
      res.setHeader('X-Pdf-Source', source)
      return res.end(result.buffer)
    }

    if (result.redirectUrl) {
      return res.redirect(302, result.redirectUrl)
    }

    res.status(404).json({ error: result.error ?? 'PDF not found', doi: result.doi })
  } catch (error) {
    console.error('PDF download error:', error)
    if (knownUrl) {
      return res.redirect(302, knownUrl)
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'PDF download failed' })
  }
})

/** Search Kaggle datasets by topic/keyword. */
app.get('/api/kaggle/search', async (req, res) => {
  const q = req.query.q
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q query parameter' })
  }

  if (!isKaggleConfigured()) {
    return res.status(503).json({
      error: 'Kaggle API not configured. Set KAGGLE_USERNAME and KAGGLE_KEY in environment variables',
    })
  }

  try {
    const datasets = await searchDatasets(q)
    res.json({ query: q.trim(), count: datasets.length, datasets })
  } catch (error) {
    console.error('Kaggle search error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Kaggle search failed' })
  }
})

/** Download a Kaggle dataset archive (zip). */
app.get('/api/kaggle/download', async (req, res) => {
  const ref = req.query.ref
  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: 'Missing ref query parameter (owner/slug)' })
  }

  if (!isKaggleConfigured()) {
    return res.status(503).json({
      error: 'Kaggle API not configured. Set KAGGLE_USERNAME and KAGGLE_KEY in environment variables',
    })
  }

  try {
    if (isNetlifyRuntime()) {
      const sizeHint = Number(req.query.sizeBytes)
      let sizeBytes =
        Number.isFinite(sizeHint) && sizeHint > 0 ? sizeHint : await getDatasetSizeBytes(ref)

      if (sizeBytes && sizeBytes > NETLIFY_MAX_DOWNLOAD_BYTES) {
        return res.status(413).json(tooLargePayload(ref, sizeBytes))
      }
    }

    const result = await downloadDatasetZip(ref)

    const safeName = result.filename.replace(/[^\w.-]/g, '_')

    if (!isZipBuffer(result.buffer)) {
      return res.status(502).json({
        error: 'Kaggle returned an invalid archive. Try downloading from Kaggle directly.',
        ref: result.ref,
        url: `https://www.kaggle.com/datasets/${result.ref}`,
      })
    }

    if (isNetlifyRuntime() && result.buffer.length > NETLIFY_MAX_DOWNLOAD_BYTES) {
      return res.status(413).json(tooLargePayload(ref, result.buffer.length))
    }

    // Netlify Functions mangle raw binary as UTF-8; base64 JSON survives intact.
    if (req.query.format === 'base64') {
      return res.json({
        ok: true,
        filename: safeName,
        contentType: result.contentType,
        ref: result.ref,
        data: result.buffer.toString('base64'),
      })
    }

    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    res.setHeader('X-Dataset-Ref', result.ref)
    return res.end(result.buffer)
  } catch (error) {
    console.error('Kaggle download error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Kaggle download failed' })
  }
})

/** Resolve DOIs to CSL-JSON (server-side; avoids browser CORS on doi.org). */
app.post('/api/references/metadata', async (req, res) => {
  const dois = req.body?.dois
  if (!Array.isArray(dois) || dois.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty dois array' })
  }
  if (dois.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 DOIs per request' })
  }

  try {
    const items = await fetchCslMetadataForDois(dois)
    res.json({ count: items.length, items })
  } catch (error) {
    console.error('Reference metadata error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Metadata fetch failed' })
  }
})
