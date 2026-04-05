import { useState, useEffect } from "react"
import { Shield, BookOpen, Bell, MapPin, Phone, ExternalLink, X, FileText, AlertOctagon } from "lucide-react"
import { useAuth } from "@/features/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { PongGame } from "@/components/PongGame"

/* ─── Data ─────────────────────────────────────────────────────── */

const coreValues = [
  {
    number: "01",
    name: "Deliver the Wow",
    body: "We don't just return aircraft to service. We deliver airplanes that people trust without hesitation. Safe, clean, and ready to perform. Every detail accounted for, every discrepancy closed, every release something we stand behind.\n\nWhen that door closes and the engines spool up, there is zero doubt. That level of confidence is what we deliver every single time.",
  },
  {
    number: "02",
    name: "Solutions Focus",
    body: "We are problem solvers at our core. When something breaks, we don't slow down — we lock in. We chase root cause, make smart decisions, and move with purpose.\n\nWe respect the schedule, we respect the budget, and we respect the aircraft. Fix it right, fix it once, and keep the operation moving forward.",
  },
  {
    number: "03",
    name: "Fueled by Passion",
    body: "This is not a job. This is a calling. We chose aviation, and aviation demands everything. Precision when you're exhausted. Standards when no one is watching. Pride in work that most people will never see or understand.\n\nWhen that aircraft lifts off, something we touched and something we signed is carrying human beings through the sky. That weight never leaves us. We don't want it to. That is the fire.",
  },
  {
    number: "04",
    name: "Team Alignment",
    body: "We know exactly where we fit in, and we take pride in it. We are a support department, and that means we show up for the rest of the operation every single day.\n\nWe stay aligned with Safety, pilots, SkyOps, and Accounting — all working toward the same goal of delivering world class private aviation. When the company moves, we move with it. When they need us, we're already there.",
  },
]

const bulletinItems = [
  { date: "Apr 3", text: "14-Day Check is live — standing inspection links for each aircraft, mobile photo capture, and a full MC review dashboard with fleet status at a glance." },
  { date: "Apr 3", text: "External Requests is live. Send structured requests to anyone outside the platform and collect responses through a secure, no-login portal." },
  { date: "Apr 3", text: "MM Revision & Audit Tracking is now live under Compliance. Quarterly audit campaigns replace the spreadsheet — review the entire fleet by type group, track revision changes, and generate PDF reports ready for the FSDO." },
  { date: "Apr 2", text: "Parts module launched: submit parts requests, track order status, manage approvals, and view FedEx tracking — all in one place. Replaces the Google Form workflow. 616 historical orders imported. Find it under Parts in the sidebar." },
  { date: "Apr 1", text: "DW1GHT Interview System launched: AI-powered mechanic interviews with automatic learning, DOM review workflow, and email notifications. Check your interview assignments under Discrepancy Intelligence." },
  { date: "Mar 31", text: "Discrepancy Intelligence launched: browse fleet discrepancy records by aircraft, view full detail with pilot reports, corrective actions, AMM references, turnaround time, and airframe hours between events. 40 records imported for N499CB." },
  { date: "Mar 31", text: "Aircraft Info now pulls live fleet data from Supabase instead of static config. Portal Updates section is now scrollable." },
  { date: "Mar 31", text: "Vendor governance system launched: dual-lane compliance (9-or-less / 10-or-more), document tracking, review & audit logging, and on-demand compliance reporting with PDF and CSV export." },
  { date: "Mar 30", text: "Department directory and core values sections added to the portal." },
  { date: "Mar 28", text: "SkyShare MX portal is live. Welcome to the team intranet." },
  { date: "Mar 28", text: "User management and invite system are fully operational." },
]


const departments = [
  { name: "SkyShare Maintenance",  location: "OGD · SLC",   email: "cbmx@skyshare.com",       phone: "385-294-0969" },
  { name: "HR & Recruiting",       location: "OGD",         email: "recruiting@skyshare.com",  phone: null          },
  { name: "General Information",   location: null,          email: "info@skyshare.com",        phone: null          },
  { name: "SkyOps",                location: "SLC",         email: "skyops@skyshare.com",      phone: "801-516-9189" },
  { name: "Charter Sales",         location: null,          email: "charter@skyshare.com",     phone: null          },
  { name: "Accounts Payable",      location: "OGD",         email: "payables@skyshare.com",    phone: null          },
]

/* ─── Core Value Modal ──────────────────────────────────────────── */

function CoreValueModal({
  value,
  onClose,
}: {
  value: (typeof coreValues)[number] | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!value) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [value, onClose])

  if (!value) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-lg overflow-hidden"
        style={{
          background: "hsl(var(--card))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(212,160,23,0.2)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header band */}
        <div
          className="relative px-8 py-6"
          style={{
            background: "var(--skyshare-navy)",
            borderBottom: "2px solid var(--skyshare-gold)",
          }}
        >
          {/* Diagonal texture */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba(212,160,23,0.03) 20px, rgba(212,160,23,0.03) 21px)",
            }}
          />
          <div className="relative flex items-end justify-between gap-4">
            <div>
              <p
                className="mb-1"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "4rem",
                  lineHeight: 1,
                  color: "rgba(212,160,23,0.15)",
                  letterSpacing: "0.04em",
                  userSelect: "none",
                }}
              >
                {value.number}
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2rem",
                  color: "var(--skyshare-gold)",
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                }}
              >
                {value.name.toUpperCase()}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded p-1.5 transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          {value.body ? (
            <div className="space-y-6">
              {value.body.split("\n\n").map((para, i, arr) => (
                <div key={i}>
                  <p
                    style={{
                      fontSize: "1rem",
                      lineHeight: 1.85,
                      color: i === 0 ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.55)",
                      fontFamily: "var(--font-body)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {para}
                  </p>
                  {i < arr.length - 1 && (
                    <div
                      className="mt-6"
                      style={{ height: "1px", background: "linear-gradient(90deg, rgba(212,160,23,0.3) 0%, transparent 100%)", width: "4rem" }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p
                className="text-sm"
                style={{ color: "rgba(212,160,23,0.5)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
              >
                DESCRIPTION COMING SOON
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                MX department details for this value will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function Dashboard() {
  const { profile } = useAuth()
  const firstName = profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? "there"
  const [openValue, setOpenValue] = useState<(typeof coreValues)[number] | null>(null)

  return (
    <>
      <CoreValueModal value={openValue} onClose={() => setOpenValue(null)} />

      <div>

        {/* ── Hero greeting ─────────────────────────────────────── */}
        <div className="hero-area flex items-stretch gap-0" style={{ padding: 0, minHeight: "6rem", borderBottom: "none" }}>

          {/* Left 50% — welcome text */}
          <div
            className="flex flex-col justify-center"
            style={{ flex: "0 0 50%", padding: "1rem 1.5rem 1.25rem" }}
          >
            <h1
              className="text-[2.6rem] leading-none text-foreground"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
            >
              Welcome back, {firstName.toUpperCase()}
            </h1>
            <div
              className="mt-2 mb-2"
              style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }}
            />
            <p
              className="text-sm text-muted-foreground"
              style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}
            >
              Team Operations &amp; Performance
            </p>
          </div>

          {/* Right 50% — Love Your Journey SVG */}
          <div
            className="flex items-center justify-end overflow-hidden"
            style={{ flex: "0 0 50%", padding: "0.5rem 1.5rem 0.5rem 0" }}
          >
            <img
              src="/love-your-journey.svg"
              alt="Love Your Journey"
              style={{
                height: "100%",
                width: "auto",
                maxHeight: "4.75rem",
                objectFit: "contain",
                objectPosition: "right center",
              }}
            />
          </div>
        </div>

        {/* Gradient stripe replacing hero bottom border */}
        <div style={{ margin: "0 -1.5rem", height: "2px", background: "linear-gradient(90deg, var(--skyshare-crimson) 0%, var(--skyshare-navy) 100%)" }} />

        {/* ── Core Values ───────────────────────────────────────── */}
        <div style={{ margin: "0 -1.5rem 0" }}>

          {/* Section heading — logo image / Pong field */}
          {/* Canvas fills this banner; gradient stripe above is the top wall, tile border below is the bottom wall */}
          <div className="flex items-center justify-center" style={{ padding: 0, position: "relative" }}>
            <PongGame />
            <img
              src="/core-values-logo.png"
              alt="Core Values"
              className=""
              style={{ height: "7rem", width: "auto", objectFit: "contain", position: "relative", zIndex: 1 }}
            />
          </div>

          {/* Four tiles */}
          <div
            className="flex gap-4"
            style={{
              borderTop: "1px solid hsl(var(--border))",
              borderBottom: "1px solid hsl(var(--border))",
              padding: "0.5rem",
              background: "hsl(var(--background))",
            }}
          >
            {coreValues.map((v) => (
              <button
                key={v.name}
                onClick={() => setOpenValue(v)}
                className="group flex-1 flex items-center justify-center transition-all relative overflow-hidden"
                style={{
                  padding: "1.25rem 1rem",
                  minHeight: "5rem",
                  background: "hsl(var(--card))",
                  cursor: "pointer",
                  borderRadius: "2px",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--skyshare-navy)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "hsl(var(--card))" }}
              >
                {/* Gold bottom edge reveal on hover */}
                <span
                  className="absolute bottom-0 left-0 right-0 transition-all opacity-0 group-hover:opacity-100"
                  style={{ height: "2px", background: "var(--skyshare-gold)" }}
                />

                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)",
                    letterSpacing: "0.1em",
                    color: "var(--foreground)",
                    lineHeight: 1,
                    textAlign: "center",
                  }}
                >
                  {v.name.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Safety + Documents ────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6 mt-8" style={{ alignItems: "stretch" }}>

          {/* Safety Dashboard */}
          <Card className="card-elevated border-0" style={{ borderLeft: "3px solid #10b981" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(16,185,129,0.1)" }}
                >
                  <Shield className="h-4 w-4" style={{ color: "#10b981" }} />
                </div>
                <CardTitle
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#10b981",
                  }}
                >
                  Safety Dashboard
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="pt-0 pb-5">
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://prismsms.argus.aero/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#10b981",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.2)",
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  PRISM SMS
                </a>
                {/* Replace href="#" with ERP URL when available */}
                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  ERP System
                </a>
                {/* Replace href="#" with SMS Manual URL when available */}
                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <FileText className="h-3 w-3" />
                  SMS Manual
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Company Documents */}
          <Card className="card-elevated border-0" style={{ borderLeft: "3px solid #60a5fa" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(96,165,250,0.1)" }}
                >
                  <BookOpen className="h-4 w-4" style={{ color: "#60a5fa" }} />
                </div>
                <CardTitle
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#60a5fa",
                  }}
                >
                  Company Documents
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="pt-0 pb-5">
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://portal.jetinsight.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#60a5fa",
                      background: "rgba(96,165,250,0.08)",
                      border: "1px solid rgba(96,165,250,0.2)",
                    }}
                  >
                    <BookOpen className="h-3 w-3" />
                    JetInsight Portal
                  </a>
                  <a
                    href="https://portal.jetinsight.com/compliance/documents/operator"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#60a5fa",
                      background: "rgba(96,165,250,0.08)",
                      border: "1px solid rgba(96,165,250,0.2)",
                    }}
                  >
                    <FileText className="h-3 w-3" />
                    Company Docs
                  </a>
                  <a
                    href="https://portal.jetinsight.com/compliance/documents/aircraft"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#60a5fa",
                      background: "rgba(96,165,250,0.08)",
                      border: "1px solid rgba(96,165,250,0.2)",
                    }}
                  >
                    <FileText className="h-3 w-3" />
                    Aircraft Docs
                  </a>
                  <a
                    href="https://portal.jetinsight.com/compliance/discrepancies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-opacity hover:opacity-75"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#60a5fa",
                      background: "rgba(96,165,250,0.08)",
                      border: "1px solid rgba(96,165,250,0.2)",
                    }}
                  >
                    <AlertOctagon className="h-3 w-3" />
                    Discrepancies
                  </a>
                </div>
                <p
                  className="text-xs text-muted-foreground mt-2"
                  style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.05em" }}
                >
                  Authoritative source — always check before starting any task.
                </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Portal Updates ────────────────────────────────────── */}
        <Card className="card-elevated border-0 mt-6" style={{ borderLeft: "3px solid var(--skyshare-gold)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(212,160,23,0.12)" }}
              >
                <Bell className="h-4 w-4" style={{ color: "var(--skyshare-gold)" }} />
              </div>
              <CardTitle
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--skyshare-gold)",
                }}
              >
                Portal Updates
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className="space-y-3 overflow-y-auto pr-2"
              style={{
                maxHeight: "9.5rem",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(212,160,23,0.25) transparent",
              }}
            >
              {bulletinItems.map((item, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      color: "rgba(212,160,23,0.5)",
                      whiteSpace: "nowrap",
                      paddingTop: "2px",
                    }}
                  >
                    {item.date.toUpperCase()}
                  </span>
                  <span className="text-sm text-muted-foreground" style={{ lineHeight: 1.6 }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Department Directory ──────────────────────────────── */}
        <div className="mt-8 mb-2">
          <p
            className="tracking-[0.3em] uppercase mb-5"
            style={{ fontFamily: "var(--font-heading)", fontSize: "10px", color: "var(--skyshare-gold)" }}
          >
            Department Directory
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div
                key={dept.name}
                className="card-elevated rounded-lg p-4 space-y-2"
                style={{ borderTop: "2px solid hsl(var(--border))" }}
              >
                <p
                  className="text-sm font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
                >
                  {dept.name}
                </p>
                {dept.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{dept.location}</span>
                  </div>
                )}
                <a
                  href={`mailto:${dept.email}`}
                  className="block text-xs transition-opacity hover:opacity-75"
                  style={{
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.04em",
                    color: "var(--skyshare-blue-mid)",
                  }}
                >
                  {dept.email}
                </a>
                {dept.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <a
                      href={`tel:${dept.phone}`}
                      className="text-xs text-muted-foreground transition-opacity hover:opacity-75"
                      style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
                    >
                      {dept.phone}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
