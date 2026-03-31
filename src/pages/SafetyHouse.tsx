import {
  Shield, Radio, BarChart3, FileText, AlertTriangle, CheckCircle,
  CalendarDays, Users, Phone, ExternalLink, BookOpen, Zap,
  TrendingDown, TrendingUp, Minus, Flag, MessageSquare, ClipboardCheck,
  Activity, Clock, Globe, Brain, GraduationCap, Building2, Target,
  Eye, Layers, Newspaper, AlertOctagon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

// ─── Color token ─────────────────────────────────────────────────────────────
const G = "#10b981" // emerald — safety accent
const rgba = (a: number) => `rgba(16,185,129,${a})`

// ─── Placeholder Data ─────────────────────────────────────────────────────────
// All data below is hardcoded. Wire to Supabase when sections are committed.

const statCards = [
  { label: "Open Safety Items",     value: "3",   trend: "up",   trendNote: "+1 this week"         },
  { label: "Active Investigations", value: "0",   trend: "flat", trendNote: "Clean slate"           },
  { label: "Days Since Last Event", value: "47",  trend: "up",   trendNote: "Keep it going"         },
  { label: "Open Action Items",     value: "5",   trend: "down", trendNote: "Down from 8 last mo."  },
  { label: "Culture Score",         value: "77",  trend: "up",   trendNote: "+3 pts since Aug 25"   },
  { label: "Open Risk Register",    value: "4",   trend: "flat", trendNote: "1 high priority"       },
  { label: "Overdue CAs",           value: "1",   trend: "up",   trendNote: "CA-2026-005 aging"     },
  { label: "Next Audit",            value: "Q3",  trend: "flat", trendNote: "IS-BAO Stage 1 target" },
]

// Safety Inbox — categories and counts only, no sensitive report details
const safetyInbox = [
  { source: "PRISM SMS",    category: "Hazard Report",          received: "Mar 29", status: "In Review",      assignedTo: "DoS"      },
  { source: "Direct",       category: "Near-Miss Observation",  received: "Mar 27", status: "Pending Action", assignedTo: "DoS / DOM"},
  { source: "PRISM SMS",    category: "Safety Concern",         received: "Mar 20", status: "In Review",      assignedTo: "DoS"      },
  { source: "Crew Debrief", category: "Ground Ops Observation", received: "Mar 15", status: "Closed",         assignedTo: "DoS"      },
  { source: "PRISM SMS",    category: "Maintenance Finding",    received: "Mar 10", status: "Closed",         assignedTo: "DOM"      },
]

// ─── Risk Register ────────────────────────────────────────────────────────────
const riskRegister = [
  { id: "RR-001", hazard: "Crew fatigue risk on back-to-back early/late rotations", area: "Flight Ops",   severity: 5, likelihood: 2, riskLevel: "High",   mitigation: "Rest-rule review in progress; FDM monitoring active", owner: "DoS / DO", status: "Open",      opened: "Jan 2026" },
  { id: "RR-002", hazard: "FOD potential during after-hours ramp operations",        area: "Ground Ops",   severity: 4, likelihood: 2, riskLevel: "Medium", mitigation: "Mandatory FOD walk pre/post ops; PRISM logged",        owner: "DOM",       status: "Open",      opened: "Feb 2026" },
  { id: "RR-003", hazard: "Incomplete MEL entries during line maintenance",          area: "Maintenance",  severity: 3, likelihood: 3, riskLevel: "Medium", mitigation: "MEL audit Q1 2026 complete; RTS checklist revised",    owner: "DOM",       status: "Open",      opened: "Mar 2026" },
  { id: "RR-004", hazard: "Hangar door clearance — wingtip proximity on park",      area: "Maintenance",  severity: 4, likelihood: 2, riskLevel: "Medium", mitigation: "Wing walker required; visual stop cues installed",      owner: "DOM",       status: "Mitigated", opened: "Nov 2025" },
  { id: "RR-005", hazard: "Third-party fuel vendor quality records compliance",      area: "Ground Ops",   severity: 5, likelihood: 1, riskLevel: "Low",    mitigation: "Annual vendor audit complete; COQ current on file",     owner: "DoS",       status: "Mitigated", opened: "Sep 2025" },
]

const smsProgramStatus = [
  { item: "SMS Manual",               value: "Rev 2.1",   detail: "Effective Jan 2026 · Next review Jan 2027",        status: "Current"   },
  { item: "Emergency Response Plan",  value: "Rev 1.4",   detail: "Last drill Oct 2025 · Next drill due Apr 2026",     status: "Review"    },
  { item: "Drug & Alcohol Program",   value: "Active",    detail: "MRO: Concentra · Q2 testing window opens Apr 15",  status: "Current"   },
  { item: "Safety Training (DoS)",    value: "Current",   detail: "Last completed Dec 2025 · Annual",                  status: "Current"   },
  { item: "HFACS Awareness Training", value: "Scheduled", detail: "Crew completion deadline May 1, 2026",              status: "Review"    },
  { item: "Whistleblower Policy",     value: "Posted",    detail: "Last updated Sep 2025 · Posted in all hangars",     status: "Current"   },
  { item: "IS-BAO Stage 1 Initiation",value: "In Progress",detail:"Gap analysis started Q1 2026 · Target Q3 2026",    status: "Review"    },
  { item: "ASAP / VDRP Eligibility",  value: "Eligible",  detail: "Program standing confirmed with PHX FSDO",          status: "Current"   },
]

const committeeItems = [
  { item: "Review Q1 PRISM report summary",             owner: "DoS",       due: "Apr 15", status: "Open"     },
  { item: "Close out Feb hazard report — ground ops",   owner: "DoS / DOM", due: "Apr 10", status: "Open"     },
  { item: "Schedule ERP drill — all stations",          owner: "DoS",       due: "May 01", status: "Open"     },
  { item: "Distribute revised SMS manual to all crew",  owner: "DoS",       due: "Apr 5",  status: "Complete" },
  { item: "HFACS training schedule distributed",        owner: "DoS",       due: "Apr 1",  status: "Complete" },
]

// ─── Human Factors ────────────────────────────────────────────────────────────
const hfacsData = [
  { category: "Unsafe Acts",     subcategory: "Skill-based Error",     count: 2, trend: "down" },
  { category: "Unsafe Acts",     subcategory: "Decision Error",         count: 1, trend: "flat" },
  { category: "Preconditions",   subcategory: "Physical Environment",   count: 1, trend: "down" },
  { category: "Preconditions",   subcategory: "Crew Resource Mgmt",     count: 0, trend: "flat" },
  { category: "Supervision",     subcategory: "Inadequate Supervision",  count: 0, trend: "flat" },
  { category: "Org Influences",  subcategory: "Resource Management",    count: 1, trend: "up"   },
]

// ─── Training Compliance ──────────────────────────────────────────────────────
const trainingCompliance = [
  { course: "HFACS Awareness",           dept: "All Crew",    completed: 9,  total: 20, pct: 45,  due: "May 1, 2026"  },
  { course: "ERP Familiarization",       dept: "All Staff",   completed: 22, total: 22, pct: 100, due: "Current"      },
  { course: "Hazard Reporting (PRISM)",  dept: "Technicians", completed: 8,  total: 10, pct: 80,  due: "Apr 15, 2026" },
  { course: "Fatigue Risk Awareness",    dept: "Flight Crew", completed: 4,  total: 12, pct: 33,  due: "May 15, 2026" },
  { course: "SMS Annual Refresher",      dept: "All Crew",    completed: 18, total: 20, pct: 90,  due: "Apr 30, 2026" },
  { course: "Ground Safety (Ramp Ops)",  dept: "Ground Crew", completed: 6,  total: 6,  pct: 100, due: "Current"      },
]

// ─── Corrective Action Board ──────────────────────────────────────────────────
const correctiveActions = [
  { id: "CA-2026-007", source: "PRISM SMS",       finding: "Ramp lighting insufficient — east apron after hours",     assignedTo: "DOM",    due: "Apr 20, 2026", daysOpen: 12, status: "In Progress" },
  { id: "CA-2026-006", source: "Safety Committee", finding: "ERP contact list not updated after leadership change",    assignedTo: "DoS",    due: "Apr 5, 2026",  daysOpen: 18, status: "Open"        },
  { id: "CA-2026-005", source: "Internal Audit",  finding: "Three drug test chain-of-custody records incomplete",     assignedTo: "HR",     due: "Mar 30, 2026", daysOpen: 32, status: "Overdue"     },
  { id: "CA-2026-004", source: "PRISM SMS",       finding: "Fueling discrepancy — incorrect grade logged at SAN",     assignedTo: "DOM",    due: "Mar 15, 2026", daysOpen: 8,  status: "Closed"      },
  { id: "CA-2026-003", source: "ERP Drill",       finding: "Station manager unreachable — escalation gap identified",  assignedTo: "DoS",    due: "Apr 30, 2026", daysOpen: 22, status: "In Progress" },
  { id: "CA-2026-002", source: "PRISM SMS",       finding: "Near-miss report — ground equipment left in taxiway",     assignedTo: "DoS/DO", due: "Apr 10, 2026", daysOpen: 9,  status: "In Progress" },
]

// ─── Safety Metrics ───────────────────────────────────────────────────────────
const safetyMetrics = [
  { month: "Oct 25", reports: 2, closed: 2, open: 0 },
  { month: "Nov 25", reports: 1, closed: 1, open: 0 },
  { month: "Dec 25", reports: 3, closed: 2, open: 1 },
  { month: "Jan 26", reports: 1, closed: 1, open: 0 },
  { month: "Feb 26", reports: 2, closed: 1, open: 1 },
  { month: "Mar 26", reports: 2, closed: 0, open: 2 },
]

// ─── Regulatory Calendar ──────────────────────────────────────────────────────
const regulatoryCalendar = [
  { date: "Apr 1, 2026",  event: "SMS Manual Rev 2.1 effective",                type: "Internal",      status: "Upcoming" },
  { date: "Apr 3, 2026",  event: "Q1 Safety Stand-Down — Hangar 4, 0700",       type: "Training",      status: "Upcoming" },
  { date: "Apr 10, 2026", event: "Safety Committee Monthly Meeting",             type: "Committee",     status: "Upcoming" },
  { date: "Apr 15, 2026", event: "D&A Q2 testing window opens",                 type: "Regulatory",    status: "Due Soon" },
  { date: "Apr 15, 2026", event: "ERP Semi-Annual Drill due",                   type: "ERP",           status: "Due Soon" },
  { date: "Apr 20, 2026", event: "PRISM Q1 report review deadline",             type: "SMS",           status: "Due Soon" },
  { date: "May 1, 2026",  event: "HFACS awareness — crew completion deadline",  type: "Training",      status: "Upcoming" },
  { date: "Jun 30, 2026", event: "IS-BAO Stage 1 gap analysis target close",    type: "Certification", status: "Upcoming" },
  { date: "Jul 1, 2026",  event: "D&A Q3 testing window opens",                type: "Regulatory",    status: "Upcoming" },
  { date: "Oct 15, 2026", event: "ERP Semi-Annual Drill — second occurrence",   type: "ERP",           status: "Upcoming" },
]

// ─── Industry Alerts ──────────────────────────────────────────────────────────
const industryAlerts = [
  { date: "Mar 28", source: "FAA",  type: "SAIB",    text: "SAIB AW-26-03: CJ series fuel system inspection guidance issued to all operators" },
  { date: "Mar 22", source: "NTSB", type: "Safety Alert", text: "Runway incursion trends increasing in Part 135 ops — heightened vigilance advisory" },
  { date: "Mar 15", source: "FAA",  type: "NOTAM",   text: "PHX FSDO: Winter ops debrief memo distributed to all Part 135 certificate holders" },
  { date: "Mar 08", source: "NBAA", type: "Bulletin", text: "Updated IS-BAO Stage 2 checklist released — 2026 edition now on IBAC website" },
  { date: "Feb 28", source: "FAA",  type: "AD",      text: "AD 2026-04-07: Applicable to GIV/GV series — inspect per current MRBR revision" },
  { date: "Feb 14", source: "ASRS", type: "Report",  text: "NASA ASRS trending: crew communication breakdowns on single-pilot IFR departures" },
]

// ─── Safety Broadcasts ────────────────────────────────────────────────────────
const safetyBroadcasts = [
  { date: "Mar 30", tag: "Reminder",   text: "All FOD walks must be logged in PRISM prior to aircraft departure. No exceptions." },
  { date: "Mar 22", tag: "Update",     text: "Revised SMS manual effective April 1 — review Section 4 on hazard reporting." },
  { date: "Mar 15", tag: "Stand-Down", text: "Q1 Safety Stand-Down confirmed April 3, 0700, Hangar 4. Attendance mandatory." },
  { date: "Mar 05", tag: "Reminder",   text: "PRISM SMS accounts — ensure your login credentials are current before month-end." },
]

// ─── Safety Goals ─────────────────────────────────────────────────────────────
const safetyGoals = [
  { goal: "Zero preventable events — calendar year 2026",          progress: 80,  status: "On Track"   },
  { goal: "100% PRISM report closure within 30 days",              progress: 62,  status: "In Progress" },
  { goal: "IS-BAO Stage 1 registration initiated by Q3 2026",      progress: 20,  status: "In Progress" },
  { goal: "All crew HFACS awareness training complete by May 1",    progress: 45,  status: "In Progress" },
  { goal: "ERP drill completed semi-annually (Apr + Oct)",          progress: 0,   status: "Upcoming"    },
  { goal: "Safety committee meets monthly — no missed sessions",    progress: 100, status: "On Track"    },
  { goal: "100% corrective action closure within 45 days of open", progress: 55,  status: "In Progress" },
  { goal: "Safety culture score ≥ 80 by year-end 2026",            progress: 77,  status: "In Progress" },
]

// ─── Safety Culture Pulse ─────────────────────────────────────────────────────
const culturePulse = [
  { dimension: "Reporting Culture",  score: 82, benchmark: 78 },
  { dimension: "Just Culture",       score: 71, benchmark: 75 },
  { dimension: "Flexible Culture",   score: 85, benchmark: 72 },
  { dimension: "Learning Culture",   score: 78, benchmark: 74 },
  { dimension: "Informed Culture",   score: 69, benchmark: 70 },
]

// ─── Station Safety Snapshot ──────────────────────────────────────────────────
const stationSnapshot = [
  { station: "PHX — Deer Valley", lastInspection: "Mar 12, 2026", openItems: 1, status: "Monitor", lead: "— TBD —" },
  { station: "PHX — Scottsdale",  lastInspection: "Feb 22, 2026", openItems: 0, status: "Good",    lead: "— TBD —" },
  { station: "LAX",               lastInspection: "Jan 15, 2026", openItems: 2, status: "Monitor", lead: "— TBD —" },
  { station: "SAN",               lastInspection: "Feb 5, 2026",  openItems: 0, status: "Good",    lead: "— TBD —" },
  { station: "LAS",               lastInspection: "Mar 1, 2026",  openItems: 0, status: "Good",    lead: "— TBD —" },
]

// ─── Voluntary Safety Programs ────────────────────────────────────────────────
const voluntaryPrograms = [
  { program: "ASRS (NASA)",          status: "Encouraged",  filedYTD: 2, lastFiled: "Feb 2026", note: "Anonymous reports filed directly by crew to NASA" },
  { program: "VDRP (FAA)",           status: "Eligible",    filedYTD: 0, lastFiled: "—",        note: "Voluntary Disclosure Reporting Program — open to operators" },
  { program: "PRISM Hazard Reports", status: "Active",      filedYTD: 7, lastFiled: "Mar 29",   note: "Primary internal hazard and safety reporting channel" },
  { program: "Direct to DoS",        status: "Active",      filedYTD: 2, lastFiled: "Mar 27",   note: "Walk-in, phone, or text to Director of Safety" },
]

// ─── Emergency Contacts ───────────────────────────────────────────────────────
const emergencyContacts = [
  { role: "Director of Safety",      name: "— TBD —",           phone: "—"              },
  { role: "Director of Maintenance", name: "— TBD —",           phone: "—"              },
  { role: "Director of Operations",  name: "— TBD —",           phone: "—"              },
  { role: "PHX FSDO",                name: "Flight Standards",   phone: "(480) 988-7755" },
  { role: "NTSB Go-Team",            name: "24-hr Response",     phone: "(844) 373-9922" },
  { role: "MRO / Drug & Alcohol",    name: "Concentra",          phone: "— TBD —"        },
  { role: "FAA Safety Hotline",      name: "AFS-900",            phone: "(800) 255-1111" },
  { role: "NBAA Operations Center",  name: "Member Services",    phone: "(202) 783-9000" },
]

// ─── Regulatory References ────────────────────────────────────────────────────
const regulatoryRefs = [
  { label: "14 CFR Part 135",     href: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-135"                },
  { label: "14 CFR Part 119",     href: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-119"                },
  { label: "FAA SMS Info",        href: "https://www.faa.gov/about/initiatives/sms"                                             },
  { label: "PRISM SMS",           href: "https://prismsms.argus.aero/"                                                          },
  { label: "ASRS (NASA)",         href: "https://asrs.arc.nasa.gov"                                                             },
  { label: "FAA Safety Hotline",  href: "https://www.faa.gov/about/office_org/headquarters_offices/afs/afs900"                  },
  { label: "IS-BAO / IBAC",       href: "https://www.ibac.org/is-bao"                                                           },
  { label: "NBAA Safety",         href: "https://nbaa.org/operations/safety"                                                    },
  { label: "NTSB Aviation",       href: "https://www.ntsb.gov/investigations/pages/aviation.aspx"                               },
  { label: "FAA AD Search",       href: "https://rgl.faa.gov/Regulatory_and_Guidance_Library/rgAD.nsf/0/SearchFrame?OpenPage"  },
  { label: "Skybrary",            href: "https://skybrary.aero"                                                                 },
  { label: "CAST / JSSI",         href: "https://www.cast-safety.org"                                                           },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Current:        { bg: rgba(0.1),                    color: G                          },
    "In Review":    { bg: "rgba(96,165,250,0.1)",       color: "#60a5fa"                  },
    "Pending Action":{ bg: "rgba(245,158,11,0.1)",      color: "#f59e0b"                  },
    Closed:         { bg: "rgba(255,255,255,0.06)",     color: "rgba(255,255,255,0.3)"    },
    Review:         { bg: "rgba(245,158,11,0.1)",       color: "#f59e0b"                  },
    "On Track":     { bg: rgba(0.1),                    color: G                          },
    "In Progress":  { bg: "rgba(96,165,250,0.1)",       color: "#60a5fa"                  },
    Upcoming:       { bg: "rgba(255,255,255,0.06)",     color: "rgba(255,255,255,0.35)"   },
    Complete:       { bg: rgba(0.08),                   color: rgba(0.7)                  },
    Open:           { bg: "rgba(245,158,11,0.1)",       color: "#f59e0b"                  },
    Scheduled:      { bg: "rgba(167,139,250,0.1)",      color: "#a78bfa"                  },
    Mitigated:      { bg: rgba(0.08),                   color: G                          },
    High:           { bg: "rgba(248,113,113,0.12)",     color: "#f87171"                  },
    Medium:         { bg: "rgba(245,158,11,0.1)",       color: "#f59e0b"                  },
    Low:            { bg: rgba(0.08),                   color: G                          },
    Overdue:        { bg: "rgba(248,113,113,0.15)",     color: "#f87171"                  },
    "Due Soon":     { bg: "rgba(245,158,11,0.12)",      color: "#f59e0b"                  },
    Good:           { bg: rgba(0.08),                   color: G                          },
    Monitor:        { bg: "rgba(245,158,11,0.1)",       color: "#f59e0b"                  },
    Encouraged:     { bg: rgba(0.08),                   color: G                          },
    Eligible:       { bg: "rgba(96,165,250,0.08)",      color: "#60a5fa"                  },
    Active:         { bg: rgba(0.1),                    color: G                          },
    Certification:  { bg: "rgba(167,139,250,0.1)",      color: "#a78bfa"                  },
  }
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase whitespace-nowrap"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-heading)" }}
    >
      {status}
    </span>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: rgba(0.1) }}>
        <Icon className="h-4 w-4" style={{ color: G }} />
      </div>
      <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: G }}>
        {title}
      </CardTitle>
    </div>
  )
}

function TypeTag({ type }: { type: string }) {
  const map: Record<string, string> = {
    Regulatory: "#60a5fa", Training: "#a78bfa", Committee: G, ERP: "#f59e0b",
    SMS: G, Internal: "rgba(255,255,255,0.4)", Certification: "#a78bfa",
    SAIB: "#f59e0b", AD: "#f87171", NOTAM: "#60a5fa", Bulletin: "#a78bfa",
    Report: G, "Safety Alert": "#f87171",
  }
  const color = map[type] ?? "rgba(255,255,255,0.35)"
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
      style={{ background: `${color}18`, color, fontFamily: "var(--font-heading)", border: `1px solid ${color}30` }}>
      {type}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SafetyHouse() {
  return (
    <div className="space-y-8">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="hero-area">
        <h1 className="text-[2.6rem] leading-none text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
          SAFETY'S HOUSE
        </h1>
        <div className="mt-2 mb-2" style={{ height: "1px", background: G, width: "3.5rem" }} />
        <p className="text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Director of Safety · SMS · ERP · Risk Register · Culture · Program Oversight · Communications
        </p>
      </div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const TrendIcon = card.trend === "up" ? TrendingUp : card.trend === "down" ? TrendingDown : Minus
          const isPositiveUp = card.label === "Days Since Last Event" || card.label === "Culture Score"
          const trendColor = card.trend === "flat"
            ? "rgba(255,255,255,0.3)"
            : card.trend === "up"
              ? (isPositiveUp ? G : "#f59e0b")
              : G
          return (
            <Card key={card.label} className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
              <CardContent className="p-4">
                <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: rgba(0.6) }}>
                  {card.label}
                </p>
                <p className="text-3xl font-bold mt-1" style={{ fontFamily: "var(--font-display)", color: G }}>
                  {card.value}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendIcon className="h-3 w-3" style={{ color: trendColor }} />
                  <p className="text-[10px]" style={{ fontFamily: "var(--font-heading)", color: trendColor }}>{card.trendNote}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Safety Inbox ─────────────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-3">
          <SectionHeader icon={Radio} title="Safety Inbox" />
          <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
            Category-level tracking only. Individual report details remain in PRISM SMS.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Source", "Category", "Received", "Assigned To", "Status"].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safetyInbox.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-muted-foreground" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{row.source}</td>
                    <td className="py-2.5 pr-4 text-foreground/80">{row.category}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{row.received}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.assignedTo}</td>
                    <td className="py-2.5"><StatusChip status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Risk Register ─────────────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-3">
          <SectionHeader icon={Layers} title="Risk Register" />
          <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
            Open organizational hazards classified by severity and likelihood. Source of truth for SMS risk posture.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["ID", "Hazard", "Area", "Risk", "Mitigation", "Owner", "Status"].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskRegister.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: rgba(0.7) }}>{row.id}</td>
                    <td className="py-2.5 pr-4 text-foreground/80 max-w-[220px]" style={{ lineHeight: "1.4" }}>{row.hazard}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{row.area}</td>
                    <td className="py-2.5 pr-4"><StatusChip status={row.riskLevel} /></td>
                    <td className="py-2.5 pr-4 text-muted-foreground max-w-[200px]" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", lineHeight: "1.4" }}>{row.mitigation}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{row.owner}</td>
                    <td className="py-2.5"><StatusChip status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── SMS Program + Safety Committee ───────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* SMS Program Health */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Shield} title="SMS Program Health" />
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {smsProgramStatus.map((row, i) => (
              <div key={i} className="flex items-start gap-3 rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-medium text-foreground/80">{row.item}</p>
                    <span className="text-[9px] font-bold" style={{ color: G, fontFamily: "var(--font-heading)" }}>{row.value}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug" style={{ fontFamily: "var(--font-heading)" }}>{row.detail}</p>
                </div>
                <StatusChip status={row.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Safety Committee */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Users} title="Safety Committee" />
            <div className="mt-2 flex gap-4">
              <div className="rounded px-3 py-2 flex-1" style={{ background: rgba(0.06), border: `1px solid ${rgba(0.14)}` }}>
                <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.6) }}>Next Meeting</p>
                <p className="text-sm font-semibold text-foreground/85 mt-0.5">April 10, 2026</p>
                <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>0800 · Hangar 4 Conference Room</p>
              </div>
              <div className="rounded px-3 py-2 flex-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Last Meeting</p>
                <p className="text-sm font-semibold text-foreground/85 mt-0.5">March 6, 2026</p>
                <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>All members present</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: rgba(0.5), marginBottom: "0.5rem" }}>
              Open Action Items
            </p>
            <div className="space-y-1.5">
              {committeeItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/75 leading-snug">{item.item}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{item.owner} · Due {item.due}</p>
                  </div>
                  <StatusChip status={item.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Human Factors + Training Compliance ──────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Human Factors Snapshot */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Brain} title="Human Factors Snapshot" />
            <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
              HFACS category roll-up — rolling 12 months. Source: PRISM SMS report analysis.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {hfacsData.map((row, i) => {
              const TIcon = row.trend === "up" ? TrendingUp : row.trend === "down" ? TrendingDown : Minus
              const tColor = row.count === 0
                ? rgba(0.5)
                : row.trend === "down" ? G : row.trend === "up" ? "#f59e0b" : "rgba(255,255,255,0.3)"
              return (
                <div key={i} className="flex items-center justify-between gap-3 rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>{row.category}</p>
                    <p className="text-xs text-foreground/75">{row.subcategory}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: row.count === 0 ? rgba(0.4) : "#f59e0b" }}>
                      {row.count}
                    </span>
                    <TIcon className="h-3.5 w-3.5" style={{ color: tColor }} />
                  </div>
                </div>
              )
            })}
            <div className="rounded px-3 py-2 text-center mt-1" style={{ background: rgba(0.04), border: `1px dashed ${rgba(0.18)}` }}>
              <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                HFACS coding done by DoS after each PRISM report closure.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Safety Training Compliance */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={GraduationCap} title="Safety Training Compliance" />
            <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
              Completion rates by course and department.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {trainingCompliance.map((row, i) => (
              <div key={i}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="text-xs text-foreground/80">{row.course}</p>
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{row.dept} · Due {row.due}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold" style={{ color: row.pct === 100 ? G : row.pct >= 70 ? "#f59e0b" : "#f87171", fontFamily: "var(--font-heading)" }}>
                      {row.completed}/{row.total}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${row.pct}%`,
                      background: row.pct === 100 ? G : row.pct >= 70 ? "rgba(245,158,11,0.7)" : "rgba(248,113,113,0.7)",
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Corrective Action Board ───────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-3">
          <SectionHeader icon={Activity} title="Corrective Action Board" />
          <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
            All open CAs from every source — PRISM, audits, ERP drills, safety committee.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["CA ID", "Source", "Finding", "Assigned To", "Due", "Days Open", "Status"].map(h => (
                    <th key={h} className="text-left pb-2 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correctiveActions.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: rgba(0.7) }}>{row.id}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{row.source}</td>
                    <td className="py-2.5 pr-4 text-foreground/75 max-w-[240px]" style={{ lineHeight: "1.4" }}>{row.finding}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{row.assignedTo}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{row.due}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: row.daysOpen > 30 ? "#f87171" : row.daysOpen > 15 ? "#f59e0b" : rgba(0.7) }}>
                        {row.daysOpen}d
                      </span>
                    </td>
                    <td className="py-2.5"><StatusChip status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Safety Metrics — 6-month table ───────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-3">
          <SectionHeader icon={BarChart3} title="Safety Metrics — Rolling 6 Months" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Month", "Reports Filed", "Closed", "Open / Pending"].map(h => (
                    <th key={h} className="text-left pb-2 pr-6" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safetyMetrics.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-6 text-foreground/70" style={{ fontFamily: "var(--font-heading)" }}>{row.month}</td>
                    <td className="py-2.5 pr-6 font-bold" style={{ color: G }}>{row.reports}</td>
                    <td className="py-2.5 pr-6 text-foreground/60">{row.closed}</td>
                    <td className="py-2.5">
                      {row.open > 0
                        ? <span className="font-bold" style={{ color: "#f59e0b" }}>{row.open}</span>
                        : <span style={{ color: rgba(0.6) }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Regulatory Calendar + Industry Alerts ────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Regulatory Calendar */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Clock} title="Regulatory Calendar" />
            <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
              Key safety, training, and regulatory deadlines — rolling 12 months.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {regulatoryCalendar.map((row, i) => (
              <div key={i} className="flex items-start gap-3 rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex-shrink-0 w-20">
                  <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{row.date}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/75 leading-snug">{row.event}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <TypeTag type={row.type} />
                  <StatusChip status={row.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Industry Alerts */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Newspaper} title="Industry Alerts & Notices" />
            <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
              Curated FAA, NTSB, and NBAA items relevant to Part 135 operations.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {industryAlerts.map((row, i) => (
              <div key={i} className="rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: rgba(0.45), fontFamily: "var(--font-heading)" }}>{row.date}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-heading)" }}>{row.source}</span>
                  <TypeTag type={row.type} />
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">{row.text}</p>
              </div>
            ))}
            <div className="rounded px-3 py-2 text-center" style={{ background: rgba(0.04), border: `1px dashed ${rgba(0.18)}` }}>
              <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                DoS curates this feed manually. Auto-sync with FAA RSS coming soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Safety Broadcasts + Goals ─────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Safety Broadcasts */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={MessageSquare} title="Safety Broadcasts" />
            <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.03em" }}>
              These also appear in the Safety Dashboard on the main portal page.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {safetyBroadcasts.map((item, i) => (
              <div key={i} className="rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: rgba(0.45), fontFamily: "var(--font-heading)" }}>{item.date}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" style={{ background: rgba(0.1), color: G, fontFamily: "var(--font-heading)" }}>{item.tag}</span>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">{item.text}</p>
              </div>
            ))}
            <div className="rounded px-3 py-2 text-center" style={{ background: rgba(0.04), border: `1px dashed ${rgba(0.2)}` }}>
              <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                Inline editing coming soon — DoS will manage broadcasts from this panel.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Safety Goals */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Flag} title="Safety Goals — 2026" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {safetyGoals.map((goal, i) => (
              <div key={i}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs text-foreground/75 leading-snug flex-1">{goal.goal}</p>
                  <StatusChip status={goal.status} />
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${goal.progress}%`,
                      background: goal.progress === 100 ? G : goal.progress > 50 ? rgba(0.7) : "rgba(245,158,11,0.6)",
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Safety Culture Pulse + Station Safety Snapshot ───────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Culture Pulse */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Target} title="Safety Culture Pulse" />
            <div className="mt-2 flex gap-3">
              <div className="rounded px-3 py-1.5 flex-1" style={{ background: rgba(0.06), border: `1px solid ${rgba(0.14)}` }}>
                <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: rgba(0.6) }}>Last Survey</p>
                <p className="text-xs font-semibold text-foreground/80 mt-0.5">February 2026</p>
                <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>17 of 22 participants</p>
              </div>
              <div className="rounded px-3 py-1.5 flex-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Next Survey</p>
                <p className="text-xs font-semibold text-foreground/80 mt-0.5">August 2026</p>
                <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Semi-annual cadence</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: rgba(0.5), marginBottom: "0.25rem" }}>
              vs. Industry Benchmark
            </p>
            {culturePulse.map((row, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-foreground/75">{row.dimension}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>Benchmark {row.benchmark}</span>
                    <span className="text-xs font-bold" style={{ color: row.score >= row.benchmark ? G : "#f59e0b", fontFamily: "var(--font-heading)" }}>
                      {row.score}
                    </span>
                  </div>
                </div>
                <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="absolute h-full rounded-full" style={{ width: `${row.benchmark}%`, background: "rgba(255,255,255,0.12)" }} />
                  <div className="absolute h-full rounded-full transition-all" style={{ width: `${row.score}%`, background: row.score >= row.benchmark ? rgba(0.7) : "rgba(245,158,11,0.65)" }} />
                </div>
              </div>
            ))}
            <div className="rounded px-3 py-2 mt-1" style={{ background: rgba(0.04), border: `1px dashed ${rgba(0.18)}` }}>
              <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                Survey tool: anonymous Google Form distributed by DoS. Scored 0–100 per dimension.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Station Safety Snapshot */}
        <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
          <CardHeader className="pb-3">
            <SectionHeader icon={Building2} title="Station Safety Snapshot" />
            <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
              Per-station safety status, last inspection date, and open items.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {stationSnapshot.map((row, i) => (
              <div key={i} className="flex items-center gap-3 rounded px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/85">{row.station}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
                    Last inspection: {row.lastInspection}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {row.openItems > 0 && (
                    <span className="text-[10px] font-bold" style={{ color: "#f59e0b", fontFamily: "var(--font-heading)" }}>
                      {row.openItems} open
                    </span>
                  )}
                  <StatusChip status={row.status} />
                </div>
              </div>
            ))}
            <div className="rounded px-3 py-2 mt-1" style={{ background: rgba(0.04), border: `1px dashed ${rgba(0.18)}` }}>
              <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                Station leads TBD. Safety walkthrough checklist coming soon for each location.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Voluntary Safety Programs ─────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-3">
          <SectionHeader icon={Eye} title="Voluntary Safety Reporting Programs" />
          <p className="text-xs text-muted-foreground mt-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
            All channels through which safety concerns can be raised — anonymous, internal, and regulatory. Just culture begins here.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid sm:grid-cols-2 gap-3">
            {voluntaryPrograms.map((row, i) => (
              <div key={i} className="rounded px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-foreground/85">{row.program}</p>
                  <StatusChip status={row.status} />
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug mb-2" style={{ fontFamily: "var(--font-heading)" }}>{row.note}</p>
                <div className="flex items-center gap-4">
                  <div>
                    <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: rgba(0.5) }}>Filed YTD</p>
                    <p className="text-base font-bold" style={{ fontFamily: "var(--font-display)", color: G }}>{row.filedYTD}</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Last Filed</p>
                    <p className="text-xs text-foreground/60 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{row.lastFiled}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Emergency Response ────────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-3">
          <SectionHeader icon={AlertTriangle} title="Emergency Response Quick Reference" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: rgba(0.5), marginBottom: "0.75rem" }}>
                ERP Status
              </p>
              <div className="space-y-2">
                {[
                  { label: "ERP Version",     value: "Rev 1.4 · Oct 2025"                  },
                  { label: "Last Drill",       value: "Oct 14, 2025 — PHX Station"          },
                  { label: "Next Drill Due",   value: "Apr 15, 2026 (semi-annual)"          },
                  { label: "Distribution",     value: "All crew + station managers on file" },
                  { label: "NTSB Go-Team",     value: "Notification protocol current"       },
                  { label: "Media Protocol",   value: "All media → VP Communications only"  },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-4 rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>{row.label}</p>
                    <p className="text-xs text-foreground/75 text-right">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: rgba(0.5), marginBottom: "0.75rem" }}>
                Key Contacts
              </p>
              <div className="space-y-2">
                {emergencyContacts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>{c.role}</p>
                      <p className="text-xs text-foreground/75">{c.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" style={{ color: rgba(0.5) }} />
                      <p className="text-xs" style={{ fontFamily: "var(--font-heading)", color: rgba(0.8) }}>{c.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Safety Resources ─────────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${G}` }}>
        <CardHeader className="pb-2">
          <SectionHeader icon={BookOpen} title="Safety Resources & Regulatory References" />
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex flex-wrap gap-2">
            {regulatoryRefs.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: G, background: rgba(0.07), border: `1px solid ${rgba(0.18)}` }}
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
