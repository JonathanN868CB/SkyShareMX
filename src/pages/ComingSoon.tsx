import { useState, useEffect } from "react"

export default function ComingSoon({ name }: { name: string }) {
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setCycle(c => c + 1), 6000)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      style={{
        fontFamily: "var(--font-heading)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "28px",
        gap: "20px",
      }}
    >
      <div
        style={{
          background: "hsl(var(--card))",
          border: "0.5px solid rgba(212,160,23,0.25)",
          borderRadius: "8px",
          padding: "36px 40px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          width: "100%",
          maxWidth: "500px",
          boxShadow: "0 2px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Status tag */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          fontSize: "9px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--skyshare-gold)",
          border: "0.5px solid rgba(212,160,23,0.4)",
          borderRadius: "2px",
          padding: "5px 12px",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D4A017", animation: "cs-blink 1.4s ease-in-out infinite", display: "inline-block" }} />
          In Development
        </div>

        {/* Hangar SVG */}
        <svg key={cycle} viewBox="0 0 500 280" width="100%" style={{ maxWidth: 500 }} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><clipPath id="sc5"><rect width="500" height="280"/></clipPath></defs>
          <g clipPath="url(#sc5)">

            {/* Ground lines */}
            <line x1="52" y1="228" x2="242" y2="264" stroke="rgba(212,160,23,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="196" strokeDashoffset="196" style={{ animation: "cs-draw 0.45s 0.05s ease forwards" }}/>
            <line x1="242" y1="264" x2="498" y2="246" stroke="rgba(212,160,23,0.28)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="260" strokeDashoffset="260" style={{ animation: "cs-draw 0.5s 0.28s ease forwards" }}/>
            <line x1="52" y1="228" x2="315" y2="210" stroke="rgba(212,160,23,0.18)" strokeWidth="1" strokeLinecap="round" strokeDasharray="268" strokeDashoffset="268" style={{ animation: "cs-draw 0.5s 0.28s ease forwards" }}/>
            <line x1="315" y1="210" x2="498" y2="246" stroke="rgba(212,160,23,0.15)" strokeWidth="1" strokeLinecap="round" strokeDasharray="196" strokeDashoffset="196" style={{ animation: "cs-draw 0.42s 0.55s ease forwards" }}/>

            {/* Columns */}
            <line x1="52" y1="228" x2="52" y2="108" stroke="#D4A017" strokeWidth="3" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.38s 0.75s ease forwards" }}/>
            <line x1="115" y1="240" x2="115" y2="120" stroke="rgba(212,160,23,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.35s 0.85s ease forwards" }}/>
            <line x1="178" y1="252" x2="178" y2="132" stroke="rgba(212,160,23,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.35s 0.9s ease forwards" }}/>
            <line x1="242" y1="264" x2="242" y2="144" stroke="#D4A017" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.38s 0.95s ease forwards" }}/>
            <line x1="330" y1="258" x2="330" y2="174" stroke="rgba(212,160,23,0.45)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="84" strokeDashoffset="84" style={{ animation: "cs-draw 0.32s 1.0s ease forwards" }}/>
            <line x1="417" y1="252" x2="417" y2="168" stroke="rgba(212,160,23,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="84" strokeDashoffset="84" style={{ animation: "cs-draw 0.32s 1.05s ease forwards" }}/>
            <line x1="498" y1="246" x2="498" y2="126" stroke="rgba(212,160,23,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.38s 1.1s ease forwards" }}/>
            <line x1="315" y1="210" x2="315" y2="90" stroke="rgba(212,160,23,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.35s 1.12s ease forwards" }}/>

            {/* Eave beams */}
            <line x1="52" y1="108" x2="242" y2="144" stroke="#D4A017" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="196" strokeDashoffset="196" style={{ animation: "cs-draw 0.45s 1.3s ease forwards" }}/>
            <line x1="242" y1="144" x2="498" y2="126" stroke="rgba(212,160,23,0.55)" strokeWidth="2" strokeLinecap="round" strokeDasharray="260" strokeDashoffset="260" style={{ animation: "cs-draw 0.5s 1.4s ease forwards" }}/>
            <line x1="52" y1="108" x2="315" y2="90" stroke="rgba(212,160,23,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="268" strokeDashoffset="268" style={{ animation: "cs-draw 0.48s 1.45s ease forwards" }}/>
            <line x1="315" y1="90" x2="498" y2="126" stroke="rgba(212,160,23,0.25)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="196" strokeDashoffset="196" style={{ animation: "cs-draw 0.42s 1.5s ease forwards" }}/>

            {/* Roof rafters */}
            <line x1="52" y1="108" x2="147" y2="60" stroke="#D4A017" strokeWidth="2" strokeLinecap="round" strokeDasharray="107" strokeDashoffset="107" style={{ animation: "cs-draw 0.35s 1.7s ease forwards" }}/>
            <line x1="242" y1="144" x2="147" y2="60" stroke="#D4A017" strokeWidth="2" strokeLinecap="round" strokeDasharray="130" strokeDashoffset="130" style={{ animation: "cs-draw 0.38s 1.8s ease forwards" }}/>
            <line x1="315" y1="90" x2="410" y2="42" stroke="rgba(212,160,23,0.38)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="107" strokeDashoffset="107" style={{ animation: "cs-draw 0.35s 1.75s ease forwards" }}/>
            <line x1="498" y1="126" x2="410" y2="42" stroke="rgba(212,160,23,0.38)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="130" strokeDashoffset="130" style={{ animation: "cs-draw 0.38s 1.85s ease forwards" }}/>
            <line x1="147" y1="60" x2="410" y2="42" stroke="#D4A017" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="264" style={{ animation: "cs-draw 0.5s 2.0s ease forwards" }}/>
            <line x1="330" y1="138" x2="235" y2="54" stroke="rgba(212,160,23,0.2)" strokeWidth="1" strokeLinecap="round" strokeDasharray="114" strokeDashoffset="114" style={{ animation: "cs-draw 0.28s 2.18s ease forwards" }}/>
            <line x1="417" y1="132" x2="322" y2="48" stroke="rgba(212,160,23,0.18)" strokeWidth="1" strokeLinecap="round" strokeDasharray="114" strokeDashoffset="114" style={{ animation: "cs-draw 0.28s 2.22s ease forwards" }}/>

            {/* Purlins */}
            <line x1="82" y1="106" x2="165" y2="63" stroke="rgba(212,160,23,0.16)" strokeWidth="0.75" strokeDasharray="95" strokeDashoffset="95" style={{ animation: "cs-draw 0.2s 2.35s ease forwards" }}/>
            <line x1="115" y1="110" x2="186" y2="62" stroke="rgba(212,160,23,0.12)" strokeWidth="0.75" strokeDasharray="84" strokeDashoffset="84" style={{ animation: "cs-draw 0.2s 2.4s ease forwards" }}/>
            <line x1="280" y1="148" x2="183" y2="63" stroke="rgba(212,160,23,0.16)" strokeWidth="0.75" strokeDasharray="118" strokeDashoffset="118" style={{ animation: "cs-draw 0.2s 2.37s ease forwards" }}/>
            <line x1="318" y1="147" x2="215" y2="61" stroke="rgba(212,160,23,0.12)" strokeWidth="0.75" strokeDasharray="118" strokeDashoffset="118" style={{ animation: "cs-draw 0.2s 2.42s ease forwards" }}/>
            <line x1="242" y1="138" x2="498" y2="120" stroke="rgba(212,160,23,0.1)" strokeWidth="0.75" strokeDasharray="260" strokeDashoffset="260" style={{ animation: "cs-draw 0.3s 2.45s ease forwards" }}/>
            <line x1="242" y1="130" x2="498" y2="113" stroke="rgba(212,160,23,0.08)" strokeWidth="0.75" strokeDasharray="260" strokeDashoffset="260" style={{ animation: "cs-draw 0.3s 2.48s ease forwards" }}/>

            {/* Face fills */}
            <polygon points="52,228 242,264 242,144 52,108" fill="rgba(212,160,23,0.04)" opacity="0" style={{ animation: "cs-fadein 0.45s 2.55s ease forwards" }}/>
            <polygon points="242,264 498,246 498,126 242,144" fill="rgba(212,160,23,0.022)" opacity="0" style={{ animation: "cs-fadein 0.45s 2.6s ease forwards" }}/>
            <polygon points="52,108 242,144 147,60" fill="rgba(212,160,23,0.05)" opacity="0" style={{ animation: "cs-fadein 0.45s 2.65s ease forwards" }}/>
            <polygon points="242,144 498,126 410,42 147,60" fill="rgba(212,160,23,0.03)" opacity="0" style={{ animation: "cs-fadein 0.45s 2.7s ease forwards" }}/>

            {/* Hangar doors */}
            <line x1="52" y1="108" x2="242" y2="144" stroke="rgba(212,160,23,0.75)" strokeWidth="3.5" strokeLinecap="square" strokeDasharray="196" strokeDashoffset="196" style={{ animation: "cs-draw 0.42s 2.8s ease forwards" }}/>
            <line x1="52" y1="228" x2="242" y2="264" stroke="rgba(212,160,23,0.75)" strokeWidth="3.5" strokeLinecap="square" strokeDasharray="196" strokeDashoffset="196" style={{ animation: "cs-draw 0.42s 2.84s ease forwards" }}/>
            <polygon points="52,228 147,246 147,126 52,108" fill="rgba(212,160,23,0.07)" opacity="0" style={{ animation: "cs-fadein 0.3s 2.98s ease forwards" }}/>
            <polygon points="147,246 242,264 242,144 147,126" fill="rgba(212,160,23,0.055)" opacity="0" style={{ animation: "cs-fadein 0.3s 3.02s ease forwards" }}/>
            <line x1="52" y1="108" x2="52" y2="228" stroke="rgba(212,160,23,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.28s 2.94s ease forwards" }}/>
            <line x1="147" y1="126" x2="147" y2="246" stroke="rgba(212,160,23,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.28s 2.97s ease forwards" }}/>
            <line x1="242" y1="144" x2="242" y2="264" stroke="rgba(212,160,23,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="120" strokeDashoffset="120" style={{ animation: "cs-draw 0.28s 3.0s ease forwards" }}/>
            <line x1="52" y1="168" x2="147" y2="186" stroke="rgba(212,160,23,0.3)" strokeWidth="1" strokeDasharray="100" strokeDashoffset="100" style={{ animation: "cs-draw 0.22s 3.12s ease forwards" }}/>
            <line x1="147" y1="186" x2="242" y2="204" stroke="rgba(212,160,23,0.3)" strokeWidth="1" strokeDasharray="100" strokeDashoffset="100" style={{ animation: "cs-draw 0.22s 3.15s ease forwards" }}/>
            <line x1="52" y1="108" x2="147" y2="246" stroke="rgba(212,160,23,0.09)" strokeWidth="0.75" strokeDasharray="162" strokeDashoffset="162" style={{ animation: "cs-draw 0.28s 3.22s ease forwards" }}/>
            <line x1="147" y1="126" x2="242" y2="264" stroke="rgba(212,160,23,0.09)" strokeWidth="0.75" strokeDasharray="162" strokeDashoffset="162" style={{ animation: "cs-draw 0.28s 3.25s ease forwards" }}/>

            {/* Personnel door */}
            <polygon points="208,216 236,221 236,258 208,252" fill="rgba(212,160,23,0.06)" opacity="0" style={{ animation: "cs-fadein 0.25s 3.32s ease forwards" }}/>
            <line x1="208" y1="216" x2="208" y2="252" stroke="rgba(212,160,23,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="36" strokeDashoffset="36" style={{ animation: "cs-draw 0.18s 3.3s ease forwards" }}/>
            <line x1="236" y1="221" x2="236" y2="258" stroke="rgba(212,160,23,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="37" strokeDashoffset="37" style={{ animation: "cs-draw 0.18s 3.32s ease forwards" }}/>
            <line x1="208" y1="216" x2="236" y2="221" stroke="rgba(212,160,23,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="28" style={{ animation: "cs-draw 0.15s 3.34s ease forwards" }}/>
            <line x1="208" y1="252" x2="236" y2="258" stroke="rgba(212,160,23,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="28" style={{ animation: "cs-draw 0.15s 3.36s ease forwards" }}/>

            {/* Rivets */}
            <g opacity="0" style={{ animation: "cs-fadein 0.4s 3.5s ease forwards" }}>
              <circle cx="52"  cy="108" r="3"   fill="#D4A017" opacity="1"/>
              <circle cx="242" cy="144" r="3.5" fill="#D4A017" opacity="1"/>
              <circle cx="498" cy="126" r="3"   fill="#D4A017" opacity="0.7"/>
              <circle cx="315" cy="90"  r="2.5" fill="#D4A017" opacity="0.45"/>
              <circle cx="147" cy="60"  r="4"   fill="#D4A017" opacity="1"/>
              <circle cx="410" cy="42"  r="3"   fill="#D4A017" opacity="0.7"/>
              <circle cx="147" cy="126" r="2.5" fill="#D4A017" opacity="0.85"/>
              <rect x="49"  y="226" width="8" height="4" rx="0.5" fill="#D4A017" opacity="0.55"/>
              <rect x="239" y="262" width="8" height="4" rx="0.5" fill="#D4A017" opacity="0.55"/>
              <rect x="495" y="244" width="8" height="4" rx="0.5" fill="#D4A017" opacity="0.4"/>
            </g>

          </g>
        </svg>

        {/* Module name */}
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          fontWeight: 400,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "hsl(var(--foreground))",
          textAlign: "center",
        }}>
          {name}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", width: "36px", background: "var(--skyshare-gold)", opacity: 0.6 }} />

        {/* Subtitle */}
        <div style={{
          fontSize: "10px",
          color: "hsl(var(--muted-foreground))",
          letterSpacing: "0.05em",
          textAlign: "center",
          fontWeight: 300,
          lineHeight: 1.7,
          fontFamily: "var(--font-heading)",
        }}>
          This module is currently under development<br />and will be available in an upcoming release.
        </div>
      </div>
    </div>
  )
}
