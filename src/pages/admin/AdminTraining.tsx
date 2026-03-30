import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GraduationCap, Link2, Unlink, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import { useAuth } from "@/features/auth"
import type { Profile } from "@/entities/supabase"
import type { MxlmsTechnician } from "@/entities/mxlms"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Label } from "@/shared/ui/label"

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .not("status", "eq", "Pending")
    .order("full_name", { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

async function fetchMxlmsTechnicians(): Promise<MxlmsTechnician[]> {
  const { data, error } = await mxlms
    .from("technicians")
    .select("id,name,tech_code,role,status,email")
    .eq("status", "active")
    .order("name")
  if (error) throw error
  return (data ?? []) as MxlmsTechnician[]
}

// ─── Link Dialog (inline version for this page) ────────────────────────────────

function LinkDialog({
  user,
  technicians,
  open,
  onClose,
}: {
  user: Profile | null
  technicians: MxlmsTechnician[]
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string>("")
  const [saving, setSaving] = useState(false)

  useState(() => {
    if (open && user) {
      setSelectedId(user.mxlms_technician_id != null ? String(user.mxlms_technician_id) : "")
    }
  })

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
      const value = selectedId === "" ? null : Number(selectedId)
      const { error } = await supabase.from("profiles").update({ mxlms_technician_id: value }).eq("id", user.id)
      if (error) throw error
      toast.success(value ? "MX-LMS profile linked" : "MX-LMS link removed")
      qc.invalidateQueries({ queryKey: ["admin-training-profiles"] })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const currentTech = technicians.find(t => String(t.id) === selectedId)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "4px 4px 0 0", marginTop: "-1px", marginLeft: "-1px", marginRight: "-1px", position: "relative", top: "-24px", marginBottom: "-20px" }} />
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>Link to MX-LMS</DialogTitle>
          <DialogDescription className="text-white/35" style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.08em" }}>
            {user?.full_name ?? user?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block" style={{ fontFamily: "var(--font-heading)" }}>
              MX-LMS Technician
            </Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="text-sm text-white/80" style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <SelectValue placeholder="— Not linked —" />
              </SelectTrigger>
              <SelectContent style={{ background: "hsl(0 0% 14%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <SelectItem value="" className="text-white/40 focus:bg-white/10 focus:text-white text-xs italic">— Not linked —</SelectItem>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={String(t.id)} className="text-white/80 focus:bg-white/10 focus:text-white">
                    <span className="font-medium">{t.name}</span>
                    {t.tech_code && <span className="ml-2 text-[11px] text-white/35" style={{ fontFamily: "var(--font-heading)" }}>[{t.tech_code}]</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentTech && (
            <div className="rounded px-3 py-2.5" style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.18)" }}>
              <p className="text-sm text-white/85">{currentTech.name}</p>
              <div className="flex gap-3 text-[11px] text-white/40 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
                {currentTech.tech_code && <span>Code: {currentTech.tech_code}</span>}
                {currentTech.role && <span>· {currentTech.role}</span>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving} className="text-white/40 hover:text-white/60">Cancel</Button>
          <Button onClick={save} disabled={saving}
            style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            {saving ? "Saving…" : "Save Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTraining() {
  const { profile: me } = useAuth()
  const [linkTarget, setLinkTarget] = useState<Profile | null>(null)

  const isSuperAdmin = me?.role === "Super Admin"

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-training-profiles"],
    queryFn:  fetchProfiles,
    enabled:  isSuperAdmin,
  })

  const { data: technicians = [] } = useQuery({
    queryKey: ["mxlms-technicians"],
    queryFn:  fetchMxlmsTechnicians,
    enabled:  isSuperAdmin,
  })

  // Build a lookup map: technician_id → technician
  const techMap = new Map(technicians.map(t => [t.id, t]))

  const linked    = profiles.filter(p => p.mxlms_technician_id != null)
  const unlinked  = profiles.filter(p => p.mxlms_technician_id == null)

  if (!isSuperAdmin) {
    return (
      <div className="hero-area">
        <p className="text-sm text-red-400">Super Admin only.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" style={{ color: "var(--skyshare-gold)" }} />
          <div>
            <h1 className="text-[2.6rem] leading-none text-foreground"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
              TEAM TRAINING
            </h1>
            <div className="mt-1.5" style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Link team members to their MX-LMS profiles to enable My Training &amp; My Journey
        </p>
      </div>

      {/* Info callout */}
      <div className="rounded-lg px-5 py-4 flex items-start gap-3"
        style={{ background: "rgba(70,100,129,0.12)", border: "1px solid rgba(70,100,129,0.2)" }}>
        <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--skyshare-blue-mid, #4e7fa0)" }} />
        <div className="text-xs text-white/50 leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
          Training is managed in <strong className="text-white/70">MX-LMS</strong>. Link each team member here to connect their
          SkyShare account to their MX-LMS technician record — this enables the <strong className="text-white/70">My Training</strong> and{" "}
          <strong className="text-white/70">My Journey™</strong> tabs on their dashboard.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Members",  value: profiles.length,   accent: "var(--skyshare-gold)" },
          { label: "MX-LMS Linked",  value: linked.length,     accent: "var(--skyshare-success, #10b981)" },
          { label: "Not Linked",     value: unlinked.length,   accent: "rgba(255,255,255,0.25)" },
        ].map(stat => (
          <div key={stat.label} className="card-elevated rounded-lg px-5 py-4"
            style={{ borderLeft: `3px solid ${stat.accent}` }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
              {stat.label}
            </p>
            <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: stat.accent }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-elevated rounded-lg overflow-hidden">
        {loadingProfiles ? (
          <div className="py-16 text-center text-sm text-white/25">Loading team…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Team Member", "Role", "MX-LMS Technician", ""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const tech = p.mxlms_technician_id ? techMap.get(p.mxlms_technician_id) : null
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>

                      {/* User */}
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-white/80">{p.full_name ?? "—"}</p>
                        <p className="text-xs text-white/35">{p.email}</p>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                          {p.role}
                        </span>
                      </td>

                      {/* MX-LMS link */}
                      <td className="px-5 py-3.5">
                        {tech ? (
                          <div className="flex items-center gap-2">
                            <Link2 size={12} style={{ color: "var(--skyshare-gold)" }} />
                            <div>
                              <p className="text-sm text-white/75">{tech.name}</p>
                              {tech.tech_code && (
                                <p className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>{tech.tech_code}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Unlink size={12} className="text-white/15" />
                            <span className="text-xs text-white/25">Not linked</span>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 pr-6 text-right">
                        <button
                          onClick={() => setLinkTarget(p)}
                          className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-70"
                          style={{
                            color: tech ? "rgba(255,255,255,0.3)" : "var(--skyshare-gold)",
                            fontFamily: "var(--font-heading)",
                          }}
                        >
                          {tech ? "Edit →" : "Link →"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LinkDialog
        user={linkTarget}
        technicians={technicians}
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
      />
    </div>
  )
}
