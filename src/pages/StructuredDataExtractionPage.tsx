import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadKaggleDataset, searchKaggleDatasets } from '../api/kaggleApi'
import { apiUrl } from '../config/api'
import { saveFileBlob, zipFilenameForRef } from '../lib/datasetDownload'
import type { DatasetEntry } from '../lib/dataExtractionTypes'

function makeId() {
  return crypto.randomUUID()
}

const DELAY_BETWEEN_DOWNLOADS_MS = 1500

export function StructuredDataExtractionPage() {
  const entriesRef = useRef<DatasetEntry[]>([])
  const [topic, setTopic] = useState('')
  const [entries, setEntries] = useState<DatasetEntry[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [kaggleOk, setKaggleOk] = useState<boolean | null>(null)
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 })

  entriesRef.current = entries

  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then((r) => r.json())
      .then((d) => {
        setApiOk(Boolean(d.ok))
        setKaggleOk(Boolean(d.kaggle))
      })
      .catch(() => {
        setApiOk(false)
        setKaggleOk(false)
      })
  }, [])

  const selectedCount = entries.filter((e) => e.selected && e.status !== 'downloaded').length
  const downloadedCount = entries.filter((e) => e.status === 'downloaded').length
  const allSelected =
    entries.length > 0 && entries.every((e) => e.selected || e.status === 'downloaded')

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const query = topic.trim()
    if (!query) {
      setError('Enter a topic or keyword to search Kaggle datasets')
      return
    }

    setError('')
    setIsSearching(true)
    setLastQuery(query)

    try {
      const result = await searchKaggleDatasets(query)
      setEntries(
        result.datasets.map((dataset) => ({
          ...dataset,
          id: makeId(),
          selected: false,
          status: 'idle',
        })),
      )

      if (result.datasets.length === 0) {
        setError(`No datasets found on Kaggle for "${query}"`)
      }
    } catch (err) {
      setEntries([])
      setError(err instanceof Error ? err.message : 'Could not search Kaggle')
    } finally {
      setIsSearching(false)
    }
  }

  function toggleSelect(id: string) {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id && entry.status !== 'downloaded'
          ? { ...entry, selected: !entry.selected }
          : entry,
      ),
    )
  }

  function toggleSelectAll() {
    const selectAll = !allSelected
    setEntries((prev) =>
      prev.map((entry) =>
        entry.status === 'downloaded' ? entry : { ...entry, selected: selectAll },
      ),
    )
  }

  async function downloadOne(entry: DatasetEntry): Promise<boolean> {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, status: 'downloading', error: undefined, selected: true } : e,
      ),
    )

    try {
      const blob = await downloadKaggleDataset(entry.ref)
      saveFileBlob(blob, zipFilenameForRef(entry.ref))
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: 'downloaded', selected: false, error: undefined }
            : e,
        ),
      )
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed'
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, status: 'failed', error: message } : e,
        ),
      )
      return false
    }
  }

  async function handleDownloadSelected() {
    const toDownload = entriesRef.current.filter((e) => e.selected && e.status !== 'downloaded')
    if (toDownload.length === 0) return

    setIsDownloading(true)
    setError('')
    setDownloadProgress({ done: 0, total: toDownload.length })

    for (let i = 0; i < toDownload.length; i++) {
      const current = entriesRef.current.find((e) => e.id === toDownload[i].id) ?? toDownload[i]
      await downloadOne(current)
      setDownloadProgress({ done: i + 1, total: toDownload.length })

      if (i < toDownload.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_DOWNLOADS_MS))
      }
    }

    setIsDownloading(false)
    setDownloadProgress({ done: 0, total: 0 })
  }

  return (
    <div className="data-page">
      <header className="data-header">
        <div className="data-header__left">
          <Link to="/" className="data-header__back">
            ← Services
          </Link>
          <h1 className="data-header__title">Structured Data Extraction</h1>
        </div>
      </header>

      <main className="data-main">
        <section className="data-search">
          <form className="data-search__form" onSubmit={handleSearch}>
            <label className="data-search__label" htmlFor="kaggle-topic">
              Search Kaggle datasets
            </label>
            <div className="data-search__row">
              <input
                id="kaggle-topic"
                type="text"
                className="data-search__input"
                placeholder="e.g. climate change, medical imaging, wine quality…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isSearching || isDownloading}
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isSearching || isDownloading || !topic.trim()}
              >
                {isSearching ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Searching…
                  </>
                ) : (
                  'Search Kaggle'
                )}
              </button>
            </div>
            <p className="data-search__hint">
              Enter any research topic — we search Kaggle and list matching public datasets.
            </p>
          </form>

          {entries.length > 0 && (
            <div className="data-actions">
              <p className="data-actions__summary">
                {isDownloading ? (
                  <>
                    Downloading <strong>{downloadProgress.done}</strong> /{' '}
                    <strong>{downloadProgress.total}</strong>…
                  </>
                ) : (
                  <>
                    <strong>{entries.length}</strong> datasets for{' '}
                    <strong>{lastQuery || topic}</strong>
                    {downloadedCount > 0 && (
                      <>
                        {' '}
                        · <strong>{downloadedCount}</strong> downloaded
                      </>
                    )}
                    {selectedCount > 0 && (
                      <>
                        {' '}
                        · <strong>{selectedCount}</strong> selected
                      </>
                    )}
                  </>
                )}
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleDownloadSelected}
                disabled={isDownloading || isSearching || selectedCount === 0}
              >
                {isDownloading ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Downloading…
                  </>
                ) : (
                  'Download Selected'
                )}
              </button>
            </div>
          )}
        </section>

        {apiOk === false && (
          <div className="data-alert data-alert--warn" role="alert">
            {import.meta.env.PROD ? (
              <>
                API offline — set environment variables in Netlify (e.g. <code>UNPAYWALL_EMAIL</code>,{' '}
                <code>KAGGLE_USERNAME</code>, <code>KAGGLE_KEY</code>) and redeploy.
              </>
            ) : (
              <>API offline — run <code>npm run dev</code> to enable Kaggle search and downloads.</>
            )}
          </div>
        )}

        {apiOk === true && kaggleOk === false && (
          <div className="data-alert data-alert--warn" role="alert">
            Kaggle credentials missing — create a token at{' '}
            <a href="https://www.kaggle.com/settings" target="_blank" rel="noopener noreferrer">
              kaggle.com/settings
            </a>{' '}
            (Legacy API Credentials), then add <code>KAGGLE_USERNAME</code> and <code>KAGGLE_KEY</code>{' '}
            {import.meta.env.PROD ? (
              <>
                in Netlify → Site settings → Environment variables, and redeploy.
              </>
            ) : (
              <>
                to <code>.env</code> and restart the API (<code>npm run dev</code>).
              </>
            )}
          </div>
        )}

        {error && (
          <div className="data-alert" role="alert">
            {error}
          </div>
        )}

        {entries.length > 0 && (
          <section className="data-results">
            <div className="data-results__table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="data-table__check">
                      <input
                        type="checkbox"
                        aria-label="Select all datasets"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={isDownloading}
                      />
                    </th>
                    <th>#</th>
                    <th>Dataset</th>
                    <th>Owner</th>
                    <th>Size</th>
                    <th>Updated</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className={`data-table__row data-table__row--${entry.status} ${
                        entry.selected ? 'data-table__row--selected' : ''
                      }`}
                    >
                      <td className="data-table__check">
                        <input
                          type="checkbox"
                          aria-label={`Select ${entry.title}`}
                          checked={entry.selected}
                          onChange={() => toggleSelect(entry.id)}
                          disabled={entry.status === 'downloaded' || isDownloading}
                        />
                      </td>
                      <td className="data-table__num">{index + 1}</td>
                      <td className="data-table__dataset">
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="data-table__title"
                        >
                          {entry.title}
                        </a>
                        <span className="data-table__ref">{entry.ref}</span>
                        {entry.subtitle && (
                          <span className="data-table__subtitle">{entry.subtitle}</span>
                        )}
                        {entry.error && <span className="data-table__error">{entry.error}</span>}
                      </td>
                      <td className="data-table__owner">{entry.owner}</td>
                      <td className="data-table__size">{entry.sizeLabel}</td>
                      <td className="data-table__updated">{entry.lastUpdated}</td>
                      <td>
                        <DatasetStatusBadge status={entry.status} />
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

function DatasetStatusBadge({ status }: { status: DatasetEntry['status'] }) {
  const labels: Record<DatasetEntry['status'], string> = {
    idle: 'Ready',
    downloading: 'Downloading…',
    downloaded: 'Downloaded',
    failed: 'Failed',
  }

  return <span className={`data-status data-status--${status}`}>{labels[status]}</span>
}
