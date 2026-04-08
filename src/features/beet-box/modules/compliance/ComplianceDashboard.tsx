import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ShieldCheck, Users, GraduationCap, Wrench,
  AlertTriangle, CheckCircle2, Clock, XCircle,
} from "lucide-react"
import {
  getComplianceScore,
  getPersonnelCompliance,
  getToolCalibrationCompliance,
} from "../../services/compliance"
import type {
  ComplianceScore,
  PersonnelCompliance,
  ToolCalibrationStatus,
} from "../../services/compliance"

export default function ComplianceDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<ComplianceScore | null>(null)
  const [personnel, setPersonnel] = useState<PersonnelCompliance[]>([])
  const [tools, setTools] = useState<ToolCalibrationStatus[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [s, p, t] = await Promise.all([
          getComplianceScore(),
          getPersonnelCompliance(),
          getToolCalibrationCompliance(),
        ])
        setScore(s)
        setPersonnel(p)
        setTools(t)
      } catch (err) {
        console.error("Failed to load compliance data:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
            >
              Compliance Center
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : "Personnel certifications, training & tool calibration status"}
            </p>
          </div>
          <ShieldCheck className="w-8 h-8 text-white/15" />
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-white/30 text-sm">Loading compliance data...</div>
        ) : score && (
          <>
            {/* ── Overall Score + Category Scores ─────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              {/* Overall score ring */}
              <div className="card-elevated rounded-lg p-5 flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-3">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(0,0%,18%)" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={scoreColor(score.overall)}
                      strokeWidth="10"
                      strokeDasharray={`${(score.overall / 100) * 264} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      {score.overall}
                    </span>
                  </div>
                </div>
                <p className="text-white/40 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                  Overall Score
                </p>
              </div>

              {/* Personnel */}
              <ScoreCard
                label="Personnel"
                icon={Users}
                score={score.personnel.score}
                detail={`${score.personnel.compliant}/${score.personnel.total} certified`}
                issues={score.personnel.issues.length}
              />

              {/* Training */}
              <ScoreCard
                label="Training"
                icon={GraduationCap}
                score={score.training.score}
                detail={score.training.total > 0
                  ? `${score.training.current} current, ${score.training.expiring} expiring, ${score.training.expired} expired`
                  : "No training records"
                }
                issues={score.training.expired}
              />

              {/* Tools */}
              <ScoreCard
                label="Tool Calibration"
                icon={Wrench}
                score={score.tooling.score}
                detail={score.tooling.total > 0
                  ? `${score.tooling.current} current, ${score.tooling.dueSoon} due soon, ${score.tooling.overdue} overdue`
                  : "No tools tracked"
                }
                issues={score.tooling.overdue}
              />
            </div>

            {/* ── Issues Banner ────────────────────────────────────────── */}
            {score.personnel.issues.length > 0 && (
              <div
                className="card-elevated rounded-lg px-5 py-4"
                style={{ borderLeft: "3px solid rgba(251,191,36,0.6)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-amber-400 text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>
                    Attention Required
                  </h3>
                </div>
                <ul className="space-y-1">
                  {score.personnel.issues.map((issue, i) => (
                    <li key={i} className="text-white/50 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Personnel Table ──────────────────────────────────────── */}
            <div className="card-elevated rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                <h2 className="text-white/70 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                  Personnel Certifications
                </h2>
                <span className="text-white/30 text-xs">{personnel.length} technician{personnel.length !== 1 ? "s" : ""}</span>
              </div>

              {personnel.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/25 text-sm">No personnel with certifications on file</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                      {["Name", "Cert Type", "Cert #", "Training Records", "Status"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {personnel.map((p, i) => {
                      const hasIssues = !p.hasCert || p.expiredTraining > 0
                      const isWarning = p.expiringSoonTraining > 0
                      return (
                        <tr
                          key={p.profileId}
                          className="transition-colors hover:bg-white/[0.03]"
                          style={{ borderBottom: i < personnel.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                        >
                          <td className="px-4 py-2.5 text-white/80 text-sm font-medium">{p.name}</td>
                          <td className="px-4 py-2.5">
                            {p.certType ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-600/20 text-blue-300">
                                {p.certType}
                              </span>
                            ) : (
                              <span className="text-red-400/70 text-xs">No cert</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-white/50 text-xs">{p.certNumber ?? "—"}</td>
                          <td className="px-4 py-2.5 text-white/50 text-xs">
                            {p.trainingRecords > 0 ? (
                              <span>
                                {p.currentTraining} current
                                {p.expiringSoonTraining > 0 && <span className="text-amber-400"> · {p.expiringSoonTraining} expiring</span>}
                                {p.expiredTraining > 0 && <span className="text-red-400"> · {p.expiredTraining} expired</span>}
                              </span>
                            ) : (
                              <span className="text-white/25">None</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {hasIssues ? (
                              <XCircle className="w-4 h-4 text-red-400/70" />
                            ) : isWarning ? (
                              <Clock className="w-4 h-4 text-amber-400/70" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400/70" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Tool Calibration Table ───────────────────────────────── */}
            <div className="card-elevated rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                <h2 className="text-white/70 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                  Tool Calibration Status
                </h2>
                <button
                  onClick={() => navigate("/app/beet-box/tool-calibration")}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  Manage Tools →
                </button>
              </div>

              {tools.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Wrench className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/25 text-sm">No tools tracked</p>
                  <p className="text-white/15 text-xs mt-1">Add tools in Tool Calibration to track compliance</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                      {["Tool #", "Description", "Last Calibrated", "Next Due", "Days Left", "Status"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map((t, i) => (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/app/beet-box/tool-calibration/${t.id}`)}
                        className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                        style={{ borderBottom: i < tools.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                      >
                        <td className="px-4 py-2.5 font-mono text-white/70 text-xs font-semibold">{t.toolNumber}</td>
                        <td className="px-4 py-2.5 text-white/55 text-xs max-w-[200px] truncate">{t.description}</td>
                        <td className="px-4 py-2.5 text-white/40 text-xs">
                          {t.lastCalibratedAt
                            ? new Date(t.lastCalibratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-white/20">Never</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-white/40 text-xs">
                          {t.nextCalibrationDue
                            ? new Date(t.nextCalibrationDue).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-white/20">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          {t.daysUntilDue !== null ? (
                            <span className={`text-xs font-bold ${
                              t.isOverdue ? "text-red-400" :
                              t.isDueSoon ? "text-amber-400" :
                              "text-emerald-400"
                            }`}>
                              {t.isOverdue ? `${Math.abs(t.daysUntilDue)}d overdue` : `${t.daysUntilDue}d`}
                            </span>
                          ) : (
                            <span className="text-white/20 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <ToolStatusBadge status={t.status} isOverdue={t.isOverdue} isDueSoon={t.isDueSoon} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return "#10b981"   // emerald
  if (score >= 70) return "#fbbf24"   // amber
  return "#ef4444"                     // red
}

function ScoreCard({
  label, icon: Icon, score, detail, issues,
}: {
  label: string; icon: typeof Users; score: number; detail: string; issues: number
}) {
  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/40 text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>
          {label}
        </p>
        <Icon className="w-4 h-4 text-white/20" />
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span
          className="text-3xl font-bold"
          style={{ fontFamily: "var(--font-display)", color: scoreColor(score) }}
        >
          {score}
        </span>
        <span className="text-white/25 text-xs mb-1">/ 100</span>
      </div>
      <p className="text-white/40 text-xs">{detail}</p>
      {issues > 0 && (
        <p className="text-red-400/70 text-xs mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {issues} issue{issues !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}

function ToolStatusBadge({ status, isOverdue, isDueSoon }: { status: string; isOverdue: boolean; isDueSoon: boolean }) {
  const cfg = isOverdue
    ? { bg: "bg-red-600/25", text: "text-red-300", label: "Overdue" }
    : isDueSoon
      ? { bg: "bg-amber-600/25", text: "text-amber-300", label: "Due Soon" }
      : status === "active"
        ? { bg: "bg-emerald-600/25", text: "text-emerald-300", label: "Current" }
        : { bg: "bg-zinc-600/25", text: "text-zinc-300", label: status.replace(/_/g, " ") }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}
