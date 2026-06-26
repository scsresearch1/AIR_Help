import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicationWorkflowBar } from '../components/PublicationWorkflowBar'
import { fetchJournalInsights, recommendJournalsFromAbstract } from '../api/journalApi'
import {
  clearPublicationWorkflow,
  loadPublicationWorkflow,
  savePublicationWorkflow,
  type PublicationWorkflowState,
} from '../lib/publicationWorkflow'
import type {
  JournalInsightRow,
  JournalInsightsResponse,
  JournalRecommendResponse,
} from '../lib/journalTypes'
import { formatVenueLocation } from '../lib/conferenceTypes'

const EXAMPLE_JOURNALS = [
  'IEEE Transactions on Pattern Analysis and Machine Intelligence',
  'Nature Communications',
  'Journal of Machine Learning Research',
]

type JournalMode = 'lookup' | 'abstract'

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return 'Not announced'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function JournalInsightsPage() {
  const [mode, setMode] = useState<JournalMode>('abstract')
  const [query, setQuery] = useState('')
  const [abstract, setAbstract] = useState('')
  const [report, setReport] = useState<JournalInsightsResponse | null>(null)
  const [recommendations, setRecommendations] = useState<JournalRecommendResponse | null>(null)
  const [workflow, setWorkflow] = useState<PublicationWorkflowState | null>(() =>
    loadPublicationWorkflow(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const wf = loadPublicationWorkflow()
    if (wf) {
      setWorkflow(wf)
      setMode('abstract')
      if (wf.journalRecommendations.length > 0) {
        setRecommendations({
          abstractLength: wf.abstractPreview.length,
          matchedPublications: wf.matchedPublications,
          detectedThemes: wf.detectedThemes,
          conferenceSearchQuery: wf.conferenceSearchQuery,
          recommendations: wf.journalRecommendations,
          conferenceRecommendations: wf.conferenceRecommendations,
          sources: wf.sources,
          methodology: wf.methodology,
        })
      }
    }
  }, [])

  function switchMode(next: JournalMode) {
    setMode(next)
    setError('')
  }

  function persistWorkflow(data: JournalRecommendResponse, abstractText: string) {
    const next: PublicationWorkflowState = {
      abstractPreview: abstractText.slice(0, 120),
      detectedThemes: data.detectedThemes,
      conferenceSearchQuery: data.conferenceSearchQuery,
      topJournalNames: data.recommendations.slice(0, 5).map((j) => j.journalName),
      journalRecommendations: data.recommendations,
      conferenceRecommendations: data.conferenceRecommendations,
      matchedPublications: data.matchedPublications,
      methodology: data.methodology,
      sources: data.sources,
      analyzedAt: new Date().toISOString(),
    }
    savePublicationWorkflow(next)
    setWorkflow(next)
  }

  function handleClearWorkflow() {
    clearPublicationWorkflow()
    setWorkflow(null)
    setRecommendations(null)
    setReport(null)
    setAbstract('')
  }

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

  async function handleAbstractMatch(e: React.FormEvent) {
    e.preventDefault()
    const text = abstract.trim()
    if (text.length < 80) {
      setError('Paste your manuscript abstract (at least 80 characters).')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)
    setRecommendations(null)

    try {
      const data = await recommendJournalsFromAbstract(text)
      setRecommendations(data)
      persistWorkflow(data, text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Journal fit analysis failed')
    } finally {
      setLoading(false)
    }
  }

  async function viewJournalProfile(journalName: string) {
    setMode('lookup')
    setQuery(journalName)
    setLoading(true)
    setError('')
    setReport(null)

    try {
      const data = await fetchJournalInsights(journalName)
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

  const workflowStep = recommendations || workflow ? 'journals' : 'abstract'

  return (
    <div className="research-tool-page">
      <header className="research-tool-header">
        <div className="research-tool-header__left">
          <Link to="/" className="research-tool-header__back">
            ← Services
          </Link>
          <h1 className="research-tool-header__title">Journal Insights</h1>
          <p className="research-tool-header__subtitle">
            Publication planning — abstract analysis, journal fit, and conference deadlines
          </p>
        </div>
      </header>

      <main className="research-tool-main">
        <PublicationWorkflowBar
          workflow={workflow}
          activeStep={workflowStep}
          onClear={handleClearWorkflow}
        />

        <div className="journal-mode-tabs" role="tablist" aria-label="Journal analysis mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'abstract'}
            className={`journal-mode-tabs__tab${mode === 'abstract' ? ' journal-mode-tabs__tab--active' : ''}`}
            onClick={() => switchMode('abstract')}
          >
            Abstract Analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'lookup'}
            className={`journal-mode-tabs__tab${mode === 'lookup' ? ' journal-mode-tabs__tab--active' : ''}`}
            onClick={() => switchMode('lookup')}
          >
            Journal Lookup
          </button>
        </div>

        {mode === 'lookup' && (
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
        )}

        {mode === 'abstract' && (
          <form className="journal-abstract" onSubmit={(e) => void handleAbstractMatch(e)}>
            <label className="journal-search__label" htmlFor="manuscript-abstract">
              Manuscript abstract
            </label>
            <textarea
              id="manuscript-abstract"
              className="journal-abstract__textarea"
              rows={10}
              placeholder="Paste your research paper abstract here. The workflow will identify suitable journals and map matching conference submission deadlines."
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              disabled={loading}
            />
            <div className="journal-abstract__footer">
              <span className="journal-abstract__count">{abstract.trim().length} characters</span>
              <button type="submit" className="btn btn--primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Running publication plan…
                  </>
                ) : (
                  'Analyze publication options'
                )}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="research-tool-alert" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="research-tool-alert research-tool-alert--info" role="status">
            {mode === 'abstract'
              ? 'Matching journals and conferences to your abstract via OpenAlex and CCF Deadlines…'
              : 'Querying OpenAlex, CrossRef, DOAJ, and the publisher website…'}
          </div>
        )}

        {recommendations && !loading && mode === 'abstract' && (
          <>
            <section className="research-tool-panel" aria-label="Recommended journals">
              <h2 className="research-tool-panel__title">Step 2 — Recommended Journals</h2>
              <p className="research-tool-panel__meta">
                Analyzed {recommendations.matchedPublications} similar publications ·{' '}
                {recommendations.sources.join(', ')}
              </p>

              {recommendations.detectedThemes.length > 0 && (
                <div className="journal-keywords journal-keywords--themes">
                  <span className="journal-keywords__label">Detected research themes</span>
                  {recommendations.detectedThemes.map((theme) => (
                    <span key={theme} className="journal-keywords__tag">
                      {theme}
                    </span>
                  ))}
                </div>
              )}

              <div className="research-tool-table-wrap">
                <table className="data-table research-tool-table">
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Journal Name</th>
                      <th scope="col">Fit Score</th>
                      <th scope="col">Similar Articles</th>
                      <th scope="col">Subject Alignment</th>
                      <th scope="col">Publisher</th>
                      <th scope="col">Open Access</th>
                      <th scope="col">Indexing</th>
                      <th scope="col">Official URL</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.recommendations.map((journal) => (
                      <tr key={journal.openAlexId}>
                        <td data-label="Rank">{journal.rank}</td>
                        <td data-label="Journal Name">
                          <span className="data-table__title">{journal.journalName}</span>
                          {journal.sampleSimilarArticles[0] && (
                            <span className="data-table__subtitle">
                              e.g. {journal.sampleSimilarArticles[0]}
                            </span>
                          )}
                        </td>
                        <td data-label="Fit Score">
                          <span className="journal-fit-score">{journal.fitScore}%</span>
                        </td>
                        <td data-label="Similar Articles">{journal.similarArticleCount}</td>
                        <td data-label="Subject Alignment">
                          {journal.subjectAlignment.length
                            ? journal.subjectAlignment.join(', ')
                            : '—'}
                        </td>
                        <td data-label="Publisher">{journal.publisher ?? 'Unknown'}</td>
                        <td data-label="Open Access">{journal.openAccessStatus}</td>
                        <td data-label="Indexing">{journal.indexing}</td>
                        <td data-label="Official URL">
                          {journal.officialUrl ? (
                            <a
                              href={journal.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="data-table__ref"
                            >
                              Visit journal
                            </a>
                          ) : (
                            'Not available'
                          )}
                        </td>
                        <td data-label="Actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => void viewJournalProfile(journal.journalName)}
                          >
                            Full profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="research-tool-panel" aria-label="Matching conferences">
              <div className="workflow-panel-header">
                <div>
                  <h2 className="research-tool-panel__title">Step 3 — Matching Conferences</h2>
                  <p className="research-tool-panel__meta">
                    {recommendations.conferenceRecommendations.length} conferences aligned with your
                    abstract themes
                  </p>
                </div>
                <Link to="/conference-tracker" className="btn btn--primary btn--sm">
                  Open Conference Tracker
                </Link>
              </div>

              {recommendations.conferenceRecommendations.length === 0 ? (
                <p className="research-tool-footnote">
                  No thematic conference matches found in the CCF Deadlines catalog. Browse all
                  upcoming deadlines in the Conference Tracker.
                </p>
              ) : (
                <div className="research-tool-table-wrap">
                  <table className="data-table research-tool-table">
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Conference Name</th>
                        <th scope="col">Fit Score</th>
                        <th scope="col">Paper Submission Due Date</th>
                        <th scope="col">Conference Date</th>
                        <th scope="col">Matched Themes</th>
                        <th scope="col">Venue Location</th>
                        <th scope="col">Official URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.conferenceRecommendations.map((conf) => (
                        <tr key={conf.id}>
                          <td data-label="Rank">{conf.rank}</td>
                          <td data-label="Conference Name">
                            <span className="data-table__title">{conf.conferenceName}</span>
                            {conf.publisher && (
                              <span className="data-table__subtitle">{conf.publisher}</span>
                            )}
                          </td>
                          <td data-label="Fit Score">
                            <span className="journal-fit-score">{conf.fitScore}%</span>
                          </td>
                          <td data-label="Paper Submission Due Date">
                            {formatShortDate(conf.paperSubmissionDueDate)}
                          </td>
                          <td data-label="Conference Date">
                            {formatShortDate(conf.conferenceDate)}
                          </td>
                          <td data-label="Matched Themes">
                            {conf.matchedThemes.length ? conf.matchedThemes.join(', ') : '—'}
                          </td>
                          <td data-label="Venue Location">
                            {formatVenueLocation(conf.location)}
                          </td>
                          <td data-label="Official URL">
                            {conf.conferencePageUrl ? (
                              <a
                                href={conf.conferencePageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="data-table__ref"
                              >
                                Visit official page
                              </a>
                            ) : (
                              'Not available'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="research-tool-footnote research-tool-footnote--inline">
              {recommendations.methodology} Use <strong>Full profile</strong> for APC and indexing
              details, then continue to the Conference Tracker for deadline planning.
            </p>
          </>
        )}

        {report && !loading && mode === 'lookup' && (
          <section className="research-tool-panel" aria-label="Journal intelligence report">
            <div className="workflow-panel-header">
              <div>
                <h2 className="research-tool-panel__title">Publication Profile — {report.journalName}</h2>
                <p className="research-tool-panel__meta">
                  Data sources: {report.sources.join(', ')}
                </p>
              </div>
              {workflow && (
                <div className="workflow-panel-header__actions">
                  <Link to="/conference-tracker" className="btn btn--ghost btn--sm">
                    Conference deadlines
                  </Link>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => switchMode('abstract')}
                  >
                    Back to recommendations
                  </button>
                </div>
              )}
            </div>

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
          The publication workflow connects abstract analysis → journal fit → conference deadlines.
          Session data persists while you navigate between Journal Insights and Conference Tracker.
          Always verify scope, indexing, APC, and submission dates with publishers before submitting.
        </p>
      </main>
    </div>
  )
}
