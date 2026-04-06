import { useState, useEffect } from "react"
import { X, UserPlus, Trash2, Search } from "lucide-react"
import { Input } from "@/shared/ui/input"
import type { PmBoardMember, PmProfile } from "@/entities/supabase"
import { Avatar } from "./Avatar"
import { useBoardMemberMutations, fetchAllProfiles } from "../hooks/useBoardMembers"
import { useAuth } from "@/features/auth"

interface BoardMembersPanelProps {
  boardId:      string
  members:      (PmBoardMember & { profile: PmProfile })[]
  createdBy:    string
  onClose:      () => void
}

export function BoardMembersPanel({ boardId, members, createdBy, onClose }: BoardMembersPanelProps) {
  const { profile: currentProfile } = useAuth()
  const { addMember, removeMember } = useBoardMemberMutations(boardId)
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [search, setSearch] = useState("")

  const isOwner = currentProfile?.id === createdBy
  const isAdmin = currentProfile?.role === "Super Admin" || currentProfile?.role === "Admin"
  const canManage = isOwner || isAdmin

  useEffect(() => {
    fetchAllProfiles().then(setAllProfiles).catch(() => {})
  }, [])

  const memberIds = new Set(members.map(m => m.profile_id))
  const nonMembers = allProfiles.filter(p =>
    !memberIds.has(p.id) &&
    (search === "" ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.display_name?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div
      style={{
        position:     "fixed",
        inset:        0,
        zIndex:       500,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
      }}
    >
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div
        style={{
          position:      "relative",
          zIndex:        501,
          background:    "hsl(0 0% 14%)",
          border:        "1px solid rgba(255,255,255,0.1)",
          borderRadius:  10,
          width:         420,
          maxHeight:     "70vh",
          display:       "flex",
          flexDirection: "column",
          boxShadow:     "0 16px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#fff" }}>
            Board Members
          </span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          {/* Current members */}
          <div>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 10px" }}>
              {members.length} {members.length === 1 ? "Member" : "Members"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {members.map(m => (
                <div
                  key={m.id}
                  style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          10,
                    padding:      "6px 10px",
                    background:   "hsl(0 0% 18%)",
                    borderRadius: 6,
                    border:       "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Avatar profile={m.profile} size="sm" />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#fff" }}>{m.profile.display_name ?? m.profile.full_name}</p>
                    {m.profile_id === createdBy && (
                      <p style={{ margin: 0, fontSize: 9, fontFamily: "var(--font-heading)", letterSpacing: "0.1em", color: "#D4A017", textTransform: "uppercase" }}>Owner</p>
                    )}
                  </div>
                  {canManage && m.profile_id !== createdBy && m.profile_id !== currentProfile?.id && (
                    <button
                      onClick={() => removeMember.mutate(m.profile_id)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 4 }}
                      className="hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add members */}
          {canManage && (
            <div>
              <p style={{ fontFamily: "var(--font-heading)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>
                Add Members
              </p>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search users…"
                  style={{ paddingLeft: 30, background: "hsl(0 0% 16%)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 12 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 160, overflowY: "auto" }}>
                {nonMembers.length === 0 ? (
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "8px 0" }}>
                    {search ? "No users found" : "All users are already members"}
                  </p>
                ) : nonMembers.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => { addMember.mutate(p.id); setSearch("") }}
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          8,
                      padding:      "6px 10px",
                      borderRadius: 4,
                      cursor:       "pointer",
                    }}
                    className="hover:bg-white/5"
                  >
                    <Avatar profile={p} size="sm" />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                      {p.display_name ?? p.full_name}
                    </span>
                    <UserPlus size={11} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.25)" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
