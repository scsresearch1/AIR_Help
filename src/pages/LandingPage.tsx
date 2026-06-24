import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrandLogo } from '../components/BrandLogo'
import { ScientificBackground } from '../components/ScientificBackground'
import { LandingDecor } from '../components/LandingDecor'

const SERVICES = [
  {
    id: 'citation-extraction',
    title: 'AI Citation Extraction',
    description: 'Extract and structure citations from papers and PDFs.',
    tone: 'gold' as const,
    index: '01',
    route: '/citation-extraction',
    hint: 'Upload references → extract DOIs → download PDFs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <path d="M13 3v6h6" />
      </svg>
    ),
  },
  {
    id: 'data-extraction',
    title: 'Structured Data Extraction',
    description: 'Search Kaggle by topic and download structured datasets.',
    tone: 'emerald' as const,
    index: '02',
    route: '/data-extraction',
    hint: 'Search Kaggle → select datasets → download',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'reference-manager',
    title: 'Reference Manager',
    description: 'Detect citation style, convert between formats, and download.',
    tone: 'amber' as const,
    index: '03',
    route: '/reference-manager',
    hint: 'Upload references → detect style → convert & download',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    id: 'conference-tracker',
    title: 'Conference Tracker',
    description: 'Submission deadline calendar for IEEE, ACM, and allied research venues.',
    tone: 'violet' as const,
    index: '04',
    route: '/conference-tracker',
    hint: 'Browse calendar → select date → review deadlines & venues',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'journal-insights',
    title: 'Journal Insights',
    description: 'Publication intelligence — indexing, APC, frequency, and recent articles.',
    tone: 'emerald' as const,
    index: '05',
    route: '/journal-insights',
    hint: 'Enter journal name → generate publication profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
]

export function LandingPage() {
  const { username, logout } = useAuth()
  const [featured, ...rest] = SERVICES

  return (
    <div className="landing-page">
      <ScientificBackground />
      <div className="landing-page__backdrop" aria-hidden="true">
        <div className="landing-page__grid" />
        <LandingDecor />
      </div>

      <header className="landing-header">
        <div className="landing-header__brand">
          <BrandLogo size="sm" />
          <span className="landing-header__name">AI Research Helper</span>
        </div>
        <div className="landing-header__actions">
          <span className="landing-header__user">{username}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="landing-main">
        <div className="bento">
          <Link
            to={featured.route}
            className={`bento-card bento-card--featured bento-card--${featured.tone} bento-card--link`}
          >
            <span className="bento-card__index" aria-hidden="true">{featured.index}</span>
            <div className="bento-card__watermark" aria-hidden="true">{featured.icon}</div>
            <div className="bento-card__body">
              <div className="bento-card__icon">{featured.icon}</div>
              <h2 className="bento-card__title">{featured.title}</h2>
              <p className="bento-card__description">{featured.description}</p>
              {featured.hint && <p className="bento-card__hint">{featured.hint}</p>}
            </div>
          </Link>

          {rest.map((service, i) => (
            <Link
              key={service.id}
              to={service.route}
              className={`bento-card bento-card--${service.tone} bento-card--link`}
              style={{ animationDelay: `${(i + 1) * 70}ms` }}
            >
              <span className="bento-card__index" aria-hidden="true">
                {service.index}
              </span>
              <div className="bento-card__body">
                <div className="bento-card__icon">{service.icon}</div>
                <h3 className="bento-card__title">{service.title}</h3>
                <p className="bento-card__description">{service.description}</p>
                {service.hint && <p className="bento-card__hint">{service.hint}</p>}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
