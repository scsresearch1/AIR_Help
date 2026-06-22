import './env.mjs'
import express from 'express'
import cors from 'cors'
import { downloadPdfForDoi, resolveBestPdfUrl } from './pdfFromDoi.mjs'
import { downloadDatasetZip, isKaggleConfigured, searchDatasets } from './kaggle.mjs'

const RESOLVE_CONCURRENCY = 6
const NETLIFY_MAX_PDF_BYTES = 4_500_000

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

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    tlsInsecure: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0',
    unpaywall: Boolean(process.env.UNPAYWALL_EMAIL),
    kaggle: isKaggleConfigured(),
    runtime: process.env.NETLIFY === 'true' ? 'netlify' : 'node',
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

  try {
    const result = await downloadPdfForDoi(doi)

    if (result.found && result.buffer) {
      if (
        process.env.NETLIFY === 'true' &&
        result.buffer.length > NETLIFY_MAX_PDF_BYTES &&
        result.pdfUrl
      ) {
        return res.redirect(302, result.pdfUrl)
      }

      const safeName = result.doi.replace(/[^\w.-]/g, '_')
      res.setHeader('Content-Type', result.contentType ?? 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
      res.setHeader('X-Pdf-Source', result.source ?? 'unknown')
      return res.send(result.buffer)
    }

    if (result.redirectUrl) {
      return res.redirect(302, result.redirectUrl)
    }

    res.status(404).json({ error: result.error ?? 'PDF not found', doi: result.doi })
  } catch (error) {
    console.error('PDF download error:', error)
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
    const result = await downloadDatasetZip(ref)

    if (process.env.NETLIFY === 'true' && result.buffer.length > NETLIFY_MAX_PDF_BYTES) {
      return res.status(413).json({
        error: 'Dataset too large for serverless download. Open the dataset on Kaggle and download manually.',
        ref: result.ref,
        url: `https://www.kaggle.com/datasets/${result.ref}`,
      })
    }

    const safeName = result.filename.replace(/[^\w.-]/g, '_')
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    res.setHeader('X-Dataset-Ref', result.ref)
    return res.send(result.buffer)
  } catch (error) {
    console.error('Kaggle download error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Kaggle download failed' })
  }
})
