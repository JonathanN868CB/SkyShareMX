import { useState, useEffect } from "react"

export default function AccessDenied({ name }: { name: string }) {
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setCycle(c => c + 1), 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div
        className="card-elevated flex flex-col items-center gap-7 w-full max-w-[480px] rounded-lg px-12 py-11"
        style={{ border: "1px solid rgba(212,160,23,0.45)" }}
      >

        {/* Radar scene */}
        <div key={cycle} style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>

          {/* Sweep glow (behind rings) */}
          <div className="ad-sweep-glow" />

          {/* Rings */}
          {[120, 82, 46].map((size, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: size,
                height: size,
                borderRadius: "50%",
                border: `1px solid rgba(139,96,10,${0.55 - i * 0.1})`,
              }}
            />
          ))}

          {/* Crosshairs */}
          <div style={{ position: "absolute", width: "100%", height: "0.5px", background: "rgba(139,96,10,0.35)" }} />
          <div style={{ position: "absolute", height: "100%", width: "0.5px", background: "rgba(139,96,10,0.35)" }} />

          {/* Sweep line */}
          <div className="ad-sweep-wrap">
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "1.5px",
              background: "linear-gradient(to right, transparent, rgba(212,160,23,0.95))",
              transformOrigin: "left center",
            }} />
          </div>

          {/* Contacts */}
          <div className="ad-contact" />
          <div className="ad-contact ad-contact-2" />

          {/* Lock icon */}
          <div style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="9" width="14" height="10" rx="2" stroke="var(--skyshare-gold)" strokeWidth="1.5" />
              <path d="M5 9V6a4 4 0 0 1 8 0v3" stroke="var(--skyshare-gold)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="14" r="1.5" fill="var(--skyshare-gold)" opacity="0.9" />
            </svg>
          </div>
        </div>

        {/* Radio typewriter box */}
        <div key={`radio-${cycle}`} className="ad-radio-box">
          <span className="ad-radio-line ad-l1" style={{ color: "var(--skyshare-gold)" }}>Tower: Identify yourself...</span>
          <span className="ad-radio-line ad-l2" style={{ color: "hsl(var(--foreground))" }}>User: Requesting access to {name}.</span>
          <span className="ad-radio-line ad-l3" style={{ color: "var(--skyshare-gold)" }}>Tower: Checking clearance...</span>
          <span className="ad-radio-line ad-l4" style={{ color: "#e74c3c", fontWeight: 600 }}>
            Tower: ACCESS DENIED. Stand by.<span className="ad-cursor" />
          </span>
        </div>

        {/* Divider */}
        <div key={`div-${cycle}`} className="ad-divider" />

        {/* Headline */}
        <div key={`hl-${cycle}`} style={{ textAlign: "center" }}>
          <span className="ad-hl-tag">&#9632; Restricted Airspace</span>
          <span className="ad-hl-main">Clearance Required</span>
          <span className="ad-hl-sub">
            You don't have permission to access {name}.<br />
            Contact your administrator to request access.
          </span>
        </div>

      </div>
    </div>
  )
}
