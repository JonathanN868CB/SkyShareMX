import { useEffect, useState } from "react"
import { ArrowLeft, Trash2 } from "lucide-react"
import {
  useAircraftLibraryDocs,
  useSourceDocuments,
  useUpsertAircraftDocument,
  useDeleteAircraftDocument,
} from "@/features/mm-audit/useMmAuditData"

interface Props {
  aircraftId: string
  tailNumber: string
  canEdit: boolean
  onClose: () => void
}

const ASSEMBLY_TYPES = ["airframe", "engine", "apu", "propeller"] as const
const REQUIREMENT_TYPES = ["sched_mx", "awl"] as const

const ASSEMBLY_LABELS: Record<string, string> = {
  airframe: "Airframe",
  engine: "Engine",
  apu: "APU",
  propeller: "Propeller",
}

const ASSEMBLY_BADGE: Record<string, { bg: string; color: string }> = {
  airframe:  { bg: "rgba(70,100,129,0.18)",   color: "#7aa5c8" },
  engine:    { bg: "rgba(212,160,23,0.12)",    color: "rgba(212,160,23,0.85)" },
  apu:       { bg: "rgba(16,185,129,0.12)",    color: "#10b981" },
  propeller: { bg: "rgba(167,139,250,0.12)",   color: "#a78bfa" },
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(212,160,23,0.05)",
  border: "none",
  borderBottom: "1.5px solid rgba(212,160,23,0.4)",
  borderRadius: "3px 3px 0 0",
  color: "hsl(var(--foreground))",
  fontFamily: "var(--font-body)",
  outline: "none",
  fontSize: "0.875rem",
  padding: "7px 10px",
  colorScheme: "dark",
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontFamily: "var(--font-heading)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
  color: "var(--skyshare-gold)",
  opacity: 0.75,
  marginBottom: 5,
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
export default function DocumentationEditorOverlay({ aircraftId, tailNumber, canEdit, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  const { data: libraryDocs = [], isLoading: loadingDocs } = useAircraftLibraryDocs(aircraftId)
  const { data: sourceDocs = [], isLoading: loadingSources } = useSourceDocuments()
  const addLink    = useUpsertAircraftDocument()
  const removeLink = useDeleteAircraftDocument()

  // Add-manual form state
  const [addSourceDocId,      setAddSourceDocId]      = useState("")
  const [addAssemblyType,     setAddAssemblyType]     = useState<typeof ASSEMBLY_TYPES[number]>("airframe")
  const [addRequirementType,  setAddRequirementType]  = useState<typeof REQUIREMENT_TYPES[number]>("sched_mx")
  const [addSection,          setAddSection]          = useState("")
  const [addAssemblyDetail,   setAddAssemblyDetail]   = useState("")
  const [addError,            setAddError]            = useState("")
  const [removeErrors,        setRemoveErrors]        = useState<Record<string, string>>({})

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() { setVisible(false); setTimeout(onClose, 220) }

  // Source docs that aren't already linked to this aircraft
  const linkedSourceIds = new Set(libraryDocs.map(d => d.source_document_id))
  const availableDocs = sourceDocs.filter(d => !linkedSourceIds.has(d.id))

  async function handleAdd() {
    if (!addSourceDocId) { setAddError("Select a manual to link."); return }
    setAddError("")
    try {
      await addLink.mutateAsync({
        aircraft_id:       aircraftId,
        source_document_id: addSourceDocId,
        assembly_type:     addAssemblyType,
        requirement_type:  addRequirementType,
        section:           addSection.trim() || null,
        assembly_detail:   addAssemblyDetail.trim() || null,
        is_applicable:     true,
      })
      setAddSourceDocId("")
      setAddSection("")
      setAddAssemblyDetail("")
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add manual.")
    }
  }

  async function handleRemove(id: string) {
    setRemoveErrors(e => ({ ...e, [id]: "" }))
    try {
      await removeLink.mutateAsync(id)
    } catch (err) {
      setRemoveErrors(e => ({ ...e, [id]: err instanceof Error ? err.message : "Remove failed" }))
    }
  }

  function formatRevDate(d: string | null): string {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 55,
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

        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-4 px-8 py-4"
          style={{
            background: "hsl(0 0% 10%)",
            borderBottom: "1px solid rgba(212,160,23,0.4)",
            boxShadow: "0 1px 0 0 rgba(212,160,23,0.06)",
          }}>
          <button onClick={handleClose}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded"
            style={{
              background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)",
              border: "0.5px solid rgba(212,160,23,0.3)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.08em", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
            <ArrowLeft className="h-4 w-4" />
            {tailNumber}
          </button>
          <span className="text-sm font-semibold uppercase tracking-widest flex-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Documentation &amp; Manuals
          </span>
          <button onClick={handleClose}
            className="text-sm px-4 py-2 rounded"
            style={{
              background: "transparent", color: "hsl(var(--muted-foreground))",
              border: "0.5px solid hsl(var(--border))",
              fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer",
            }}>
            Done
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col gap-6" style={{ flex: 1, maxWidth: 780, width: "100%", margin: "0 auto" }}>

          {/* Linked manuals */}
          <div className="rounded-lg flex flex-col"
            style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(212,160,23,0.3)", overflow: "hidden" }}>
            <div className="px-8 py-5"
              style={{ borderBottom: "0.5px solid rgba(212,160,23,0.2)", background: "rgba(212,160,23,0.04)" }}>
              <div className="text-sm font-bold uppercase tracking-widest"
                style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.14em" }}>
                Linked Manuals
              </div>
              <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                Manuals linked from the compliance library for this aircraft. Changes sync automatically to audits.
              </p>
            </div>

            <div className="flex flex-col" style={{ padding: "0.5rem 0" }}>
              {loadingDocs ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded skeleton-gold" />
                  ))}
                </div>
              ) : libraryDocs.length === 0 ? (
                <div className="py-8 text-center">
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                    No manuals linked yet — add one below.
                  </p>
                </div>
              ) : (
                libraryDocs.map(doc => {
                  const badge = ASSEMBLY_BADGE[doc.assembly_type] ?? { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                  const note  = `${doc.document_number} · Rev ${doc.current_revision}${doc.current_rev_date ? " · " + formatRevDate(doc.current_rev_date) : ""}`
                  const errMsg = removeErrors[doc.id]

                  return (
                    <div key={doc.id}>
                      <div className="flex items-center gap-3 px-6 py-3"
                        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                        {/* Assembly badge */}
                        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                          style={{ fontFamily: "var(--font-heading)", background: badge.bg, color: badge.color }}>
                          {ASSEMBLY_LABELS[doc.assembly_type] ?? doc.assembly_type}
                        </span>

                        {/* Doc info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                            {doc.document_name}
                          </div>
                          <div className="text-xs mt-0.5"
                            style={{ color: "rgba(167,139,250,0.65)", fontFamily: "'Courier Prime','Courier New',monospace" }}>
                            {note}
                          </div>
                        </div>

                        {/* Remove button */}
                        {canEdit && (
                          <button
                            onClick={() => handleRemove(doc.id)}
                            disabled={removeLink.isPending}
                            className="flex-shrink-0 p-1.5 rounded transition-opacity hover:opacity-70"
                            style={{
                              background: "rgba(239,68,68,0.08)",
                              border: "0.5px solid rgba(239,68,68,0.25)",
                              color: "#f87171",
                              cursor: removeLink.isPending ? "not-allowed" : "pointer",
                            }}
                            title="Remove from this aircraft">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {errMsg && (
                        <div className="px-6 py-1 text-xs" style={{ color: "#f87171", background: "rgba(248,113,113,0.06)" }}>
                          {errMsg}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Add manual section — managers only */}
          {canEdit && (
            <div className="rounded-lg flex flex-col"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(167,139,250,0.25)", overflow: "hidden" }}>
              <div className="px-8 py-5"
                style={{ borderBottom: "0.5px solid rgba(167,139,250,0.15)", background: "rgba(167,139,250,0.04)" }}>
                <div className="text-sm font-bold uppercase tracking-widest"
                  style={{ color: "#a78bfa", fontFamily: "var(--font-heading)", letterSpacing: "0.14em" }}>
                  Link a Manual
                </div>
                <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                  Select a manual from the compliance library and classify it for this aircraft.
                </p>
              </div>

              <div className="p-6 flex flex-col gap-4">
                {/* Manual picker */}
                <div>
                  <div style={labelStyle}>Manual</div>
                  {loadingSources ? (
                    <div className="h-9 rounded skeleton-gold" />
                  ) : availableDocs.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
                      All compliance library manuals are already linked to this aircraft.
                    </p>
                  ) : (
                    <select
                      value={addSourceDocId}
                      onChange={e => setAddSourceDocId(e.target.value)}
                      style={selectStyle}>
                      <option value="" style={{ background: "hsl(0 0% 14%)" }}>— Select a manual —</option>
                      {availableDocs.map(d => (
                        <option key={d.id} value={d.id} style={{ background: "hsl(0 0% 14%)" }}>
                          {d.document_name} · Rev {d.current_revision} ({d.document_number})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Assembly type + Requirement type — side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <div>
                    <div style={labelStyle}>Assembly Type</div>
                    <select
                      value={addAssemblyType}
                      onChange={e => setAddAssemblyType(e.target.value as typeof ASSEMBLY_TYPES[number])}
                      style={selectStyle}>
                      {ASSEMBLY_TYPES.map(t => (
                        <option key={t} value={t} style={{ background: "hsl(0 0% 14%)" }}>
                          {ASSEMBLY_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>Requirement Type</div>
                    <select
                      value={addRequirementType}
                      onChange={e => setAddRequirementType(e.target.value as typeof REQUIREMENT_TYPES[number])}
                      style={selectStyle}>
                      <option value="sched_mx" style={{ background: "hsl(0 0% 14%)" }}>Scheduled MX</option>
                      <option value="awl"      style={{ background: "hsl(0 0% 14%)" }}>AWL</option>
                    </select>
                  </div>
                </div>

                {/* Section + Assembly detail — optional */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <div>
                    <div style={{ ...labelStyle, opacity: 0.5 }}>Section (optional)</div>
                    <input
                      value={addSection}
                      onChange={e => setAddSection(e.target.value)}
                      placeholder="e.g. Engine 1"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={{ ...labelStyle, opacity: 0.5 }}>Assembly Detail (optional)</div>
                    <input
                      value={addAssemblyDetail}
                      onChange={e => setAddAssemblyDetail(e.target.value)}
                      placeholder="e.g. PW306A S/N 12345"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Error + Add button */}
                <div className="flex items-center gap-3 justify-end pt-1">
                  {addError && (
                    <span className="text-xs px-3 py-1.5 rounded flex-1"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", fontFamily: "var(--font-heading)" }}>
                      {addError}
                    </span>
                  )}
                  <button
                    onClick={handleAdd}
                    disabled={addLink.isPending || availableDocs.length === 0}
                    className="text-sm px-5 py-2 rounded"
                    style={{
                      background: "rgba(167,139,250,0.12)",
                      color: "#a78bfa",
                      border: "1px solid rgba(167,139,250,0.3)",
                      fontFamily: "var(--font-heading)",
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                      opacity: (addLink.isPending || availableDocs.length === 0) ? 0.5 : 1,
                      cursor: (addLink.isPending || availableDocs.length === 0) ? "not-allowed" : "pointer",
                    }}>
                    {addLink.isPending ? "Linking…" : "Link Manual"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
