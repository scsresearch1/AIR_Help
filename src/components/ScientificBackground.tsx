export function ScientificBackground() {
  return (
    <div className="scientific-bg" aria-hidden="true">
      <div className="scientific-bg__gradient" />
      <div className="scientific-bg__grid" />
      <div className="scientific-bg__orb scientific-bg__orb--1" />
      <div className="scientific-bg__orb scientific-bg__orb--2" />
      <div className="scientific-bg__orb scientific-bg__orb--3" />
      <svg className="scientific-bg__molecules" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bond-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(232, 196, 104, 0.25)" />
            <stop offset="100%" stopColor="rgba(167, 139, 250, 0.2)" />
          </linearGradient>
        </defs>
        <g className="molecule-group molecule-group--1">
          <circle cx="180" cy="200" r="6" className="atom atom--cyan" />
          <circle cx="280" cy="160" r="8" className="atom atom--indigo" />
          <circle cx="340" cy="240" r="5" className="atom atom--teal" />
          <line x1="180" y1="200" x2="280" y2="160" className="bond" />
          <line x1="280" y1="160" x2="340" y2="240" className="bond" />
        </g>
        <g className="molecule-group molecule-group--2">
          <circle cx="900" cy="150" r="7" className="atom atom--cyan" />
          <circle cx="980" cy="220" r="6" className="atom atom--indigo" />
          <circle cx="860" cy="260" r="5" className="atom atom--teal" />
          <circle cx="1020" cy="180" r="4" className="atom atom--violet" />
          <line x1="900" y1="150" x2="980" y2="220" className="bond" />
          <line x1="980" y1="220" x2="1020" y2="180" className="bond" />
          <line x1="900" y1="150" x2="860" y2="260" className="bond" />
        </g>
        <g className="molecule-group molecule-group--3">
          <circle cx="600" cy="600" r="9" className="atom atom--indigo" />
          <circle cx="700" cy="550" r="6" className="atom atom--cyan" />
          <circle cx="750" cy="640" r="5" className="atom atom--teal" />
          <circle cx="520" cy="620" r="5" className="atom atom--violet" />
          <line x1="600" y1="600" x2="700" y2="550" className="bond" />
          <line x1="700" y1="550" x2="750" y2="640" className="bond" />
          <line x1="600" y1="600" x2="520" y2="620" className="bond" />
        </g>
        <g className="molecule-group molecule-group--4">
          <circle cx="200" cy="580" r="5" className="atom atom--teal" />
          <circle cx="120" cy="520" r="7" className="atom atom--cyan" />
          <line x1="200" y1="580" x2="120" y2="520" className="bond" />
        </g>
      </svg>
      <div className="scientific-bg__scanline" />
    </div>
  )
}
