export function LandingDecor() {
  return (
    <div className="landing-decor" aria-hidden="true">
      <div className="landing-decor__orb landing-decor__orb--1" />
      <div className="landing-decor__orb landing-decor__orb--2" />
      <div className="landing-decor__orb landing-decor__orb--3" />

      <svg className="landing-decor__network" viewBox="0 0 480 480" fill="none">
        <defs>
          <linearGradient id="decor-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8c468" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <g className="landing-decor__network-lines" stroke="url(#decor-line)" strokeWidth="1">
          <line x1="80" y1="120" x2="200" y2="80" />
          <line x1="200" y1="80" x2="320" y2="140" />
          <line x1="320" y1="140" x2="400" y2="100" />
          <line x1="200" y1="80" x2="180" y2="220" />
          <line x1="180" y1="220" x2="300" y2="280" />
          <line x1="300" y1="280" x2="400" y2="240" />
          <line x1="180" y1="220" x2="60" y2="300" />
          <line x1="60" y1="300" x2="140" y2="400" />
          <line x1="300" y1="280" x2="220" y2="380" />
          <line x1="220" y1="380" x2="140" y2="400" />
          <line x1="400" y1="240" x2="360" y2="360" />
          <line x1="360" y1="360" x2="220" y2="380" />
        </g>
        <g className="landing-decor__network-nodes">
          <circle cx="80" cy="120" r="6" fill="#e8c468" fillOpacity="0.6" />
          <circle cx="200" cy="80" r="9" fill="#e8c468" fillOpacity="0.8" />
          <circle cx="320" cy="140" r="7" fill="#a78bfa" fillOpacity="0.7" />
          <circle cx="400" cy="100" r="5" fill="#e8c468" fillOpacity="0.5" />
          <circle cx="180" cy="220" r="8" fill="#34d399" fillOpacity="0.6" />
          <circle cx="300" cy="280" r="10" fill="#a78bfa" fillOpacity="0.75" />
          <circle cx="400" cy="240" r="6" fill="#fbbf24" fillOpacity="0.6" />
          <circle cx="60" cy="300" r="5" fill="#34d399" fillOpacity="0.5" />
          <circle cx="140" cy="400" r="7" fill="#e8c468" fillOpacity="0.55" />
          <circle cx="220" cy="380" r="8" fill="#a78bfa" fillOpacity="0.65" />
          <circle cx="360" cy="360" r="6" fill="#fbbf24" fillOpacity="0.5" />
        </g>
      </svg>

      <svg className="landing-decor__citations" viewBox="0 0 280 200" fill="none">
        <rect x="20" y="20" width="120" height="8" rx="2" fill="#e8c468" fillOpacity="0.15" />
        <rect x="20" y="38" width="90" height="6" rx="2" fill="#fff" fillOpacity="0.06" />
        <rect x="20" y="52" width="100" height="6" rx="2" fill="#fff" fillOpacity="0.04" />
        <rect x="20" y="80" width="140" height="8" rx="2" fill="#a78bfa" fillOpacity="0.15" />
        <rect x="20" y="98" width="110" height="6" rx="2" fill="#fff" fillOpacity="0.06" />
        <rect x="20" y="112" width="80" height="6" rx="2" fill="#fff" fillOpacity="0.04" />
        <rect x="20" y="140" width="100" height="8" rx="2" fill="#34d399" fillOpacity="0.12" />
        <rect x="20" y="158" width="130" height="6" rx="2" fill="#fff" fillOpacity="0.05" />
        <path
          d="M180 40 L220 60 L180 80 Z"
          stroke="#e8c468"
          strokeOpacity="0.25"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M200 100 L240 120 L200 140 Z"
          stroke="#a78bfa"
          strokeOpacity="0.2"
          strokeWidth="1"
          fill="none"
        />
      </svg>

      <div className="landing-decor__ring landing-decor__ring--1" />
      <div className="landing-decor__ring landing-decor__ring--2" />

      <svg className="landing-decor__wave" viewBox="0 0 800 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id="decor-wave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e8c468" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          d="M0 60 Q100 20 200 60 T400 55 T600 65 T800 50"
          stroke="url(#decor-wave)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    </div>
  )
}
