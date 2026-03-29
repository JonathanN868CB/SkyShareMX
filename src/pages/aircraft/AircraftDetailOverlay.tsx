import React, { useEffect, useRef, useState } from "react"
import { useAuth } from "@/features/auth"
import type { AircraftBase, AircraftDetailData, AvionicsService, CMMDocument, DataField, GroupCMM } from "./fleetData"
import { FLEET_FAMILY_NAMES, getAircraftFamily } from "./fleetData"
import { useAircraftDetail, useUpsertAircraftDetail, useUpdateCMMs, useGroupCMMs, useUpsertGroupCMM, useDeleteGroupCMM } from "./useAircraftDetail"
import AvionicsEditorOverlay from "./AvionicsEditorOverlay"
import ProgramsEditorOverlay from "./ProgramsEditorOverlay"
import IdentityEditorOverlay from "./IdentityEditorOverlay"
import PropulsionEditorOverlay from "./PropulsionEditorOverlay"
import DocumentationEditorOverlay from "./DocumentationEditorOverlay"

interface Props {
  aircraft: AircraftBase
  detail: AircraftDetailData
  onClose: () => void
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
type FieldStatus = "enrolled" | "pending" | "none"

function fieldStatus(value: string): FieldStatus {
  if (value === "None") return "none"
  if (value === "—" || value === "") return "pending"
  return "enrolled"
}

const DOT_COLOR: Record<FieldStatus, string> = {
  enrolled: "var(--skyshare-success)",
  pending:  "rgba(212,160,23,0.5)",
  none:     "hsl(var(--muted-foreground))",
}

function StatusDot({ value, size = 8 }: { value: string; size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", backgroundColor: DOT_COLOR[fieldStatus(value)],
      flexShrink: 0, marginTop: 1,
    }} />
  )
}

// ─── Clipboard copy button ────────────────────────────────────────────────────
// Always copies the full underlying value — not the displayed/truncated text.
// Flashes a checkmark for 1.5 s as confirmation. Uses muted-foreground so it
// reads clearly on both the light card (#fff) and dark card (#2e2e2e) surfaces.
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()  // don't trigger expand-toggle on parent
    navigator.clipboard.writeText(value).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: "3px", borderRadius: "50%",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, lineHeight: 1,
        color: copied ? "var(--skyshare-success)" : "hsl(var(--muted-foreground))",
        transition: "color 0.15s ease, background 0.12s ease",
      }}
      onMouseEnter={e => { if (!copied) { e.currentTarget.style.color = "hsl(var(--foreground))"; e.currentTarget.style.background = "rgba(128,128,128,0.14)" } }}
      onMouseLeave={e => { if (!copied) { e.currentTarget.style.color = "hsl(var(--muted-foreground))"; e.currentTarget.style.background = "none" } }}>
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="4" y="1.5" width="6.5" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 3.5H3a1 1 0 00-1 1v6.5a1 1 0 001 1h5.5a1 1 0 001-1V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}

function getField(fields: DataField[], label: string) {
  return fields.find(f => f.label === label)
}
function getFieldsByGroup(fields: DataField[], group: string) {
  return fields.filter(f => f.group === group)
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function Card({ title, children, headerAction }: { title: string; children: React.ReactNode; headerAction?: React.ReactNode }) {
  return (
    <div className="card-elevated rounded-lg flex flex-col">
      <div className="px-5 pt-4 pb-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(212,160,23,0.18)" }}>
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", letterSpacing: "0.14em" }}>
          {title}
        </span>
        {headerAction}
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  )
}

function InCardDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      {label && (
        <>
          <div style={{ width: 2, height: 10, borderRadius: 1, background: "var(--skyshare-gold)", opacity: 0.55, flexShrink: 0 }} />
          <span className="text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
            style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--muted-foreground))", opacity: 0.75, letterSpacing: "0.1em" }}>
            {label}
          </span>
        </>
      )}
      <div style={{ flex: 1, height: "0.5px", background: "hsl(var(--border))" }} />
    </div>
  )
}

// ─── Standard field row (view-only) ──────────────────────────────────────────
function FieldRow({ label, value, account, link, note }: DataField) {
  const s       = fieldStatus(value)
  const isEmpty = s !== "enrolled"
  const isUrl   = !!link || value.startsWith("http")

  return (
    <div className="py-2.5" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
      <div className="text-xs uppercase tracking-widest mb-1"
        style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--muted-foreground))", opacity: 0.6, letterSpacing: "0.09em" }}>
        {label}
      </div>
      {isUrl ? (
        <a href={link ?? value} target="_blank" rel="noopener noreferrer"
          className="text-sm underline underline-offset-2"
          style={{ color: "var(--skyshare-gold)" }}>
          Open ↗
        </a>
      ) : (
        <div className="text-sm"
          style={{
            fontFamily: s === "pending" ? "'Courier Prime','Courier New',monospace" : "var(--font-body)",
            color: isEmpty ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
            fontStyle: s === "none" ? "italic" : "normal",
            opacity: isEmpty ? 0.45 : 1,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}>
          {s === "none" ? "None — not enrolled" : value}
        </div>
      )}
      {account && s === "enrolled" && (
        <div className="text-xs font-mono mt-0.5" style={{ color: "var(--skyshare-gold)", letterSpacing: "0.04em" }}>
          {account}
        </div>
      )}
      {note && (
        <div className="text-xs italic mt-0.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
          {note}
        </div>
      )}
    </div>
  )
}

// ─── Propulsion hero strip — vertical grid table ──────────────────────────────
// Pattern auto-detected from data:
//   A — engine(s) + propeller(s), no APU
//   B — engine(s) only, no APU
//   C — engine(s) + APU (with or without props)

function PropulsionHeroStrip({
  powerplant, apu, aircraftNote,
}: {
  powerplant: DataField[]
  apu: DataField[] | null
  aircraftNote?: string
}) {
  const allPP = [...powerplant, ...(apu ?? [])]

  function val(label: string): string {
    return allPP.find(f => f.label === label)?.value ?? "—"
  }

  function nums(prefix: string, source: DataField[]): number[] {
    return [...new Set(
      source
        .map(f => { const m = f.label.match(new RegExp(`^${prefix}\\s+(\\d+)\\b`, "i")); return m ? parseInt(m[1]) : 0 })
        .filter(n => n > 0)
    )].sort((a, b) => a - b)
  }

  interface PPRow { label: string; model: string; sn: string; note: string }
  const rows: PPRow[] = []

  // ── Engines ──────────────────────────────────────────────────────────────────
  const engNums = nums("Engine", powerplant)
  const isTwin  = engNums.length > 1
  for (const n of engNums) {
    rows.push({
      label: isTwin ? `ENG ${n}` : "ENG",
      model: val(`Engine ${n} Model`),
      sn:    val(`Engine ${n} S/N`),
      note:  val(`Engine ${n} Descriptor`),
    })
  }
  // Backward-compat: old unnumbered schema
  if (!engNums.length) {
    const m = val("Engine Model"), s = val("Engine S/N")
    if (m !== "—" || s !== "—") rows.push({ label: "ENG", model: m, sn: s, note: "—" })
  }

  // ── Propellers ───────────────────────────────────────────────────────────────
  const propNums   = nums("Propeller", powerplant)
  const isMultiProp = propNums.length > 1
  for (const n of propNums) {
    rows.push({
      label: isMultiProp ? `PROP ${n}` : "PROP",
      model: val(`Propeller ${n} Model`),
      sn:    val(`Propeller ${n} S/N`),
      note:  val(`Propeller ${n} Descriptor`),
    })
  }
  if (!propNums.length) {
    const m = val("Propeller Model"), s = val("Propeller S/N")
    if (m !== "—" || s !== "—") rows.push({ label: "PROP", model: m, sn: s, note: "—" })
  }

  // ── APU ───────────────────────────────────────────────────────────────────────
  if (apu) {
    const apuNums    = nums("APU", apu)
    const isMultiAPU = apuNums.length > 1
    for (const n of apuNums) {
      rows.push({
        label: isMultiAPU ? `APU ${n}` : "APU",
        model: val(`APU ${n} Model`),
        sn:    val(`APU ${n} S/N`),
        note:  "—",
      })
    }
    if (!apuNums.length) {
      const m = val("APU Model"), s = val("APU S/N")
      if (m !== "—" || s !== "—") rows.push({ label: "APU", model: m, sn: s, note: "—" })
    }
  }

  const populated = rows.filter(r => r.model !== "—" || r.sn !== "—")
  if (!populated.length) return null

  const showNote = aircraftNote && aircraftNote !== "—" && aircraftNote !== ""

  return (
    <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 12, marginTop: 14 }}>
      {/* Single parent grid — column 2 is "auto" so all value cells share the same max width,
          keeping note badges left-aligned at a consistent position across all rows */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "56px auto 1fr",
        columnGap: 8,
        alignItems: "center",
      }}>
        {populated.map((row, i) => {
          const hasNote = row.note && row.note !== "—" && row.note !== ""
          const isLast  = i === populated.length - 1 && !showNote
          return (
            <React.Fragment key={i}>
              {/* Label */}
              <div style={{
                padding: "7px 0",
                fontFamily: "'Courier Prime','Courier New',monospace",
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(212,160,23,0.55)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                {row.label}
              </div>

              {/* Model / S/N */}
              <div style={{ padding: "7px 0", fontSize: "13px" }}>
                {row.model !== "—" && (
                  <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                    {row.model}
                  </span>
                )}
                {row.model !== "—" && row.sn !== "—" && (
                  <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, margin: "0 5px" }}>/</span>
                )}
                {row.sn !== "—" && (
                  <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>
                    {row.sn}
                  </span>
                )}
              </div>

              {/* Note badge — collapses when empty */}
              <div style={{ padding: "7px 0" }}>
                {hasNote && (
                  <span style={{
                    fontSize: "11px",
                    color: "var(--skyshare-gold)",
                    fontStyle: "italic",
                    background: "rgba(212,160,23,0.08)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    borderRadius: 6,
                    padding: "2px 9px",
                    whiteSpace: "nowrap",
                    maxWidth: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "inline-block",
                  }}>
                    {row.note}
                  </span>
                )}
              </div>

              {/* Full-width divider — single element spanning all 3 columns, no zigzag */}
              {!isLast && (
                <div style={{
                  gridColumn: "1 / -1",
                  height: "0.5px",
                  background: "hsl(var(--border))",
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Aircraft-level note (Pattern C / special aircraft) */}
      {showNote && (
        <div style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12,
          color: "hsl(var(--muted-foreground))",
          fontStyle: "italic",
          opacity: 0.75,
        }}>
          <span style={{ color: "rgba(212,160,23,0.55)", flexShrink: 0, fontStyle: "normal" }}>ℹ</span>
          {aircraftNote}
        </div>
      )}
    </div>
  )
}

// ─── Programs Card ────────────────────────────────────────────────────────────
const ENROLLMENT_LABELS = [
  "Engine Program",
  "Engine Health Monitoring",
  "Airframe MSP",
  "Parts Program",
  "Maintenance Tracking",
  "APU Program",
]

function ProgramBlock({ field }: { field: DataField }) {
  const s = fieldStatus(field.value)

  return (
    <div className="py-2.5" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
      <div className="flex items-start gap-2.5"
        style={{
          borderLeft: s === "enrolled" ? "2px solid var(--skyshare-success)" : "2px solid transparent",
          paddingLeft: 6,
          transition: "border-color 0.15s ease",
        }}>
        <StatusDot value={field.value} size={8} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="text-sm"
              style={{
                color: s === "enrolled" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                fontWeight: s === "enrolled" ? 600 : 400,
                opacity: s === "enrolled" ? 1 : 0.65,
                fontFamily: "var(--font-body)",
              }}>
              {field.label}
            </span>
            <span className="text-xs text-right font-mono"
              style={{
                color: s === "enrolled" ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                opacity: s === "enrolled" ? 1 : s === "none" ? 0.38 : 0.45,
                fontStyle: s === "none" ? "italic" : "normal",
                whiteSpace: "nowrap",
              }}>
              {s === "enrolled" ? field.value : s === "none" ? "Not enrolled" : "—"}
            </span>
          </div>

          {s === "enrolled" && (
            <div className="mt-2 grid gap-y-2"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {[
                { key: "provider",       label: "Provider",   val: field.provider       ?? "—" },
                { key: "contractNumber", label: "Contract #", val: field.contractNumber ?? "—" },
                { key: "expiry",         label: "Expires",    val: field.expiry         ?? "—" },
                { key: "account",        label: "Account #",  val: field.account        ?? "—" },
              ]
                .filter(item => item.val !== "—" && item.val !== "")
                .map(item => (
                  <div key={item.key}>
                    <div className="text-xs mb-0.5"
                      style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--muted-foreground))", opacity: 0.45, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {item.label}
                    </div>
                    <div className="text-xs"
                      style={{
                        fontFamily: (item.key === "contractNumber" || item.key === "account") ? "'Courier Prime','Courier New',monospace" : "var(--font-body)",
                        color: (item.key === "contractNumber" || item.key === "account") ? "var(--skyshare-gold)" : "hsl(var(--foreground))",
                      }}>
                      {item.val}
                    </div>
                  </div>
                ))
              }
              {field.note && (
                <div className="col-span-full text-xs italic"
                  style={{ color: "hsl(var(--muted-foreground))", opacity: 0.55 }}>
                  {field.note}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProgramsCard({ programs, canEdit, onEdit }: {
  programs: DataField[]
  canEdit: boolean
  onEdit: () => void
}) {
  const avionicsMsp = programs
    .filter(f => f.group?.startsWith("Avionics") && f.label === "MSP")
    .map(f => {
      const suite = programs.find(p => p.group === f.group && p.label === "Suite")
      return { ...f, label: suite?.value && fieldStatus(suite.value) === "enrolled" ? `Avionics MSP — ${suite.value}` : "Avionics MSP" }
    })

  const enrollmentFields = [
    ...ENROLLMENT_LABELS.map(l => programs.find(f => f.label === l)).filter(Boolean) as DataField[],
    ...avionicsMsp,
  ]

  const editButton = canEdit ? (
    <button onClick={onEdit}
      className="text-xs px-2.5 py-1 rounded"
      style={{ background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)", border: "0.5px solid rgba(212,160,23,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
      Edit
    </button>
  ) : null

  return (
    <Card title="Programs &amp; Enrollment" headerAction={editButton}>
      {enrollmentFields.map(f => (
        <ProgramBlock key={f.label + (f.group ?? "")} field={f} />
      ))}
    </Card>
  )
}


// ─── Avionics view ────────────────────────────────────────────────────────────
const AVIONICS_CATEGORY_ORDER = [
  "Flight Deck", "Nav Database", "Connectivity",
  "Weather", "Communications", "ATC / Datalink", "Surveillance",
]

// Cell label style — no opacity reduction; muted-foreground provides contrast on its own
const CELL_LBL: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "0.62rem",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  color: "hsl(var(--muted-foreground))",
  lineHeight: 1,
  userSelect: "none",
  marginBottom: 3,
}

function AvionicsServiceRow({ svc }: { svc: AvionicsService }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const toggleReveal = (i: number) => setRevealed(prev => {
    const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next
  })

  const visibleFields = svc.fields.filter(f =>
    f.type === "boolean" ? true : (f.value && f.value !== "")
  )

  return (
    <div className="py-3" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
      {/* Service label */}
      {svc.label && (
        <div className="text-sm font-semibold mb-2.5"
          style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-body)" }}>
          {svc.label}
        </div>
      )}

      {visibleFields.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, auto)",
          rowGap: 10,
          columnGap: 24,
          overflowX: "auto",
        }}>
          {visibleFields.map((f, i) => {
            const gIdx = svc.fields.indexOf(f)
            const isRev = revealed.has(gIdx)

            // ── Boolean (2FA) ──────────────────────────────────────────────
            if (f.type === "boolean") {
              const isYes = f.value === "Yes"
              return (
                <div key={i}>
                  <div style={CELL_LBL}>{f.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                    <span
                      className={isYes ? "badge-success" : "badge-warning"}
                      style={{ padding: "1px 7px", borderRadius: 4, fontSize: "0.7rem", fontFamily: "var(--font-heading)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {isYes ? "✓ On" : "Off"}
                    </span>
                    {isYes && f.detail && (
                      <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-body)", whiteSpace: "nowrap" }}>
                        — {f.detail}
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            // ── Sensitive + masked ─────────────────────────────────────────
            if (f.sensitive && !isRev) {
              return (
                <div key={i}>
                  <div style={CELL_LBL}>{f.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", letterSpacing: "0.12em" }}>
                      ••••••••
                    </span>
                    <button onClick={() => toggleReveal(gIdx)}
                      style={{ fontSize: "0.65rem", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", opacity: 0.85, whiteSpace: "nowrap" }}>
                      show
                    </button>
                    <CopyButton value={f.value} />
                  </div>
                </div>
              )
            }

            // ── URL ────────────────────────────────────────────────────────
            if (f.value.startsWith("http")) {
              return (
                <div key={i}>
                  <div style={CELL_LBL}>{f.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
                    <a href={f.value} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--skyshare-gold)", fontFamily: "var(--font-body)", textDecoration: "underline", textDecorationStyle: "dotted", whiteSpace: "nowrap" }}>
                      Open ↗
                    </a>
                    {isRev && (
                      <button onClick={() => toggleReveal(gIdx)}
                        style={{ fontSize: "0.65rem", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", opacity: 0.5, whiteSpace: "nowrap" }}>
                        hide
                      </button>
                    )}
                    <CopyButton value={f.value} />
                  </div>
                </div>
              )
            }

            // ── Plain text (revealed sensitive or normal) ──────────────────
            return (
              <div key={i}>
                <div style={CELL_LBL}>{f.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
                  <span style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    fontFamily: "var(--font-body)",
                    color: "hsl(var(--foreground))",
                    whiteSpace: "nowrap",
                  }}>
                    {f.value}
                  </span>
                  {f.sensitive && isRev && (
                    <button onClick={() => toggleReveal(gIdx)}
                      style={{ fontSize: "0.65rem", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", opacity: 0.5, whiteSpace: "nowrap" }}>
                      hide
                    </button>
                  )}
                  <CopyButton value={f.value} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Notes */}
      {svc.notes && (
        <div className="mt-2.5 text-xs italic"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-body)", lineHeight: 1.65 }}>
          {svc.notes}
        </div>
      )}
    </div>
  )
}

function AvionicsCard({ avionics, canEdit, onEdit }: { avionics: AvionicsService[]; canEdit: boolean; onEdit: () => void }) {
  const grouped = new Map<string, AvionicsService[]>()
  for (const svc of avionics) {
    const cat = svc.category || "Other"
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(svc)
  }
  const sortedCats = [
    ...AVIONICS_CATEGORY_ORDER.filter(c => grouped.has(c)),
    ...[...grouped.keys()].filter(c => !AVIONICS_CATEGORY_ORDER.includes(c)),
  ]

  const editButton = canEdit ? (
    <button onClick={onEdit}
      className="text-xs px-2.5 py-1 rounded"
      style={{ background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)", border: "0.5px solid rgba(212,160,23,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
      Edit
    </button>
  ) : null

  return (
    <Card title="Avionics &amp; Connectivity" headerAction={editButton}>
      {avionics.length === 0 ? (
        <div className="py-4 text-xs italic text-center"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, fontFamily: "var(--font-body)" }}>
          {canEdit ? "No avionics data entered. Use Edit to add services." : "No avionics data on file."}
        </div>
      ) : (
        sortedCats.map(cat => (
          <div key={cat}>
            <InCardDivider label={cat} />
            {grouped.get(cat)!.map(svc => <AvionicsServiceRow key={svc.id} svc={svc} />)}
          </div>
        ))
      )}
    </Card>
  )
}

// ─── ATA chapter name lookup ──────────────────────────────────────────────────
const ATA_NAMES: Record<string, string> = {
  "05": "Time Limits / Mx Checks", "06": "Dimensions & Areas",
  "12": "Servicing",               "20": "Std Practices — Airframe",
  "21": "Air Conditioning",        "22": "Auto Flight",
  "23": "Communications",          "24": "Electrical Power",
  "25": "Equipment / Furnishings", "26": "Fire Protection",
  "27": "Flight Controls",         "28": "Fuel",
  "29": "Hydraulic Power",         "30": "Ice & Rain Protection",
  "31": "Indicating / Recording",  "32": "Landing Gear",
  "33": "Lights",                  "34": "Navigation",
  "35": "Oxygen",                  "36": "Pneumatic",
  "38": "Water & Waste",           "49": "Airborne APU",
  "51": "Structures",              "52": "Doors",
  "53": "Fuselage",                "55": "Stabilizers",
  "56": "Windows",                 "57": "Wings",
  "61": "Propellers",              "70": "Std Practices — Power Plant",
  "71": "Power Plant",             "72": "Engine",
  "73": "Engine Fuel & Control",   "74": "Ignition",
  "76": "Engine Controls",         "77": "Engine Indicating",
  "79": "Oil",                     "80": "Starting",
}
function ataName(chapter: string) {
  const prefix = chapter.split("-")[0].padStart(2, "0")
  return ATA_NAMES[prefix] ?? "Miscellaneous"
}

// ─── EditInput — shared inline text input ────────────────────────────────────
function EditInput({
  value, onChange, placeholder, mono = false, small = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  small?: boolean
}) {
  return (
    <input
      type="text"
      value={value === "—" ? "" : value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        background: "rgba(212,160,23,0.04)",
        border: "none",
        borderBottom: "1px solid rgba(212,160,23,0.3)",
        borderRadius: "2px 2px 0 0",
        color: "hsl(var(--foreground))",
        fontFamily: mono ? "'Courier Prime','Courier New',monospace" : "var(--font-body)",
        fontSize: small ? "0.8rem" : "0.875rem",
        padding: small ? "3px 5px" : "4px 6px",
        outline: "none",
      }}
      onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
      onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.3)")}
    />
  )
}

// ─── CMMsOverlay ─────────────────────────────────────────────────────────────

const BLANK_CMM: CMMDocument = { ataChapter: "", docNumber: "", revision: "", driveLink: "" }

const BLANK_GROUP_CMM: Omit<GroupCMM, "id"> = {
  manufacturer: "", docNumber: "", ataChapter: "", revision: "",
  revisionDate: "", title: "", applicability: "", driveLink: "", notes: "", groups: [],
}

type AddScope = "group" | "aircraft"

// Small helper for field labels inside forms
const fldLbl = (t: string) => (
  <span style={{
    display: "block", marginBottom: 2,
    color: "hsl(var(--muted-foreground))", opacity: 0.5,
    fontSize: "0.65rem", fontFamily: "var(--font-heading)",
    textTransform: "uppercase", letterSpacing: "0.09em",
  }}>
    {t}
  </span>
)

// Sort CMMDocument array by ATA chapter numerically
function groupByAta<T extends { ataChapter: string }>(docs: T[]) {
  const map: Record<string, T[]> = {}
  for (const d of docs) {
    const key = d.ataChapter || "00"
    ;(map[key] ??= []).push(d)
  }
  const keys = Object.keys(map).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ""), 10) || 0
    const nb = parseInt(b.replace(/\D/g, ""), 10) || 0
    return na - nb
  })
  return { map, keys }
}

// ── Shared document row — 4-column × 2-row label/value grid (like avionics)
function CMMRow({
  title, manufacturer, docNumber, revision, revisionDate, applicability,
  hasLink, driveLink, notes, groupBadges, canDelete, onEdit, onRemove,
  border,
}: {
  title: string
  manufacturer?: string
  docNumber: string
  revision: string
  revisionDate?: string
  applicability?: string
  hasLink: boolean
  driveLink: string
  notes?: string
  groupBadges?: string[]
  canDelete: boolean
  onEdit: () => void
  onRemove?: () => void
  border: string
  bg: string   // kept for call-site compat
}) {
  const [confirming, setConfirming] = useState(false)

  // Value styles — reuse the same sizing as the avionics credential grid
  const val: React.CSSProperties  = { fontSize: "0.8rem", color: "hsl(var(--foreground))", lineHeight: 1.35, wordBreak: "break-word" }
  const mono: React.CSSProperties = { ...val, fontFamily: "'Courier Prime','Courier New',monospace" }
  const dim: React.CSSProperties  = { ...val, color: "hsl(var(--muted-foreground))", opacity: 0.35 }

  return (
    <div style={{
      borderBottom: border,
      padding: "11px 16px",
      background: confirming ? "rgba(220,38,38,0.04)" : "hsl(var(--card))",
      transition: "background 0.15s ease",
    }}>

      {/* ── Title strip: status dot · title · controls ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 4,
            background: hasLink ? "var(--skyshare-success)" : "rgba(212,160,23,0.3)",
          }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.35, wordBreak: "break-word" }}>
            {title || "—"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {!confirming ? (
            <>
              <button onClick={onEdit}
                style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 4, cursor: "pointer", background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)", border: "0.5px solid rgba(212,160,23,0.28)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
                Edit
              </button>
              {canDelete && onRemove && (
                <button onClick={() => setConfirming(true)}
                  style={{ fontSize: "0.75rem", lineHeight: 1, cursor: "pointer", color: "hsl(var(--muted-foreground))", opacity: 0.2, background: "none", border: "none", padding: "2px 4px" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.65")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.2")}
                  title="Delete entry">
                  ✕
                </button>
              )}
            </>
          ) : (
            <>
              <span style={{ fontSize: "0.7rem", color: "rgb(220,38,38)", fontFamily: "var(--font-heading)", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                Permanently delete?
              </span>
              <button onClick={() => setConfirming(false)}
                style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 4, cursor: "pointer", color: "hsl(var(--muted-foreground))", border: "0.5px solid hsl(var(--border))", background: "none", fontFamily: "var(--font-heading)" }}>
                Cancel
              </button>
              <button onClick={() => { setConfirming(false); onRemove?.() }}
                style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: 4, cursor: "pointer", background: "rgb(220,38,38)", color: "#fff", border: "none", fontFamily: "var(--font-heading)", fontWeight: 600, letterSpacing: "0.05em" }}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 4-column × 2-row data grid ── */}
      <div style={{
        paddingLeft: 15,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        columnGap: 20,
        rowGap: 9,
      }}>

        {/* Row 1 */}
        <div>
          <div style={CELL_LBL}>Manufacturer</div>
          <div style={val}>{manufacturer || <span style={dim}>—</span>}</div>
        </div>
        <div>
          <div style={CELL_LBL}>Part #</div>
          <div style={mono}>{docNumber || <span style={dim}>—</span>}</div>
        </div>
        <div>
          <div style={CELL_LBL}>Revision</div>
          <div style={mono}>{revision || <span style={dim}>—</span>}</div>
        </div>
        <div>
          <div style={CELL_LBL}>Dated</div>
          <div style={mono}>{revisionDate || <span style={dim}>—</span>}</div>
        </div>

        {/* Row 2 */}
        <div>
          <div style={CELL_LBL}>Applicability</div>
          <div style={{ ...val, fontStyle: applicability ? "italic" : "normal" }}>
            {applicability || <span style={dim}>—</span>}
          </div>
        </div>
        <div>
          <div style={CELL_LBL}>Manual</div>
          {hasLink ? (
            <a href={driveLink} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.8rem", color: "var(--skyshare-gold)", fontWeight: 600, fontFamily: "var(--font-heading)", letterSpacing: "0.06em", textDecoration: "none" }}>
              Open ↗
            </a>
          ) : (
            <div style={dim}>—</div>
          )}
        </div>
        <div style={{ gridColumn: "3 / -1" }}>
          <div style={CELL_LBL}>Notes</div>
          <div style={{ ...val, fontStyle: notes ? "italic" : "normal" }}>
            {notes || <span style={dim}>—</span>}
          </div>
        </div>

      </div>

      {/* ── Applies-to badges (group CMMs only) ── */}
      {groupBadges && groupBadges.length > 0 && (
        <div style={{ paddingLeft: 15, marginTop: 9 }}>
          <div style={{ ...CELL_LBL, marginBottom: 5 }}>Applies to</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {groupBadges.map(g => (
              <span key={g} style={{
                fontSize: "0.62rem", padding: "2px 8px", borderRadius: 3,
                background: "rgba(212,160,23,0.09)", color: "var(--skyshare-gold)",
                border: "0.5px solid rgba(212,160,23,0.2)",
                fontFamily: "var(--font-heading)", letterSpacing: "0.05em", whiteSpace: "nowrap",
              }}>
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── CMM structured form — shared for add + edit group ────────────────────────
// Must be defined at module level (not inside CMMsOverlay) to keep a stable
// component identity across renders, so inputs don't lose focus on every keystroke.
function CMMForm({
  form, setForm, groups, toggleGroup, scopeHeader, onSave, onCancel, saving, saveError,
}: {
  form: typeof BLANK_GROUP_CMM
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK_GROUP_CMM>>
  groups: string[] | undefined
  toggleGroup: (name: string) => void
  scopeHeader: React.ReactNode
  onSave: () => void
  onCancel: () => void
  saving: boolean
  saveError?: string | null
}) {
  return (
    <div className="rounded-lg p-5 flex flex-col gap-4"
      style={{ border: "1px solid rgba(212,160,23,0.35)", background: "rgba(212,160,23,0.03)" }}>
      {scopeHeader}

      {/* Row 1: Manufacturer · Doc # · ATA · Revision · Rev Date */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))" }}>
        <div>
          {fldLbl("Manufacturer")}
          <EditInput value={form.manufacturer} onChange={v => setForm(f => ({ ...f, manufacturer: v }))}
            placeholder="e.g. Goodrich Corporation" />
        </div>
        <div>
          {fldLbl("Doc / Part #")}
          <EditInput value={form.docNumber} onChange={v => setForm(f => ({ ...f, docNumber: v }))}
            placeholder="e.g. 2-1559" mono small />
        </div>
        <div>
          {fldLbl("ATA Chapter")}
          <EditInput value={form.ataChapter} onChange={v => setForm(f => ({ ...f, ataChapter: v }))}
            placeholder="e.g. 21-00-08" mono small />
        </div>
        <div>
          {fldLbl("Revision")}
          <EditInput value={form.revision} onChange={v => setForm(f => ({ ...f, revision: v }))}
            placeholder="e.g. 5" mono small />
        </div>
        <div>
          {fldLbl("Revision Date")}
          <EditInput value={form.revisionDate} onChange={v => setForm(f => ({ ...f, revisionDate: v }))}
            placeholder="e.g. Dec 13/18" mono small />
        </div>
      </div>

      {/* Row 2: Title · Applicability */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          {fldLbl("Title / Description")}
          <EditInput value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))}
            placeholder="e.g. Air Conditioning System Components" />
        </div>
        <div>
          {fldLbl("Applicability")}
          <EditInput value={form.applicability} onChange={v => setForm(f => ({ ...f, applicability: v }))}
            placeholder="e.g. Cessna 525 A/B (CJ2/3)" />
        </div>
      </div>

      {/* Row 3: Drive Link · Notes */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          {fldLbl("Drive Link")}
          <EditInput value={form.driveLink} onChange={v => setForm(f => ({ ...f, driveLink: v }))}
            placeholder="https://drive.google.com/..." />
        </div>
        <div>
          {fldLbl("Notes (optional)")}
          <EditInput value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))}
            placeholder="Any special note for techs" />
        </div>
      </div>

      {/* Group family checkboxes — hidden for aircraft-specific scope */}
      {groups !== undefined && (
        <div>
          {fldLbl("Applicable to fleet families")}
          <div className="grid gap-1.5 mt-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
            {FLEET_FAMILY_NAMES.map(name => {
              const checked = groups.includes(name)
              return (
                <button key={name} type="button" onClick={() => toggleGroup(name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", textAlign: "left", cursor: "pointer",
                    border: checked ? "1px solid rgba(212,160,23,0.45)" : "0.5px solid hsl(var(--border))",
                    borderRadius: 5,
                    background: checked ? "rgba(212,160,23,0.1)" : "transparent",
                  }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    border: checked ? "none" : "1px solid hsl(var(--border))",
                    background: checked ? "var(--skyshare-gold)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {checked && <span style={{ color: "#1a1400", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </span>
                  <span style={{
                    fontSize: "0.72rem",
                    color: checked ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                    fontFamily: "var(--font-heading)", letterSpacing: "0.04em",
                  }}>
                    {name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {saveError && (
        <div style={{ fontSize: "0.75rem", color: "rgb(220,38,38)", background: "rgba(220,38,38,0.07)", border: "0.5px solid rgba(220,38,38,0.3)", borderRadius: 4, padding: "6px 10px" }}>
          Save failed: {saveError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded"
          style={{ color: "hsl(var(--muted-foreground))", border: "0.5px solid hsl(var(--border))", fontFamily: "var(--font-heading)" }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={saving}
          className="text-xs px-3 py-1.5 rounded font-semibold"
          style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", border: "none",
            fontFamily: "var(--font-heading)", letterSpacing: "0.06em", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Document"}
        </button>
      </div>
    </div>
  )
}

// ── ATA chapter section header ────────────────────────────────────────────────
function AtaHeader({ ataKey, count }: { ataKey: string; count: number }) {
  return (
    <div className="flex items-center gap-3 pb-2">
      <span className="text-xs font-semibold px-2 py-0.5 rounded font-mono"
        style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", letterSpacing: "0.06em", flexShrink: 0 }}>
        ATA {ataKey}
      </span>
      <span className="text-xs uppercase tracking-widest"
        style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.55, letterSpacing: "0.1em" }}>
        {ataName(ataKey)}
      </span>
      <span style={{ flex: 1, height: "0.5px", background: "hsl(var(--border))" }} />
      <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, fontFamily: "var(--font-heading)" }}>
        {count} doc{count !== 1 ? "s" : ""}
      </span>
    </div>
  )
}

function CMMsOverlay({
  initialCmms,
  tailNumber,
  familyGroup,
  canDelete,
  onClose,
}: {
  initialCmms: CMMDocument[]
  tailNumber: string
  familyGroup: string | null
  canDelete: boolean
  onClose: () => void
}) {
  const [visible,       setVisible]       = useState(false)
  const [acCmms,        setAcCmms]        = useState<CMMDocument[]>(initialCmms)
  const [search,        setSearch]        = useState("")
  const [adding,        setAdding]        = useState(false)
  const [addScope,      setAddScope]      = useState<AddScope>("group")
  const [addForm,       setAddForm]       = useState<typeof BLANK_GROUP_CMM>({ ...BLANK_GROUP_CMM, groups: familyGroup ? [familyGroup] : [] })
  const [editingAcIdx,  setEditingAcIdx]  = useState<number | null>(null)
  const [editAcForm,    setEditAcForm]    = useState<CMMDocument>(BLANK_CMM)
  const [editingGrpId,  setEditingGrpId]  = useState<string | null>(null)
  const [editGrpForm,   setEditGrpForm]   = useState<typeof BLANK_GROUP_CMM>({ ...BLANK_GROUP_CMM })
  const [acDirty,       setAcDirty]       = useState(false)
  const [acSaving,      setAcSaving]      = useState(false)
  const [acSaveOk,      setAcSaveOk]      = useState(false)
  const [grpSaving,     setGrpSaving]     = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)

  const { data: groupCmms = [], isLoading: grpLoading } = useGroupCMMs(familyGroup)
  const updateAcCMMs  = useUpdateCMMs()
  const upsertGrpCMM  = useUpsertGroupCMM()
  const deleteGrpCMM  = useDeleteGroupCMM()

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 220) }

  // ── Aircraft-specific CMM handlers ──────────────────────────────────────────
  function removeAcCmm(idx: number) {
    setAcCmms(prev => prev.filter((_, i) => i !== idx))
    setAcDirty(true)
  }

  function startEditAc(idx: number) {
    setEditingAcIdx(idx)
    setEditAcForm({ ...acCmms[idx] })
    setAdding(false)
  }

  function saveEditAc() {
    if (editingAcIdx === null) return
    setAcCmms(prev => prev.map((c, i) => i === editingAcIdx ? { ...editAcForm } : c))
    setEditingAcIdx(null)
    setAcDirty(true)
  }

  async function handleAcSave() {
    setAcSaving(true)
    try {
      await updateAcCMMs.mutateAsync({ tailNumber, cmms: acCmms })
      setAcDirty(false)
      setAcSaveOk(true)
      setTimeout(() => setAcSaveOk(false), 3000)
    } finally {
      setAcSaving(false)
    }
  }

  // ── Group CMM handlers (immediate save) ─────────────────────────────────────
  async function addGroupOrAcCmm() {
    if (!addForm.docNumber.trim() && !addForm.title.trim()) {
      setSaveError("Doc / Part # or Title is required.")
      return
    }
    setSaveError(null)
    setGrpSaving(true)
    try {
      if (addScope === "group") {
        const newId = crypto.randomUUID()
        await upsertGrpCMM.mutateAsync({ ...addForm, id: newId })
      } else {
        const newAcCmm: CMMDocument = {
          ataChapter:    addForm.ataChapter,
          title:         addForm.title,
          manufacturer:  addForm.manufacturer,
          docNumber:     addForm.docNumber,
          revision:      addForm.revision,
          revisionDate:  addForm.revisionDate,
          applicability: addForm.applicability,
          driveLink:     addForm.driveLink,
          notes:         addForm.notes,
        }
        setAcCmms(prev => [...prev, newAcCmm])
        setAcDirty(true)
      }
      setAddForm({ ...BLANK_GROUP_CMM, groups: familyGroup ? [familyGroup] : [] })
      setAdding(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setGrpSaving(false)
    }
  }

  function startEditGrp(cmm: GroupCMM) {
    setEditingGrpId(cmm.id)
    setEditGrpForm({
      manufacturer: cmm.manufacturer, docNumber: cmm.docNumber, ataChapter: cmm.ataChapter,
      revision: cmm.revision, revisionDate: cmm.revisionDate, title: cmm.title,
      applicability: cmm.applicability, driveLink: cmm.driveLink, notes: cmm.notes, groups: cmm.groups,
    })
    setAdding(false)
  }

  async function saveEditGrp() {
    if (!editingGrpId) return
    setSaveError(null)
    setGrpSaving(true)
    try {
      await upsertGrpCMM.mutateAsync({ ...editGrpForm, id: editingGrpId })
      setEditingGrpId(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setGrpSaving(false)
    }
  }

  async function deleteGrp(id: string) {
    setGrpSaving(true)
    try {
      await deleteGrpCMM.mutateAsync(id)
    } finally {
      setGrpSaving(false)
    }
  }

  // ── Search filtering ─────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase()
  const filteredGrp = q
    ? groupCmms.filter(c =>
        c.title.toLowerCase().includes(q) || c.manufacturer.toLowerCase().includes(q) ||
        c.ataChapter.includes(q) || c.docNumber.toLowerCase().includes(q))
    : groupCmms
  const filteredAc = q
    ? acCmms.filter(c =>
        (c.title ?? c.component ?? "").toLowerCase().includes(q) ||
        c.ataChapter.includes(q) || c.docNumber.toLowerCase().includes(q))
    : acCmms

  const { map: grpMap, keys: grpKeys } = groupByAta(filteredGrp)
  const { map: acMap,  keys: acKeys  } = groupByAta(filteredAc)

  // ── Group checkbox toggler ───────────────────────────────────────────────────
  function toggleAddGroup(name: string) {
    setAddForm(f => ({
      ...f,
      groups: f.groups.includes(name) ? f.groups.filter(g => g !== name) : [...f.groups, name],
    }))
  }
  function toggleEditGrpGroup(name: string) {
    setEditGrpForm(f => ({
      ...f,
      groups: f.groups.includes(name) ? f.groups.filter(g => g !== name) : [...f.groups, name],
    }))
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "hsl(var(--background))", overflowY: "auto", overflowX: "hidden",
      opacity: visible ? 1 : 0,
      transform: visible ? "scale(1)" : "scale(0.97)",
      transition: "opacity 0.2s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1) 0.04s",
        minHeight: "100%", display: "flex", flexDirection: "column",
      }}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 flex-wrap"
          style={{ background: "hsl(var(--topbar-bg))", borderBottom: "1px solid hsl(var(--topbar-border))", boxShadow: "0 1px 0 0 rgba(212,160,23,0.06)" }}>

          <button onClick={handleClose}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded flex-shrink-0 transition-colors"
            style={{ background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)", border: "0.5px solid rgba(212,160,23,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
            ← {tailNumber}
          </button>
          <div style={{ width: 1, height: 18, background: "hsl(var(--border))", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", letterSpacing: "0.1em", color: "var(--skyshare-gold)", flexShrink: 0 }}>
            CMMs
          </span>
          <span className="text-xs hidden sm:inline" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
            Component Maintenance Manuals
          </span>
          {familyGroup && (
            <span className="text-xs px-2 py-0.5 rounded"
              style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
              {familyGroup}
            </span>
          )}

          {/* Search */}
          <div className="flex-1 min-w-[140px] max-w-xs ml-auto">
            <input type="search" placeholder="Search title, ATA, doc #…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", background: "rgba(255,255,255,0.04)",
                border: "0.5px solid hsl(var(--border))", borderRadius: 4,
                color: "hsl(var(--foreground))", fontSize: "0.75rem",
                fontFamily: "var(--font-body)", padding: "4px 10px", outline: "none",
              }}
            />
          </div>

          {/* Save notice */}
          {acSaveOk && (
            <span className="text-xs px-2 py-1 rounded flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.12)", color: "var(--skyshare-success)", fontFamily: "var(--font-heading)" }}>
              Saved ✓
            </span>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {acDirty && (
              <button onClick={handleAcSave} disabled={acSaving}
                className="text-xs px-3 py-1.5 rounded transition-colors"
                style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", border: "none", fontFamily: "var(--font-heading)", letterSpacing: "0.06em", fontWeight: 600, opacity: acSaving ? 0.6 : 1 }}>
                {acSaving ? "Saving…" : "Save CMMs"}
              </button>
            )}
            <button
              onClick={() => { setAdding(true); setEditingAcIdx(null); setEditingGrpId(null); setSaveError(null); setAddForm({ ...BLANK_GROUP_CMM, groups: familyGroup ? [familyGroup] : [] }) }}
              className="text-xs px-2.5 py-1.5 rounded transition-colors"
              style={{ background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)", border: "0.5px solid rgba(212,160,23,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.16)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
              + Add
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 p-6" style={{ flex: 1 }}>

          {/* Add form */}
          {adding && (
            <CMMForm
              form={addForm}
              setForm={setAddForm}
              groups={addScope === "group" ? addForm.groups : undefined as unknown as string[]}
              toggleGroup={toggleAddGroup}
              saving={grpSaving}
              saveError={saveError}
              onCancel={() => { setAdding(false); setSaveError(null) }}
              onSave={addGroupOrAcCmm}
              scopeHeader={
                <div className="flex items-center gap-1 pb-1">
                  {(["group", "aircraft"] as AddScope[]).map(scope => (
                    <button key={scope} type="button" onClick={() => setAddScope(scope)}
                      style={{
                        fontSize: "0.7rem", fontFamily: "var(--font-heading)", letterSpacing: "0.08em",
                        padding: "4px 14px", borderRadius: "4px 4px 0 0", cursor: "pointer",
                        border: "0.5px solid rgba(212,160,23,0.3)",
                        borderBottom: addScope === scope ? "none" : "0.5px solid rgba(212,160,23,0.3)",
                        background: addScope === scope ? "rgba(212,160,23,0.12)" : "transparent",
                        color: addScope === scope ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                        fontWeight: addScope === scope ? 600 : 400,
                      }}>
                      {scope === "group" ? "Group CMM" : "Aircraft-specific"}
                    </button>
                  ))}
                </div>
              }
            />
          )}

          {/* ── GROUP CMMs section ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest"
                style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", letterSpacing: "0.14em" }}>
                Group CMMs
              </span>
              <span style={{ flex: 1, height: "0.5px", background: "linear-gradient(to right, rgba(212,160,23,0.3), transparent)" }} />
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, fontFamily: "var(--font-heading)" }}>
                {grpLoading ? "…" : `${groupCmms.length} shared`}
              </span>
            </div>

            {grpLoading && (
              <div className="text-xs text-center py-8" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, fontFamily: "var(--font-heading)" }}>
                Loading…
              </div>
            )}

            {!grpLoading && groupCmms.length === 0 && (
              <div className="text-xs italic py-5 text-center" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                No group CMMs for {familyGroup ?? "this family"} yet.
              </div>
            )}

            {grpKeys.map(ataKey => (
              <div key={ataKey} className="flex flex-col gap-0 mb-5">
                <AtaHeader ataKey={ataKey} count={grpMap[ataKey].length} />
                <div className="rounded-lg overflow-hidden" style={{ border: "0.5px solid rgba(212,160,23,0.15)" }}>
                  {grpMap[ataKey].map((doc, rowIdx) => {
                    const isEditing = editingGrpId === doc.id
                    const rowBorder = rowIdx < grpMap[ataKey].length - 1 ? "0.5px solid hsl(var(--border))" : "none"
                    const rowBg = rowIdx % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--background))"

                    if (isEditing) {
                      return (
                        <div key={doc.id} style={{ borderBottom: rowBorder }}>
                          <CMMForm
                            form={editGrpForm}
                            setForm={setEditGrpForm}
                            groups={editGrpForm.groups}
                            toggleGroup={toggleEditGrpGroup}
                            saving={grpSaving}
                            saveError={saveError}
                            onCancel={() => { setEditingGrpId(null); setSaveError(null) }}
                            onSave={saveEditGrp}
                            scopeHeader={
                              <div className="text-xs font-semibold uppercase tracking-widest"
                                style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
                                Edit Group CMM
                              </div>
                            }
                          />
                        </div>
                      )
                    }
                    return (
                      <CMMRow key={doc.id}
                        title={doc.title} manufacturer={doc.manufacturer}
                        docNumber={doc.docNumber} revision={doc.revision}
                        revisionDate={doc.revisionDate} applicability={doc.applicability}
                        hasLink={!!doc.driveLink} driveLink={doc.driveLink}
                        notes={doc.notes}
                        groupBadges={doc.groups}
                        canDelete={canDelete}
                        onEdit={() => startEditGrp(doc)}
                        onRemove={canDelete ? () => deleteGrp(doc.id) : undefined}
                        border={rowBorder} bg={rowBg}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Section divider ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <span style={{ flex: 1, height: "0.5px", background: "hsl(var(--border))" }} />
            <span className="text-xs uppercase tracking-widest"
              style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--muted-foreground))", opacity: 0.35, letterSpacing: "0.12em" }}>
              Aircraft-specific
            </span>
            <span style={{ flex: 1, height: "0.5px", background: "hsl(var(--border))" }} />
          </div>

          {/* ── AIRCRAFT-SPECIFIC CMMs section ──────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest"
                style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--muted-foreground))", letterSpacing: "0.14em", opacity: 0.7 }}>
                {tailNumber}
              </span>
              <span style={{ flex: 1, height: "0.5px", background: "hsl(var(--border))" }} />
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, fontFamily: "var(--font-heading)" }}>
                {acCmms.length} aircraft-specific
              </span>
            </div>

            {acCmms.length === 0 && (
              <div className="text-xs italic py-5 text-center" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                No aircraft-specific CMMs. Use + Add → Aircraft-specific to add one.
              </div>
            )}

            {q && filteredAc.length === 0 && acCmms.length > 0 && (
              <div className="text-sm text-center py-6" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>
                No aircraft CMMs match "{search}"
              </div>
            )}

            {acKeys.map(ataKey => (
              <div key={ataKey} className="flex flex-col gap-0 mb-5">
                <AtaHeader ataKey={ataKey} count={acMap[ataKey].length} />
                <div className="rounded-lg overflow-hidden" style={{ border: "0.5px solid rgba(212,160,23,0.12)" }}>
                  {acMap[ataKey].map((doc, rowIdx) => {
                    const globalIdx = acCmms.indexOf(doc)
                    const isEditing = editingAcIdx === globalIdx
                    const rowBorder = rowIdx < acMap[ataKey].length - 1 ? "0.5px solid hsl(var(--border))" : "none"
                    const rowBg = rowIdx % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--background))"

                    if (isEditing) {
                      return (
                        <div key={rowIdx} className="px-4 py-4 flex flex-col gap-3"
                          style={{ borderBottom: rowBorder, background: "rgba(212,160,23,0.04)" }}>
                          <div className="text-xs font-semibold uppercase tracking-widest"
                            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
                            Edit Entry
                          </div>
                          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))" }}>
                            {([
                              { key: "manufacturer", label: "Manufacturer",  ph: "e.g. Goodrich Corporation", mono: false },
                              { key: "docNumber",    label: "Doc / Part #",  ph: "e.g. 2-1559",              mono: true  },
                              { key: "ataChapter",   label: "ATA Chapter",   ph: "e.g. 21-00-08",            mono: true  },
                              { key: "revision",     label: "Revision",      ph: "e.g. 5",                   mono: true  },
                              { key: "revisionDate", label: "Revision Date", ph: "e.g. Dec 13/18",           mono: true  },
                            ] as const).map(({ key, label, ph, mono }) => (
                              <div key={key}>
                                {fldLbl(label)}
                                <EditInput
                                  value={(editAcForm[key] as string | undefined) ?? ""}
                                  onChange={v => setEditAcForm(f => ({ ...f, [key]: v }))}
                                  placeholder={ph} mono={mono} small
                                />
                              </div>
                            ))}
                          </div>
                          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <div>
                              {fldLbl("Title / Description")}
                              <EditInput value={editAcForm.title ?? ""} onChange={v => setEditAcForm(f => ({ ...f, title: v }))}
                                placeholder="e.g. Air Conditioning System Components" />
                            </div>
                            <div>
                              {fldLbl("Applicability")}
                              <EditInput value={editAcForm.applicability ?? ""} onChange={v => setEditAcForm(f => ({ ...f, applicability: v }))}
                                placeholder="e.g. Cessna 525 A/B" />
                            </div>
                          </div>
                          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <div>
                              {fldLbl("Drive Link")}
                              <EditInput value={editAcForm.driveLink} onChange={v => setEditAcForm(f => ({ ...f, driveLink: v }))}
                                placeholder="https://drive.google.com/..." />
                            </div>
                            <div>
                              {fldLbl("Notes (optional)")}
                              <EditInput value={editAcForm.notes ?? ""} onChange={v => setEditAcForm(f => ({ ...f, notes: v }))}
                                placeholder="Any special note for techs" />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={() => setEditingAcIdx(null)}
                              className="text-xs px-3 py-1.5 rounded"
                              style={{ color: "hsl(var(--muted-foreground))", border: "0.5px solid hsl(var(--border))", fontFamily: "var(--font-heading)" }}>
                              Cancel
                            </button>
                            <button onClick={saveEditAc}
                              className="text-xs px-3 py-1.5 rounded font-semibold"
                              style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", border: "none", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
                              Save Entry
                            </button>
                          </div>
                        </div>
                      )
                    }

                    const displayTitle = doc.title || doc.component || "—"
                    return (
                      <CMMRow key={rowIdx}
                        title={displayTitle} manufacturer={doc.manufacturer}
                        docNumber={doc.docNumber} revision={doc.revision}
                        revisionDate={doc.revisionDate} applicability={doc.applicability}
                        hasLink={!!doc.driveLink} driveLink={doc.driveLink}
                        notes={doc.notes}
                        canDelete={canDelete}
                        onEdit={() => startEditAc(globalIdx)}
                        onRemove={canDelete ? () => removeAcCmm(globalIdx) : undefined}
                        border={rowBorder} bg={rowBg}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer count */}
          {(groupCmms.length > 0 || acCmms.length > 0) && (
            <div className="text-xs text-center pt-2 pb-4"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3, fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
              {groupCmms.length} group · {acCmms.length} aircraft-specific
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Documentation Card ───────────────────────────────────────────────────────
function DocumentationCard({
  fields,
  tailNumber,
  cmms,
  familyGroup,
  canDelete,
  canEdit,
  onEdit,
}: {
  fields: DataField[]
  tailNumber: string
  cmms: CMMDocument[]
  familyGroup: string | null
  canDelete: boolean
  canEdit: boolean
  onEdit: () => void
}) {
  const [showCMMs, setShowCMMs] = useState(false)

  return (
    <>
      {showCMMs && (
        <CMMsOverlay
          initialCmms={cmms}
          tailNumber={tailNumber}
          familyGroup={familyGroup}
          canDelete={canDelete}
          onClose={() => setShowCMMs(false)}
        />
      )}

      <div className="card-elevated rounded-lg flex flex-col">

          {/* Card header — title left · CMMs center · Edit right, all on the same baseline */}
          <div className="px-5 pt-4 pb-2.5 flex items-center"
            style={{ borderBottom: "1px solid rgba(212,160,23,0.18)", gap: 12 }}>

            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", letterSpacing: "0.14em", flexShrink: 0 }}>
              Documentation &amp; Manuals
            </span>

            {/* CMMs — centered between title and Edit, filled gold, lowercase s preserved */}
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => setShowCMMs(true)}
                style={{
                  padding: "5px 18px",
                  background: "var(--skyshare-gold)",
                  border: "none",
                  borderRadius: "5px",
                  color: "hsl(0 0% 8%)",
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                CMMs <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>↗</span>
              </button>
            </div>

            {canEdit && (
              <button
                onClick={onEdit}
                className="text-xs px-2.5 py-1 rounded"
                style={{
                  background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)",
                  border: "0.5px solid rgba(212,160,23,0.3)", flexShrink: 0,
                  fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
                Edit
              </button>
            )}
          </div>

        <div className="px-5 py-1">
          {fields.map((f, i) => {
            const s        = fieldStatus(f.value)
            const href     = f.link || (f.value.startsWith("http") ? f.value : null)
            const isOnFile = !!href || (s === "enrolled" && !f.value.startsWith("None"))
            return (
              <div key={i} className="py-2.5" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
                <div className="flex items-center gap-3">
                  <StatusDot value={isOnFile ? "active" : f.value} size={8} />
                  <span className="text-sm flex-1"
                    style={{
                      color: s === "enrolled" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                      opacity: s === "enrolled" ? 1 : 0.55,
                    }}>
                    {f.label}
                  </span>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-xs"
                      style={{ color: "var(--skyshare-gold)", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                      Open ↗
                    </a>
                  )}
                  {!href && s === "none" && (
                    <span className="text-xs italic" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>N/A</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>   {/* card-elevated */}
    </>
  )
}

// ─── Identity Card ────────────────────────────────────────────────────────────
function IdentityCard({ identity, canEdit, onEdit }: {
  identity: DataField[]
  canEdit: boolean
  onEdit: () => void
}) {
  const mainFields = identity.filter(f => !f.label.toLowerCase().includes("key"))
  const keyFields  = identity.filter(f =>  f.label.toLowerCase().includes("key"))

  const editButton = canEdit ? (
    <button onClick={onEdit}
      className="text-xs px-2.5 py-1 rounded"
      style={{ background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)", border: "0.5px solid rgba(212,160,23,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
      Edit
    </button>
  ) : null

  return (
    <Card title="Identity &amp; Operations" headerAction={editButton}>
      <div className="grid grid-cols-2 gap-x-8">
        {mainFields.map(f => <FieldRow key={f.label} {...f} />)}
      </div>
      {keyFields.length > 0 && (
        <>
          <InCardDivider label="Keys" />
          <div className="grid grid-cols-2 gap-x-8">
            {keyFields.map(f => <FieldRow key={f.label} {...f} />)}
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Notes ────────────────────────────────────────────────────────────────────
function NotesSection({
  notes: initialNotes,
  canEdit,
  onSave,
}: {
  notes: string
  canEdit: boolean
  onSave: (notes: string) => Promise<void>
}) {
  const [open,    setOpen]    = useState(!!initialNotes)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(initialNotes)
  const [display, setDisplay] = useState(initialNotes)
  const [saving,  setSaving]  = useState(false)

  // Sync display when prop updates (after refetch), but don't discard an active draft
  useEffect(() => {
    if (!editing) { setDisplay(initialNotes); setDraft(initialNotes) }
  }, [initialNotes]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      setDisplay(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ border: "0.5px solid rgba(212,160,23,0.15)" }}>
      <button className="w-full flex items-center justify-between px-5 py-3 text-left"
        style={{ background: "hsl(var(--card))", borderBottom: open ? "0.5px solid hsl(var(--border))" : "none" }}
        onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", letterSpacing: "0.14em" }}>
          Notes &amp; References
        </span>
        <span style={{ color: "hsl(var(--muted-foreground))", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", fontSize: "0.7rem" }}>
          ▲
        </span>
      </button>
      {open && (
        <div className="px-5 py-4 flex flex-col gap-3" style={{ background: "hsl(var(--card))" }}>
          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Add notes visible to all users…"
                rows={4}
                style={{
                  width: "100%",
                  background: "rgba(212,160,23,0.04)",
                  border: "none",
                  borderBottom: "1px solid rgba(212,160,23,0.5)",
                  borderRadius: "2px 2px 0 0",
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  padding: "6px 8px",
                  outline: "none",
                  resize: "vertical",
                  minHeight: 80,
                }}
                onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}
              />
              <div className="flex items-center gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="text-xs px-3 py-1 rounded"
                  style={{
                    background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", border: "none",
                    fontFamily: "var(--font-heading)", fontWeight: 600,
                    opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
                  }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => { setEditing(false); setDraft(display) }}
                  className="text-xs px-3 py-1 rounded"
                  style={{
                    background: "transparent", color: "hsl(var(--muted-foreground))",
                    border: "0.5px solid hsl(var(--border))",
                    fontFamily: "var(--font-heading)", cursor: "pointer",
                  }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm"
                style={{
                  color: display ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  fontStyle: display ? "normal" : "italic",
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  opacity: display ? 1 : 0.45,
                }}>
                {display || "No notes on file. Notes entered here are visible to all users."}
              </p>
              {canEdit && (
                <button onClick={() => { setDraft(display); setEditing(true) }}
                  className="text-xs self-start px-2.5 py-1 rounded"
                  style={{
                    background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)",
                    border: "0.5px solid rgba(212,160,23,0.3)",
                    fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
                  Edit Notes
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Hero stats bar ───────────────────────────────────────────────────────────
function HeroStatsBar({ identity }: { identity: DataField[] }) {
  const cert    = getField(identity, "Operating Certificate")
  const company = getField(identity, "Operating Company")
  const hangar  = getField(identity, "Primary Hangar")

  const allItems = [
    { label: "CERT",   value: cert?.value    ?? "—" },
    { label: "OPER",   value: company?.value ?? "—" },
    { label: "HANGAR", value: hangar?.value  ?? "—" },
  ]
  const items = allItems.filter(item => item.value !== "—" && item.value !== "")

  if (!items.length) return null

  return (
    <div style={{
      fontFamily: "'Courier Prime','Courier New',monospace",
      fontSize: 12,
      color: "hsl(var(--muted-foreground))",
      opacity: 0.7,
      marginTop: 6,
      marginBottom: 2,
      lineHeight: 1.6,
    }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span style={{ opacity: 0.45, margin: "0 8px" }}>·</span>}
          <span style={{ opacity: 0.65 }}>{item.label} </span>
          <span style={{ color: "hsl(var(--foreground))", opacity: 0.85, fontWeight: 500 }}>{item.value}</span>
        </span>
      ))}
    </div>
  )
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
export default function AircraftDetailOverlay({ aircraft, detail: fallbackDetail, onClose }: Props) {
  const { profile } = useAuth()
  const isSuperAdmin   = profile?.role === "Super Admin"
  const canEditSection = isSuperAdmin || profile?.role === "Admin" || profile?.role === "Manager"
  const canDelete      = isSuperAdmin || profile?.role === "Admin"
  const familyGroup    = getAircraftFamily(aircraft.tailNumber)

  const { data: liveDetail } = useAircraftDetail(aircraft.tailNumber, fallbackDetail)
  const upsert = useUpsertAircraftDetail()
  const baseDetail = liveDetail ?? fallbackDetail

  const [visible,               setVisible]               = useState(false)
  const [showAvionicsEditor,    setShowAvionicsEditor]     = useState(false)
  const [showProgramsEditor,    setShowProgramsEditor]     = useState(false)
  const [showIdentityEditor,    setShowIdentityEditor]     = useState(false)
  const [showPropulsionEditor,     setShowPropulsionEditor]    = useState(false)
  const [showDocumentationEditor,  setShowDocumentationEditor] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const anyOverlayOpen = showAvionicsEditor || showProgramsEditor || showIdentityEditor || showPropulsionEditor || showDocumentationEditor

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Lock body scroll while overlay is open so only the overlay's scrollbar is visible.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !anyOverlayOpen) handleClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [anyOverlayOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() { setVisible(false); setTimeout(onClose, 220) }

  async function handleAvionicsSave(services: AvionicsService[]) {
    await upsert.mutateAsync({ tailNumber: aircraft.tailNumber, detail: { ...baseDetail, avionics: services } })
  }
  async function handleProgramsSave(programs: DataField[]) {
    await upsert.mutateAsync({ tailNumber: aircraft.tailNumber, detail: { ...baseDetail, programs } })
  }
  async function handleIdentitySave(identity: DataField[]) {
    await upsert.mutateAsync({ tailNumber: aircraft.tailNumber, detail: { ...baseDetail, identity } })
  }
  async function handlePropulsionSave(powerplant: DataField[], apu: DataField[] | null) {
    await upsert.mutateAsync({ tailNumber: aircraft.tailNumber, detail: { ...baseDetail, powerplant, apu } })
  }
  async function handleDocumentationSave(documentation: DataField[]) {
    await upsert.mutateAsync({ tailNumber: aircraft.tailNumber, detail: { ...baseDetail, documentation } })
  }
  async function handleNotesSave(notes: string) {
    await upsert.mutateAsync({ tailNumber: aircraft.tailNumber, detail: { ...baseDetail, notes } })
  }

  return (
    <>
      <div ref={overlayRef} style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "hsl(var(--background))", overflowY: "auto", overflowX: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.97)",
        transition: "opacity 0.2s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{
          transform: visible ? "translateY(0)" : "translateY(14px)",
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1) 0.04s",
          minHeight: "100%", display: "flex", flexDirection: "column",
        }}>

          {/* Sticky nav bar */}
          <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3"
            style={{
              background: "hsl(var(--topbar-bg))",
              borderBottom: "1px solid hsl(var(--topbar-border))",
              boxShadow: "0 1px 0 0 rgba(212,160,23,0.06)",
            }}>
            <button onClick={handleClose}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded transition-colors"
              style={{
                background: "rgba(212,160,23,0.08)",
                color: "var(--skyshare-gold)",
                border: "0.5px solid rgba(212,160,23,0.3)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.08em",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
              ← Fleet Directory
            </button>
            <div style={{ flex: 1 }} />
            {isSuperAdmin && (
              <button
                onClick={() => setShowPropulsionEditor(true)}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded transition-colors"
                style={{
                  background: "rgba(212,160,23,0.08)",
                  color: "var(--skyshare-gold)",
                  border: "0.5px solid rgba(212,160,23,0.3)",
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.08em",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
                Edit Hero Bar
              </button>
            )}
          </div>

          {/* Hero + Documentation — side by side */}
          <div className="px-6 pt-6 pb-5"
            style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", alignItems: "start" }}>

              {/* Left: identity & powerplant */}
              <div>
                <div className="flex items-center gap-5">
                  <h1 style={{
                    fontFamily: "var(--font-display)", fontSize: "2.6rem",
                    letterSpacing: "0.1em", color: "var(--skyshare-gold)",
                    lineHeight: 1, flexShrink: 0,
                  }}>
                    {aircraft.tailNumber}
                  </h1>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{
                      fontFamily: "var(--font-heading)", fontSize: "0.95rem",
                      fontWeight: 600, color: "hsl(var(--muted-foreground))",
                      letterSpacing: "0.08em",
                    }}>
                      {aircraft.model} · {aircraft.year}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-heading)", fontSize: "0.95rem",
                      fontWeight: 500, color: "hsl(var(--muted-foreground))",
                      letterSpacing: "0.08em", opacity: 0.65,
                    }}>
                      S/N {aircraft.serialNumber}
                    </span>
                  </div>
                </div>
                <HeroStatsBar identity={baseDetail.identity} />
                <PropulsionHeroStrip
                  powerplant={baseDetail.powerplant}
                  apu={baseDetail.apu}
                  aircraftNote={getField(baseDetail.identity, "Aircraft Note")?.value}
                />
              </div>

              {/* Right: Documentation & Manuals */}
              <DocumentationCard
                fields={baseDetail.documentation}
                tailNumber={aircraft.tailNumber}
                cmms={baseDetail.cmms ?? []}
                familyGroup={familyGroup}
                canDelete={canDelete}
                canEdit={canEditSection}
                onEdit={() => setShowDocumentationEditor(true)}
              />

            </div>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col gap-4">
            <AvionicsCard
              avionics={baseDetail.avionics}
              canEdit={canEditSection}
              onEdit={() => setShowAvionicsEditor(true)}
            />
            <ProgramsCard
              programs={baseDetail.programs}
              canEdit={canEditSection}
              onEdit={() => setShowProgramsEditor(true)}
            />
            <IdentityCard
              identity={baseDetail.identity}
              canEdit={canEditSection}
              onEdit={() => setShowIdentityEditor(true)}
            />
            <NotesSection
              notes={baseDetail.notes}
              canEdit={canEditSection}
              onSave={handleNotesSave}
            />
          </div>

        </div>
      </div>

      {showAvionicsEditor && (
        <AvionicsEditorOverlay
          initialServices={baseDetail.avionics}
          tailNumber={aircraft.tailNumber}
          onSave={handleAvionicsSave}
          onClose={() => setShowAvionicsEditor(false)}
        />
      )}
      {showProgramsEditor && (
        <ProgramsEditorOverlay
          initialPrograms={baseDetail.programs}
          tailNumber={aircraft.tailNumber}
          onSave={handleProgramsSave}
          onClose={() => setShowProgramsEditor(false)}
        />
      )}
      {showIdentityEditor && (
        <IdentityEditorOverlay
          initialIdentity={baseDetail.identity}
          tailNumber={aircraft.tailNumber}
          onSave={handleIdentitySave}
          onClose={() => setShowIdentityEditor(false)}
        />
      )}
      {showPropulsionEditor && (
        <PropulsionEditorOverlay
          initialPowerplant={baseDetail.powerplant}
          initialApu={baseDetail.apu}
          tailNumber={aircraft.tailNumber}
          onSave={handlePropulsionSave}
          onClose={() => setShowPropulsionEditor(false)}
        />
      )}
      {showDocumentationEditor && (
        <DocumentationEditorOverlay
          initialFields={baseDetail.documentation}
          tailNumber={aircraft.tailNumber}
          onSave={handleDocumentationSave}
          onClose={() => setShowDocumentationEditor(false)}
        />
      )}
    </>
  )
}
