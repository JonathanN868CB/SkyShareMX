import { useState } from "react"
import { useTraining } from "@/hooks/useTraining"
import { useAuth } from "@/features/auth"
import TrainingConnect from "./TrainingConnect"
import TrainingDashboard from "./TrainingDashboard"

export default function MyTraining() {
  const training = useTraining()
  const { profile } = useAuth()

  // When Google auth expires the user must re-link — reset to connect state
  const [forceRelink, setForceRelink] = useState(false)

  // linked === null means we haven't heard back from the server yet (initial load)
  const showConnect = forceRelink || training.linked === false
  const showDash    = !showConnect && training.linked !== null

  function handleConnected() {
    setForceRelink(false)
    training.refresh()
  }

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div
        className="px-6 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-baseline gap-3">
          <h1
            className="text-lg font-semibold tracking-wide"
            style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}
          >
            My Training
          </h1>
          {training.loading && training.linked === null && (
            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
              Loading…
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
          Your open training assignments
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {/* Skeleton / initial load */}
        {training.linked === null && !forceRelink && (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
              Loading…
            </span>
          </div>
        )}

        {showConnect && (
          <TrainingConnect onConnected={handleConnected} />
        )}

        {showDash && (
          <TrainingDashboard
            rows={training.rows}
            loading={training.loading}
            lastRefreshed={training.lastRefreshed}
            cooldownLabel={training.cooldownLabel}
            canRefresh={training.canRefresh}
            authExpired={training.authExpired}
            onRefresh={training.refresh}
            onRelink={() => setForceRelink(true)}
            sheetFileId={profile?.training_sheet_file_id ?? null}
          />
        )}
      </div>

    </div>
  )
}
