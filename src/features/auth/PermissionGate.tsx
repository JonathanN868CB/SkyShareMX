import { Navigate, useSearchParams } from "react-router-dom"
import { useAuth } from "./AuthContext"
import type { AppSection } from "@/entities/supabase"

interface Props {
  /** The permission section required to view this route */
  section: AppSection
  /** If true, only Super Admin / Admin can access (admin pages) */
  adminOnly?: boolean
  /** If true, only Super Admin can access */
  superAdminOnly?: boolean
  children: React.ReactNode
}

/**
 * Route-level permission guard.
 *
 * Wraps a page component and redirects to /app/access-restricted
 * if the current user lacks the required permission.
 * This is the authoritative enforcement layer — the sidebar simply
 * hides nav items, but this component prevents actual access.
 */
export function PermissionGate({ section, adminOnly, superAdminOnly, children }: Props) {
  const { profile, permissions, loading } = useAuth()

  // Still loading auth — don't flash the restricted page
  if (loading || !profile) return null

  const role = profile.role ?? ""
  const isSuperAdmin = role === "Super Admin"
  const isAdmin = isSuperAdmin || role === "Admin"

  // Super-admin-only gate (e.g. admin pages)
  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to={`/app/access-restricted?feature=${encodeURIComponent(section)}`} replace />
  }

  // Admin-only gate
  if (adminOnly && !isAdmin) {
    return <Navigate to={`/app/access-restricted?feature=${encodeURIComponent(section)}`} replace />
  }

  // Admins always have access to everything
  if (isAdmin) return <>{children}</>

  // Standard permission check
  if (!permissions.includes(section)) {
    return <Navigate to={`/app/access-restricted?feature=${encodeURIComponent(section)}`} replace />
  }

  return <>{children}</>
}
