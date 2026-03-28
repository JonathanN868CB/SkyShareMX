import skyShareLogo from "@/shared/assets/skyshare-logo.png"
import { Loader2 } from "lucide-react"

interface Props {
  exiting?: boolean
}

export function AuthTransitionScreen({ exiting = false }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#1e1e1e",
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
      <img
        src={skyShareLogo}
        alt="SkyShare"
        style={{
          height: "44px",
          width: "auto",
          filter: "brightness(0) invert(1)",
          opacity: 0.85,
          marginBottom: "32px",
        }}
      />

      <Loader2
        size={22}
        style={{ color: "var(--skyshare-gold)", opacity: 0.8 }}
        className="animate-spin"
      />
    </div>
  )
}
