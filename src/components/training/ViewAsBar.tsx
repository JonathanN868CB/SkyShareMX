import { useNavigate, useSearchParams } from "react-router-dom"
import { Eye, X } from "lucide-react"
import { useViewAsTech } from "@/hooks/useViewAsTech"

interface ViewAsBarProps {
  page: "journey" | "training"
}

export function ViewAsBar({ page }: ViewAsBarProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isSuperAdmin, isViewingOther, viewingTech, allTechs } = useViewAsTech()

  if (!isSuperAdmin) return null

  const pagePath  = page === "journey" ? "/app/journey" : "/app/training"
  const pageLabel = page === "journey" ? "Journey" : "Training"

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (!val) navigate(pagePath)
    else navigate(`${pagePath}?as=${val}`)
  }

  // ── Banner: viewing someone else ─────────────────────────────────────────────
  if (isViewingOther && viewingTech) {
    return (
      <div className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}>
        <div className="flex items-center gap-2.5">
          <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
          <span style={{
            fontFamily: "var(--font-heading)", fontSize: "0.7rem",
            fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)",
          }}>
            Viewing{" "}
            <span style={{ color: "var(--skyshare-gold)" }}>{viewingTech.name}</span>
            's {pageLabel} — read-only
          </span>
        </div>
        <button
          onClick={() => navigate(pagePath)}
          className="flex items-center gap-1.5 px-3 py-1 rounded transition-colors hover:bg-white/10"
          style={{
            fontFamily: "var(--font-heading)", fontSize: "0.62rem",
            fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)", border: "0.5px solid rgba(255,255,255,0.12)",
          }}
        >
          <X className="h-3 w-3" />
          Back to mine
        </button>
      </div>
    )
  }

  // ── Picker: own view, offer dropdown to switch ────────────────────────────────
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-2.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
      <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
      <span style={{
        fontFamily: "var(--font-heading)", fontSize: "0.62rem",
        fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.3)",
      }}>
        View as
      </span>
      <select
        value={searchParams.get("as") ?? ""}
        onChange={handleSelect}
        className="bg-transparent outline-none cursor-pointer"
        style={{
          fontFamily: "var(--font-heading)", fontSize: "0.68rem",
          color: "rgba(255,255,255,0.55)", letterSpacing: "0.04em",
        }}
      >
        <option value="" style={{ background: "#1a1a1a" }}>— Select team member —</option>
        {allTechs.map(t => (
          <option key={t.id} value={t.id} style={{ background: "#1a1a1a" }}>
            {t.name}{t.role ? ` · ${t.role}` : ""}
          </option>
        ))}
      </select>
    </div>
  )
}
