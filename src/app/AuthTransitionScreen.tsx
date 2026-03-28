import skyShareLogo from "@/shared/assets/skyshare-logo.png"

interface Props {
  exiting?: boolean
}

const GOLD     = "#d4a017"
const GOLD_DIM = "rgba(212,160,23,0.18)"

export function AuthTransitionScreen({ exiting = false }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.4s ease",
        pointerEvents: exiting ? "none" : "all",
      }}
    >
      <style>{`
        /* Progress bar fills once — no loop */
        @keyframes smx-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }

        /* Status labels — each plays for the full 3s, only one visible at a time */
        @keyframes smx-s1 {
          0%          { opacity: 1; }
          28%         { opacity: 1; }
          35%, 100%   { opacity: 0; }
        }
        @keyframes smx-s2 {
          0%, 31%     { opacity: 0; }
          38%         { opacity: 1; }
          61%         { opacity: 1; }
          68%, 100%   { opacity: 0; }
        }
        @keyframes smx-s3 {
          0%, 64%     { opacity: 0; }
          72%, 100%   { opacity: 1; }
        }

        /* Checkpoint dot — dims to lit, plays once */
        @keyframes smx-dot {
          from { background: ${GOLD_DIM}; box-shadow: none; }
          to   { background: ${GOLD};     box-shadow: 0 0 6px rgba(212,160,23,0.55); }
        }

        /* Logo soft reveal */
        @keyframes smx-reveal {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 0.88; transform: translateY(0); }
        }
      `}</style>

      {/* Logo */}
      <img
        src={skyShareLogo}
        alt="SkyShare"
        style={{
          height: "44px",
          width: "auto",
          filter: "brightness(0) invert(1)",
          marginBottom: "44px",
          animation: "smx-reveal 0.7s ease forwards",
        }}
      />

      {/* Status label — three overlapping spans, each fades in/out */}
      <div
        style={{
          position: "relative",
          width: "240px",
          height: "13px",
          marginBottom: "12px",
          textAlign: "center",
        }}
      >
        {(
          [
            { text: "AUTHENTICATING",  anim: "smx-s1" },
            { text: "LOADING SYSTEMS", anim: "smx-s2" },
            { text: "READY",           anim: "smx-s3" },
          ] as const
        ).map(({ text, anim }) => (
          <span
            key={text}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              fontFamily: "'Montserrat', Arial, sans-serif",
              fontSize: "9px",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.32)",
              opacity: 0,
              animationName: anim,
              animationDuration: "2.55s",
              animationTimingFunction: "linear",
              animationFillMode: "forwards",
              animationIterationCount: 1,
            }}
          >
            {text}
          </span>
        ))}
      </div>

      {/* Runway progress track */}
      <div
        style={{
          position: "relative",
          width: "240px",
          height: "2px",
          background: "rgba(255,255,255,0.07)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "0%",
            background: `linear-gradient(90deg, rgba(212,160,23,0.65) 0%, ${GOLD} 100%)`,
            borderRadius: "2px",
            animationName: "smx-fill",
            animationDuration: "2.55s",
            animationTimingFunction: "ease-in-out",
            animationFillMode: "forwards",
            animationIterationCount: 1,
          }}
        />
      </div>

      {/* Checkpoint dots at 25 / 50 / 75% of track width */}
      <div style={{ position: "relative", width: "240px", height: "14px", marginTop: "2px" }}>
        {([25, 50, 75] as const).map((pct) => (
          <div
            key={pct}
            style={{
              position: "absolute",
              top: "4px",
              left: `${pct}%`,
              transform: "translateX(-50%)",
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              background: GOLD_DIM,
              animationName: "smx-dot",
              animationDuration: "0.25s",
              animationTimingFunction: "ease-out",
              animationFillMode: "forwards",
              animationIterationCount: 1,
              animationDelay: `${(pct / 100) * 2.55}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
