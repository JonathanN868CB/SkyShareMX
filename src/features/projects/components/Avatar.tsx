import type { PmProfile } from "@/entities/supabase"

interface AvatarProps {
  profile: PmProfile
  size?: "sm" | "md"
  className?: string
}

export function Avatar({ profile, size = "sm", className = "" }: AvatarProps) {
  const dim = size === "sm" ? 26 : 34
  const fontSize = size === "sm" ? "9px" : "12px"

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name ?? profile.full_name}
        style={{ width: dim, height: dim, borderRadius: "50%", objectFit: "cover" }}
        className={className}
      />
    )
  }

  return (
    <div
      title={profile.display_name ?? profile.full_name}
      style={{
        width:           dim,
        height:          dim,
        borderRadius:    "50%",
        background:      profile.avatar_color || "#466481",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontSize,
        fontFamily:      "var(--font-heading)",
        fontWeight:      700,
        color:           "#fff",
        letterSpacing:   "0.05em",
        flexShrink:      0,
      }}
      className={className}
    >
      {profile.avatar_initials}
    </div>
  )
}
