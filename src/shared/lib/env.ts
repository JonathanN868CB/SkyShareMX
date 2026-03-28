export const ALLOWED_EMAIL_DOMAIN = "skyshare.com"
export const MASTER_ADMIN_EMAIL = "jonathan@skyshare.com"

export function getSupabaseUrl(): string {
  const value = import.meta.env.VITE_SUPABASE_URL
  if (!value) throw new Error("Missing VITE_SUPABASE_URL")
  return value
}

export function getSupabaseAnonKey(): string {
  const value = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!value) throw new Error("Missing VITE_SUPABASE_ANON_KEY")
  return value
}

export function getPublicSiteUrl(): string {
  return import.meta.env.VITE_SITE_URL ?? window.location.origin
}

export function isAllowedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
}
