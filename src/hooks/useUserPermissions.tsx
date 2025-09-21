import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/api";
import type { Tables } from "@/entities/supabase";
import { getAdminEmails, isDevBypassActive, setDomainDeniedMessage } from "@/shared/lib/env";
import { toast } from "@/hooks/use-toast";
import { isSkyshare } from "@/lib/domainGate";

const DOMAIN_DENIED_MESSAGE = "Google account must be @skyshare.com.";

const ROLE_ENUM_BY_TEXT: Record<UserProfile["role"], UserProfile["role_enum"]> = {
  admin: "Admin",
  technician: "Technician",
  qc: "Manager",
  viewer: "Read-Only",
};

const READ_ONLY_FALLBACK_EMAIL = "jonathan@skyshare.com";
type UserProfile = Tables<"profiles">;
type AppSection = Tables<"user_permissions">["section"];

const DEV_PERMISSIONS: AppSection[] = [
  "Overview",
  "Operations",
  "Administration",
  "Development",
];

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

function resolveAdminEnum(email: string, existingEnum?: UserProfile["role_enum"]) {
  if (existingEnum === "Super Admin") {
    return existingEnum;
  }
  if (email === READ_ONLY_FALLBACK_EMAIL) {
    return "Super Admin";
  }
  return "Admin";
}

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<AppSection[]>([]);
  const [loading, setLoading] = useState(true);
  // TODO: Rename these viewer-specific flags to match customer-facing terminology.
  const [isReadOnly, setIsReadOnly] = useState(false);

  const adminEmails = useMemo(() => getAdminEmails(), []);
  const adminEmailSet = useMemo(() => new Set(adminEmails), [adminEmails]);

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
        .select("id, role, role_enum, is_readonly, full_name, email")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const existingRole = existingProfile?.role ?? "viewer";
      const safeRole: UserProfile["role"] = ["admin", "technician", "qc", "viewer"].includes(existingRole as string)
        ? (existingRole as UserProfile["role"])
        : "viewer";

      const isAllowListed = adminEmailSet.has(normalizedEmail);

      let resolvedRole = safeRole;
      let resolvedReadOnly = existingProfile?.is_readonly ?? true;
      let resolvedEnum = existingProfile?.role_enum ?? ROLE_ENUM_BY_TEXT[resolvedRole];

      if (!existingProfile) {
        resolvedRole = isAllowListed ? "admin" : "viewer";
        resolvedReadOnly = !isAllowListed;
        resolvedEnum = isAllowListed
          ? resolveAdminEnum(normalizedEmail, existingProfile?.role_enum)
          : ROLE_ENUM_BY_TEXT[resolvedRole];
      }

      if (isAllowListed) {
        resolvedRole = "admin";
        resolvedReadOnly = false;
        resolvedEnum = resolveAdminEnum(normalizedEmail, existingProfile?.role_enum);
      } else {
        resolvedEnum = ROLE_ENUM_BY_TEXT[resolvedRole] ?? resolvedEnum;
      }

      if (!isAllowListed) {
        return;
      }

      const fullName = deriveFullName(authUser, existingProfile?.full_name);

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: authUser.id,
            email: authUser.email ?? existingProfile?.email ?? normalizedEmail,
            full_name: fullName,
            role: resolvedRole,
            role_enum: resolvedEnum,
            is_readonly: resolvedReadOnly,
            status: existingProfile ? undefined : "Active",
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (upsertError) {
        throw upsertError;
      }
    },
    [adminEmailSet],
  );

  const handleSession = useCallback(
    async (activeSession: Session | null) => {
      if (!activeSession) {
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setIsReadOnly(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUser(activeSession.user);

      const normalizedEmail = normalizeEmail(activeSession.user.email);
      const allowedDomain = isSkyshare(normalizedEmail);

      if (!allowedDomain) {
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
        window.location.replace("/");
        return;
      }

      try {
        await ensureProfile(activeSession);
      } catch (error) {
        console.error("Error ensuring profile (continuing with load attempt):", error);
      }

      try {
        await loadProfileAndPermissions(activeSession.user.id);
      } catch (error) {
        console.error("Error loading profile and permissions:", error);
        toast({
          title: "Authentication error",
          description: "We couldn't load your profile. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [ensureProfile, loadProfileAndPermissions],
  );

  useEffect(() => {
    const devBypass = isDevBypassActive();
    if (devBypass) {
      console.log("🚧 PermissionProvider: Dev bypass active, granting full access");
      setUser(null);
      setProfile(null);
      setPermissions(DEV_PERMISSIONS);
      setIsReadOnly(false);
      setLoading(false);
      return () => {};
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
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
