import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, BookMarked, ChevronRight, FileText, AlertTriangle, Clock, Wrench, ShoppingCart, BookOpen, FileText as FileTextIcon, Shield, Compass } from "lucide-react"
import { SOPS, type SOPCategory } from "../../data/mockData"

const CATEGORY_CONFIG: Record<SOPCategory, { color: string; bg: string; icon: typeof FileText }> = {
  "Work Orders":       { color: "text-blue-400",    bg: "bg-blue-900/25 border-blue-800/40",    icon: FileText    },
  "Parts & Inventory": { color: "text-amber-400",   bg: "bg-amber-900/25 border-amber-800/40",  icon: ShoppingCart },
  "Logbook":           { color: "text-emerald-400", bg: "bg-emerald-900/25 border-emerald-800/40", icon: BookOpen  },
  "Invoicing":         { color: "text-purple-400",  bg: "bg-purple-900/25 border-purple-800/40", icon: FileTextIcon },
  "Tool Calibration":  { color: "text-orange-400",  bg: "bg-orange-900/25 border-orange-800/40", icon: Wrench     },
  "Safety":            { color: "text-red-400",     bg: "bg-red-900/25 border-red-800/40",       icon: Shield      },
  "Portal Navigation": { color: "text-sky-400",     bg: "bg-sky-900/25 border-sky-800/40",       icon: Compass     },
}

const ALL_CATEGORIES: SOPCategory[] = [
  "Work Orders", "Parts & Inventory", "Logbook", "Invoicing", "Tool Calibration", "Safety", "Portal Navigation",
]

export default function SOPDashboard() {
  const navigate = useNavigate()
  const [search, setSearch]     = useState("")
  const [activeCategory, setActiveCategory] = useState<SOPCategory | "All">("All")

  const filtered = useMemo(() => {
    let list = SOPS
    if (activeCategory !== "All") list = list.filter(s => s.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.sopNumber.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [search, activeCategory])

  const categoryCounts = useMemo(() => {
    const out: Partial<Record<SOPCategory, number>> = {}
    ALL_CATEGORIES.forEach(cat => {
      out[cat] = SOPS.filter(s => s.category === cat).length
    })
    return out
  }, [])

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              SOP Library
            </h1>
            <p className="text-white/45 text-sm">{SOPS.length} standard operating procedures · Beet Box MRO Suite</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}>
            <BookMarked className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
              {SOPS.length} Documents
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-7 gap-3 mt-5">
          {ALL_CATEGORIES.map(cat => {
            const cfg   = CATEGORY_CONFIG[cat]
            const count = categoryCounts[cat] ?? 0
            const Icon  = cfg.icon
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? "All" : cat)}
                className={`rounded-lg p-3 text-left transition-all duration-150 border ${
                  activeCategory === cat ? cfg.bg : "bg-white/3 border-white/8 hover:bg-white/6"
                }`}
              >
                <Icon className={`w-4 h-4 mb-2 ${activeCategory === cat ? cfg.color : "text-white/30"}`} />
                <p className={`text-xl font-bold ${activeCategory === cat ? cfg.color : "text-white/60"}`}
                   style={{ fontFamily: "var(--font-display)" }}>
                  {count}
                </p>
                <p className="text-[10px] leading-tight mt-0.5 text-white/40 uppercase tracking-wide"
                   style={{ fontFamily: "var(--font-heading)" }}>
                  {cat}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-5">
        {/* Search + filter row */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search SOPs…"
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)" }}
            />
          </div>
          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                activeCategory === "All"
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/65"
              }`}
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
            >
              All ({SOPS.length})
            </button>
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? "All" : cat)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  activeCategory === cat
                    ? `${CATEGORY_CONFIG[cat].color} bg-white/10`
                    : "text-white/40 hover:text-white/65"
                }`}
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
              >
                {cat} ({categoryCounts[cat] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {/* Results label */}
        {(search || activeCategory !== "All") && (
          <p className="text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {activeCategory !== "All" ? ` · ${activeCategory}` : ""}
            {search ? ` · "${search}"` : ""}
          </p>
        )}

        {/* SOP card grid */}
        {filtered.length === 0 ? (
          <div className="card-elevated rounded-lg p-10 text-center">
            <p className="text-white/30 text-sm">No SOPs match your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(sop => {
              const cfg  = CATEGORY_CONFIG[sop.category]
              const Icon = cfg.icon
              return (
                <button
                  key={sop.id}
                  onClick={() => navigate(`/app/beet-box/sop-library/${sop.id}`)}
                  className="card-elevated rounded-lg p-5 text-left group hover:bg-white/5 transition-all duration-150 w-full"
                  style={{ border: "1px solid hsl(0 0% 16%)" }}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}
                         style={{ border: undefined }}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white/40 text-xs font-mono">{sop.sopNumber}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
                          {sop.category}
                        </span>
                        <span className="text-white/20 text-[10px]">Rev {sop.revision}</span>
                      </div>
                      <h3 className="text-white text-sm font-medium mb-1 group-hover:text-white/90 transition-colors">
                        {sop.title}
                      </h3>
                      <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{sop.description}</p>

                      {/* Tags + meta */}
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="text-white/25 text-[10px]">{sop.steps.length} steps</span>
                        <span className="text-white/15">·</span>
                        <span className="text-white/25 text-[10px]">Effective {sop.effectiveDate}</span>
                        <span className="text-white/15">·</span>
                        <span className="text-white/25 text-[10px]">Review {sop.reviewDate}</span>
                        {sop.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded text-white/30 bg-white/5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0 mt-1 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
