// SendCheckEmailModal — dispatches the permanent 14-day check link to a mechanic.
// Loads Technicians/Managers from profiles; click to populate, then send.

import { useState, useEffect, useRef } from "react"
import { X, Mail, Check, Loader2, Search, ChevronRight, UserX } from "lucide-react"
import { supabase } from "@/lib/supabase"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

type Profile = {
  id: string
  full_name: string | null
  email: string
  role: string
}

type Props = {
  registration: string
  encodedToken: string
  onClose: () => void
}

function initials(profile: Profile): string {
  if (profile.full_name) {
    const parts = profile.full_name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return profile.email.slice(0, 2).toUpperCase()
}

function displayName(profile: Profile): string {
  return profile.full_name?.trim() || profile.email
}

export function SendCheckEmailModal({ registration, encodedToken, onClose }: Props) {
  const [profiles, setProfiles]             = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [search, setSearch]                 = useState("")
  const [selected, setSelected]             = useState<Profile | null>(null)
  const [recipientName, setRecipientName]   = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [sending, setSending]               = useState(false)
  const [sent, setSent]                     = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load technicians + managers on mount
  useEffect(() => {
    const load = async () => {
      const { data } = await db
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["Technician", "Manager", "Admin", "Super Admin"])
        .order("full_name", { ascending: true, nullsFirst: false })
      setProfiles(data ?? [])
      setLoadingProfiles(false)
    }
    load()
    setTimeout(() => searchRef.current?.focus(), 80)
  }, [])

  function handleSelect(p: Profile) {
    setSelected(p)
    setRecipientName(p.full_name?.trim() || "")
    setRecipientEmail(p.email)
    setError(null)
  }

  function handleClearSelection() {
    setSelected(null)
    setRecipientName("")
    setRecipientEmail("")
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    return (
      (p.full_name?.toLowerCase().includes(q) ?? false) ||
      p.email.toLowerCase().includes(q)
    )
  })

  const technicians = filtered.filter(p => p.role === "Technician")
  const managers    = filtered.filter(p => p.role === "Manager")
  const admins      = filtered.filter(p => p.role === "Admin" || p.role === "Super Admin")

  async function handleSend() {
    const name  = recipientName.trim()
    const email = recipientEmail.trim()
    if (!name || !email) return
    setError(null)
    setSending(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")

      const res = await fetch("/.netlify/functions/fourteen-day-check-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ encodedToken, recipientName: name, recipientEmail: email }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to send email")
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const canSend = recipientName.trim().length > 0 && recipientEmail.trim().length > 0

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative rounded-xl overflow-hidden w-full"
          style={{
            maxWidth: "420px",
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.65)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Brand stripe */}
          <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: "rgba(212,160,23,0.7)" }}>
                14-Day Check · {registration}
              </p>
              <p className="text-base font-semibold mt-0.5" style={{ color: "#fff" }}>
                {sent ? "Check Link Dispatched" : "Dispatch Check Link"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            /* ── Success ── */
            <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#fff" }}>
                  Dispatched to {recipientName}
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {recipientEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-md text-sm font-medium mt-2"
                style={{
                  background: "rgba(212,160,23,0.12)",
                  border: "1px solid rgba(212,160,23,0.3)",
                  color: "#d4a017",
                }}
              >
                Done
              </button>
            </div>
          ) : selected ? (
            /* ── Selected mechanic — confirm & send ── */
            <div className="px-5 py-5 space-y-4">
              {/* Selected profile chip */}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-3"
                style={{
                  background: "rgba(212,160,23,0.06)",
                  border: "1px solid rgba(212,160,23,0.25)",
                  borderLeft: "3px solid rgba(212,160,23,0.7)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: "rgba(212,160,23,0.15)", color: "#d4a017" }}
                >
                  {initials(selected)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#fff" }}>
                    {displayName(selected)}
                  </p>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {selected.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="flex-shrink-0 p-1 rounded"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  title="Change recipient"
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Editable fields in case MC wants to tweak */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="flex-1 py-2.5 rounded-md text-sm transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend || sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(212,160,23,0.15)",
                    border: "1px solid rgba(212,160,23,0.35)",
                    color: "#d4a017",
                  }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Mechanic picker ── */
            <div className="flex flex-col" style={{ maxHeight: "480px" }}>
              {/* Search */}
              <div className="px-4 pt-4 pb-3">
                <div
                  className="flex items-center gap-2 rounded-md px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")} style={{ color: "rgba(255,255,255,0.3)" }}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1 pb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {loadingProfiles ? (
                  <div className="flex items-center justify-center py-10">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: "#d4a017", borderTopColor: "transparent" }}
                    />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                    <UserX className="w-6 h-6" style={{ color: "rgba(255,255,255,0.15)" }} />
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      No match for "{search}"
                    </p>
                  </div>
                ) : (
                  <>
                    {technicians.length > 0 && (
                      <RoleGroup label="Technicians" profiles={technicians} onSelect={handleSelect} />
                    )}
                    {managers.length > 0 && (
                      <RoleGroup label="Managers" profiles={managers} onSelect={handleSelect} />
                    )}
                    {admins.length > 0 && (
                      <RoleGroup label="Admin" profiles={admins} onSelect={handleSelect} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      />
    </>
  )
}

function RoleGroup({
  label,
  profiles,
  onSelect,
}: {
  label: string
  profiles: Profile[]
  onSelect: (p: Profile) => void
}) {
  return (
    <div>
      <p
        className="px-4 pt-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: "rgba(255,255,255,0.2)" }}
      >
        {label}
      </p>
      {profiles.map(p => (
        <ProfileRow key={p.id} profile={p} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ProfileRow({ profile, onSelect }: { profile: Profile; onSelect: (p: Profile) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onSelect(profile)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{ background: hovered ? "rgba(255,255,255,0.04)" : "transparent" }}
    >
      {/* Initials avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{
          background: hovered ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.07)",
          color: hovered ? "#d4a017" : "rgba(255,255,255,0.45)",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {initials(profile)}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: hovered ? "#fff" : "rgba(255,255,255,0.75)", transition: "color 0.15s" }}
        >
          {displayName(profile)}
        </p>
        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
          {profile.email}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight
        className="w-3.5 h-3.5 flex-shrink-0 transition-opacity"
        style={{ color: "#d4a017", opacity: hovered ? 0.8 : 0 }}
      />
    </button>
  )
}
