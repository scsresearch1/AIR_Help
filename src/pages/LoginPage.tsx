import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { ScientificBackground } from '../components/ScientificBackground'

const SHOWCASE_FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    label: 'Citation Extraction',
    detail: 'Parse references from any document',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    label: 'AI Automation',
    detail: 'Accelerate repetitive research tasks',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    label: 'Secure Workspace',
    detail: 'Encrypted research environment',
  },
]

function BrandLogo() {
  return (
    <div className="login-logo">
      <div className="login-logo__ring" aria-hidden="true" />
      <div className="login-logo__core">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" opacity="0.25" />
          <circle cx="24" cy="13" r="4.5" fill="currentColor" />
          <circle cx="13" cy="31" r="4" fill="currentColor" opacity="0.75" />
          <circle cx="35" cy="31" r="4" fill="currentColor" opacity="0.75" />
          <line x1="24" y1="17" x2="13" y2="27" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
          <line x1="24" y1="17" x2="35" y2="27" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
          <line x1="17" y1="31" x2="31" y2="31" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
        </svg>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    requestAnimationFrame(() => {
      const success = login(username, password)
      setIsLoading(false)
      if (!success) {
        setError('Invalid credentials. Please verify your username and password.')
      }
    })
  }

  return (
    <div className="login-page">
      <ScientificBackground />

      <div className="login-layout">
        <aside className="login-showcase">
          <div className="login-showcase__inner">
            <div className="login-showcase__brand">
              <BrandLogo />
              <p className="login-showcase__eyebrow">Research Automation Platform</p>
              <h1 className="login-showcase__title">
                AI Research
                <span className="login-showcase__title-accent">Helper</span>
              </h1>
              <p className="login-showcase__tagline">
                Transform how you discover, cite, and synthesize scientific literature with
                intelligent automation built for researchers.
              </p>
            </div>

            <ul className="login-showcase__features">
              {SHOWCASE_FEATURES.map((feature) => (
                <li key={feature.label} className="login-showcase__feature">
                  <span className="login-showcase__feature-icon">{feature.icon}</span>
                  <span className="login-showcase__feature-text">
                    <strong>{feature.label}</strong>
                    <span>{feature.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="login-showcase__viz" aria-hidden="true">
              <svg viewBox="0 0 400 200" fill="none">
                <defs>
                  <linearGradient id="viz-line" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#e8c468" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#e8c468" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <path
                  d="M20 160 Q80 40 140 100 T260 80 T380 120"
                  stroke="url(#viz-line)"
                  strokeWidth="2"
                  fill="none"
                  className="login-showcase__wave"
                />
                <circle cx="80" cy="90" r="5" fill="#e8c468" opacity="0.6" className="login-showcase__node" />
                <circle cx="140" cy="100" r="7" fill="#e8c468" className="login-showcase__node" />
                <circle cx="260" cy="80" r="6" fill="#a78bfa" opacity="0.8" className="login-showcase__node" />
                <circle cx="340" cy="110" r="5" fill="#34d399" opacity="0.7" className="login-showcase__node" />
              </svg>
            </div>
          </div>
        </aside>

        <div className="login-panel">
          <div className="login-card">
            <div className="login-card__glow" aria-hidden="true" />

            <div className="login-card__mobile-brand">
              <BrandLogo />
            </div>

            <div className="login-card__header">
              <h2 className="login-card__title">Welcome back</h2>
              <p className="login-card__subtitle">Sign in to access your research workspace</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <div className="login-form__error" role="alert">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              )}

              <div className="form-field">
                <label htmlFor="username">Username</label>
                <div className="form-field__input-wrap">
                  <svg className="form-field__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074 0z" />
                  </svg>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="password">Password</label>
                <div className="form-field__input-wrap">
                  <svg className="form-field__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="form-field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
                          clipRule="evenodd"
                        />
                        <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path
                          fillRule="evenodd"
                          d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn--primary btn--full btn--login" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    Sign In to Workspace
                    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="login-card__trust">
              <div className="login-card__trust-item">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                    clipRule="evenodd"
                  />
                </svg>
                Encrypted
              </div>
              <div className="login-card__trust-item">
                <span className="pulse-dot" aria-hidden="true" />
                Live Environment
              </div>
            </div>
          </div>

          <p className="login-page__copyright">
            © {new Date().getFullYear()} SCS-Research Minds
          </p>
        </div>
      </div>
    </div>
  )
}
