import { useNavigate, useSearchParams } from "react-router-dom"
import { BookOpen } from "lucide-react"
import { LOGBOOK_ENTRIES, AIRCRAFT } from "../../data/mockData"
import { cn } from "@/shared/lib/utils"

const STATUS_STYLES = {
  draft:    "bg-zinc-800 text-zinc-400 border border-zinc-700",
  signed:   "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  exported: "bg-blue-900/30 text-blue-400 border border-blue-800/40",
}

export default function LogbookDashboard() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const newWO = params.get("wo")

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
          Logbook
        </h1>
        <p className="text-white/45 text-sm">Aircraft maintenance logbook entries</p>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Banner for "generate from WO" flow */}
        {newWO && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-4 rounded-lg"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.25)" }}
          >
            <div>
              <p className="text-white/80 text-sm font-semibold">Generate Logbook Entry</p>
              <p className="text-white/50 text-xs mt-0.5">Create a new entry from completed work order. Click an entry below to see the format, or click New Entry.</p>
            </div>
            <button
              onClick={() => navigate(`/app/beet-box/logbook/new?wo=${newWO}`)}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-black transition-colors flex-shrink-0"
              style={{ background: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
            >
              New Entry →
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Entries",  value: LOGBOOK_ENTRIES.length,                                              color: "text-white"         },
            { label: "Signed",         value: LOGBOOK_ENTRIES.filter(e => e.status === "signed").length,            color: "text-emerald-400"    },
            { label: "Draft",          value: LOGBOOK_ENTRIES.filter(e => e.status === "draft").length,             color: "text-zinc-400"       },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4">
              <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Entries table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                {["Entry #", "Aircraft", "Date", "WO Ref", "Work Performed", "Mechanic", "Cert", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LOGBOOK_ENTRIES.map((entry, idx) => {
                const ac = AIRCRAFT.find(a => a.id === entry.aircraftId)
                return (
                  <tr
                    key={entry.id}
                    onClick={() => navigate(`/app/beet-box/logbook/${entry.id}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                    style={{ borderBottom: idx < LOGBOOK_ENTRIES.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                  >
                    <td className="px-4 py-3 font-mono text-white/70 text-xs font-semibold">{entry.entryNumber}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                        {entry.aircraftReg}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {new Date(entry.entryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs font-mono">{entry.woNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-white/65 text-xs max-w-[200px]">
                      <span className="line-clamp-2">{entry.entries[0]?.text ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-white/65 text-xs">{entry.mechanicName}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">{entry.certificateType}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide", STATUS_STYLES[entry.status])}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* New entry button at bottom */}
        <div className="flex">
          <button
            onClick={() => navigate("/app/beet-box/logbook/new")}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm border border-dashed border-white/15 text-white/35 hover:border-white/30 hover:text-white/60 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            Create New Logbook Entry
          </button>
        </div>
      </div>
    </div>
  )
}
