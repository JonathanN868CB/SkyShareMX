import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { AppSection, Profile } from "@/entities/supabase"

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  permissions: AppSection[]
  loading: boolean
  isFirstLogin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<AppSection[]>([])
  const [loading, setLoading] = useState(true)
  const [isFirstLogin, setIsFirstLogin] = useState(false)

  useEffect(() => {
    // On the OAuth callback page, getSession() may return null before the PKCE
    // code has been exchanged. Keep loading=true here and let onAuthStateChange
    // resolve it once Supabase fires SIGNED_IN — otherwise ProtectedRoute bounces
    // to the login page for a brief flash.
    const onCallbackPage = window.location.pathname === "/auth/callback"

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else if (!onCallbackPage) {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        if (event !== "INITIAL_SESSION" || !onCallbackPage) {
          setProfile(null)
          setPermissions([])
          setLoading(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single()

    setProfile(profileData ?? null)

    if (profileData) {
      const firstLogin = !profileData.last_seen_at
      setIsFirstLogin(firstLogin)
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", profileData.id)
        .then(({ error }) => {
          if (error) console.error("[last_seen_at] update failed:", error.message)
        })
    }

    if (profileData) {
      const { data: perms } = await supabase
        .from("user_permissions")
        .select("section")
        .eq("user_id", profileData.id)
      setPermissions((perms ?? []).map(p => p.section as AppSection))
    }

    setLoading(false)
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshProfile() {
    const userId = session?.user?.id
    if (userId) await fetchProfile(userId)
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, permissions, loading, isFirstLogin, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
