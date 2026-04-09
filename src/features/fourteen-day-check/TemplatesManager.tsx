// TemplatesManager.tsx
// Page for managing 14-Day Check inspection templates.
// Manager+ can create, copy, rename, and edit fields.
// Super Admin can delete templates.
// Aircraft assignment (which token uses which template) is per-checkbox.
// Rendered at /app/14-day-check/templates — not an overlay.

import { useState, useRef, useEffect, Fragment } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, format } from "date-fns"
import { useNavigate } from "react-router-dom"
import {
  X, Plus, Copy, Trash2, ChevronDown, ChevronUp, ArrowLeft,
  CheckSquare, Camera, Minus, Type, AlignLeft, Hash,
  GripVertical, FileText, Tag, RotateCcw, Save, UserCheck,
} from "lucide-react"
import {
  useTemplates,
  useTemplateAudit,
  useCreateTemplate,
  useCopyTemplate,
  useRenameTemplate,
  useUpdateTemplateFields,
  useDeleteTemplate,
  useAssignTemplate,
  useDeleteAuditEntry,
} from "@/hooks/useInspectionTemplates"
import type { InspectionCardTemplate, FieldDef, FieldType, TemplateAuditEntry } from "@/entities/supabase"
import { useFleetCheckSummaries, type AircraftCheckSummary } from "@/hooks/useFourteenDayChecks"
import { useAuth } from "@/features/auth"

// ─── Field type metadata ──────────────────────────────────────────────────────

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: "checkbox",  label: "Checklist item",  icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { type: "photo",     label: "Photo request",   icon: <Camera      className="w-3.5 h-3.5" /> },
  { type: "section",   label: "Section heading", icon: <Minus       className="w-3.5 h-3.5" /> },
  { type: "text",      label: "Text field",      icon: <Type        className="w-3.5 h-3.5" /> },
  { type: "textarea",  label: "Text area",       icon: <AlignLeft   className="w-3.5 h-3.5" /> },
  { type: "number",    label: "Number field",    icon: <Hash        className="w-3.5 h-3.5" /> },
]

function fieldTypeIcon(type: FieldType) {
  return FIELD_TYPES.find(f => f.type === type)?.icon ?? <FileText className="w-3.5 h-3.5" />
}

function fieldTypeLabel(type: FieldType) {
  return FIELD_TYPES.find(f => f.type === type)?.label ?? type
}

function genId() {
  return `field-${Math.random().toString(36).slice(2, 9)}`
}

function typeColorFor(type: FieldType): string {
  return type === "section"  ? "rgba(212,160,23,0.6)"
    : type === "photo"    ? "#60a5fa"
    : type === "checkbox" ? "#4ade80"
    : "rgba(255,255,255,0.35)"
}

// ─── Main page component ──────────────────────────────────────────────────────

export function TemplatesManager() {
  const navigate             = useNavigate()
  const { profile, user }    = useAuth()
  const isSuperAdmin         = profile?.role === "Super Admin"
  const isManagerOrAbove     = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"

  // Redirect non-managers immediately
  useEffect(() => {
    if (profile && !isManagerOrAbove) navigate("/app/14-day-check", { replace: true })
  }, [profile, isManagerOrAbove, navigate])

  const { data: fleet = [] }            = useFleetCheckSummaries()
  const { data: templates = [], isLoading } = useTemplates()
  const [selectedId, setSelectedId]     = useState<string | null>(null)

  const createTemplate  = useCreateTemplate()
  const copyTemplate    = useCopyTemplate()
  const deleteTemplate  = useDeleteTemplate()

  // Auto-select first template once loaded
  useEffect(() => {
    if (templates.length && !selectedId) setSelectedId(templates[0].id)
  }, [templates, selectedId])

  function actorName() {
    return profile?.display_name ?? profile?.avatar_initials ?? user?.email?.split("@")[0] ?? "Unknown"
  }

  async function handleNew() {
    if (!profile) return
    const id = await createTemplate.mutateAsync({
      name: "New Template",
      actorId: profile.id,
      actorName: actorName(),
    })
    setSelectedId(id)
  }

  async function handleCopy(source: InspectionCardTemplate) {
    if (!profile) return
    const id = await copyTemplate.mutateAsync({
      source,
      actorId: profile.id,
      actorName: actorName(),
    })
    setSelectedId(id)
  }

  async function handleDelete(id: string) {
    await deleteTemplate.mutateAsync(id)
    if (selectedId === id) setSelectedId(templates.find(t => t.id !== id)?.id ?? null)
  }

  const selected = templates.find(t => t.id === selectedId) ?? null

  if (!isManagerOrAbove) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 24px",
        background: "hsl(0 0% 10%)",
        borderBottom: "1px solid rgba(212,160,23,0.35)",
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate("/app/14-day-check")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 6, cursor: "pointer",
            background: "rgba(212,160,23,0.08)",
            border: "0.5px solid rgba(212,160,23,0.3)",
            color: "var(--skyshare-gold)",
            fontFamily: "var(--font-heading)", fontSize: "0.87rem", letterSpacing: "0.07em",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <span style={{
          flex: 1,
          fontFamily: "var(--font-heading)", fontSize: "0.97rem",
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--skyshare-gold)", fontWeight: 700,
        }}>
          Inspection Templates
        </span>

        {isManagerOrAbove && (
          <button
            onClick={handleNew}
            disabled={createTemplate.isPending}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 6, cursor: "pointer",
              background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)",
              border: "none", fontFamily: "var(--font-heading)",
              fontSize: "0.87rem", letterSpacing: "0.06em", fontWeight: 700,
              opacity: createTemplate.isPending ? 0.6 : 1,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* ── Left: template list ── */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.07)",
          overflowY: "auto",
          background: "rgba(0,0,0,0.2)",
        }}>
          {isLoading ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "0.87rem" }}>
              Loading…
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "0.87rem" }}>
              No templates yet.
            </div>
          ) : (
            templates.map(tpl => {
              const assignedCount = fleet.filter(a => a.templateId === tpl.id).length
              const isSelected = tpl.id === selectedId
              return (
                <TemplateListCard
                  key={tpl.id}
                  template={tpl}
                  assignedCount={assignedCount}
                  isSelected={isSelected}
                  isManagerOrAbove={isManagerOrAbove}
                  isSuperAdmin={isSuperAdmin}
                  onSelect={() => setSelectedId(tpl.id)}
                  onCopy={() => handleCopy(tpl)}
                  onDelete={() => handleDelete(tpl.id)}
                  deleteLoading={deleteTemplate.isPending}
                />
              )
            })
          )}
        </div>

        {/* ── Right: template detail ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
          {selected ? (
            <TemplateDetail
              key={selected.id}
              template={selected}
              fleet={fleet}
              isManagerOrAbove={isManagerOrAbove}
              isSuperAdmin={isSuperAdmin}
            />
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 12,
              color: "rgba(255,255,255,0.2)", textAlign: "center",
            }}>
              <FileText className="w-10 h-10" style={{ opacity: 0.3 }} />
              <p style={{ fontSize: "0.92rem" }}>Select a template to edit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Template list card (left sidebar) ────────────────────────────────────────

function TemplateListCard({
  template, assignedCount, isSelected, isManagerOrAbove, isSuperAdmin,
  onSelect, onCopy, onDelete, deleteLoading,
}: {
  template: InspectionCardTemplate
  assignedCount: number
  isSelected: boolean
  isManagerOrAbove: boolean
  isSuperAdmin: boolean
  onSelect: () => void
  onCopy: () => void
  onDelete: () => void
  deleteLoading: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fieldCount = template.field_schema.filter(f => f.type !== "section").length

  return (
    <div
      onClick={() => { onSelect(); setConfirmDelete(false) }}
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: "pointer",
        background: isSelected ? "rgba(212,160,23,0.08)" : "transparent",
        borderLeft: isSelected ? "2px solid rgba(212,160,23,0.7)" : "2px solid transparent",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent" }}
    >
      <p style={{
        fontSize: "0.89rem", fontWeight: 700,
        fontFamily: "var(--font-heading)", letterSpacing: "0.04em",
        color: isSelected ? "var(--skyshare-gold)" : "rgba(255,255,255,0.85)",
        marginBottom: 4,
      }}>
        {template.name}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "0.77rem", color: "rgba(255,255,255,0.3)" }}>
          {fieldCount} field{fieldCount !== 1 ? "s" : ""}
        </span>
        {assignedCount > 0 && (
          <span style={{
            fontSize: "0.73rem", padding: "1px 6px", borderRadius: 999,
            background: "rgba(212,160,23,0.15)", color: "rgba(212,160,23,0.8)",
            border: "1px solid rgba(212,160,23,0.25)",
          }}>
            {assignedCount} ac
          </span>
        )}
      </div>

      {/* Action row */}
      {isSelected && (
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}
          onClick={e => e.stopPropagation()}
        >
          {isManagerOrAbove && (
            <button
              onClick={onCopy}
              title="Copy template"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                fontSize: "0.77rem", fontFamily: "var(--font-heading)",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          )}

          {isSuperAdmin && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete template"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "rgba(239,68,68,0.6)",
                fontSize: "0.77rem", fontFamily: "var(--font-heading)",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,68,68,0.6)")}
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}

          {isSuperAdmin && confirmDelete && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.73rem", color: "#ef4444" }}>Confirm?</span>
              <button
                onClick={onDelete}
                disabled={deleteLoading}
                style={{
                  padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                  background: "#ef4444", color: "#fff", border: "none",
                  fontSize: "0.76rem", fontFamily: "var(--font-heading)", fontWeight: 700,
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                  background: "transparent", color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontSize: "0.76rem", fontFamily: "var(--font-heading)",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Template detail (right panel) ────────────────────────────────────────────

function TemplateDetail({
  template, fleet, isManagerOrAbove, isSuperAdmin,
}: {
  template: InspectionCardTemplate
  fleet: AircraftCheckSummary[]
  isManagerOrAbove: boolean
  isSuperAdmin: boolean
}) {
  const { profile, user }  = useAuth()
  const qc                 = useQueryClient()
  const renameTemplate     = useRenameTemplate()
  const deleteAuditEntry   = useDeleteAuditEntry(template.id)

  function actorName() {
    return profile?.display_name ?? profile?.avatar_initials ?? user?.email?.split("@")[0] ?? "Unknown"
  }
  const updateFields       = useUpdateTemplateFields()
  const assignTemplate     = useAssignTemplate()

  // Name editing
  const [editingName, setEditingName] = useState(false)
  const [draftName,   setDraftName]   = useState(template.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraftName(template.name)
    setEditingName(false)
  }, [template.id, template.name])

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  async function saveName() {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === template.name || !profile) {
      setDraftName(template.name)
      setEditingName(false)
      return
    }
    await renameTemplate.mutateAsync({
      id: template.id,
      name: trimmed,
      previousName: template.name,
      actorId: profile.id,
      actorName: actorName(),
    })
    setEditingName(false)
    qc.invalidateQueries({ queryKey: ["inspection_card_template_audit", template.id] })
  }

  // Field editing
  const [fields, setFields]           = useState<FieldDef[]>(template.field_schema)
  const [fieldsDirty, setFieldsDirty] = useState(false)
  const [savingFields, setSavingFields] = useState(false)
  const [fieldError, setFieldError]   = useState("")
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

  useEffect(() => {
    setFields(template.field_schema)
    setFieldsDirty(false)
    setEditingFieldId(null)
  }, [template.id, template.field_schema])

  function addField(type: FieldType) {
    const newField: FieldDef = {
      id: genId(),
      label: type === "section" ? "NEW SECTION" : type === "photo" ? "Photo" : "New item",
      type,
      required: type !== "section",
    }
    const updated = [...fields, newField]
    setFields(updated)
    setFieldsDirty(true)
    setEditingFieldId(newField.id)
  }

  function deleteField(id: string) {
    setFields(f => f.filter(x => x.id !== id))
    setFieldsDirty(true)
    if (editingFieldId === id) setEditingFieldId(null)
  }

  function updateField(id: string, changes: Partial<FieldDef>) {
    setFields(f => f.map(x => x.id === id ? { ...x, ...changes } : x))
    setFieldsDirty(true)
  }

  // Drag-and-drop reordering
  const [draggedId,    setDraggedId]    = useState<string | null>(null)
  const [ghostPos,     setGhostPos]     = useState<{ x: number; y: number } | null>(null)
  const [gapBeforeId,  setGapBeforeId]  = useState<string | null>(null)
  const rowEls        = useRef(new Map<string, HTMLDivElement>())
  const dragStateRef  = useRef<{ id: string; startX: number; startY: number; active: boolean } | null>(null)
  const dragMetaRef   = useRef({ ox: 0, oy: 0, h: 48, w: 0 })
  const fieldsSnap    = useRef(fields)
  const gapSnap       = useRef(gapBeforeId)
  useEffect(() => { fieldsSnap.current = fields },       [fields])
  useEffect(() => { gapSnap.current   = gapBeforeId },  [gapBeforeId])

  function startDrag(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    e.preventDefault()
    dragStateRef.current = { id, startX: e.clientX, startY: e.clientY, active: false }
    document.body.style.userSelect = "none"
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragStateRef.current
      if (!ds) return
      if (!ds.active) {
        if (Math.hypot(e.clientX - ds.startX, e.clientY - ds.startY) < 5) return
        ds.active = true
        const el = rowEls.current.get(ds.id)
        const rect = el?.getBoundingClientRect()
        if (rect) dragMetaRef.current = { ox: ds.startX - rect.left, oy: ds.startY - rect.top, h: rect.height, w: rect.width }
        document.body.style.cursor = "grabbing"
        setDraggedId(ds.id)
      }
      setGhostPos({ x: e.clientX, y: e.clientY })
      // Compute insertion gap
      let gap: string = "__end__"
      for (const f of fieldsSnap.current) {
        if (f.id === ds.id) continue
        const el = rowEls.current.get(f.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (e.clientY < rect.top + rect.height / 2) { gap = f.id; break }
      }
      setGapBeforeId(gap)
    }
    const onUp = () => {
      const ds = dragStateRef.current
      if (ds?.active) {
        const gap   = gapSnap.current
        const dragId = ds.id
        setFields(prev => {
          const list = [...prev]
          const from = list.findIndex(f => f.id === dragId)
          if (from < 0) return prev
          const [item] = list.splice(from, 1)
          if (!gap || gap === "__end__") {
            list.push(item)
          } else {
            const to = list.findIndex(f => f.id === gap)
            list.splice(to < 0 ? list.length : to, 0, item)
          }
          return list
        })
        setFieldsDirty(true)
        setDraggedId(null)
        setGhostPos(null)
        setGapBeforeId(null)
        document.body.style.cursor = ""
      }
      dragStateRef.current = null
      document.body.style.userSelect = ""
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup",   onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup",   onUp)
    }
  }, []) // uses refs — no stale closure

  async function saveFields() {
    if (!profile) return
    setSavingFields(true)
    setFieldError("")
    try {
      const { action, details } = diffFieldChanges(template.field_schema, fields)
      await updateFields.mutateAsync({
        id: template.id,
        field_schema: fields,
        action,
        actorId: profile.id,
        actorName: actorName(),
        details,
      })
      setFieldsDirty(false)
      qc.invalidateQueries({ queryKey: ["inspection_card_template_audit", template.id] })
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSavingFields(false)
    }
  }

  // Audit history
  const [showAudit, setShowAudit] = useState(false)
  const { data: auditLog = [] }   = useTemplateAudit(showAudit ? template.id : undefined)

  // Aircraft assignment
  const assignedTokenIds = new Set(fleet.filter(a => a.templateId === template.id).map(a => a.tokenId))

  async function toggleAssignment(aircraft: AircraftCheckSummary) {
    if (!profile) return
    const isAssigned = assignedTokenIds.has(aircraft.tokenId)
    await assignTemplate.mutateAsync({
      tokenId:     aircraft.tokenId,
      templateId:  isAssigned ? null : template.id,
      templateName: isAssigned ? null : template.name,
      registration: aircraft.registration,
      actorId:     profile.id,
      actorName:   actorName(),
    })
    qc.invalidateQueries({ queryKey: ["inspection_card_template_audit", template.id] })
  }

  const sectionStyle: React.CSSProperties = {
    fontSize: "0.73rem", fontFamily: "var(--font-heading)",
    textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700,
    color: "rgba(212,160,23,0.55)", marginBottom: 12, marginTop: 28,
  }

  return (
    <div style={{ maxWidth: 680 }}>

      {/* ── Template name ── */}
      <div style={{ marginBottom: 4 }}>
        {editingName && isManagerOrAbove ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") saveName()
                if (e.key === "Escape") { setDraftName(template.name); setEditingName(false) }
              }}
              onBlur={saveName}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: "1.5px solid rgba(212,160,23,0.6)",
                color: "#fff",
                fontSize: "1.45rem",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                letterSpacing: "0.03em",
                outline: "none",
                padding: "2px 0",
              }}
            />
            <button
              onMouseDown={saveName}
              style={{
                padding: "4px 12px", borderRadius: 4, cursor: "pointer",
                background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)",
                border: "none", fontSize: "0.83rem",
                fontFamily: "var(--font-heading)", fontWeight: 700,
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <h2
            onClick={() => isManagerOrAbove && setEditingName(true)}
            title={isManagerOrAbove ? "Click to rename" : undefined}
            style={{
              fontSize: "1.45rem", fontWeight: 700,
              fontFamily: "var(--font-heading)", letterSpacing: "0.03em",
              color: "#fff",
              cursor: isManagerOrAbove ? "text" : "default",
              padding: "2px 0",
              borderBottom: "1.5px solid transparent",
            }}
            onMouseEnter={e => {
              if (isManagerOrAbove) e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.35)"
            }}
            onMouseLeave={e => { e.currentTarget.style.borderBottomColor = "transparent" }}
          >
            {template.name}
          </h2>
        )}
      </div>

      {template.aircraft_type && (
        <p style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
          Aircraft type: {template.aircraft_type}
        </p>
      )}
      {template.updated_at && (
        <p style={{ fontSize: "0.77rem", color: "rgba(255,255,255,0.22)" }}>
          Last edited {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
        </p>
      )}

      {/* ── Fields ── */}
      <p style={sectionStyle}>Fields</p>

      {/* Add field buttons — at top of section */}
      {isManagerOrAbove && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            { label: "+ Checklist Item", type: "checkbox" as FieldType, color: "#4ade80" },
            { label: "+ Photo Request",  type: "photo"    as FieldType, color: "#60a5fa" },
            { label: "+ Section",        type: "section"  as FieldType, color: "rgba(212,160,23,0.8)" },
            { label: "+ Text Field",     type: "text"     as FieldType, color: "rgba(255,255,255,0.4)" },
          ].map(({ label, type, color }) => (
            <button
              key={type}
              onClick={() => addField(type)}
              style={{
                padding: "6px 12px", borderRadius: 5, cursor: "pointer",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.1)`,
                color, fontSize: "0.83rem",
                fontFamily: "var(--font-heading)", letterSpacing: "0.05em",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Ghost — mirrors the actual row while dragging */}
      {draggedId && ghostPos && (() => {
        const f = fields.find(x => x.id === draggedId)
        if (!f) return null
        const tc     = typeColorFor(f.type)
        const isSec  = f.type === "section"
        return (
          <div style={{
            position: "fixed", pointerEvents: "none", zIndex: 9999,
            left: ghostPos.x - dragMetaRef.current.ox,
            top:  ghostPos.y - dragMetaRef.current.oy,
            width: dragMetaRef.current.w,
            background: "hsl(0 0% 20%)",
            border: "1px solid rgba(212,160,23,0.7)",
            borderRadius: 7,
            boxShadow: "0 14px 44px rgba(0,0,0,0.7), 0 3px 12px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 16px",
            transform: "rotate(1.2deg) scale(1.015)",
            transformOrigin: "center center",
            overflow: "hidden",
          }}>
            {/* Gold left edge accent */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: 3, background: "rgba(212,160,23,0.75)", borderRadius: "7px 0 0 7px",
            }} />
            <div style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, marginLeft: 8 }}>
              <GripVertical className="w-4 h-4" />
            </div>
            <span style={{ color: tc, flexShrink: 0 }}>{fieldTypeIcon(f.type)}</span>
            <span style={{
              flex: 1,
              fontSize: isSec ? "0.77rem" : "0.89rem",
              fontWeight: isSec ? 700 : 400,
              fontFamily: isSec ? "var(--font-heading)" : "var(--font-body)",
              letterSpacing: isSec ? "0.12em" : "0",
              textTransform: isSec ? "uppercase" : "none",
              color: isSec ? "rgba(212,160,23,0.9)" : "rgba(255,255,255,0.92)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {f.label}
            </span>
          </div>
        )
      })()}

      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 8, overflow: "hidden",
        marginBottom: 12,
      }}>
        {fields.length === 0 ? (
          <p style={{ padding: "20px 16px", fontSize: "0.87rem", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
            No fields yet — use the buttons above to add items.
          </p>
        ) : (
          <>
            {fields.map((f) => (
              <Fragment key={f.id}>
                {/* Drop zone placeholder — opens a gap at the target position */}
                {gapBeforeId === f.id && (
                  <div style={{
                    height: Math.max(dragMetaRef.current.h, 44),
                    margin: "3px 8px",
                    border: "1.5px dashed rgba(212,160,23,0.45)",
                    borderRadius: 6,
                    background: "rgba(212,160,23,0.05)",
                  }} />
                )}
                <FieldRow
                  field={f}
                  isEditing={editingFieldId === f.id}
                  isDragging={draggedId === f.id}
                  isManagerOrAbove={isManagerOrAbove}
                  rowRef={el => { if (el) rowEls.current.set(f.id, el); else rowEls.current.delete(f.id) }}
                  onEdit={() => setEditingFieldId(editingFieldId === f.id ? null : f.id)}
                  onUpdate={changes => updateField(f.id, changes)}
                  onDelete={() => deleteField(f.id)}
                  onDragStart={e => startDrag(e, f.id)}
                />
              </Fragment>
            ))}
            {/* Drop zone at end of list */}
            {gapBeforeId === "__end__" && (
              <div style={{
                height: Math.max(dragMetaRef.current.h, 44),
                margin: "3px 8px",
                border: "1.5px dashed rgba(212,160,23,0.45)",
                borderRadius: 6,
                background: "rgba(212,160,23,0.05)",
              }} />
            )}
          </>
        )}
      </div>

      {/* Save fields button */}
      {fieldsDirty && isManagerOrAbove && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button
            onClick={saveFields}
            disabled={savingFields}
            style={{
              padding: "7px 20px", borderRadius: 5, cursor: "pointer",
              background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)",
              border: "none", fontFamily: "var(--font-heading)",
              fontSize: "0.87rem", fontWeight: 700, letterSpacing: "0.06em",
              opacity: savingFields ? 0.6 : 1,
            }}
          >
            {savingFields
              ? "Saving…"
              : assignedTokenIds.size > 0
                ? `Save & Push to ${assignedTokenIds.size} Aircraft`
                : "Save Fields"}
          </button>
          <button
            onClick={() => { setFields(template.field_schema); setFieldsDirty(false) }}
            style={{
              padding: "7px 14px", borderRadius: 5, cursor: "pointer",
              background: "transparent", color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "var(--font-heading)", fontSize: "0.87rem",
            }}
          >
            Revert
          </button>
          {fieldError && (
            <span style={{ fontSize: "0.83rem", color: "#ef4444" }}>{fieldError}</span>
          )}
        </div>
      )}

      {/* ── Aircraft assignment ── */}
      {(() => {
        const assigned  = fleet.filter(a => assignedTokenIds.has(a.tokenId))
        const available = fleet.filter(a => !a.templateId)
        const elsewhere = fleet.filter(a => a.templateId && !assignedTokenIds.has(a.tokenId))

        const acRow = (
          aircraft: AircraftCheckSummary,
          action: "remove" | "assign",
          idx: number,
        ) => (
          <div
            key={aircraft.tokenId}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "9px 14px",
              borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: "0.89rem", fontWeight: 700,
                fontFamily: "var(--font-heading)", letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.85)",
              }}>
                {aircraft.registration}
              </span>
              {aircraft.model && (
                <span style={{ fontSize: "0.79rem", color: "rgba(255,255,255,0.28)", marginLeft: 8 }}>
                  {aircraft.model}
                </span>
              )}
            </div>
            {isManagerOrAbove && (
              <button
                onClick={() => toggleAssignment(aircraft)}
                disabled={assignTemplate.isPending}
                style={{
                  flexShrink: 0,
                  padding: "3px 11px", borderRadius: 4, cursor: "pointer",
                  fontFamily: "var(--font-heading)", fontSize: "0.76rem", fontWeight: 700,
                  border: "none",
                  background: action === "remove"
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(212,160,23,0.12)",
                  color: action === "remove"
                    ? "rgba(239,68,68,0.7)"
                    : "rgba(212,160,23,0.85)",
                  opacity: assignTemplate.isPending ? 0.5 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
                onMouseLeave={e => (e.currentTarget.style.opacity = assignTemplate.isPending ? "0.5" : "1")}
              >
                {action === "remove" ? "Remove" : "Assign"}
              </button>
            )}
          </div>
        )

        return (
          <div style={{ marginBottom: 4 }}>
            {/* Assigned to this template */}
            <p style={sectionStyle}>Assigned to This Template</p>
            {assigned.length === 0 ? (
              <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.22)", marginBottom: 20 }}>
                No aircraft assigned yet.
              </p>
            ) : (
              <div style={{
                background: "rgba(212,160,23,0.03)",
                border: "0.5px solid rgba(212,160,23,0.15)",
                borderRadius: 8, overflow: "hidden", marginBottom: 20,
              }}>
                {assigned.map((a, i) => acRow(a, "remove", i))}
              </div>
            )}

            {/* Available (no template assigned) */}
            {available.length > 0 && (
              <>
                <p style={sectionStyle}>Available to Assign</p>
                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "0.5px solid rgba(255,255,255,0.07)",
                  borderRadius: 8, overflow: "hidden", marginBottom: 20,
                }}>
                  {available.map((a, i) => acRow(a, "assign", i))}
                </div>
              </>
            )}

            {/* Using a different template */}
            {elsewhere.length > 0 && (
              <>
                <p style={{ ...sectionStyle, color: "rgba(255,255,255,0.2)" }}>Using Another Template</p>
                <div style={{
                  background: "rgba(255,255,255,0.01)",
                  border: "0.5px solid rgba(255,255,255,0.05)",
                  borderRadius: 8, overflow: "hidden",
                }}>
                  {elsewhere.map((a, i) => (
                    <div
                      key={a.tokenId}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "9px 14px",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{
                          fontSize: "0.89rem", fontWeight: 700,
                          fontFamily: "var(--font-heading)", letterSpacing: "0.06em",
                          color: "rgba(255,255,255,0.35)",
                        }}>
                          {a.registration}
                        </span>
                        {a.model && (
                          <span style={{ fontSize: "0.79rem", color: "rgba(255,255,255,0.18)", marginLeft: 8 }}>
                            {a.model}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>
                        {a.templateName}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── Audit history ── */}
      <p style={{ ...sectionStyle, marginTop: 36 }}>Audit History</p>
      <button
        onClick={() => setShowAudit(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          background: "rgba(255,255,255,0.04)",
          border: "0.5px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "7px 12px", cursor: "pointer",
          color: "rgba(255,255,255,0.5)", fontSize: "0.83rem",
          fontFamily: "var(--font-heading)",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
      >
        {showAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showAudit ? "Hide history" : "Show history"}
      </button>
      {showAudit && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "0.5px solid rgba(255,255,255,0.07)",
          borderRadius: 8, overflow: "hidden",
        }}>
          {auditLog.length === 0 ? (
            <p style={{ padding: "16px", fontSize: "0.86rem", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
              No audit entries yet.
            </p>
          ) : (
            auditLog.map((entry, idx) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                idx={idx}
                isSuperAdmin={isSuperAdmin}
                onDelete={() => deleteAuditEntry.mutate(entry.id)}
                deleting={deleteAuditEntry.isPending}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Audit row ────────────────────────────────────────────────────────────────

function AuditRow({
  entry, idx, isSuperAdmin, onDelete, deleting,
}: {
  entry: TemplateAuditEntry
  idx: number
  isSuperAdmin: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{
        padding: "11px 16px",
        borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: "0.86rem", fontFamily: "var(--font-heading)",
          color: "rgba(255,255,255,0.75)", marginBottom: 2,
        }}>
          {formatAuditAction(entry.action, entry.details)}
        </p>
        <p style={{ fontSize: "0.77rem", color: "rgba(255,255,255,0.32)" }}>
          {entry.actor_name ?? "Unknown user"}
          {" · "}
          <span title={formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}>
            {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </p>
      </div>

      {isSuperAdmin && !confirmDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          title="Clear this entry"
          style={{
            flexShrink: 0, padding: "3px 6px", borderRadius: 4,
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(239,68,68,0.3)",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(239,68,68,0.75)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,68,68,0.3)")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {isSuperAdmin && confirmDelete && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => { onDelete(); setConfirmDelete(false) }}
            disabled={deleting}
            style={{
              padding: "2px 8px", borderRadius: 4, cursor: "pointer",
              background: "#ef4444", color: "#fff", border: "none",
              fontSize: "0.75rem", fontFamily: "var(--font-heading)", fontWeight: 700,
            }}
          >
            Clear
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              padding: "2px 8px", borderRadius: 4, cursor: "pointer",
              background: "transparent", color: "rgba(255,255,255,0.35)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "0.75rem", fontFamily: "var(--font-heading)",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  field, isEditing, isDragging, isManagerOrAbove,
  rowRef, onEdit, onUpdate, onDelete, onDragStart,
}: {
  field: FieldDef
  isEditing: boolean
  isDragging: boolean
  isManagerOrAbove: boolean
  rowRef: (el: HTMLDivElement | null) => void
  onEdit: () => void
  onUpdate: (changes: Partial<FieldDef>) => void
  onDelete: () => void
  onDragStart: (e: React.PointerEvent) => void
}) {
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) labelRef.current?.focus()
  }, [isEditing])

  const isSection = field.type === "section"
  const typeColor = typeColorFor(field.type)

  return (
    <div ref={rowRef}>
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
        background: isDragging
          ? "rgba(212,160,23,0.04)"
          : isSection ? "rgba(212,160,23,0.025)"
          : isEditing ? "rgba(255,255,255,0.025)"
          : "transparent",
        opacity: isDragging ? 0.35 : 1,
        transition: "opacity 0.12s ease",
      }}>
        {/* Main row */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: isSection ? "10px 16px" : "9px 16px",
            cursor: isManagerOrAbove ? "pointer" : "default",
          }}
          onClick={() => isManagerOrAbove && onEdit()}
        >
          {/* Drag handle — functional */}
          {isManagerOrAbove && (
            <div
              onPointerDown={onDragStart}
              onClick={e => e.stopPropagation()}
              title="Drag to reorder"
              style={{
                display: "flex", alignItems: "center", padding: "4px 2px",
                flexShrink: 0, cursor: "grab", borderRadius: 3,
                color: "rgba(255,255,255,0.18)",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {/* Type icon */}
          <span style={{ color: typeColor, flexShrink: 0 }}>
            {fieldTypeIcon(field.type)}
          </span>

          {/* Label */}
          <span style={{
            flex: 1, fontSize: isSection ? "0.77rem" : "0.89rem",
            fontWeight: isSection ? 700 : 400,
            fontFamily: isSection ? "var(--font-heading)" : "var(--font-body)",
            letterSpacing: isSection ? "0.12em" : "0.01em",
            textTransform: isSection ? "uppercase" : "none",
            color: isSection ? "rgba(212,160,23,0.7)" : "rgba(255,255,255,0.75)",
          }}>
            {field.label}
          </span>

          {/* Required badge */}
          {!isSection && field.required && (
            <span style={{
              fontSize: "0.67rem", padding: "1px 5px", borderRadius: 999,
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.06em",
            }}>
              req
            </span>
          )}

          {/* Delete */}
          {isManagerOrAbove && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              title="Remove field"
              style={{
                padding: 3, borderRadius: 3, cursor: "pointer", flexShrink: 0,
                background: "transparent", border: "none",
                color: "rgba(239,68,68,0.3)",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,68,68,0.3)")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      {/* Edit panel — expanded when this field is selected */}
      {isEditing && isManagerOrAbove && (
        <div
          style={{
            padding: "10px 16px 14px 44px",
            background: "rgba(0,0,0,0.2)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Label edit */}
            <div style={{ flex: "1 1 200px" }}>
              <p style={{ fontSize: "0.69rem", color: "rgba(255,255,255,0.3)", marginBottom: 4, fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Label</p>
              <input
                ref={labelRef}
                value={field.label}
                onChange={e => onUpdate({ label: e.target.value })}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 4, color: "#fff",
                  fontSize: "0.89rem", padding: "6px 8px", outline: "none",
                  fontFamily: "var(--font-body)",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(212,160,23,0.5)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            {/* Type selector */}
            <div style={{ flex: "0 0 160px" }}>
              <p style={{ fontSize: "0.69rem", color: "rgba(255,255,255,0.3)", marginBottom: 4, fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Type</p>
              <select
                value={field.type}
                onChange={e => onUpdate({ type: e.target.value as FieldType })}
                style={{
                  width: "100%",
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 4, color: "#fff",
                  fontSize: "0.89rem", padding: "6px 8px", outline: "none",
                  fontFamily: "var(--font-body)",
                }}
              >
                {FIELD_TYPES.map(ft => (
                  <option key={ft.type} value={ft.type} style={{ background: "#1a1a1a", color: "#fff" }}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Required toggle */}
            {field.type !== "section" && (
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: "0.69rem", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Required</p>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={e => onUpdate({ required: e.target.checked })}
                    style={{ accentColor: "#d4a017" }}
                  />
                  <span style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.5)" }}>Yes</span>
                </label>
              </div>
            )}
          </div>

          {/* Hint */}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: "0.69rem", color: "rgba(255,255,255,0.3)", marginBottom: 4, fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Hint (optional)</p>
            <input
              value={field.hint ?? ""}
              onChange={e => onUpdate({ hint: e.target.value || undefined })}
              placeholder="Helper text shown below this field"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 4, color: "rgba(255,255,255,0.7)",
                fontSize: "0.86rem", padding: "6px 8px", outline: "none",
                fontFamily: "var(--font-body)",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(212,160,23,0.5)")}
              onBlur={e  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            />
          </div>
        </div>
      )}
      </div>{/* closes background/opacity wrapper */}
    </div>
  )
}

// ─── Field change diff ────────────────────────────────────────────────────────

function diffFieldChanges(
  oldFields: FieldDef[],
  newFields: FieldDef[],
): { action: string; details: Record<string, unknown> } {
  const oldIds = oldFields.map(f => f.id)
  const newIds = newFields.map(f => f.id)

  // Added
  const added = newFields.filter(f => !oldIds.includes(f.id))
  if (added.length === 1) {
    return { action: "field_added", details: { label: added[0].label, field_type: added[0].type, field_count: newFields.length } }
  }

  // Removed
  const removed = oldFields.filter(f => !newIds.includes(f.id))
  if (removed.length === 1) {
    return { action: "field_removed", details: { label: removed[0].label, field_count: newFields.length } }
  }

  // Reordered (same IDs, different positions)
  if (newIds.join(",") !== oldIds.join(",")) {
    const moves = newFields
      .map((f, newIdx) => {
        const oldIdx = oldIds.indexOf(f.id)
        if (oldIdx === newIdx) return null
        return { label: f.label, from: oldIdx + 1, to: newIdx + 1, delta: Math.abs(newIdx - oldIdx) }
      })
      .filter((m): m is { label: string; from: number; to: number; delta: number } => m !== null)

    // Primary mover = item with largest position delta
    const primary = moves.reduce((a, b) => (a.delta >= b.delta ? a : b))
    return {
      action: "fields_reordered",
      details: {
        primary: { label: primary.label, from: primary.from, to: primary.to },
        all_moves: moves.map(({ label, from, to }) => ({ label, from, to })),
        field_count: newFields.length,
      },
    }
  }

  // Updated (same IDs, same order — label/type/required/hint changed)
  for (const nf of newFields) {
    const of_ = oldFields.find(f => f.id === nf.id)
    if (!of_) continue
    if (nf.label !== of_.label) {
      return { action: "field_updated", details: { label: nf.label, previous_label: of_.label, field_count: newFields.length } }
    }
    if (nf.type !== of_.type) {
      return { action: "field_updated", details: { label: nf.label, change: `type changed to ${nf.type}`, field_count: newFields.length } }
    }
    if (nf.required !== of_.required) {
      return { action: "field_updated", details: { label: nf.label, change: nf.required ? "marked required" : "marked optional", field_count: newFields.length } }
    }
    if ((nf.hint ?? "") !== (of_.hint ?? "")) {
      return { action: "field_updated", details: { label: nf.label, change: "hint updated", field_count: newFields.length } }
    }
  }

  return { action: "fields_saved", details: { field_count: newFields.length } }
}

// ─── Audit action formatter ────────────────────────────────────────────────────

function formatAuditAction(action: string, details: Record<string, unknown> | null): string {
  switch (action) {
    case "created":     return "Template created"
    case "copied_from": return `Copied from "${details?.source_name ?? "another template"}"`
    case "renamed":     return `Renamed: "${details?.from}" → "${details?.to}"`
    case "field_added": return `Field added: "${details?.label}" (${details?.field_type ?? "unknown type"})`
    case "field_removed": return `Field removed: "${details?.label}"`
    case "field_updated": {
      const change = details?.change as string | undefined
      if (change) return `Field updated: "${details?.label}" — ${change}`
      if (details?.previous_label) return `Field renamed: "${details?.previous_label}" → "${details?.label}"`
      return `Field updated: "${details?.label}"`
    }
    case "fields_reordered": {
      type Move = { label: string; from: number; to: number }
      const allMoves = details?.all_moves as Move[] | undefined
      if (allMoves?.length) {
        const fmt = (m: Move) => `"${m.label}" ${m.to < m.from ? "↑" : "↓"} (pos ${m.from} → ${m.to})`
        if (allMoves.length <= 3) return `Reordered: ${allMoves.map(fmt).join(", ")}`
        const p = details?.primary as Move
        return `"${p.label}" moved ${p.to < p.from ? "up" : "down"} from position ${p.from} to ${p.to} (${allMoves.length - 1} other items shifted)`
      }
      return `Field order changed (${details?.field_count ?? "?"} fields)`
    }
    case "fields_saved":        return `Fields saved — ${details?.field_count ?? "?"} fields`
    case "aircraft_assigned":   return `Aircraft assigned: ${details?.registration}`
    case "aircraft_unassigned": return `Aircraft unassigned: ${details?.registration}`
    default:                    return action.replace(/_/g, " ")
  }
}

// Re-export fieldTypeLabel for potential external use
export { fieldTypeLabel }
