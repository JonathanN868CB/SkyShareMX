import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Session, User } from "@supabase/supabase-js";

import type { Tables } from "@/entities/supabase";
import { PermissionProvider, useUserPermissions } from "@/hooks/useUserPermissions";

type UserProfile = Tables<"profiles">;
type AppSection = Tables<"user_permissions">["section"];

type Snapshot = {
  loading: boolean;
  profile: UserProfile | null;
  permissions: AppSection[];
  isReadOnly: boolean;
};

const refs = vi.hoisted(() => {
  const profileUpsertSpy = vi.fn();
  const unsubscribeMock = vi.fn();
  const getSessionMock = vi.fn<[], Promise<{ data: { session: Session | null } | null; error: null }>>();
  const signOutMock = vi.fn<[], Promise<{ error: null }>>(() => Promise.resolve({ error: null }));

  const sessionUser: Partial<User> = {
    id: "allowlisted-user-id",
    email: "jonathan@skyshare.com",
    user_metadata: {
      full_name: "Jonathan Schaedig",
    },
    app_metadata: {},
    identities: [],
    role: "authenticated",
    aud: "authenticated",
    created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
    updated_at: new Date("2024-01-01T00:00:00Z").toISOString(),
    last_sign_in_at: new Date("2024-02-01T00:00:00Z").toISOString(),
  };

  const session: Session = {
    access_token: "allowlisted-session-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: sessionUser as User,
    provider_token: undefined,
    provider_refresh_token: undefined,
  };

  const supabaseState = {
    profile: null as UserProfile | null,
    permissions: [] as AppSection[],
  };

  return {
    getSessionMock,
    profileUpsertSpy,
    session,
    signOutMock,
    supabaseState,
    unsubscribeMock,
    mswCallCount: 0,
  };
});

vi.mock("@/debug", () => ({
  appendAuthLog: vi.fn(),
  AuthDebugOverlay: () => null,
}));

vi.mock("@/shared/lib/env", () => ({
  getAdminEmails: () => ["jonathan@skyshare.com"],
  isDevBypassActive: () => false,
  setDomainDeniedMessage: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/shared/lib/api", () => {
  const { getSessionMock, profileUpsertSpy, signOutMock, supabaseState, unsubscribeMock } = refs;

  return {
    supabase: {
      auth: {
        getSession: () => getSessionMock(),
        onAuthStateChange: (_callback: () => void) => ({
          data: { subscription: { unsubscribe: unsubscribeMock } },
        }),
        signOut: signOutMock,
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: supabaseState.profile, error: null }),
              }),
            }),
            upsert: (...args: unknown[]) => {
              profileUpsertSpy(...args);
              return Promise.resolve({ error: null });
            },
          };
        }
        if (table === "user_permissions") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: supabaseState.permissions.map(section => ({ section })),
                  error: null,
                }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      },
    },
  };
});

const server = setupServer(
  http.post("/.netlify/functions/promote-allowlisted-user", async ({ request }) => {
    refs.mswCallCount += 1;
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${refs.session.access_token}`) {
      return HttpResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = (await request.json()) as { fullName?: string | null };
    const nowIso = new Date().toISOString();

    refs.supabaseState.profile = {
      id: "profile-allowlisted",
      user_id: refs.session.user.id,
      email: refs.session.user.email ?? "jonathan@skyshare.com",
      first_name: null,
      last_name: null,
      full_name: body.fullName ?? refs.session.user.email ?? "jonathan@skyshare.com",
      role: "admin",
      role_enum: "Super Admin",
      is_readonly: false,
      status: "Active",
      last_login: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    } satisfies UserProfile;

    refs.supabaseState.permissions = [
      "Overview",
      "Operations",
      "Administration",
      "Development",
    ];

    return HttpResponse.json({
      profile: refs.supabaseState.profile,
      grantedSections: refs.supabaseState.permissions,
    });
  }),
);

function Observer({ onChange }: { onChange: (snapshot: Snapshot) => void }) {
  const { loading, profile, permissions, isReadOnly } = useUserPermissions();
  useEffect(() => {
    onChange({ loading, profile, permissions, isReadOnly });
  }, [loading, profile, permissions, isReadOnly, onChange]);
  return null;
}

async function tick() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe("PermissionProvider allow-list promotion", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  beforeEach(() => {
    refs.supabaseState.profile = null;
    refs.supabaseState.permissions = [];
    refs.mswCallCount = 0;
    refs.getSessionMock.mockResolvedValue({ data: { session: refs.session }, error: null });
    refs.profileUpsertSpy.mockClear();
    refs.unsubscribeMock.mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it("promotes allow-listed users via the Netlify function", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const snapshots: Snapshot[] = [];

    await act(async () => {
      root.render(
        <PermissionProvider>
          <Observer onChange={snapshot => snapshots.push(snapshot)} />
        </PermissionProvider>,
      );
    });

    for (let i = 0; i < 5; i += 1) {
      await tick();
    }

    const finalState = snapshots.at(-1);
    expect(finalState?.loading).toBe(false);
    expect(finalState?.profile?.role).toBe("admin");
    expect(finalState?.profile?.role_enum).toBe("Super Admin");
    expect(finalState?.isReadOnly).toBe(false);
    expect(new Set(finalState?.permissions ?? [])).toEqual(
      new Set(["Overview", "Operations", "Administration", "Development"]),
    );
    expect(refs.profileUpsertSpy).not.toHaveBeenCalled();
    expect(refs.mswCallCount).toBe(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
