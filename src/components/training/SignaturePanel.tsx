/**
 * SignaturePanel — reusable signing UI for ad hoc training acknowledgments.
 *
 * Shows a cursive-rendered name (Dancing Script font), the signer's email,
 * a live timestamp, and a confirm checkbox. On sign, computes a SHA-256
 * fingerprint: SHA-256(userId:recordId:timestamp) — deterministic and
 * verifiable. No external library required; uses native browser crypto.subtle.
 *
 * Also exports SignatureBlock for displaying a completed, locked signature.
 */

import { useState } from "react"
import { CheckCheck, Lock, ShieldCheck } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignatureData {
  hash:      string   // full SHA-256 hex
  shortHash: string   // first 12 chars uppercase, for display
  timestamp: string   // ISO string — the moment of signing
  name:      string
  email:     string
}

export type SignerRole = "Manager" | "Technician" | "Witness"

// ─── Hash helper ─────────────────────────────────────────────────────────────

export async function computeSignatureHash(
  userId: string,
  recordId: number,
  timestamp: string
): Promise<string> {
  const message  = `${userId}:${recordId}:${timestamp}`
  const encoded  = new TextEncoder().encode(message)
  const buffer   = await crypto.subtle.digest("SHA-256", encoded)
  const bytes    = Array.from(new Uint8Array(buffer))
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("")
}

function shortHash(hash: string): string {
  return hash.slice(0, 12).toUpperCase()
}

// ─── Completed signature display (read-only) ─────────────────────────────────

export function SignatureBlock({
  name,
  email,
  timestamp,
  hash,
  role,
}: {
  name:      string | null | undefined
  email:     string | null | undefined
  timestamp: string | null | undefined
  hash:      string | null | undefined
  role:      SignerRole
}) {
  if (!name || !timestamp) return null

  const date = new Date(timestamp)
  const dateStr = date.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  })

  const roleColors: Record<SignerRole, { accent: string; bg: string; border: string }> = {
    Manager:    { accent: "var(--skyshare-gold)",  bg: "rgba(212,160,23,0.05)",  border: "rgba(212,160,23,0.2)" },
    Technician: { accent: "#4e7fa0",               bg: "rgba(70,100,129,0.06)",  border: "rgba(70,100,129,0.2)" },
    Witness:    { accent: "#10b981",               bg: "rgba(16,185,129,0.05)", border: "rgba(16,185,129,0.2)" },
  }
  const { accent, bg, border } = roleColors[role]

  return (
    <div className="rounded-lg px-4 py-3 flex flex-col gap-1.5"
      style={{ background: bg, border: `1px solid ${border}` }}>

      {/* Role label */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <Lock className="h-2.5 w-2.5 shrink-0" style={{ color: accent }} />
        <span className="text-[9px] uppercase tracking-widest font-bold"
          style={{ color: accent, fontFamily: "var(--font-heading)" }}>
          {role} Signature
        </span>
      </div>

      {/* Cursive name */}
      <div
        style={{
          fontFamily: "'Dancing Script', cursive",
          fontSize: "1.6rem",
          lineHeight: 1.15,
          color: accent,
          letterSpacing: "0.01em",
        }}
      >
        {name}
      </div>

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
        {email && (
          <span className="text-[11px] text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
            {email}
          </span>
        )}
        <span className="text-[11px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
          {dateStr} · {timeStr}
        </span>
      </div>

      {/* Sig ID */}
      {hash && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <ShieldCheck className="h-2.5 w-2.5 shrink-0" style={{ color: accent, opacity: 0.6 }} />
          <span className="text-[9px] font-mono tracking-widest" style={{ color: accent, opacity: 0.55 }}>
            SIG-{shortHash(hash)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Signing panel (interactive) ─────────────────────────────────────────────

interface SignaturePanelProps {
  userId:      string
  name:        string
  email:       string
  recordId:    number
  role:        SignerRole
  confirmText: string
  onSign:      (data: SignatureData) => void
  signing:     boolean
}

export function SignaturePanel({
  userId,
  name,
  email,
  recordId,
  role,
  confirmText,
  onSign,
  signing,
}: SignaturePanelProps) {
  const [expanded,  setExpanded]  = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const roleColors: Record<SignerRole, { accent: string; bg: string; border: string; borderActive: string }> = {
    Manager:    { accent: "var(--skyshare-gold)",  bg: "rgba(212,160,23,0.05)",  border: "rgba(212,160,23,0.15)",  borderActive: "rgba(212,160,23,0.4)" },
    Technician: { accent: "#4e7fa0",               bg: "rgba(70,100,129,0.06)",  border: "rgba(70,100,129,0.18)",  borderActive: "rgba(70,100,129,0.45)" },
    Witness:    { accent: "#10b981",               bg: "rgba(16,185,129,0.05)", border: "rgba(16,185,129,0.15)", borderActive: "rgba(16,185,129,0.4)" },
  }
  const { accent, bg, border, borderActive } = roleColors[role]

  async function handleSign() {
    if (!confirmed || signing) return
    const timestamp = new Date().toISOString()
    const hash      = await computeSignatureHash(userId, recordId, timestamp)
    onSign({ hash, shortHash: shortHash(hash), timestamp, name, email })
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
        style={{ background: bg, border: `1px solid ${border}`, color: accent, fontFamily: "var(--font-heading)" }}
      >
        <CheckCheck className="h-3.5 w-3.5" />
        Sign &amp; Acknowledge
      </button>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderActive}`, background: bg }}>

      {/* Signature preview */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[9px] uppercase tracking-widest mb-3"
          style={{ color: accent, fontFamily: "var(--font-heading)", opacity: 0.7 }}>
          {role} Signature Preview
        </p>

        {/* The signature line */}
        <div className="pb-2 mb-1" style={{ borderBottom: `1px solid ${accent}`, borderBottomOpacity: 0.3 }}>
          <div
            style={{
              fontFamily: "'Dancing Script', cursive",
              fontSize: "2rem",
              lineHeight: 1.2,
              color: accent,
            }}
          >
            {name}
          </div>
        </div>

        {/* Identity details */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2">
          <span className="text-xs text-white/50" style={{ fontFamily: "var(--font-heading)" }}>
            {email}
          </span>
          <span className="text-xs text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <p className="text-[10px] text-white/20 mt-1" style={{ fontFamily: "var(--font-heading)" }}>
          Sig ID will be assigned at time of signing
        </p>
      </div>

      {/* Confirm checkbox */}
      <div className="px-5 py-3" style={{ borderTop: `1px solid rgba(255,255,255,0.07)` }}>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 shrink-0"
            style={{ width: 14, height: 14, accentColor: accent }}
          />
          <span className="text-xs leading-relaxed text-white/55 group-hover:text-white/70 transition-colors select-none">
            {confirmText}
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.1)" }}>
        <button
          onClick={() => { setExpanded(false); setConfirmed(false) }}
          disabled={signing}
          className="text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-40"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSign}
          disabled={!confirmed || signing}
          className="inline-flex items-center gap-2 px-5 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80 disabled:opacity-35"
          style={{
            background: accent,
            color: role === "Manager" ? "hsl(0 0% 8%)" : "#fff",
            fontFamily: "var(--font-heading)",
            letterSpacing: "0.1em",
          }}
        >
          {signing ? (
            <>
              <span className="animate-pulse">Signing…</span>
            </>
          ) : (
            <>
              <CheckCheck className="h-3 w-3" />
              Sign &amp; Acknowledge
            </>
          )}
        </button>
      </div>
    </div>
  )
}
