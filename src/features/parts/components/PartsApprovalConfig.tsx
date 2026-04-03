import { useState, useEffect } from "react"
import { Settings, Save } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { APP_ROLES } from "@/entities/supabase"

interface ApprovalRules {
  enabled: boolean
  require_approval_roles: string[]
  approver_chain: string[]
  notes: string
}

const ASSIGNABLE_ROLES = APP_ROLES.filter(r => r !== "Super Admin")

export function PartsApprovalConfig() {
  const [rules, setRules] = useState<ApprovalRules>({
    enabled: false,
    require_approval_roles: ["Technician"],
    approver_chain: ["Manager", "Admin"],
    notes: "",
  })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("parts_config")
        .select("value")
        .eq("key", "approval_rules")
        .single()

      if (data?.value) setRules(data.value as ApprovalRules)
      setLoaded(true)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from("parts_config")
      .update({ value: rules })
      .eq("key", "approval_rules")

    if (error) toast.error("Failed to save approval config")
    else toast.success("Approval config saved")
    setSaving(false)
  }

  function toggleRole(role: string, list: "require" | "approver") {
    setRules(prev => {
      const key = list === "require" ? "require_approval_roles" : "approver_chain"
      const current = prev[key]
      const updated = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role]
      return { ...prev, [key]: updated }
    })
  }

  if (!loaded) return null

  return (
    <div
      className="rounded-lg border p-5 space-y-5"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }} />
          <h2
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
          >
            Approval Configuration
          </h2>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            background: "rgba(212,160,23,0.15)",
            color: "var(--skyshare-gold)",
            border: "1px solid rgba(212,160,23,0.25)",
          }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Enable/disable */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setRules(prev => ({ ...prev, enabled: !prev.enabled }))}
          className="relative w-10 h-5 rounded-full transition-colors"
          style={{
            background: rules.enabled ? "rgba(212,160,23,0.5)" : "rgba(255,255,255,0.1)",
          }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
            style={{
              background: rules.enabled ? "var(--skyshare-gold)" : "rgba(255,255,255,0.4)",
              left: rules.enabled ? "22px" : "2px",
            }}
          />
        </button>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          {rules.enabled ? "Approval workflow enabled" : "Approval workflow disabled"}
        </span>
      </div>

      {rules.enabled && (
        <>
          {/* Roles that require approval */}
          <div>
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              Roles that require approval before sourcing:
            </p>
            <div className="flex flex-wrap gap-2">
              {ASSIGNABLE_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => toggleRole(role, "require")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: rules.require_approval_roles.includes(role)
                      ? "rgba(212,160,23,0.15)"
                      : "rgba(255,255,255,0.03)",
                    border: rules.require_approval_roles.includes(role)
                      ? "1px solid rgba(212,160,23,0.35)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: rules.require_approval_roles.includes(role)
                      ? "var(--skyshare-gold)"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Approver chain */}
          <div>
            <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              Who can approve (in escalation order):
            </p>
            <div className="flex flex-wrap gap-2">
              {ASSIGNABLE_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => toggleRole(role, "approver")}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: rules.approver_chain.includes(role)
                      ? "rgba(100,220,100,0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: rules.approver_chain.includes(role)
                      ? "1px solid rgba(100,220,100,0.25)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: rules.approver_chain.includes(role)
                      ? "rgba(100,220,100,0.85)"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
