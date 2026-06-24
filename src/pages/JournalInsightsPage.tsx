import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJournalInsights } from '../api/journalApi'
import type { JournalInsightRow, JournalInsightsResponse } from '../lib/journalTypes'

const EXAMPLE_JOURNALS = [
  'IEEE Transactions on Pattern Analysis and Machine Intelligence',
  'Nature Communications',
  'Journal of Machine Learning Research',
]

export function JournalInsightsPage() {
  const [query, setQuery] = useState('')
  const [report, setReport] = useState<JournalInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const name = query.trim()
    if (name.length < 2) {
      setError('Enter a journal name with at least 2 characters.')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)

    try {
      const data = await fetchJournalInsights(name)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Journal intelligence lookup failed')
    } finally {
      setLoading(false)
    }
  }

  function renderValue(row: JournalInsightRow) {
    if (row.label === 'Official URL' && row.value?.startsWith('http')) {
      return (
        <a href={row.value} target="_blank" rel="noopener noreferrer" className="data-table__ref">
          {row.value}
        </a>
      )
    }
    return row.value ?? 'Not available'
  }

  return (
    <div className="research-tool-page">
      <header className="research-tool-header">
        <div className="research-tool-header__left">
          <Link to="/" className="research-tool-header__back">
            ← Services
          </Link>
          <h1 className="research-tool-header__title">Journal Insights</h1>
          <p className="research-tool-header__subtitle">
            Publication intelligence for journal selection and submission planning
          </p>
        </div>
      </header>

      <main className="research-tool-main">
        <form className="journal-search" onSubmit={(e) => void handleSearch(e)}>
          <label className="journal-search__label" htmlFor="journal-name">
            Journal name or ISSN
          </label>
          <div className="journal-search__row">
            <input
              id="journal-name"
              type="search"
              className="journal-search__input"
              placeholder="e.g. IEEE Transactions on Neural Networks and Learning Systems"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Analyzing…
                </>
              ) : (
                'Generate report'
              )}
            </button>
          </div>
          <p className="journal-search__hint">
            Try:{' '}
            {EXAMPLE_JOURNALS.map((name, i) => (
              <span key={name}>
                {i > 0 && ' · '}
                <button
                  type="button"
                  className="journal-search__example"
                  onClick={() => setQuery(name)}
                  disabled={loading}
                >
                  {name}
                </button>
              </span>
            ))}
          </p>
        </form>

        {error && (
          <div className="research-tool-alert" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="research-tool-alert research-tool-alert--info" role="status">
            Querying OpenAlex, CrossRef, DOAJ, and the publisher website…
          </div>
        )}

        {report && !loading && (
          <section className="research-tool-panel" aria-label="Journal intelligence report">
            <h2 className="research-tool-panel__title">Publication Profile — {report.journalName}</h2>
            <p className="research-tool-panel__meta">
              Data sources: {report.sources.join(', ')}
            </p>

            <div className="research-tool-table-wrap">
              <table className="data-table research-tool-table research-tool-table--insights">
                <thead>
                  <tr>
                    <th scope="col">Attribute</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.label}>
                      <td data-label="Attribute" className="research-tool-table__attr">
                        {row.label}
                      </td>
                      <td data-label="Details">{renderValue(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {report.recentTitles.length > 0 && (
              <div className="journal-highlights">
                <h3 className="journal-highlights__title">Recent article titles</h3>
                <ul className="journal-highlights__list">
                  {report.recentTitles.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.keywords.length > 0 && (
              <div className="journal-keywords">
                {report.keywords.map((kw) => (
                  <span key={kw} className="journal-keywords__tag">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        <p className="research-tool-footnote">
          Journal metadata is compiled from OpenAlex, CrossRef, DOAJ, and the publisher homepage.
          Indexing status, APC, and open-access policies change frequently — verify with the
          publisher before submitting a manuscript.
        </p>
      </main>
    </div>
  )
}
