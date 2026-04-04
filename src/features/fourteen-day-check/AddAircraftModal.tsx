// AddAircraftModal — Admin flow to enroll a new aircraft in the 14-day check system.
// Picks aircraft from fleet, selects template, optionally sets Traxxall URL.
// On confirm: creates token → shows permanent URL + QR immediately.

import { useState, useEffect } from "react"
import { X, QrCode, Check, Copy, ExternalLink } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { encodeToken } from "@/shared/lib/tokenEncoder"
import { useInvalidateChecks } from "@/hooks/useFourteenDayChecks"
import { supabase } from "@/lib/supabase"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

type AircraftOption = { id: string; registration: string; model: string }
type TemplateOption = { id: string; name: string; aircraft_type: string | null }

type Props = {
  enrolledAircraftIds: Set<string>
  onClose: () => void
}

type Step = "form" | "success"

export function AddAircraftModal({ enrolledAircraftIds, onClose }: Props) {
  const [step, setStep] = useState<Step>("form")
  const [aircraft, setAircraft] = useState<AircraftOption[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedAircraftId, setSelectedAircraftId] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [traxxallUrl, setTraxxallUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<{ encodedToken: string; registration: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const invalidate = useInvalidateChecks()

  // Load available aircraft (not already enrolled) and templates
  useEffect(() => {
    const load = async () => {
      const [
        { data: acRows },
        { data: regRows },
        { data: tplRows },
      ] = await Promise.all([
        db.from("aircraft").select("id, model_full").eq("status", "active"),
        db.from("aircraft_registrations").select("aircraft_id, registration").eq("is_current", true),
        db.from("inspection_card_templates").select("id, name, aircraft_type").order("name"),
      ])

      const regMap = new Map<string, string>(
        (regRows ?? []).map((r: { aircraft_id: string; registration: string }) =>
          [r.aircraft_id, r.registration] as const
        )
      )

      const available: AircraftOption[] = (acRows ?? [])
        .filter((a: { id: string }) => !enrolledAircraftIds.has(a.id) && regMap.has(a.id))
        .map((a: { id: string; model_full: string }) => ({
          id: a.id,
          registration: regMap.get(a.id)!,
          model: a.model_full,
        }))
        .sort((a: AircraftOption, b: AircraftOption) => a.registration.localeCompare(b.registration))

      setAircraft(available)
      setTemplates(tplRows ?? [])

      // Auto-select first template if only one
      if (tplRows?.length === 1) setSelectedTemplateId(tplRows[0].id)
    }
    load()
  }, [enrolledAircraftIds])

  async function handleCreate() {
    if (!selectedAircraftId || !selectedTemplateId) return
    setError(null)
    setSaving(true)

    try {
      // Get the template's field_schema
      const { data: tpl, error: tplErr } = await db
        .from("inspection_card_templates")
        .select("field_schema")
        .eq("id", selectedTemplateId)
        .single()

      if (tplErr || !tpl) throw new Error("Failed to load template")

      // Get current user's profile id
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")

      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .single()

      if (!profile) throw new Error("Profile not found")

      // Create token
      const { data: token, error: tokenErr } = await db
        .from("fourteen_day_check_tokens")
        .insert({
          aircraft_id: selectedAircraftId,
          field_schema: tpl.field_schema,
          template_id: selectedTemplateId,
          traxxall_url: traxxallUrl.trim() || null,
          created_by: profile.id,
        })
        .select("token")
        .single()

      if (tokenErr || !token) {
        if (tokenErr?.code === "23505") throw new Error("This aircraft is already enrolled.")
        throw new Error(tokenErr?.message ?? "Failed to create token")
      }

      const ac = aircraft.find(a => a.id === selectedAircraftId)!
      setCreatedToken({
        encodedToken: encodeToken(token.token),
        registration: ac.registration,
      })
      setStep("success")
      invalidate()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const checkUrl = createdToken
    ? `${window.location.origin}/check/${createdToken.encodedToken}`
    : ""

  function handleCopy() {
    navigator.clipboard.writeText(checkUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative rounded-xl overflow-hidden w-full max-w-md"
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <p
                className="text-[10px] font-bold tracking-[0.25em] uppercase"
                style={{ color: "rgba(212,160,23,0.7)" }}
              >
                14-Day Check
              </p>
              <p className="text-base font-semibold mt-0.5" style={{ color: "#fff" }}>
                {step === "form" ? "Enroll Aircraft" : "Aircraft Enrolled"}
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

          {step === "form" ? (
            <div className="px-5 py-5 space-y-4">
              {/* Aircraft selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Aircraft <span style={{ color: "#d4a017" }}>*</span>
                </label>
                {aircraft.length === 0 ? (
                  <p className="text-sm py-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                    All active aircraft are already enrolled.
                  </p>
                ) : (
                  <select
                    value={selectedAircraftId}
                    onChange={e => setSelectedAircraftId(e.target.value)}
                    className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: selectedAircraftId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    <option value="">Select aircraft…</option>
                    {aircraft.map(ac => (
                      <option key={ac.id} value={ac.id}>
                        {ac.registration} — {ac.model}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Template selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Inspection Card Template <span style={{ color: "#d4a017" }}>*</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: selectedTemplateId ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
                  }}
                >
                  <option value="">Select template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Traxxall URL (optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Traxxall Link{" "}
                  <span className="font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
                </label>
                <input
                  type="url"
                  value={traxxallUrl}
                  onChange={e => setTraxxallUrl(e.target.value)}
                  placeholder="https://app.traxxall.com/…"
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-md text-sm transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!selectedAircraftId || !selectedTemplateId || saving || aircraft.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(212,160,23,0.15)",
                    border: "1px solid rgba(212,160,23,0.35)",
                    color: "#d4a017",
                  }}
                >
                  <QrCode className="w-4 h-4" />
                  {saving ? "Creating…" : "Create & Get Link"}
                </button>
              </div>
            </div>
          ) : (
            /* Success state */
            <div className="px-5 py-6 space-y-5">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
                >
                  <Check className="w-3.5 h-3.5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#fff" }}>
                    {createdToken?.registration} enrolled successfully
                  </p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Permanent check link is now live
                  </p>
                </div>
              </div>

              {/* QR */}
              {createdToken && (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ background: "#fff" }}>
                    <QRCodeSVG value={checkUrl} size={160} level="M" fgColor="#111" bgColor="#fff" />
                  </div>

                  <div
                    className="w-full rounded-md px-3 py-2 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <span className="flex-1 text-xs truncate font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {checkUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex-shrink-0 p-1 rounded"
                      style={{ color: copied ? "#4ade80" : "rgba(255,255,255,0.4)" }}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={checkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1 rounded"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-md text-sm font-medium"
                style={{
                  background: "rgba(212,160,23,0.12)",
                  border: "1px solid rgba(212,160,23,0.3)",
                  color: "#d4a017",
                }}
              >
                Done
              </button>
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
