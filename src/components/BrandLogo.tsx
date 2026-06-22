interface BrandLogoProps {
  size?: 'sm' | 'md'
}

export function BrandLogo({ size = 'md' }: BrandLogoProps) {
  return (
    <div className={`brand-logo brand-logo--${size}`}>
      <div className="brand-logo__ring" aria-hidden="true" />
      <div className="brand-logo__core">
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
