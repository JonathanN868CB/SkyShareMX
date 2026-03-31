import { useState, useEffect } from "react"
import {
  Phone, Globe, Star, MapPin, X,
  ChevronLeft, ExternalLink, Pencil, Maximize2, Minimize2, Plus, Truck,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  GOLD, TYPE_CONFIG, TYPE_ORDER, CONTACT_ROLES,
  type Vendor, type VendorContact,
} from "../constants"
import { Field } from "./Field"

export function VendorDetail({ vendor, onBack, isAdmin, onRefresh, onUpdated, expanded, onToggleExpand, isSuperAdmin }: {
  vendor: Vendor; onBack: () => void; isAdmin: boolean
  onRefresh: () => Promise<void>; onUpdated: (v: Vendor) => void
  expanded: boolean; onToggleExpand: () => void; isSuperAdmin: boolean
}) {
  const cfg = TYPE_CONFIG[vendor.vendor_type]
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [contacts, setContacts] = useState<VendorContact[]>([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [edit, setEdit] = useState({
    name:         vendor.name,
    vendor_type:  vendor.vendor_type,
    preferred:    vendor.preferred,
    airport_code: vendor.airport_code ?? "",
    city:         vendor.city ?? "",
    state:        vendor.state ?? "",
    country:      vendor.country,
    phone:        vendor.phone ?? "",
    email:        vendor.email ?? "",
    website:      vendor.website ?? "",
    specialties:  (vendor.specialties ?? []).join(", "),
    notes:        vendor.notes ?? "",
    lat:          vendor.lat?.toString() ?? "",
    lng:          vendor.lng?.toString() ?? "",
    is_mrt:       vendor.is_mrt,
  })

  async function saveEdits() {
    setSaving(true)
    const payload = {
      name:         edit.name.trim(),
      vendor_type:  edit.vendor_type,
      preferred:    edit.preferred,
      airport_code: edit.airport_code.trim() || null,
      city:         edit.city.trim() || null,
      state:        edit.state.trim() || null,
      country:      edit.country || "USA",
      phone:        edit.phone.trim() || null,
      email:        edit.email.trim() || null,
      website:      edit.website.trim() || null,
      specialties:  edit.specialties ? edit.specialties.split(",").map(s => s.trim()).filter(Boolean) : null,
      notes:        edit.notes.trim() || null,
      lat:          edit.lat ? parseFloat(edit.lat) : null,
      lng:          edit.lng ? parseFloat(edit.lng) : null,
      is_mrt:       edit.is_mrt,
    }
    await supabase.from("vendors").update(payload).eq("id", vendor.id)
    setSaving(false)
    setEditing(false)
    onUpdated({ ...vendor, ...payload } as Vendor)
    await onRefresh()
  }

  useEffect(() => {
    supabase.from("vendor_contacts").select("*")
      .eq("vendor_id", vendor.id).order("is_primary", { ascending: false }).order("created_at")
      .then(({ data }) => setContacts(data ?? []))
  }, [vendor.id])

  async function loadContacts() {
    const { data } = await supabase.from("vendor_contacts").select("*")
      .eq("vendor_id", vendor.id).order("is_primary", { ascending: false }).order("created_at")
    setContacts(data ?? [])
  }

  async function saveContact() {
    const payload = {
      name:       contactForm.name.trim(),
      title:      contactForm.title.trim() || null,
      role:       contactForm.role || null,
      phone:      contactForm.phone.trim() || null,
      mobile:     contactForm.mobile.trim() || null,
      email:      contactForm.email.trim() || null,
      is_primary: contactForm.is_primary,
    }
    if (editingContactId) {
      await supabase.from("vendor_contacts").update(payload).eq("id", editingContactId)
    } else {
      await supabase.from("vendor_contacts").insert({ vendor_id: vendor.id, ...payload })
    }
    setShowContactForm(false); setEditingContactId(null)
    setContactForm({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false })
    await loadContacts()
  }

  async function deleteContact(id: string) {
    await supabase.from("vendor_contacts").delete().eq("id", id)
    await loadContacts()
  }

  async function deleteVendor() {
    await supabase.from("vendors").delete().eq("id", vendor.id)
    onBack()
    await onRefresh()
  }

  function startEditContact(c: VendorContact) {
    setContactForm({ name: c.name, title: c.title ?? "", role: c.role ?? "Sales", phone: c.phone ?? "", mobile: c.mobile ?? "", email: c.email ?? "", is_primary: c.is_primary })
    setEditingContactId(c.id)
    setShowContactForm(true)
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <p className="text-xs font-bold tracking-wide" style={{ color: GOLD }}>Edit Vendor</p>
          <button onClick={() => setEditing(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          <Field label="Name *">
            <input className="form-input" value={edit.name} onChange={e => setEdit(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Type">
            <div className="grid grid-cols-2 gap-1.5">
              {TYPE_ORDER.map(k => {
                const c = TYPE_CONFIG[k]
                const active = edit.vendor_type === k
                return (
                  <button key={k} type="button" onClick={() => setEdit(f => ({ ...f, vendor_type: k }))}
                    className="text-[10px] py-1.5 px-2 rounded-sm border font-bold text-left transition-colors"
                    style={{
                      borderColor: active ? c.color : "hsl(var(--border))",
                      color:       active ? c.color : "hsl(var(--muted-foreground))",
                      background:  active ? `${c.color}15` : "transparent",
                    }}
                  >
                    <span>{c.sym}</span> {c.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Airport Code">
              <input className="form-input font-mono uppercase" value={edit.airport_code} onChange={e => setEdit(f => ({ ...f, airport_code: e.target.value }))} placeholder="KDAL" maxLength={4} />
            </Field>
            <Field label="Country">
              <input className="form-input" value={edit.country} onChange={e => setEdit(f => ({ ...f, country: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City">
              <input className="form-input" value={edit.city} onChange={e => setEdit(f => ({ ...f, city: e.target.value }))} />
            </Field>
            <Field label="State">
              <input className="form-input" value={edit.state} onChange={e => setEdit(f => ({ ...f, state: e.target.value }))} maxLength={2} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat">
              <input className="form-input" type="number" step="any" value={edit.lat} onChange={e => setEdit(f => ({ ...f, lat: e.target.value }))} />
            </Field>
            <Field label="Lng">
              <input className="form-input" type="number" step="any" value={edit.lng} onChange={e => setEdit(f => ({ ...f, lng: e.target.value }))} />
            </Field>
          </div>
          <Field label="Phone">
            <input className="form-input" value={edit.phone} onChange={e => setEdit(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <input className="form-input" value={edit.email} onChange={e => setEdit(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Website">
            <input className="form-input" value={edit.website} onChange={e => setEdit(f => ({ ...f, website: e.target.value }))} />
          </Field>
          <Field label="Specialties (comma-separated)">
            <input className="form-input" value={edit.specialties} onChange={e => setEdit(f => ({ ...f, specialties: e.target.value }))} placeholder="Engine, Avionics…" />
          </Field>
          <Field label="Notes">
            <textarea className="form-input resize-none" rows={3} value={edit.notes} onChange={e => setEdit(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={edit.preferred} onChange={e => setEdit(f => ({ ...f, preferred: e.target.checked }))} />
            <span className="text-xs" style={{ color: edit.preferred ? GOLD : "hsl(var(--muted-foreground))" }}>Preferred vendor</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={edit.is_mrt} onChange={e => setEdit(f => ({ ...f, is_mrt: e.target.checked }))} />
            <span className="text-xs" style={{ color: edit.is_mrt ? GOLD : "hsl(var(--muted-foreground))" }}>Mobile Response Team (MRT) — no map pin</span>
          </label>
        </div>
        <div className="flex gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 text-xs rounded-sm font-semibold" style={{ background: "#1e3a5f", color: "white" }}>← Back</button>
          <button onClick={saveEdits} disabled={!edit.name.trim() || saving}
            className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-50"
            style={{ background: GOLD }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
        {isSuperAdmin && (
          <div className="px-4 pb-4 flex-shrink-0">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-xs py-1.5 rounded-sm transition-colors"
                style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Delete vendor
              </button>
            ) : (
              <div className="rounded-sm p-3 space-y-2" style={{ border: "1px solid #f87171", background: "rgba(248,113,113,0.06)" }}>
                <p className="text-xs text-center font-semibold" style={{ color: "#f87171" }}>
                  Permanently delete {vendor.name}?
                </p>
                <p className="text-[10px] text-center text-muted-foreground">This cannot be undone.</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 text-xs py-1.5 rounded-sm text-muted-foreground"
                    style={{ border: "1px solid hsl(var(--border))" }}
                  >Cancel</button>
                  <button
                    onClick={deleteVendor}
                    className="flex-1 text-xs py-1.5 rounded-sm text-white font-semibold"
                    style={{ background: "#ef4444" }}
                  >Yes, Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Read view ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-sm transition-colors"
            style={{
              border: `1px solid ${expanded ? GOLD : "hsl(var(--border))"}`,
              color: expanded ? GOLD : "hsl(var(--muted-foreground))",
              background: expanded ? `${GOLD}15` : "transparent",
            }}
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {expanded ? "Collapse" : "Expand"}
          </button>
          {isAdmin && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm"
              style={{ background: `${GOLD}18`, color: GOLD }}>
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Name + type */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm"
              style={{ background: `${cfg.color}20`, color: cfg.color }}>
              {cfg.sym} {cfg.label}
            </span>
            {vendor.preferred && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                style={{ background: `${GOLD}20`, color: GOLD }}>
                <Star className="w-2.5 h-2.5" fill={GOLD} /> Preferred
              </span>
            )}
            {vendor.is_mrt && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                style={{ background: `${GOLD}15`, color: GOLD }}>
                <Truck className="w-2.5 h-2.5" /> MRT
              </span>
            )}
          </div>
          <h2 className="text-base font-bold leading-snug">{vendor.name}</h2>
          {(vendor.city || vendor.airport_code) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {vendor.airport_code && <span className="font-mono mr-1">{vendor.airport_code}</span>}
              {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}
            </p>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-2" style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Contact</p>
          {vendor.phone ? (
            <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: GOLD }}>
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{vendor.phone}
            </a>
          ) : <p className="text-xs text-muted-foreground italic">No phone on file</p>}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
              <span className="text-sm">✉</span>{vendor.email}
            </a>
          )}
          {vendor.website && (
            <a href={vendor.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{vendor.website.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
            </a>
          )}
        </div>

        {/* Key Contacts */}
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Key Contacts</p>
            {isAdmin && !showContactForm && (
              <button
                onClick={() => { setContactForm({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false }); setEditingContactId(null); setShowContactForm(true) }}
                className="flex items-center gap-0.5 text-[9px] font-semibold"
                style={{ color: GOLD }}
              ><Plus className="w-3 h-3" /> Add</button>
            )}
          </div>

          {showContactForm && (
            <div className="rounded-sm p-3 mb-3 space-y-2" style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}08` }}>
              <Field label="Name *">
                <input className="form-input" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </Field>
              <Field label="Title">
                <input className="form-input" value={contactForm.title} onChange={e => setContactForm(f => ({ ...f, title: e.target.value }))} placeholder="Regional Sales Manager" />
              </Field>
              <Field label="Role">
                <select className="form-input" value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}>
                  {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone">
                  <input className="form-input" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="(970) 555-0100" />
                </Field>
                <Field label="Mobile">
                  <input className="form-input" value={contactForm.mobile} onChange={e => setContactForm(f => ({ ...f, mobile: e.target.value }))} placeholder="(970) 555-0200" />
                </Field>
              </div>
              <Field label="Email">
                <input className="form-input" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
              </Field>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contactForm.is_primary} onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))} />
                <span className="text-xs text-muted-foreground">Primary contact</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowContactForm(false); setEditingContactId(null); setContactForm({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false }) }}
                  className="flex-1 py-1.5 text-xs rounded-sm text-muted-foreground"
                  style={{ border: "1px solid hsl(var(--border))" }}
                >Cancel</button>
                <button onClick={saveContact} disabled={!contactForm.name.trim()}
                  className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-40"
                  style={{ background: GOLD }}>
                  {editingContactId ? "Update" : "Add Contact"}
                </button>
              </div>
              {editingContactId && (
                <button onClick={() => deleteContact(editingContactId)}
                  className="w-full text-xs py-1 transition-colors"
                  style={{ color: "#f87171" }}>
                  Delete contact
                </button>
              )}
            </div>
          )}

          {contacts.length === 0 && !showContactForm && (
            <p className="text-xs text-muted-foreground italic opacity-50">No contacts on file.</p>
          )}

          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className="rounded-sm p-2.5" style={{ background: "hsl(var(--accent))", border: "1px solid hsl(var(--border))" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate">{c.name}</p>
                    {c.title && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{c.title}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.is_primary && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: `${GOLD}20`, color: GOLD }}>PRIMARY</span>
                    )}
                    {c.role && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>{c.role}</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => startEditContact(c)} className="opacity-40 hover:opacity-80 transition-opacity">
                        <Pencil className="w-3 h-3" style={{ color: GOLD }} />
                      </button>
                    )}
                  </div>
                </div>
                {(c.phone || c.mobile) && (
                  <p className="text-[10px] mt-1.5 flex items-center gap-1 flex-wrap">
                    <Phone className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                    {c.phone && <a href={`tel:${c.phone}`} style={{ color: GOLD }}>{c.phone}</a>}
                    {c.phone && c.mobile && <span className="opacity-40">·</span>}
                    {c.mobile && <span className="text-muted-foreground">M: {c.mobile}</span>}
                  </p>
                )}
                {c.email && (
                  <p className="text-[10px] mt-0.5">
                    <a href={`mailto:${c.email}`} className="text-muted-foreground hover:underline">{c.email}</a>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Specialties */}
        {vendor.specialties && vendor.specialties.length > 0 && (
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Specialties</p>
            <div className="flex flex-wrap gap-1.5">
              {vendor.specialties.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-sm font-semibold"
                  style={{ background: `${cfg.color}15`, color: cfg.color }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Notes</p>
          <p className="text-xs text-muted-foreground leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>
            {vendor.notes || <span className="italic opacity-50">No notes yet.</span>}
          </p>
        </div>

        {/* Google Maps link */}
        {vendor.lat && vendor.lng && (
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
            <a href={`https://www.google.com/maps/search/?api=1&query=${vendor.lat},${vendor.lng}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
              <MapPin className="w-3.5 h-3.5" />View on Google Maps
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
