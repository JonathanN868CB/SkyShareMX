import { useState } from "react"
import { FileText, Plane, Tablet, CalendarClock, Award, ClipboardList, ExternalLink, BookOpen, Shield, AlertTriangle, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { FLEET } from "@/pages/aircraft/fleetData"
import MmAuditSection from "@/features/mm-audit/MmAuditSection"

// ─── Color token ─────────────────────────────────────────────────────────────
const C = "#a78bfa" // violet-400 — compliance accent
const rgba = (a: number) => `rgba(167,139,250,${a})`

// ─── Fleet registration metadata ─────────────────────────────────────────────
// Tail numbers and aircraft types are sourced directly from fleetData.ts.
// Add compliance-specific fields here — update as registration info is confirmed.
type RegMeta = { owner: string; fraction: string; regExpiry: string; status: string; notes: string }

const regMeta: Record<string, RegMeta> = {
  // Pilatus PC-12/45 Legacy
  "N499CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N515RP": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N870CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Pilatus PC-12/47 Legacy
  "N739S":  { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N863CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Pilatus PC-12/47E NG
  "N963CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N413UU": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N477KR": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N418T":  { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Pilatus PC-12 NGX
  "N511DR": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Cessna Citation CJ2
  "N868CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N871CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N744CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Cessna Citation 560XL / XLS+
  "N766CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N606CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N6TM":   { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Cessna Citation M2 Gen2
  "N785PD": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Gulfstream G200
  "N860CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N861CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N612FA": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Gulfstream G450
  "N663CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N787JS": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Gulfstream GV
  "N563CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Embraer Phenom 100
  "N450JF": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Embraer Phenom 300E
  "N409KG": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Embraer Legacy 650
  "N650JF": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
}

const fallbackMeta: RegMeta = { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" }

// Flatten FLEET into a single list, merged with compliance metadata
const fleet = FLEET.flatMap(mfr =>
  mfr.families.flatMap(fam =>
    fam.aircraft.map(ac => ({
      nNumber:   ac.tailNumber,
      type:      ac.model,
      ...(regMeta[ac.tailNumber] ?? fallbackMeta),
    }))
  )
)

const documents = [
  { name: "AFM — Phenom 300 (N481SK)",       revision: "Rev 12",  effective: "Jan 2026", nextReview: "Jan 2027", owner: "DoS",          status: "Current"  },
  { name: "AFM — Phenom 300 (N482SK)",       revision: "Rev 12",  effective: "Jan 2026", nextReview: "Jan 2027", owner: "DoS",          status: "Current"  },
  { name: "AFM — Citation XLS+ (N210SX)",    revision: "Rev 8",   effective: "Oct 2025", nextReview: "Oct 2026", owner: "DoS",          status: "Current"  },
  { name: "AFM — Citation XLS+ (N310SX)",    revision: "Rev 8",   effective: "Oct 2025", nextReview: "Oct 2026", owner: "DoS",          status: "Current"  },
  { name: "AFM — Pilatus PC-12 (N750PC)",    revision: "Rev 6",   effective: "Jun 2024", nextReview: "Jun 2025", owner: "DoS",          status: "Overdue"  },
  { name: "AFM — King Air 350 (N900KA)",     revision: "Rev 9",   effective: "Mar 2025", nextReview: "Mar 2026", owner: "DoS",          status: "Current"  },
  { name: "Operations Specifications",       revision: "A001-D95", effective: "Feb 2026", nextReview: "On file",  owner: "Director Ops", status: "Current"  },
  { name: "Company Operations Manual",       revision: "Rev 4",   effective: "Sep 2025", nextReview: "Sep 2026", owner: "DOM",          status: "Current"  },
  { name: "SMS Manual",                      revision: "Rev 2",   effective: "Jan 2026", nextReview: "Jan 2027", owner: "DoS",          status: "Current"  },
  { name: "Emergency Response Plan",         revision: "Rev 1.4", effective: "Oct 2025", nextReview: "Apr 2026", owner: "DoS",          status: "Review"   },
  { name: "Drug & Alcohol Program Manual",   revision: "Rev 3",   effective: "Mar 2025", nextReview: "Mar 2026", owner: "DoS",          status: "Current"  },
  { name: "Hazardous Materials Manual",      revision: "Rev 1",   effective: "Apr 2024", nextReview: "Apr 2025", owner: "DOM",          status: "Overdue"  },
]

const efbFleet = [
  { pilot: "J. Barrett",    device: "iPad Pro 11\" (2024)", foreflight: "Active", dbExpiry: "Apr 30, 2026", appVersion: "16.8.1", status: "Current" },
  { pilot: "S. Kimura",     device: "iPad Air 5 (2022)",   foreflight: "Active", dbExpiry: "Mar 15, 2026", appVersion: "16.7.2", status: "Review"  },
  { pilot: "D. Reeves",     device: "iPad Pro 11\" (2023)", foreflight: "Active", dbExpiry: "Apr 30, 2026", appVersion: "16.8.1", status: "Current" },
  { pilot: "M. Castillo",   device: "iPad Air 5 (2023)",   foreflight: "Active", dbExpiry: "Apr 30, 2026", appVersion: "16.6.0", status: "Review"  },
  { pilot: "T. Hoffman",    device: "iPad Pro 12.9\" (2022)", foreflight: "Active", dbExpiry: "May 15, 2026", appVersion: "16.8.1", status: "Current" },
  { pilot: "R. Nakamura",   device: "iPad mini 6 (2023)",  foreflight: "Lapsed", dbExpiry: "Jan 01, 2026", appVersion: "16.4.0", status: "Overdue" },
]

const calendarItems = [
  { date: "Apr 10, 2026", item: "N210SX registration renewal filing deadline",         owner: "DoS",          urgency: "high"   },
  { date: "Apr 15, 2026", item: "Q2 Drug & Alcohol random testing window opens",       owner: "DoS",          urgency: "medium" },
  { date: "Apr 30, 2026", item: "ForeFlight database renewal — S. Kimura & M. Castillo", owner: "DoS",       urgency: "medium" },
  { date: "May 01, 2026", item: "AFM paper copy audit — all fleet",                    owner: "DoS",          urgency: "medium" },
  { date: "May 15, 2026", item: "ERP drill due (semi-annual)",                         owner: "DoS / All",    urgency: "medium" },
  { date: "Jun 01, 2026", item: "AFM revision check — N750PC (currently overdue)",     owner: "DoS",          urgency: "high"   },
  { date: "Aug 31, 2026", item: "N481SK & N482SK registration renewal",                owner: "DoS",          urgency: "low"    },
  { date: "Oct 01, 2026", item: "Annual ARGUS Platinum audit window",                  owner: "DoS / DOM",    urgency: "low"    },
]

const opSpecs = [
  { para: "A001", title: "Certification and Operations Specifications",  status: "Current", note: "Base certificate — PHX FSDO" },
  { para: "A005", title: "Definitions and Abbreviations",               status: "Current", note: ""                            },
  { para: "A008", title: "Airplane and Pilot Requirements",             status: "Current", note: ""                            },
  { para: "A021", title: "Management Personnel Required",               status: "Current", note: ""                            },
  { para: "A036", title: "Continuous Airworthiness Maintenance Program", status: "Current", note: "References CAMP enrollment"  },
  { para: "B036", title: "VFR/IFR Authorizations — Part 135 On Demand", status: "Current", note: ""                            },
  { para: "C056", title: "Special Airworthiness Requirements",          status: "Review",  note: "Pending RVSM re-authorization"},
  { para: "D085", title: "Hazardous Materials Authorization",           status: "Current", note: "Limited — ground only"       },
]

const certificates = [
  { name: "Air Carrier Operating Certificate",  issuer: "FAA / PHX FSDO", expiry: "N/A (continuous)", status: "Current", notes: "Part 135 — on file"         },
  { name: "Aircraft Registration — N481SK",     issuer: "FAA Registry",   expiry: "Aug 31, 2026",    status: "Current", notes: ""                           },
  { name: "Aircraft Registration — N482SK",     issuer: "FAA Registry",   expiry: "Aug 31, 2026",    status: "Current", notes: ""                           },
  { name: "Aircraft Registration — N210SX",     issuer: "FAA Registry",   expiry: "Nov 30, 2025",    status: "Overdue", notes: "Renewal in progress"        },
  { name: "Aircraft Registration — N310SX",     issuer: "FAA Registry",   expiry: "Mar 15, 2026",    status: "Current", notes: ""                           },
  { name: "Aircraft Registration — N750PC",     issuer: "FAA Registry",   expiry: "Jan 20, 2026",    status: "Pending", notes: "Pending re-reg post-sale"   },
  { name: "Aircraft Registration — N900KA",     issuer: "FAA Registry",   expiry: "Feb 28, 2027",    status: "Current", notes: ""                           },
  { name: "Aviation Hull & Liability Insurance",issuer: "Global Aero Ins.", expiry: "Dec 01, 2026",  status: "Current", notes: "Annual renewal"             },
  { name: "ARGUS Platinum Rating",              issuer: "ARGUS Intl.",    expiry: "Oct 31, 2026",    status: "Current", notes: "Last audit: Oct 2025"       },
]

const audits = [
  { type: "ARGUS Platinum",    last: "Oct 2025",  next: "Oct 2026",  status: "Current",  findings: 0, lead: "DoS / DOM"    },
  { type: "IS-BAO Stage 1",    last: "Mar 2024",  next: "TBD",       status: "Planning", findings: 2, lead: "DoS"          },
  { type: "Internal Safety",   last: "Jan 2026",  next: "Jul 2026",  status: "Current",  findings: 1, lead: "DoS"          },
  { type: "Internal Maint.",   last: "Feb 2026",  next: "Aug 2026",  status: "Current",  findings: 0, lead: "DOM"          },
  { type: "WYVERN Wingman",    last: "N/A",       next: "TBD",       status: "Pending",  findings: 0, lead: "DoS / Director Ops" },
]

// ─── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Current:  { bg: "rgba(16,185,129,0.1)",  color: "#10b981" },
    Review:   { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b" },
    Overdue:  { bg: "rgba(239,68,68,0.1)",   color: "#f87171" },
    Pending:  { bg: "rgba(167,139,250,0.1)", color: "#a78bfa" },
    Planning: { bg: "rgba(96,165,250,0.1)",  color: "#60a5fa" },
    Lapsed:   { bg: "rgba(239,68,68,0.1)",   color: "#f87171" },
  }
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-heading)" }}
    >
      {status}
    </span>
  )
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4" style={{ color: C }} />
      <span style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: rgba(0.7) }}>
        {label}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Compliance() {
  // Track open/closed state per family — keyed by "Manufacturer|Family"
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>({})
  const toggleFamily = (key: string) =>
    setOpenFamilies(prev => ({ ...prev, [key]: !prev[key] }))

  const [regsOpen,     setRegsOpen]     = useState(true)
  const [docsOpen,     setDocsOpen]     = useState(true)
  const [efbOpen,      setEfbOpen]      = useState(true)
  const [opSpecsOpen,  setOpSpecsOpen]  = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(true)
  const [certsOpen,    setCertsOpen]    = useState(true)
  const [auditsOpen,   setAuditsOpen]   = useState(true)
  const [linksOpen,    setLinksOpen]    = useState(true)

  function ColHeader({ icon: Icon, title, open, onToggle }: {
    icon: React.ElementType; title: string; open: boolean; onToggle: () => void
  }) {
    return (
      <CardHeader
        className="cursor-pointer select-none"
        style={{ paddingBottom: open ? "0.75rem" : "1rem" }}
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = rgba(0.04))}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: rgba(0.1) }}>
              <Icon className="h-4 w-4" style={{ color: C }} />
            </div>
            <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C }}>
              {title}
            </CardTitle>
          </div>
          <ChevronRight
            className="h-4 w-4 transition-transform duration-200 flex-shrink-0"
            style={{ color: C, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </CardHeader>
    )
  }

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <h1 className="text-[2.6rem] leading-none text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
          COMPLIANCE
        </h1>
        <div className="mt-2 mb-2" style={{ height: "1px", background: C, width: "3.5rem" }} />
        <p className="text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Registrations · Documents · Certificates · Program Oversight
        </p>
      </div>

      {/* ── MM Revision & Audit Tracking ──────────────────────────────────── */}
      <MmAuditSection />

      {/* ── Aircraft Registrations ────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
        <CardHeader
          className="cursor-pointer select-none"
          style={{ paddingBottom: regsOpen ? "0.75rem" : "1rem" }}
          onClick={() => setRegsOpen(o => !o)}
          onMouseEnter={e => (e.currentTarget.style.background = rgba(0.04))}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: rgba(0.1) }}>
                <Plane className="h-4 w-4" style={{ color: C }} />
              </div>
              <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C }}>
                Aircraft Registrations
              </CardTitle>
            </div>
            <ChevronRight
              className="h-4 w-4 transition-transform duration-200 flex-shrink-0"
              style={{ color: C, transform: regsOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </div>
        </CardHeader>
        {regsOpen && <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground mb-4" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
            Fractional fleet — registrations are actively managed as ownership shares transfer. Verify status before any registration-sensitive task.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["N-Number", "Aircraft Type", "Owner Entity", "Fraction", "Reg. Expiry", "Status", "Notes"].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FLEET.map(mfr => (
                  <>
                    {/* Manufacturer separator */}
                    <tr key={`mfr-${mfr.manufacturer}`}>
                      <td colSpan={7} className="pt-4 pb-1">
                        <span style={{ fontFamily: "var(--font-heading)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: rgba(0.35) }}>
                          {mfr.manufacturer}
                        </span>
                      </td>
                    </tr>

                    {mfr.families.map(fam => {
                      const key = `${mfr.manufacturer}|${fam.family}`
                      const isOpen = !!openFamilies[key]
                      return (
                        <>
                          {/* Family toggle row */}
                          <tr
                            key={`fam-${key}`}
                            onClick={() => toggleFamily(key)}
                            className="cursor-pointer select-none"
                            style={{ borderBottom: isOpen ? "none" : "1px solid rgba(255,255,255,0.06)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = rgba(0.08))}
                            onMouseLeave={e => (e.currentTarget.style.background = isOpen ? rgba(0.05) : "transparent")}
                          >
                            <td colSpan={7} className="py-2.5 pr-4">
                              <div
                                className="flex items-center gap-2.5 rounded px-2 py-1"
                                style={{
                                  display: "inline-flex",
                                  background: isOpen ? rgba(0.1) : rgba(0.06),
                                  border: `1px solid ${rgba(isOpen ? 0.3 : 0.15)}`,
                                }}
                              >
                                <ChevronRight
                                  className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150"
                                  style={{ color: C, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                                />
                                <span style={{ fontFamily: "var(--font-heading)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", color: C }}>
                                  {fam.family}
                                </span>
                                <span style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: rgba(0.5) }}>
                                  · {fam.aircraft.length}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Aircraft rows */}
                          {isOpen && fam.aircraft.map(ac => {
                            const meta = regMeta[ac.tailNumber] ?? fallbackMeta
                            return (
                              <tr key={ac.tailNumber} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 pr-4 pl-6 font-bold" style={{ color: C, fontFamily: "var(--font-heading)" }}>{ac.tailNumber}</td>
                                <td className="py-2.5 pr-4 text-foreground/80">{ac.model}</td>
                                <td className="py-2.5 pr-4 text-muted-foreground">{meta.owner}</td>
                                <td className="py-2.5 pr-4 text-muted-foreground">{meta.fraction}</td>
                                <td className="py-2.5 pr-4 text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{meta.regExpiry}</td>
                                <td className="py-2.5 pr-4"><StatusChip status={meta.status} /></td>
                                <td className="py-2.5 text-muted-foreground" style={{ fontSize: "10px" }}>{meta.notes}</td>
                              </tr>
                            )
                          })}
                        </>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>}
      </Card>

      {/* ── Document Control ──────────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
        <ColHeader icon={BookOpen} title="Controlled Document Register" open={docsOpen} onToggle={() => setDocsOpen(o => !o)} />
        {docsOpen && <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Document", "Revision", "Effective", "Next Review", "Owner", "Status"].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-foreground/80">{d.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{d.revision}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{d.effective}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{d.nextReview}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{d.owner}</td>
                    <td className="py-2.5"><StatusChip status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>}
      </Card>

      {/* ── EFB + OpSpecs ─────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
          <ColHeader icon={Tablet} title="EFB / iPad Fleet Status" open={efbOpen} onToggle={() => setEfbOpen(o => !o)} />
          {efbOpen && <CardContent className="pt-0">
            <div className="space-y-2">
              {efbFleet.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground/80 truncate">{e.pilot}</p>
                    <p className="text-[10px] text-muted-foreground truncate" style={{ fontFamily: "var(--font-heading)" }}>{e.device} · FF {e.appVersion}</p>
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>DB expires {e.dbExpiry}</p>
                  </div>
                  <StatusChip status={e.status} />
                </div>
              ))}
            </div>
          </CardContent>}
        </Card>

        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
          <ColHeader icon={ClipboardList} title="Operations Specifications" open={opSpecsOpen} onToggle={() => setOpSpecsOpen(o => !o)} />
          {opSpecsOpen && <CardContent className="pt-0">
            <div className="space-y-1.5">
              {opSpecs.map((o, i) => (
                <div key={i} className="flex items-start gap-3 rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ color: C, fontFamily: "var(--font-heading)" }}>{o.para}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/75 leading-snug">{o.title}</p>
                    {o.note && <p className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{o.note}</p>}
                  </div>
                  <StatusChip status={o.status} />
                </div>
              ))}
            </div>
          </CardContent>}
        </Card>
      </div>

      {/* ── Compliance Calendar ───────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
        <ColHeader icon={CalendarClock} title="Compliance Calendar" open={calendarOpen} onToggle={() => setCalendarOpen(o => !o)} />
        {calendarOpen && <CardContent className="pt-0">
          <div className="space-y-2">
            {calendarItems.map((item, i) => {
              const urgencyColor = item.urgency === "high" ? "#f87171" : item.urgency === "medium" ? "#f59e0b" : "rgba(255,255,255,0.3)"
              return (
                <div key={i} className="flex items-start gap-4 rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `2px solid ${urgencyColor}` }}>
                  <span className="text-[9px] font-bold flex-shrink-0 pt-0.5 uppercase tracking-wider" style={{ color: urgencyColor, fontFamily: "var(--font-heading)", minWidth: "6rem" }}>{item.date}</span>
                  <span className="text-xs text-foreground/75 flex-1">{item.item}</span>
                  <span className="text-[9px] text-muted-foreground flex-shrink-0" style={{ fontFamily: "var(--font-heading)" }}>{item.owner}</span>
                </div>
              )
            })}
          </div>
        </CardContent>}
      </Card>

      {/* ── Certificates + Audits ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
          <ColHeader icon={Award} title="Certificate Tracker" open={certsOpen} onToggle={() => setCertsOpen(o => !o)} />
          {certsOpen && <CardContent className="pt-0">
            <div className="space-y-2">
              {certificates.map((cert, i) => (
                <div key={i} className="rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-foreground/80 leading-snug flex-1">{cert.name}</p>
                    <StatusChip status={cert.status} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Expiry: {cert.expiry}</p>
                    {cert.notes && <p className="text-[10px] text-muted-foreground">· {cert.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>}
        </Card>

        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
          <ColHeader icon={Shield} title="Audit Tracker" open={auditsOpen} onToggle={() => setAuditsOpen(o => !o)} />
          {auditsOpen && <CardContent className="pt-0">
            <div className="space-y-2">
              {audits.map((a, i) => (
                <div key={i} className="rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-foreground/80">{a.type}</p>
                    <StatusChip status={a.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Last: {a.last}</p>
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Next: {a.next}</p>
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Lead: {a.lead}</p>
                    {a.findings > 0 && <p className="text-[10px]" style={{ color: "#f59e0b", fontFamily: "var(--font-heading)" }}>{a.findings} open finding{a.findings > 1 ? "s" : ""}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>}
        </Card>
      </div>

      {/* ── Quick Links ───────────────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
        <ColHeader icon={ExternalLink} title="Compliance Quick Links" open={linksOpen} onToggle={() => setLinksOpen(o => !o)} />
        {linksOpen && <CardContent className="pt-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "FAA eCFR Part 135", href: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-135" },
              { label: "FAA Document Retrieval", href: "https://drs.faa.gov" },
              { label: "FAA Aircraft Registry", href: "https://registry.faa.gov/aircraftinquiry" },
              { label: "PRISM SMS", href: "https://prismsms.argus.aero/" },
              { label: "DOT D&A Clearinghouse", href: "https://clearinghouse.fmcsa.dot.gov" },
              { label: "ARGUS International", href: "https://www.argus.aero" },
            ].map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C, background: rgba(0.07), border: `1px solid ${rgba(0.18)}` }}
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>}
      </Card>

    </div>
  )
}
