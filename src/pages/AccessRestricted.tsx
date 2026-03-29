import { useSearchParams } from "react-router-dom"
import { Lock } from "lucide-react"

export default function AccessRestricted() {
  const [params] = useSearchParams()
  const feature = params.get("feature") ?? "this section"

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div
        className="h-14 w-14 rounded flex items-center justify-center mb-6"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
      >
        <Lock className="h-6 w-6" style={{ color: "var(--skyshare-gold)" }} />
      </div>

      <h1
        className="text-2xl font-semibold text-foreground mb-2"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
      >
        Access Restricted
      </h1>

      <div
        className="mb-4"
        style={{ height: "1px", width: "2.5rem", background: "var(--skyshare-gold)" }}
      />

      <p
        className="text-sm mb-1"
        style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }}
      >
        {feature}
      </p>

      <p
        className="text-sm max-w-sm leading-relaxed mt-3"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        You don't currently have access to this area. If you believe this is an error or need access, please reach out to your administrator.
      </p>
    </div>
  )
}
