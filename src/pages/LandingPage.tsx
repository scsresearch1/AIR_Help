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
    status: 'coming-soon' as const,
    tone: 'gold' as const,
    index: '01',
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
    status: 'coming-soon' as const,
    tone: 'emerald' as const,
    index: '02',
    route: '/data-extraction',
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
    status: 'coming-soon' as const,
    tone: 'amber' as const,
    index: '03',
    route: '/reference-manager',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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
          to="/citation-extraction"
          className={`bento-card bento-card--featured bento-card--${featured.tone} bento-card--link`}
        >
          <span className="bento-card__index" aria-hidden="true">{featured.index}</span>
          <div className="bento-card__watermark" aria-hidden="true">{featured.icon}</div>
          <div className="bento-card__body">
            <div className="bento-card__top">
              <div className="bento-card__icon">{featured.icon}</div>
              <span className="status-badge status-badge--active">Open</span>
            </div>
            <h2 className="bento-card__title">{featured.title}</h2>
            <p className="bento-card__description">{featured.description}</p>
            <p className="bento-card__hint">Upload references → extract DOIs → download PDFs</p>
          </div>
        </Link>

          {rest.map((service, i) =>
            service.route ? (
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
                  <div className="bento-card__top">
                    <div className="bento-card__icon">{service.icon}</div>
                    <span className="status-badge status-badge--active">Open</span>
                  </div>
                  <h3 className="bento-card__title">{service.title}</h3>
                  <p className="bento-card__description">{service.description}</p>
                  {service.id === 'data-extraction' && (
                    <p className="bento-card__hint">Search Kaggle → select datasets → download</p>
                  )}
                </div>
              </Link>
            ) : (
              <article
                key={service.id}
                className={`bento-card bento-card--${service.tone}`}
                style={{ animationDelay: `${(i + 1) * 70}ms` }}
              >
                <span className="bento-card__index" aria-hidden="true">
                  {service.index}
                </span>
                <div className="bento-card__body">
                  <div className="bento-card__top">
                    <div className="bento-card__icon">{service.icon}</div>
                    <span className={`status-badge status-badge--${service.status}`}>Planned</span>
                  </div>
                  <h3 className="bento-card__title">{service.title}</h3>
                  <p className="bento-card__description">{service.description}</p>
                </div>
              </article>
            ),
          )}
        </div>
      </main>
    </div>
  )
}
