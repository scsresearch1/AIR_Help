import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { canDownload, pdfDownloadUrl, resolvePdfUrlsParallel } from '../api/citationApi'
import { apiOfflineHelp, checkApiHealth } from '../config/api'
import {
  base64ToPdfBlob,
  downloadPdfFromUrl,
  isInvalidScienceDirectPdfUrl,
  isValidPdfBlob,
  pdfFilenameForDoi,
  savePdfBlob,
} from '../lib/pdfDownload'
import { extractDois, snippetForDoi } from '../lib/doiParser'
import type { CitationEntry } from '../lib/citationTypes'

function makeId() {
  return crypto.randomUUID()
}

const DELAY_BETWEEN_DOWNLOADS_MS = 1200

export function CitationExtractionPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const entriesRef = useRef<CitationEntry[]>([])
  const lastTextRef = useRef('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [entries, setEntries] = useState<CitationEntry[]>([])
  const [isResolving, setIsResolving] = useState(false)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [error, setError] = useState('')
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [resolveProgress, setResolveProgress] = useState({ done: 0, total: 0 })
  const [downloadAllProgress, setDownloadAllProgress] = useState({ done: 0, total: 0 })

  entriesRef.current = entries

  useEffect(() => {
    checkApiHealth()
      .then(setApiOk)
      .catch(() => setApiOk(false))
  }, [])

  const readyCount = entries.filter((e) => e.status === 'ready').length
  const downloadedCount = entries.filter((e) => e.status === 'downloaded').length
  const failedCount = entries.filter((e) => e.status === 'failed').length
  const totalCount = entries.length

  const resolveEntries = useCallback(async (items: CitationEntry[]) => {
    setIsResolving(true)
    setError('')
    setResolveProgress({ done: 0, total: items.length })

    setEntries((prev) =>
      prev.map((entry) => {
        const item = items.find((i) => i.id === entry.id)
        if (!item) return entry
        return { ...entry, status: 'resolving', pdfUrl: '', pdfSource: '…', error: undefined }
      }),
    )

    try {
      await resolvePdfUrlsParallel(
        items.map((e) => ({ id: e.id, doi: e.doi })),
        (id, result) => {
          setResolveProgress((p) => ({ ...p, done: p.done + 1 }))
          setEntries((prev) =>
            prev.map((entry) => {
              if (entry.id !== id) return entry
              if (result.pdfUrl) {
                return {
                  ...entry,
                  status: 'ready',
                  pdfUrl: result.pdfUrl,
                  pdfSource: result.pdfSource ?? 'direct',
                  error: undefined,
                }
              }
              return {
                ...entry,
                status: 'failed',
                pdfUrl: `https://doi.org/${entry.doi}`,
                pdfSource: '—',
                error: 'No direct PDF URL found',
              }
            }),
          )
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve PDF URLs')
    } finally {
      setIsResolving(false)
    }
  }, [])

  const processText = useCallback(async (text: string, name: string) => {
    lastTextRef.current = text
    const dois = extractDois(text)
    if (dois.length === 0) {
      setError('No DOIs found in this file. Expected lines with "doi: 10.xxxx/..."')
      setEntries([])
      setFileName(name)
      return
    }

    setError('')
    setFileName(name)

    const initial: CitationEntry[] = dois.map((doi) => ({
      id: makeId(),
      doi,
      snippet: snippetForDoi(text, doi),
      status: 'resolving',
      pdfUrl: '',
      pdfSource: '…',
    }))
    setEntries(initial)
    setResolveProgress({ done: 0, total: dois.length })

    const apiAvailable = await checkApiHealth()
    setApiOk(apiAvailable)

    if (!apiAvailable) {
      setError(apiOfflineHelp())
      setEntries(
        initial.map((e) => ({
          ...e,
          status: 'failed',
          pdfUrl: `https://doi.org/${e.doi}`,
          pdfSource: '—',
          error: 'API offline',
        })),
      )
      setResolveProgress({ done: dois.length, total: dois.length })
      return
    }

    await resolveEntries(initial)
  }, [resolveEntries])

  async function handleRetryResolve() {
    if (entries.length === 0) return
    const apiAvailable = await checkApiHealth()
    setApiOk(apiAvailable)
    if (!apiAvailable) {
      setError(apiOfflineHelp())
      return
    }

    const toResolve = entries.filter((e) => e.status === 'failed')
    if (toResolve.length === 0) {
      await resolveEntries(entries)
      return
    }
    await resolveEntries(toResolve)
  }

  function handleFile(file: File) {
    if (!file.name.match(/\.(txt|text|refs)$/i) && !file.type.startsWith('text/')) {
      setError('Please upload a plain text reference file (.txt)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => processText(String(reader.result ?? ''), file.name)
    reader.onerror = () => setError('Could not read the file')
    reader.readAsText(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function downloadOne(entry: CitationEntry): Promise<boolean> {
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, status: 'downloading', error: undefined } : e)),
    )

    const filename = pdfFilenameForDoi(entry.doi)

    if (apiOk !== false) {
      try {
        const response = await fetch(pdfDownloadUrl(entry.doi, entry.pdfUrl || undefined), {
          redirect: 'manual',
        })

        if (response.status >= 300 && response.status < 400) {
          const redirectUrl = response.headers.get('Location') ?? entry.pdfUrl
          if (redirectUrl) {
            await downloadPdfFromUrl(redirectUrl)
            setEntries((prev) =>
              prev.map((e) =>
                e.id === entry.id
                  ? { ...e, status: 'downloaded', error: undefined }
                  : e,
              ),
            )
            return true
          }
        }

        if (response.ok) {
          const contentType = response.headers.get('content-type') ?? ''
          if (contentType.includes('json')) {
            const json = (await response.json()) as {
              ok?: boolean
              data?: string
              filename?: string
              source?: string
              contentType?: string
            }
            if (json.ok && json.data) {
              const blob = base64ToPdfBlob(json.data, json.contentType ?? 'application/pdf')
              if (await isValidPdfBlob(blob)) {
                savePdfBlob(blob, json.filename ?? filename)
                setEntries((prev) =>
                  prev.map((e) =>
                    e.id === entry.id
                      ? { ...e, status: 'downloaded', pdfSource: json.source ?? entry.pdfSource, error: undefined }
                      : e,
                  ),
                )
                return true
              }
            }
          } else if (contentType.includes('pdf')) {
            const blob = await response.blob()
            if (await isValidPdfBlob(blob)) {
              const source = response.headers.get('X-Pdf-Source') ?? entry.pdfSource
              savePdfBlob(blob, filename)
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entry.id
                    ? { ...e, status: 'downloaded', pdfSource: source, error: undefined }
                    : e,
                ),
              )
              return true
            }
          }
        }
      } catch {
        // fall through to direct URL
      }
    }

    if (entry.pdfUrl && !isInvalidScienceDirectPdfUrl(entry.pdfUrl)) {
      await downloadPdfFromUrl(entry.pdfUrl)
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: 'downloaded', pdfSource: entry.pdfSource, error: undefined }
            : e,
        ),
      )
      return true
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, status: 'ready', error: 'Download failed — try the direct link' } : e,
      ),
    )
    return false
  }

  async function handleDownloadPdf(entry: CitationEntry) {
    if (!canDownload(entry.status, isResolving) || isDownloadingAll) return
    setError('')
    await downloadOne(entry)
  }

  async function handleDownloadAll() {
    const readyEntries = entriesRef.current.filter((e) => e.status === 'ready')
    if (readyEntries.length === 0) return

    setIsDownloadingAll(true)
    setError('')
    setDownloadAllProgress({ done: 0, total: readyEntries.length })

    for (let i = 0; i < readyEntries.length; i++) {
      const current = entriesRef.current.find((e) => e.id === readyEntries[i].id) ?? readyEntries[i]
      await downloadOne(current)
      setDownloadAllProgress({ done: i + 1, total: readyEntries.length })

      if (i < readyEntries.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_DOWNLOADS_MS))
      }
    }

    setIsDownloadingAll(false)
    setDownloadAllProgress({ done: 0, total: 0 })
  }

  return (
    <div className="citation-page">
      <header className="citation-header">
        <div className="citation-header__left">
          <Link to="/" className="citation-header__back">
            ← Services
          </Link>
          <h1 className="citation-header__title">AI Citation Extraction</h1>
        </div>
      </header>

      <main className="citation-main">
        <section className="citation-upload">
          <div
            className="citation-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="citation-dropzone__input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <div className="citation-dropzone__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="citation-dropzone__label">
              {fileName ? `Loaded: ${fileName}` : 'Drop your reference file here'}
            </p>
            <p className="citation-dropzone__hint">
              Plain text (.txt) with DOIs — e.g. <code>doi: 10.1007/s12243-023-00953-y</code>
            </p>
          </div>

          {entries.length > 0 && (
            <div className="citation-actions">
              <p className="citation-actions__summary">
                {isResolving ? (
                  <>
                    Resolving <strong>{resolveProgress.done}</strong> /{' '}
                    <strong>{resolveProgress.total}</strong>…
                  </>
                ) : isDownloadingAll ? (
                  <>
                    Downloading <strong>{downloadAllProgress.done}</strong> /{' '}
                    <strong>{downloadAllProgress.total}</strong>…
                  </>
                ) : (
                  <>
                    <strong>{readyCount}</strong> of <strong>{totalCount}</strong> ready
                    {downloadedCount > 0 && (
                      <>
                        {' '}
                        · <strong>{downloadedCount}</strong> downloaded
                      </>
                    )}
                  </>
                )}
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleDownloadAll}
                disabled={isDownloadingAll || isResolving || readyCount === 0}
              >
                {isDownloadingAll ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Downloading all…
                  </>
                ) : (
                  'Download All PDFs'
                )}
              </button>
              {failedCount > 0 && !isResolving && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleRetryResolve}
                  disabled={isDownloadingAll}
                >
                  Retry resolution
                </button>
              )}
            </div>
          )}
        </section>

        {apiOk === false && (
          <div className="citation-alert citation-alert--warn" role="alert">
            {import.meta.env.PROD ? (
              <>
                API offline — Netlify Functions may not be running. Add <code>UNPAYWALL_EMAIL</code>{' '}
                in Netlify environment variables and redeploy. Check the Functions tab for errors.
              </>
            ) : (
              <>
                API offline — run <code>npm run dev</code> and open the exact localhost URL Vite
                prints.
              </>
            )}
          </div>
        )}

        {error && (
          <div className="citation-alert" role="alert">
            {error}
          </div>
        )}

        {entries.length > 0 && (
          <section className="citation-results">
            <div className="citation-results__table-wrap">
              <table className="citation-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>DOI</th>
                    <th>Status</th>
                    <th>PDF URL</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id} className={`citation-table__row citation-table__row--${entry.status}`}>
                      <td className="citation-table__num">{index + 1}</td>
                      <td className="citation-table__doi">
                        <a
                          href={`https://doi.org/${entry.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {entry.doi}
                        </a>
                        {entry.snippet && (
                          <span className="citation-table__snippet">{entry.snippet}</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="citation-table__source">
                        {entry.status === 'resolving' ? (
                          <span className="citation-table__source-label">…</span>
                        ) : (
                          <>
                            <span className="citation-table__source-label">{entry.pdfSource}</span>
                            {entry.pdfUrl && entry.status === 'ready' && (
                              <span className="citation-table__source-link" title={entry.pdfUrl}>
                                Direct link ready
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="citation-table__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => handleDownloadPdf(entry)}
                          disabled={
                            !canDownload(entry.status, isResolving) ||
                            entry.status === 'downloading' ||
                            isDownloadingAll
                          }
                        >
                          {entry.status === 'downloading' ? 'Downloading…' : 'Download PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: CitationEntry['status'] }) {
  const labels: Record<CitationEntry['status'], string> = {
    resolving: 'Resolving…',
    ready: 'Ready',
    downloading: 'Downloading…',
    downloaded: 'Downloaded',
    failed: 'Failed',
  }

  return <span className={`citation-status citation-status--${status}`}>{labels[status]}</span>
}
