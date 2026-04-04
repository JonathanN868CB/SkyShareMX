import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, Info, ChevronRight, CheckCircle, Users,
  Calendar, User, BookMarked, FileText, ShoppingCart, BookOpen,
  Wrench, Shield, Compass
} from "lucide-react"
import { SOPS, TRAINING_RECORDS, MECHANICS, type SOPCategory } from "../../data/mockData"

const CATEGORY_CONFIG: Record<SOPCategory, { color: string; bg: string; icon: typeof FileText }> = {
  "Work Orders":       { color: "text-blue-400",    bg: "bg-blue-900/20 border border-blue-800/40",    icon: FileText    },
  "Parts & Inventory": { color: "text-amber-400",   bg: "bg-amber-900/20 border border-amber-800/40",  icon: ShoppingCart },
  "Logbook":           { color: "text-emerald-400", bg: "bg-emerald-900/20 border border-emerald-800/40", icon: BookOpen  },
  "Invoicing":         { color: "text-purple-400",  bg: "bg-purple-900/20 border border-purple-800/40", icon: FileText   },
  "Tool Calibration":  { color: "text-orange-400",  bg: "bg-orange-900/20 border border-orange-800/40", icon: Wrench    },
  "Safety":            { color: "text-red-400",     bg: "bg-red-900/20 border border-red-800/40",       icon: Shield     },
  "Portal Navigation": { color: "text-sky-400",     bg: "bg-sky-900/20 border border-sky-800/40",       icon: Compass    },
}

const TRAINING_STATUS_CONFIG = {
  current:       { label: "Current",       color: "text-emerald-400", dot: "bg-emerald-400" },
  expiring_soon: { label: "Expiring Soon", color: "text-amber-400",   dot: "bg-amber-400"   },
  expired:       { label: "Expired",       color: "text-red-400",     dot: "bg-red-400"     },
  not_trained:   { label: "Not Trained",   color: "text-white/30",    dot: "bg-white/20"    },
}

export default function SOPDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const sop = SOPS.find(s => s.id === id)
  if (!sop) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white/40">SOP not found</p>
    </div>
  )

  const cfg     = CATEGORY_CONFIG[sop.category]
  const CategoryIcon = cfg.icon
  const related = SOPS.filter(s => sop.relatedSOPs.includes(s.id))

  // Training roster for this SOP
  const trainingForSOP = TRAINING_RECORDS.filter(r => r.sopId === sop.id)
  const trainedCount   = trainingForSOP.filter(r => r.status === "current").length
  const totalMechanics = MECHANICS.length

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-white/35 text-xs" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
          <button onClick={() => navigate("/app/beet-box/sop-library")} className="hover:text-white/70 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            SOP Library
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/55">{sop.sopNumber}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
            <CategoryIcon className={`w-6 h-6 ${cfg.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white/40 text-sm font-mono">{sop.sopNumber}</span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
                {sop.category}
              </span>
              <span className="text-white/25 text-xs">Rev {sop.revision}</span>
            </div>
            <h1 className="text-white mb-1.5" style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.04em" }}>
              {sop.title}
            </h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-3xl">{sop.description}</p>
          </div>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-6 mt-4 pt-4" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
          {[
            { icon: User,       label: "Author",   value: sop.author     },
            { icon: CheckCircle, label: "Approved", value: sop.approvedBy },
            { icon: Calendar,   label: "Effective", value: sop.effectiveDate },
            { icon: Calendar,   label: "Review",    value: sop.reviewDate  },
            { icon: BookMarked, label: "Steps",     value: `${sop.steps.length} steps` },
            { icon: Users,      label: "Trained",   value: `${trainedCount} / ${totalMechanics} mechanics` },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-1.5">
              <m.icon className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <span className="text-white/30 text-xs" style={{ fontFamily: "var(--font-heading)" }}>{m.label}:</span>
              <span className="text-white/65 text-xs">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stripe-divider" />

      {/* Body — two-column layout */}
      <div className="px-8 py-6 flex gap-6">
        {/* Main — steps */}
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-white/35 text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "var(--font-heading)" }}>
            Procedure
          </p>

          {sop.steps.map((step, idx) => (
            <div key={idx} className="flex gap-4 group">
              {/* Step number column */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0`}
                     style={{
                       background:   step.warning ? "rgba(239,68,68,0.15)"  : "rgba(212,160,23,0.12)",
                       border:       step.warning ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(212,160,23,0.25)",
                       color:        step.warning ? "#f87171" : "var(--skyshare-gold)",
                       fontFamily:   "var(--font-display)",
                     }}>
                  {step.number}
                </div>
                {idx < sop.steps.length - 1 && (
                  <div className="w-px flex-1 mt-2 mb-0" style={{ background: "hsl(0 0% 18%)", minHeight: "12px" }} />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-3">
                <p className="text-white/85 text-sm leading-relaxed">{step.instruction}</p>

                {/* Note callout */}
                {step.note && (
                  <div className="flex gap-2.5 mt-2 px-3 py-2.5 rounded-lg"
                       style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)" }}>
                    <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sky-300/80 text-xs leading-relaxed">{step.note}</p>
                  </div>
                )}

                {/* Warning callout */}
                {step.warning && (
                  <div className="flex gap-2.5 mt-2 px-3 py-2.5 rounded-lg"
                       style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300/80 text-xs leading-relaxed font-medium">{step.warning}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 space-y-5">
          {/* Training Roster */}
          <div className="card-elevated rounded-lg overflow-hidden" style={{ border: "1px solid hsl(0 0% 16%)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
              <div className="flex items-center justify-between">
                <p className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                  Training Roster
                </p>
                <Link
                  to="/app/beet-box/training"
                  className="text-[10px] hover:text-white/60 transition-colors"
                  style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
                >
                  View All →
                </Link>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: "hsl(0 0% 14%)" }}>
              {MECHANICS.map(mech => {
                const record = trainingForSOP.find(r => r.mechanicId === mech.id)
                const status = record?.status ?? "not_trained"
                const cfg2   = TRAINING_STATUS_CONFIG[status]
                return (
                  <div key={mech.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg2.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/75 text-xs truncate">{mech.name}</p>
                      <p className="text-white/30 text-[10px]">{mech.role}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] ${cfg2.color}`} style={{ fontFamily: "var(--font-heading)" }}>
                        {cfg2.label}
                      </p>
                      {record && (
                        <p className="text-white/25 text-[10px]">Exp {record.expiryDate}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Related SOPs */}
          {related.length > 0 && (
            <div className="card-elevated rounded-lg overflow-hidden" style={{ border: "1px solid hsl(0 0% 16%)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
                <p className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                  Related SOPs
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "hsl(0 0% 14%)" }}>
                {related.map(rel => {
                  const relCfg = CATEGORY_CONFIG[rel.category]
                  return (
                    <button
                      key={rel.id}
                      onClick={() => navigate(`/app/beet-box/sop-library/${rel.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/4 transition-colors group"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${relCfg.bg}`}>
                        <relCfg.icon className={`w-3.5 h-3.5 ${relCfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/30 text-[10px] font-mono">{rel.sopNumber}</p>
                        <p className="text-white/65 text-xs truncate group-hover:text-white/80 transition-colors">{rel.title}</p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/45 transition-colors" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {sop.tags.length > 0 && (
            <div className="card-elevated rounded-lg p-4" style={{ border: "1px solid hsl(0 0% 16%)" }}>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-heading)" }}>Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {sop.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-1 rounded text-white/40 bg-white/5 border border-white/8">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
