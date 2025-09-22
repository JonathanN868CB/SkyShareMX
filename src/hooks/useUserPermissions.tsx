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

const SESSION_TASK_TIMEOUT_MS = 5000;
const SESSION_ABORT_ERROR_NAME = "PermissionProviderAbortError";
const SESSION_TIMEOUT_ERROR_NAME = "PermissionProviderTimeoutError";

function createAbortError(label: string) {
  const error = new Error(`${label} aborted`);
  error.name = SESSION_ABORT_ERROR_NAME;
  return error;
}

function createTimeoutError(label: string, timeoutMs: number) {
  const error = new Error(`${label} timed out after ${timeoutMs}ms`);
  error.name = SESSION_TIMEOUT_ERROR_NAME;
  return error;
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === SESSION_ABORT_ERROR_NAME;
}

function isTimeoutError(error: unknown): error is Error {
  return error instanceof Error && error.name === SESSION_TIMEOUT_ERROR_NAME;
}

async function withAbortableTimeout<T>({
  parentSignal,
  label,
  timeoutMs = SESSION_TASK_TIMEOUT_MS,
  task,
}: {
  parentSignal: AbortSignal;
  label: string;
  timeoutMs?: number;
  task: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  if (parentSignal.aborted) {
    throw createAbortError(label);
  }

  const taskController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | null = null;

  const waitPromise = new Promise<never>((_, reject) => {
    abortHandler = () => {
      taskController.abort();
      reject(createAbortError(label));
    };
    parentSignal.addEventListener("abort", abortHandler!, { once: true });
    timer = setTimeout(() => {
      if (abortHandler) {
        parentSignal.removeEventListener("abort", abortHandler);
      }
      appendAuthLog(`${label} timed out after ${timeoutMs}ms`);
      taskController.abort();
      reject(createTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task(taskController.signal), waitPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (abortHandler) {
      parentSignal.removeEventListener("abort", abortHandler);
    }
  }
}

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
  const sessionAbortRef = useRef<AbortController | null>(null);

  const adminEmails = useMemo(() => getAdminEmails(), []);
  const adminEmailSet = useMemo(() => new Set(adminEmails), [adminEmails]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const loadProfileAndPermissions = useCallback(
    async (userId: string, signal?: AbortSignal) => {
      const ensureActive = () => {
        if (signal?.aborted) {
          throw createAbortError("PermissionProvider loadProfileAndPermissions");
        }
      };

      ensureActive();

      const { data: fetchedProfile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, user_id, email, first_name, last_name, full_name, role, role_enum, is_super_admin, is_readonly, status, last_login, created_at, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle();

      ensureActive();

      if (profileError) {
        throw profileError;
      }

      ensureActive();
      setProfile(fetchedProfile ?? null);
      setIsReadOnly(determineReadOnly(fetchedProfile ?? null));

      ensureActive();

      const { data: userPermissions, error: permissionsError } = await supabase
        .from("user_permissions")
        .select("section")
        .eq("user_id", userId);

      ensureActive();

      if (permissionsError) {
        throw permissionsError;
      }

      ensureActive();
      setPermissions(userPermissions?.map(p => p.section) ?? []);

      return fetchedProfile;
    },
    [],
  );

  const ensureProfile = useCallback(
    async (activeSession: Session, signal?: AbortSignal) => {
      const ensureActive = () => {
        if (signal?.aborted) {
          throw createAbortError("PermissionProvider ensureProfile");
        }
      };

      ensureActive();

      const authUser = activeSession.user;
      const normalizedEmail = normalizeEmail(authUser.email);
      if (!isSkyshare(normalizedEmail)) {
        throw new Error("Invalid email domain");
      }

      ensureActive();

      const { data: existingProfile, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("user_id", authUser.id)
        .maybeSingle();

      ensureActive();

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

      ensureActive();

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
        signal,
      });

      ensureActive();

      if (!response.ok) {
        let message = `Failed to promote allow-listed user (${response.status})`;
        try {
          const payload = await response.json();
          ensureActive();
          if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
            message = payload.error.trim();
          }
        } catch (parseError) {
          console.error("Failed to parse allow-list promotion error", parseError);
        }
        throw new Error(message);
      }

      ensureActive();

      await loadProfileAndPermissions(authUser.id, signal);
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
        sessionAbortRef.current?.abort();
        sessionAbortRef.current = null;
        setUser(null);
        setProfile(null);
        setPermissions([]);
        setIsReadOnly(false);
        setLoading(false);
        appendAuthLog("PermissionProvider session cleared; loading=false");
        return;
      }

      const controller = new AbortController();
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = controller;

      const sessionId = activeSession.user.id;

      setLoading(true);
      appendAuthLog(`PermissionProvider loading=true for ${sessionId}`);
      setUser(activeSession.user);

      try {
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
          allowListPromotionApplied = await withAbortableTimeout({
            parentSignal: controller.signal,
            label: "PermissionProvider ensureProfile",
            task: signal => ensureProfile(activeSession, signal),
          });
        } catch (error) {
          if (isAbortError(error)) {
            appendAuthLog("PermissionProvider ensureProfile aborted");
            return;
          }
          console.error("Error ensuring profile (continuing with load attempt):", error);
          const message = error instanceof Error ? error.message : String(error);
          const label = isTimeoutError(error)
            ? "PermissionProvider ensureProfile timeout"
            : "PermissionProvider ensureProfile error";
          appendAuthLog(`${label}: ${message}`);
        }

        try {
          if (!allowListPromotionApplied) {
            await withAbortableTimeout({
              parentSignal: controller.signal,
              label: "PermissionProvider loadProfileAndPermissions",
              task: signal => loadProfileAndPermissions(sessionId, signal),
            });
          }
        } catch (error) {
          if (isAbortError(error)) {
            appendAuthLog("PermissionProvider loadProfileAndPermissions aborted");
            return;
          }
          console.error("Error loading profile and permissions:", error);
          const message = error instanceof Error ? error.message : String(error);
          const label = isTimeoutError(error)
            ? "PermissionProvider loadProfileAndPermissions timeout"
            : "PermissionProvider loadProfileAndPermissions error";
          appendAuthLog(`${label}: ${message}`);
          toast({
            title: "Authentication error",
            description: "We couldn't load your profile. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        const isCurrent = sessionAbortRef.current === controller;
        if (isCurrent) {
          sessionAbortRef.current = null;
          setLoading(false);
          appendAuthLog(
            `PermissionProvider loading=false after session ${sessionId}${
              controller.signal.aborted ? " (aborted)" : ""
            }`,
          );
        }
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
          const activeController = sessionAbortRef.current;
          if (activeController && !activeController.signal.aborted) {
            appendAuthLog("PermissionProvider onReady skipped due to pending session handler");
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
