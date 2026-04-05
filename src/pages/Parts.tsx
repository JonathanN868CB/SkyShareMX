import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Package, Settings } from "lucide-react"
import { useAuth } from "@/features/auth"
import { PartsDashboard } from "@/features/parts/components/PartsDashboard"
import { PartsApprovalConfig } from "@/features/parts/components/PartsApprovalConfig"

export default function Parts() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === "Super Admin" || profile?.role === "Admin"
  const [showConfig, setShowConfig] = useState(false)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6" style={{ color: "var(--skyshare-gold)" }} />
          <h1
            className="text-2xl font-bold tracking-wide"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Parts
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                background: showConfig ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.05)",
                border: showConfig ? "1px solid rgba(212,160,23,0.25)" : "1px solid rgba(255,255,255,0.1)",
                color: showConfig ? "var(--skyshare-gold)" : "rgba(255,255,255,0.5)",
              }}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => navigate("/app/beet-box/parts/new")}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: "var(--skyshare-gold)",
              color: "#111",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>
      </div>

      {/* Admin config panel */}
      {showConfig && isAdmin && <PartsApprovalConfig />}

      <PartsDashboard />
    </div>
  )
}
