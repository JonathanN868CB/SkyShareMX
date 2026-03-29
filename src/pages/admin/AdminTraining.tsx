import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, GraduationCap, RefreshCw, WifiOff } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { useTraining } from "@/hooks/useTraining"
import TrainingConnect from "@/pages/training/TrainingConnect"
import TrainingDashboard from "@/pages/training/TrainingDashboard"
import type { Profile } from "@/entities/supabase"

// ─── User list ────────────────────────────────────────────────────────────────

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "Active")
    .order("full_name", { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

function SyncBadge({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <span
        className="text-[10px] tracking-wider uppercase"
        style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4, fontFamily: "var(--font-heading)" }}
      >
        Never
      </span>
    )
  }
  return (
    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
      {formatDistanceToNow(new Date(iso), { addSuffix: true })}
    </span>
  )
}

// ─── Per-user training view ───────────────────────────────────────────────────
// Mounted with key={profile.id} so the hook resets when admin switches users

function UserTrainingView({
  profile,
  onBack,
}: {
  profile: Profile
  onBack: () => void
}) {
  const training   = useTraining(profile.id)
  const [relink, setRelink] = useState(false)

  const showConnect = relink || training.linked === false
  const showDash    = !showConnect && training.linked !== null

  function handleConnected() {
    setRelink(false)
    training.refresh()
  }

  const displayName = profile.full_name ?? profile.email

  return (
    <div className="flex flex-col h-full">

      {/* Sub-header */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          <ArrowLeft size={12} />
          Team
        </button>
        <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }}>/</span>
        <span
          className="text-xs font-semibold"
          style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)" }}
        >
          {displayName}
        </span>
        {training.loading && training.linked === null && (
          <RefreshCw size={11} className="animate-spin ml-1" style={{ color: "var(--skyshare-gold)" }} />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {training.linked === null && !relink && (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
              Loading…
            </span>
          </div>
        )}

        {showConnect && (
          <div className="flex flex-col items-center gap-3 py-12 px-8 text-center">
            <WifiOff size={20} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {displayName} hasn't linked a training sheet yet.
            </p>
            {relink && (
              <TrainingConnect onConnected={handleConnected} />
            )}
          </div>
        )}

        {showDash && (
          <TrainingDashboard
            rows={training.rows}
            loading={training.loading}
            lastRefreshed={training.lastRefreshed}
            cooldownLabel={training.cooldownLabel}
            canRefresh={!training.loading}     // no cooldown enforcement for admin
            authExpired={training.authExpired}
            onRefresh={training.refresh}
            onRelink={() => {/* admin cannot re-link on behalf of user */}}
            relinkLabel="User must re-link"
            sheetFileId={profile.training_sheet_file_id ?? null}
          />
        )}
      </div>

    </div>
  )
}

// ─── Team overview table ──────────────────────────────────────────────────────

function TeamOverview({ onSelect }: { onSelect: (p: Profile) => void }) {
  const { profile: adminProfile } = useAuth()
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-training-profiles"],
    queryFn:  fetchProfiles,
    enabled:  adminProfile?.role === "Super Admin",
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
          Loading team…
        </span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Team Member", "Role", "Sheet Linked", "Last Synced", ""].map(h => (
              <th
                key={h}
                className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <tr
              key={p.id}
              className="transition-colors hover:bg-white/[0.02] cursor-pointer"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              onClick={() => onSelect(p)}
            >
              {/* Name */}
              <td className="px-5 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                    {p.full_name ?? p.email}
                  </span>
                  {p.full_name && (
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                      {p.email}
                    </span>
                  )}
                </div>
              </td>

              {/* Role */}
              <td className="px-5 py-3">
                <span
                  className="text-[10px] tracking-wider uppercase"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  {p.role}
                </span>
              </td>

              {/* Linked */}
              <td className="px-5 py-3">
                {p.training_sheet_file_id ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase"
                    style={{
                      background: "rgba(52,211,153,0.1)",
                      color: "#34d399",
                      border: "1px solid rgba(52,211,153,0.2)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Linked
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "hsl(var(--muted-foreground))",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    Not linked
                  </span>
                )}
              </td>

              {/* Last synced */}
              <td className="px-5 py-3">
                <SyncBadge iso={p.training_last_refreshed ?? null} />
              </td>

              {/* View arrow */}
              <td className="px-5 py-3 pr-6 text-right">
                <span
                  className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                >
                  View →
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTraining() {
  const [selected, setSelected] = useState<Profile | null>(null)

  return (
    <div className="flex flex-col h-full">

      {/* Page header — only shown on overview */}
      {!selected && (
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <GraduationCap size={16} style={{ color: "var(--skyshare-gold)" }} />
            <h1
              className="text-lg font-semibold tracking-wide"
              style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}
            >
              Team Training
            </h1>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
            View and refresh training status for your team
          </p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <UserTrainingView
            key={selected.id}
            profile={selected}
            onBack={() => setSelected(null)}
          />
        ) : (
          <TeamOverview onSelect={setSelected} />
        )}
      </div>

    </div>
  )
}
