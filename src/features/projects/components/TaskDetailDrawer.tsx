import { useState, useEffect, useRef } from "react"
import { X, Calendar, Send, Paperclip, Download, Trash2, User, Users, FileText, UserPlus, ChevronDown } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import type { PmTaskWithRelations, PmStatus, PmProfile, PmBoardMember } from "@/entities/supabase"
import { Avatar } from "./Avatar"
import { StatusPill } from "./StatusPill"
import { useTaskMutations } from "../hooks/useTaskMutations"
import { useComments, useCommentMutations } from "../hooks/useComments"
import { useAttachments, useAttachmentMutations } from "../hooks/useAttachments"
import { useAuth } from "@/features/auth"

interface TaskDetailDrawerProps {
  task:          PmTaskWithRelations | null
  statuses:      PmStatus[]
  members:       (PmBoardMember & { profile: PmProfile })[]
  boardId:       string
  onClose: () => void
}

// ─── Shared dropdown helper ────────────────────────────────────────────────────
function MemberDropdown({
  members,
  onSelect,
  onClose,
}: {
  members:  PmProfile[]
  onSelect: (id: string) => void
  onClose:  () => void
}) {
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = members.filter(m =>
    (m.display_name ?? m.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      style={{
        position:    "absolute",
        top:         "calc(100% + 6px)",
        left:        0,
        zIndex:      300,
        background:  "hsl(0 0% 13%)",
        border:      "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        boxShadow:   "0 12px 32px rgba(0,0,0,0.6)",
        width:       240,
        overflow:    "hidden",
      }}
    >
      <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          onKeyDown={e => { if (e.key === "Escape") onClose() }}
          style={{
            width:      "100%",
            background: "hsl(0 0% 18%)",
            border:     "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            padding:    "5px 8px",
            fontSize:   12,
            color:      "#fff",
            outline:    "none",
            fontFamily: "var(--font-body)",
          }}
        />
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <p style={{ padding: "10px 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No members found</p>
        ) : filtered.map(m => (
          <button
            key={m.id}
            onClick={() => { onSelect(m.id); onClose() }}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        10,
              width:      "100%",
              padding:    "8px 12px",
              background: "transparent",
              border:     "none",
              cursor:     "pointer",
              textAlign:  "left",
            }}
            className="hover:bg-white/[0.06]"
          >
            <Avatar profile={m} size="sm" />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              {m.display_name ?? m.full_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Champion picker — single select ──────────────────────────────────────────
function ChampionPicker({
  selected,
  members,
  onSelect,
}: {
  selected: string | null
  members:  PmProfile[]
  onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const profile = members.find(m => m.id === selected) ?? null

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {profile ? (
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          10,
            padding:      "7px 10px",
            background:   "hsl(0 0% 17%)",
            border:       "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7,
          }}
        >
          <Avatar profile={profile} size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.display_name ?? profile.full_name}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em", marginTop: 1 }}>
              CHAMPION
            </div>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: "2px 4px", borderRadius: 3, display: "flex" }}
            className="hover:bg-white/10 hover:text-white"
            title="Change champion"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={() => onSelect(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: "2px 4px", borderRadius: 3, display: "flex" }}
            className="hover:bg-red-500/10 hover:text-red-400"
            title="Remove champion"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            padding:      "8px 12px",
            background:   "transparent",
            border:       "1px dashed rgba(255,255,255,0.15)",
            borderRadius: 7,
            cursor:       "pointer",
            color:        "rgba(255,255,255,0.4)",
            fontSize:     12,
            fontFamily:   "var(--font-heading)",
            letterSpacing: "0.06em",
            width:        "100%",
          }}
          className="hover:border-[rgba(212,160,23,0.4)] hover:text-[rgba(212,160,23,0.7)]"
        >
          <UserPlus size={14} />
          Assign champion
        </button>
      )}

      {open && (
        <MemberDropdown
          members={members}
          onSelect={id => { onSelect(id); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Contributors picker — multi select chips ──────────────────────────────────
function ContributorsPicker({
  selected,
  members,
  onSelect,
}: {
  selected: string[]
  members:  PmProfile[]
  onSelect: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const selectedProfiles = members.filter(m => selected.includes(m.id))
  const available        = members.filter(m => !selected.includes(m.id))

  function remove(id: string) { onSelect(selected.filter(x => x !== id)) }
  function add(id: string)    { onSelect([...selected, id]); setOpen(false) }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {selectedProfiles.map(p => (
          <div
            key={p.id}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          6,
              padding:      "4px 8px 4px 4px",
              background:   "hsl(0 0% 20%)",
              border:       "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
            }}
          >
            <Avatar profile={p} size="sm" />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
              {p.display_name ?? p.full_name}
            </span>
            <button
              onClick={() => remove(p.id)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, display: "flex", lineHeight: 1 }}
              className="hover:text-red-400"
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {available.length > 0 && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          5,
              padding:      "4px 10px",
              background:   open ? "rgba(212,160,23,0.1)" : "transparent",
              border:       "1px dashed rgba(255,255,255,0.18)",
              borderRadius: 20,
              cursor:       "pointer",
              fontSize:     11,
              color:        "rgba(255,255,255,0.4)",
              fontFamily:   "var(--font-heading)",
              letterSpacing: "0.06em",
            }}
            className="hover:border-[rgba(212,160,23,0.4)] hover:text-[rgba(212,160,23,0.7)]"
          >
            <UserPlus size={12} />
            {selectedProfiles.length === 0 ? "Add contributors" : "Add"}
          </button>
        )}

        {selectedProfiles.length === 0 && available.length === 0 && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No other members to add</span>
        )}
      </div>

      {open && (
        <MemberDropdown
          members={available}
          onSelect={add}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

export function TaskDetailDrawer({ task, statuses, members, boardId, onClose }: TaskDetailDrawerProps) {
  const { profile } = useAuth()
  const { updateTask, setContributors } = useTaskMutations(boardId)
  const { data: comments } = useComments(task?.id ?? null)
  const { addComment, deleteComment } = useCommentMutations(task?.id ?? "", boardId)
  const { data: attachments } = useAttachments(task?.id ?? null)
  const { uploadAttachment, deleteAttachment, getDownloadUrl } = useAttachmentMutations(task?.id ?? "", boardId)

  const [commentText,  setCommentText]  = useState("")
  const [editedName,   setEditedName]   = useState(task?.name ?? "")
  const [editedNote,   setEditedNote]   = useState(task?.completion_note ?? "")
  const [uploading,    setUploading]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (task) {
      setEditedName(task.name)
      setEditedNote(task.completion_note ?? "")
    }
  }, [task?.id])

  if (!task) return null

  const memberProfiles = members.map(m => m.profile)
  const championId     = task.champion?.id ?? null
  const contributorIds = task.contributors.map(c => c.id)

  function handleNameBlur() {
    if (editedName.trim() && editedName !== task!.name) {
      updateTask.mutate({ id: task!.id, name: editedName.trim() })
    }
  }

  function handleNoteBlur() {
    if (editedNote !== (task!.completion_note ?? "")) {
      updateTask.mutate({ id: task!.id, completion_note: editedNote || null })
    }
  }

  async function handleSendComment() {
    if (!commentText.trim()) return
    await addComment.mutateAsync(commentText.trim())
    setCommentText("")
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadAttachment.mutateAsync(file)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDownload(storagePath: string, fileName: string) {
    const url = await getDownloadUrl(storagePath)
    const a = document.createElement("a")
    a.href = url; a.download = fileName; a.click()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.4)" }}
      />

      {/* Drawer */}
      <div
        style={{
          position:    "fixed",
          top:         0,
          right:       0,
          bottom:      0,
          width:       480,
          zIndex:      401,
          background:  "hsl(0 0% 14%)",
          borderLeft:  "1px solid rgba(255,255,255,0.08)",
          display:     "flex",
          flexDirection: "column",
          boxShadow:   "-8px 0 32px rgba(0,0,0,0.5)",
          overflowY:   "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <input
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              style={{
                background:    "transparent",
                border:        "none",
                outline:       "none",
                fontSize:      18,
                fontWeight:    600,
                color:         "#fff",
                width:         "100%",
                fontFamily:    "var(--font-body)",
                lineHeight:    1.3,
              }}
            />
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1 }}>

          {/* Status — compact inline */}
          <SectionCard accentColor="#D4A017">
            <SectionHeader label="Status" icon={<span style={{ width: 8, height: 8, borderRadius: "50%", background: task.status?.color ?? "#6b7280", display: "inline-block" }} />} />
            <div style={{ padding: "10px 14px" }}>
              <StatusPill
                status={task.status}
                statuses={statuses}
                onSelect={statusId => updateTask.mutate({ id: task.id, status_id: statusId })}
              />
            </div>
          </SectionCard>

          {/* People — Champion + Contributors grouped */}
          <SectionCard accentColor="#466481">
            <SectionHeader label="People" icon={<Users size={12} />} />
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <FieldLabel label="Champion" icon={<User size={11} />} />
                <ChampionPicker
                  selected={championId}
                  members={memberProfiles}
                  onSelect={id => updateTask.mutate({ id: task.id, champion_id: id })}
                />
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div>
                <FieldLabel label="Contributors" icon={<Users size={11} />} />
                <ContributorsPicker
                  selected={contributorIds}
                  members={memberProfiles}
                  onSelect={ids => setContributors.mutate({ taskId: task.id, profileIds: ids })}
                />
              </div>
            </div>
          </SectionCard>

          {/* Schedule */}
          <SectionCard accentColor="#10B981">
            <SectionHeader label="Schedule" icon={<Calendar size={12} />} />
            <div style={{ padding: "12px 14px" }}>
              <FieldLabel label="Due Date" />
              <input
                type="date"
                defaultValue={task.due_date ?? ""}
                onChange={e => updateTask.mutate({ id: task.id, due_date: e.target.value || null })}
                style={{
                  background:   "hsl(0 0% 18%)",
                  border:       "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  color:        "#fff",
                  padding:      "7px 10px",
                  fontSize:     13,
                  fontFamily:   "var(--font-body)",
                  cursor:       "pointer",
                  width:        "100%",
                  outline:      "none",
                }}
              />
            </div>
          </SectionCard>

          {/* Completion note */}
          <SectionCard accentColor="#8B5CF6">
            <SectionHeader label="Completion Note" icon={<FileText size={12} />} />
            <div style={{ padding: "10px 14px" }}>
              <Textarea
                value={editedNote}
                onChange={e => setEditedNote(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="Add a completion note…"
                rows={3}
                style={{ background: "hsl(0 0% 18%)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, resize: "vertical" }}
              />
            </div>
          </SectionCard>

          {/* Attachments */}
          <SectionCard accentColor="#F59E0B">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SectionHeader label="Attachments" icon={<Paperclip size={12} />} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 10, fontFamily: "var(--font-heading)", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)", marginRight: 14, marginTop: 2 }}
                className="hover:border-[rgba(212,160,23,0.5)] hover:text-[#D4A017]"
              >
                {uploading ? "Uploading…" : "+ Upload"}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            </div>

            <div style={{ padding: "8px 14px 12px" }}>
            {attachments && attachments.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {attachments.map(att => (
                  <div
                    key={att.id}
                    style={{
                      display:     "flex",
                      alignItems:  "center",
                      gap:         8,
                      padding:     "6px 10px",
                      background:  "hsl(0 0% 18%)",
                      borderRadius: 5,
                      border:      "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Paperclip size={11} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {att.file_name}
                    </span>
                    {att.file_size && (
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                        {(att.file_size / 1024).toFixed(0)}KB
                      </span>
                    )}
                    <button
                      onClick={() => handleDownload(att.storage_path, att.file_name)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 2 }}
                      className="hover:text-[#D4A017]"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={() => deleteAttachment.mutate({ id: att.id, storagePath: att.storage_path })}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 2 }}
                      className="hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No attachments yet.</p>
            )}
            </div>
          </SectionCard>

          {/* Comments */}
          <SectionCard accentColor="#466481">
            <SectionHeader label="Comments" icon={<Send size={12} />} />
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {comments && comments.length > 0 ? comments.map(c => (
                <div key={c.id} style={{ display: "flex", gap: 8 }}>
                  <Avatar profile={c.author} size="sm" />
                  <div style={{ flex: 1, background: "hsl(0 0% 18%)", borderRadius: 6, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
                        {c.author.display_name ?? c.author.full_name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                          {formatDate(c.created_at)} {formatTime(c.created_at)}
                        </span>
                        {profile?.id === c.author_id && (
                          <button
                            onClick={() => deleteComment.mutate(c.id)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", padding: 0 }}
                            className="hover:text-red-400"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {c.content}
                    </p>
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No comments yet.</p>
              )}

              {/* Comment input */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
                {profile && (
                  <Avatar
                    profile={{
                      id: profile.id,
                      full_name: profile.full_name ?? "",
                      display_name: profile.display_name ?? null,
                      avatar_color: profile.avatar_color ?? "#466481",
                      avatar_initials: profile.avatar_initials ?? "?",
                      avatar_url: profile.avatar_url ?? null,
                    }}
                    size="sm"
                  />
                )}
                <div style={{ flex: 1, position: "relative" }}>
                  <Textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    rows={2}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
                    style={{ background: "hsl(0 0% 18%)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, resize: "none", paddingRight: 40 }}
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={!commentText.trim() || addComment.isPending}
                    style={{
                      position: "absolute", right: 8, bottom: 8,
                      background: commentText.trim() ? "#D4A017" : "rgba(255,255,255,0.08)",
                      border: "none", borderRadius: 4,
                      padding: "3px 6px", cursor: "pointer",
                      color: commentText.trim() ? "#000" : "rgba(255,255,255,0.25)",
                      transition: "all 0.1s",
                    }}
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function FieldLabel({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
      {icon && <span style={{ color: "rgba(255,255,255,0.35)" }}>{icon}</span>}
      <span style={{ fontFamily: "var(--font-heading)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
        {label}
      </span>
    </div>
  )
}

function SectionCard({ accentColor, children }: { accentColor: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 8,
        border:       "1px solid rgba(255,255,255,0.09)",
        borderLeft:   `3px solid ${accentColor}`,
        overflow:     "hidden",
        background:   "hsl(0 0% 16%)",
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          6,
        padding:      "8px 14px",
        background:   "hsl(0 0% 13%)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {icon && <span style={{ color: "rgba(255,255,255,0.4)", display: "flex" }}>{icon}</span>}
      <span style={{ fontFamily: "var(--font-heading)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
        {label}
      </span>
    </div>
  )
}
