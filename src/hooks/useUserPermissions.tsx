import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/api";
import type { Tables } from "@/entities/supabase";
import { appendAuthLog } from "@/debug";
import { getAdminEmails, isDevBypassActive, setDomainDeniedMessage } from "@/shared/lib/env";
import { toast } from "@/hooks/use-toast";
import { isSkyshare } from "@/lib/domainGate";
import { bootstrapAuth } from "@/lib/authBootstrap";

const DOMAIN_DENIED_MESSAGE = "Google account must be @skyshare.com.";

type UserProfile = Tables<"profiles">;
type AppSection = Tables<"user_permissions">["section"];

const DEV_PERMISSIONS: AppSection[] = [
  "Overview",
  "Operations",
  "Administration",
  "Development",
];

const PROMOTE_ALLOWLISTED_ENDPOINT = "/.netlify/functions/promote-allowlisted-user";

interface PermissionContextType {
  user: User | null;
  profile: UserProfile | null;
  permissions: AppSection[];
  loading: boolean;
  isReadOnly: boolean;
  hasPermission: (section: AppSection) => boolean;
  isAdmin: () => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function deriveFullName(user: User, fallback?: string | null) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const direct = ["full_name", "fullName", "name"].map(key => metadata[key]);
  const parts = [
    metadata["first_name"],
    metadata["firstName"],
    metadata["last_name"],
    metadata["lastName"],
  ].map(value => (typeof value === "string" ? value.trim() : ""));

  const directMatch = direct.find(value => typeof value === "string" && value.trim().length > 0);
  if (typeof directMatch === "string" && directMatch.trim().length > 0) {
    return directMatch.trim();
  }

  const [firstName, alternateFirstName, lastName, alternateLastName] = parts;
  const first = firstName || alternateFirstName;
  const last = lastName || alternateLastName;
  const combined = [first, last].filter(Boolean).join(" ").trim();

  const finalValue = combined || (fallback ?? "");
  return finalValue.length > 0 ? finalValue : null;
}

function determineReadOnly(profile: UserProfile | null) {
  if (!profile) return false;
  return profile.is_readonly || profile.role === "viewer";
}

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<AppSection[]>([]);
  const [loading, setLoading] = useState(true);
  // TODO: Rename these viewer-specific flags to match customer-facing terminology.
  const [isReadOnly, setIsReadOnly] = useState(false);
  const isMountedRef = useRef(false);
  const loadingRef = useRef(true);

  const adminEmails = useMemo(() => getAdminEmails(), []);
  const adminEmailSet = useMemo(() => new Set(adminEmails), [adminEmails]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const loadProfileAndPermissions = useCallback(
    async (userId: string) => {
      const { data: fetchedProfile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, user_id, email, first_name, last_name, full_name, role, role_enum, is_super_admin, is_readonly, status, last_login, created_at, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      setProfile(fetchedProfile ?? null);
      setIsReadOnly(determineReadOnly(fetchedProfile ?? null));

      const { data: userPermissions, error: permissionsError } = await supabase
        .from("user_permissions")
        .select("section")
        .eq("user_id", userId);

      if (permissionsError) {
        throw permissionsError;
      }

      setPermissions(userPermissions?.map(p => p.section) ?? []);

      return fetchedProfile;
    },
    [],
  );

  const ensureProfile = useCallback(
    async (activeSession: Session) => {
      const authUser = activeSession.user;
      const normalizedEmail = normalizeEmail(authUser.email);
      if (!isSkyshare(normalizedEmail)) {
        throw new Error("Invalid email domain");
      }

      const { data: existingProfile, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const isAllowListed = adminEmailSet.has(normalizedEmail);
      if (!isAllowListed) {
        return false;
      }

      const accessToken = activeSession.access_token;
      if (!accessToken) {
        throw new Error("Missing access token for allow-listed promotion");
      }

      const fullName = deriveFullName(authUser, existingProfile?.full_name);

      const response = await fetch(PROMOTE_ALLOWLISTED_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: authUser.id,
          email: authUser.email ?? existingProfile?.email ?? normalizedEmail,
          fullName,
        }),
      });

      if (!response.ok) {
        let message = `Failed to promote allow-listed user (${response.status})`;
        try {
          const payload = await response.json();
          if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
            message = payload.error.trim();
          }
        } catch (parseError) {
          console.error("Failed to parse allow-list promotion error", parseError);
        }
        throw new Error(message);
      }

      await loadProfileAndPermissions(authUser.id);
      return true;
    },
    [adminEmailSet, loadProfileAndPermissions],
  );

  const handleSession = useCallback(
    async (activeSession: Session | null) => {
      appendAuthLog(
        activeSession
          ? `PermissionProvider handleSession: session ${activeSession.user.id}`
          : "PermissionProvider handleSession: null session",
      );

      if (!activeSession) {
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setIsReadOnly(false);
        setLoading(false);
        appendAuthLog("PermissionProvider session cleared; loading=false");
        return;
      }

      setLoading(true);
      appendAuthLog(`PermissionProvider loading=true for ${activeSession.user.id}`);
      setUser(activeSession.user);

      const normalizedEmail = normalizeEmail(activeSession.user.email);
      const allowedDomain = isSkyshare(normalizedEmail);

      if (!allowedDomain) {
        appendAuthLog("PermissionProvider invalid email domain → sign out");
        await supabase.auth.signOut();
        setDomainDeniedMessage(DOMAIN_DENIED_MESSAGE);
        toast({
          title: "Access denied",
          description: DOMAIN_DENIED_MESSAGE,
          variant: "destructive",
        });
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setIsReadOnly(false);
        setLoading(false);
        appendAuthLog("PermissionProvider loading=false after domain denial");
        window.location.replace("/");
        return;
      }

      let allowListPromotionApplied = false;

      try {
        allowListPromotionApplied = await ensureProfile(activeSession);
      } catch (error) {
        console.error("Error ensuring profile (continuing with load attempt):", error);
        appendAuthLog(
          `PermissionProvider ensureProfile error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      try {
        if (!allowListPromotionApplied) {
          await loadProfileAndPermissions(activeSession.user.id);
        }
      } catch (error) {
        console.error("Error loading profile and permissions:", error);
        appendAuthLog(
          `PermissionProvider loadProfileAndPermissions error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        toast({
          title: "Authentication error",
          description: "We couldn't load your profile. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        appendAuthLog(`PermissionProvider loading=false after session ${activeSession.user.id}`);
      }
    },
    [ensureProfile, loadProfileAndPermissions],
  );

  useEffect(() => {
    appendAuthLog("PermissionProvider mount");
    isMountedRef.current = true;

    const devBypass = isDevBypassActive();
    const timer =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            if (isMountedRef.current && loadingRef.current) {
              appendAuthLog("PermissionProvider safety flip");
              setLoading(false);
            }
          }, 2000)
        : undefined;

    if (devBypass) {
      appendAuthLog("PermissionProvider dev bypass active");
      setUser(null);
      setProfile(null);
      setPermissions(DEV_PERMISSIONS);
      setIsReadOnly(false);
      setLoading(false);
    }

    let teardown: (() => void) | undefined;

    if (!devBypass) {
      teardown = bootstrapAuth(supabase, {
        onSession: async session => {
          appendAuthLog(
            session
              ? `PermissionProvider session event: ${session.user.id}`
              : "PermissionProvider session event: null",
          );
          if (!isMountedRef.current) {
            appendAuthLog("PermissionProvider session ignored after unmount");
            return;
          }
          await handleSession(session);
        },
        onReady: () => {
          appendAuthLog("PermissionProvider onReady");
          if (!isMountedRef.current) {
            return;
          }
          setLoading(false);
        },
        onError: error => {
          appendAuthLog(
            `PermissionProvider bootstrap error: ${error instanceof Error ? error.message : String(error)}`,
          );
          console.error("Error bootstrapping authentication:", error);
          if (!isMountedRef.current) {
            return;
          }
          toast({
            title: "Authentication error",
            description: "We couldn't restore your session. Please sign in again.",
            variant: "destructive",
          });
          setLoading(false);
        },
      });
    }

    return () => {
      appendAuthLog("PermissionProvider unmount");
      isMountedRef.current = false;
      if (typeof window !== "undefined" && timer !== undefined) {
        window.clearTimeout(timer);
      }
      teardown?.();
    };
  }, [handleSession]);

  const refreshPermissions = useCallback(async () => {
    if (!user) return;
    try {
      await loadProfileAndPermissions(user.id);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast({
        title: "Error",
        description: "Failed to refresh permissions.",
        variant: "destructive",
      });
    }
  }, [loadProfileAndPermissions, user]);

  useEffect(() => {
    if (isDevBypassActive() || !user) return;
    refreshPermissions();
  }, [refreshPermissions, user]);

  const hasPermission = useCallback(
    (section: AppSection) => {
      if (isDevBypassActive()) return true;
      if (isReadOnly) {
        return section === "Overview";
      }
      return permissions.includes(section);
    },
    [isReadOnly, permissions],
  );

  const isAdmin = useCallback(() => {
    return profile?.role === "admin" || profile?.role_enum === "Super Admin";
  }, [profile?.role, profile?.role_enum]);

  return (
    <PermissionContext.Provider
      value={{
        user,
        profile,
        permissions,
        loading,
        isReadOnly,
        hasPermission,
        isAdmin,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function useUserPermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("useUserPermissions must be used within a PermissionProvider");
  }
  return context;
}

export function useReadOnly() {
  const context = useUserPermissions();
  return context.isReadOnly;
}
