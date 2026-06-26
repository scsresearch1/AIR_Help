import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicationWorkflowBar } from '../components/PublicationWorkflowBar'
import { fetchConferenceCatalog, fetchConferencesForDate } from '../api/conferenceApi'
import {
  formatVenueLocation,
  type CalendarDay,
  type ConferenceRecord,
} from '../lib/conferenceTypes'
import {
  clearPublicationWorkflow,
  loadPublicationWorkflow,
  type PublicationWorkflowState,
} from '../lib/publicationWorkflow'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function formatDisplayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return 'Not announced'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ConferenceTrackerPage() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [calendar, setCalendar] = useState<CalendarDay[]>([])
  const [total, setTotal] = useState(0)
  const [sources, setSources] = useState<string[]>([])
  const [publishers, setPublishers] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [publisher, setPublisher] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayConferences, setDayConferences] = useState<ConferenceRecord[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)
  const [error, setError] = useState('')
  const [workflow, setWorkflow] = useState<PublicationWorkflowState | null>(() =>
    loadPublicationWorkflow(),
  )

  const recommendedDateSet = useMemo(() => {
    if (!workflow?.conferenceRecommendations?.length) return new Set<string>()
    return new Set(workflow.conferenceRecommendations.map((c) => c.paperSubmissionDueDate))
  }, [workflow])

  const countByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of calendar) {
      map.set(day.date, day.count)
    }
    return map
  }, [calendar])

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    setError('')
    try {
      const data = await fetchConferenceCatalog({
        query: query.trim() || undefined,
        publisher: publisher || undefined,
      })
      setCalendar(data.calendar)
      setTotal(data.total)
      setSources(data.sources)

      const pubs = [
        ...new Set(data.conferences.map((c) => c.publisher).filter(Boolean) as string[]),
      ].sort()
      setPublishers((prev) => (prev.length > 0 ? prev : pubs))

      setSelectedDate((prev) => {
        if (prev && !data.calendar.some((d) => d.date === prev)) {
          setDayConferences([])
          return null
        }
        return prev
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conference catalog')
    } finally {
      setLoadingCatalog(false)
    }
  }, [query, publisher])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const wf = loadPublicationWorkflow()
      setWorkflow(wf)
      const searchQ = wf?.conferenceSearchQuery ?? ''

      setLoadingCatalog(true)
      setError('')
      try {
        if (searchQ) setQuery(searchQ)
        const data = await fetchConferenceCatalog({
          query: searchQ || undefined,
        })
        if (cancelled) return
        setCalendar(data.calendar)
        setTotal(data.total)
        setSources(data.sources)
        const pubs = [
          ...new Set(data.conferences.map((c) => c.publisher).filter(Boolean) as string[]),
        ].sort()
        setPublishers(pubs)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load conference catalog')
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function handleClearWorkflow() {
    clearPublicationWorkflow()
    setWorkflow(null)
    setQuery('')
    setPublisher('')
    setSelectedDate(null)
    setDayConferences([])
    setLoadingCatalog(true)
    setError('')
    void fetchConferenceCatalog().then((data) => {
      setCalendar(data.calendar)
      setTotal(data.total)
      setSources(data.sources)
      const pubs = [
        ...new Set(data.conferences.map((c) => c.publisher).filter(Boolean) as string[]),
      ].sort()
      setPublishers(pubs)
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load conference catalog')
    }).finally(() => setLoadingCatalog(false))
  }

  async function handleSelectDate(iso: string) {
    setSelectedDate(iso)
    setLoadingDay(true)
    setError('')
    try {
      const data = await fetchConferencesForDate(iso, true)
      setDayConferences(data.conferences)
    } catch (err) {
      setDayConferences([])
      setError(err instanceof Error ? err.message : 'Unable to load conferences for this date')
    } finally {
      setLoadingDay(false)
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const monthPrefix = toMonthKey(viewYear, viewMonth)

  const cells: Array<{ iso: string | null; day: number | null }> = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ iso: null, day: null })
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${monthPrefix}-${String(day).padStart(2, '0')}`
    cells.push({ iso, day })
  }

  return (
    <div className="research-tool-page">
      <header className="research-tool-header">
        <div className="research-tool-header__left">
          <Link to="/" className="research-tool-header__back">
            ← Services
          </Link>
          <h1 className="research-tool-header__title">Conference Tracker</h1>
          <p className="research-tool-header__subtitle">
            Submission deadline calendar — linked to your abstract-based publication plan
          </p>
        </div>
      </header>

      <main className="research-tool-main">
        <PublicationWorkflowBar
          workflow={workflow}
          activeStep="conferences"
          onClear={handleClearWorkflow}
        />

        {workflow?.conferenceRecommendations && workflow.conferenceRecommendations.length > 0 && (
          <section className="research-tool-panel" aria-label="Conferences matched to your abstract">
            <h2 className="research-tool-panel__title">Conferences Matched to Your Abstract</h2>
            <p className="research-tool-panel__meta">
              Ranked from your manuscript themes ·{' '}
              <Link to="/journal-insights" className="workflow-bar__link">
                Return to journal recommendations
              </Link>
            </p>
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
                  {workflow.conferenceRecommendations.map((conf) => (
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
                      <td data-label="Conference Date">{formatShortDate(conf.conferenceDate)}</td>
                      <td data-label="Matched Themes">
                        {conf.matchedThemes.length ? conf.matchedThemes.join(', ') : '—'}
                      </td>
                      <td data-label="Venue Location">{formatVenueLocation(conf.location)}</td>
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
          </section>
        )}

        <section className="research-tool-toolbar" aria-label="Conference filters">
          <div className="research-tool-toolbar__field">
            <label className="research-tool-toolbar__label" htmlFor="conf-search">
              Search conferences
            </label>
            <input
              id="conf-search"
              type="search"
              className="research-tool-toolbar__input"
              placeholder="Name, acronym, or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="research-tool-toolbar__field">
            <label className="research-tool-toolbar__label" htmlFor="conf-publisher">
              Publisher
            </label>
            <select
              id="conf-publisher"
              className="research-tool-toolbar__select"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
            >
              <option value="">All publishers</option>
              {publishers.map((pub) => (
                <option key={pub} value={pub}>
                  {pub}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn--primary research-tool-toolbar__action"
            onClick={() => void loadCatalog()}
            disabled={loadingCatalog}
          >
            {loadingCatalog ? 'Refreshing…' : 'Apply filters'}
          </button>
        </section>

        {error && (
          <div className="research-tool-alert" role="alert">
            {error}
          </div>
        )}

        <div className="research-tool-stats">
          <span>
            <strong>{total}</strong> upcoming submission deadlines
          </span>
          {sources.length > 0 && (
            <span className="research-tool-stats__source">Source: {sources.join('; ')}</span>
          )}
        </div>

        <section className="submission-calendar" aria-label="Submission deadline calendar">
          <div className="submission-calendar__nav">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ←
            </button>
            <h2 className="submission-calendar__month">{monthLabel}</h2>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="submission-calendar__weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="submission-calendar__weekday">
                {label}
              </span>
            ))}
          </div>

          <div className="submission-calendar__grid">
            {cells.map((cell, index) => {
              if (!cell.iso || cell.day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="submission-calendar__cell submission-calendar__cell--empty"
                  />
                )
              }

              const count = countByDate.get(cell.iso) ?? 0
              const isSelected = selectedDate === cell.iso
              const isToday =
                cell.iso ===
                `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

              const isRecommended = recommendedDateSet.has(cell.iso)

              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={[
                    'submission-calendar__cell',
                    count > 0 ? 'submission-calendar__cell--active' : '',
                    isSelected ? 'submission-calendar__cell--selected' : '',
                    isToday ? 'submission-calendar__cell--today' : '',
                    isRecommended ? 'submission-calendar__cell--workflow' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => count > 0 && void handleSelectDate(cell.iso!)}
                  disabled={count === 0 || loadingCatalog}
                  aria-label={
                    count > 0
                      ? `${formatDisplayDate(cell.iso)}: ${count} conference submission deadline${count === 1 ? '' : 's'}`
                      : `${cell.day}, no submission deadlines`
                  }
                >
                  <span className="submission-calendar__day">{cell.day}</span>
                  {count > 0 && (
                    <span className="submission-calendar__badge" aria-hidden="true">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {loadingCatalog && (
            <p className="research-tool-footnote" role="status">
              Loading conference catalog from curated registries…
            </p>
          )}
        </section>

        {selectedDate && (
          <section className="research-tool-panel" aria-label="Conferences on selected date">
            <h2 className="research-tool-panel__title">
              Conferences — {formatDisplayDate(selectedDate)}
            </h2>
            <p className="research-tool-panel__meta">
              {loadingDay
                ? 'Verifying registration fees from official conference pages…'
                : `${dayConferences.length} conference${dayConferences.length === 1 ? '' : 's'} with paper submission due on this date`}
            </p>

            {!loadingDay && dayConferences.length === 0 && (
              <p className="research-tool-footnote">No conferences match the current filters.</p>
            )}

            {dayConferences.length > 0 && (
              <div className="research-tool-table-wrap">
                <table className="data-table research-tool-table">
                  <thead>
                    <tr>
                      <th scope="col">Conference Name</th>
                      <th scope="col">Paper Submission Due Date</th>
                      <th scope="col">Conference Date</th>
                      <th scope="col">Author Registration Fee</th>
                      <th scope="col">Venue Location</th>
                      <th scope="col">Official Conference URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayConferences.map((conf) => (
                      <tr key={conf.id}>
                        <td data-label="Conference Name">
                          <span className="data-table__title">{conf.conferenceName}</span>
                          {conf.publisher && (
                            <span className="data-table__subtitle">{conf.publisher}</span>
                          )}
                        </td>
                        <td data-label="Paper Submission Due Date">
                          {formatShortDate(conf.paperSubmissionDueDate)}
                        </td>
                        <td data-label="Conference Date">
                          {formatShortDate(conf.conferenceDate)}
                        </td>
                        <td data-label="Author Registration Fee">
                          {conf.authorRegistrationCost ?? 'See conference page'}
                        </td>
                        <td data-label="Venue Location">{formatVenueLocation(conf.location)}</td>
                        <td data-label="Official Conference URL">
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
        )}

        <p className="research-tool-footnote">
          Deadlines are aggregated from the community-maintained CCF Deadlines registry (IEEE, ACM,
          USENIX, and related venues). Registration fees are enriched from official conference pages
          when available — always confirm dates and costs on the publisher site before submitting.
        </p>
      </main>
    </div>
  )
}
