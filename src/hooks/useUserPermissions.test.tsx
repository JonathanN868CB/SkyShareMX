import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import type { Tables } from "@/entities/supabase";

import { PermissionProvider, useUserPermissions } from "./useUserPermissions";

const mocks = vi.hoisted(() => ({
  appendAuthLogSpy: vi.fn(),
  getAdminEmailsMock: vi.fn(() => []),
  isDevBypassActiveMock: vi.fn(() => false),
  setDomainDeniedMessageMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  signOutMock: vi.fn<[], Promise<{ error: null }>>(() => Promise.resolve({ error: null })),
  getSessionMock: vi.fn<[], Promise<{ data: { session: Session | null } | null; error: unknown }>>(),
  state: {
    authChangeHandler: null as ((event: AuthChangeEvent, session: Session | null) => void) | null,
    profileData: null as Tables<"profiles"> | null,
    profileError: null as unknown,
    profileUpsertError: null as unknown,
    profilePromise: null as Promise<{ data: Tables<"profiles"> | null; error: unknown }> | null,
    permissionsData: [] as Array<{ section: Tables<"user_permissions">["section"] }>,
    permissionsError: null as unknown,
    permissionsPromise:
      null as Promise<{ data: Array<{ section: Tables<"user_permissions">["section"] }>; error: unknown }> | null,
  },
}));

vi.mock("@/debug", () => ({
  appendAuthLog: (line: string) => mocks.appendAuthLogSpy(line),
  AuthDebugOverlay: () => null,
}));

vi.mock("@/shared/lib/env", () => ({
  getAdminEmails: () => mocks.getAdminEmailsMock(),
  isDevBypassActive: () => mocks.isDevBypassActiveMock(),
  setDomainDeniedMessage: (value: string) => mocks.setDomainDeniedMessageMock(value),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/shared/lib/api", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        mocks.state.authChangeHandler = callback;
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                mocks.state.authChangeHandler = null;
                mocks.unsubscribeMock();
              },
            },
          },
        };
      },
      signOut: mocks.signOutMock,
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                mocks.state.profilePromise ??
                Promise.resolve({ data: mocks.state.profileData, error: mocks.state.profileError }),
            }),
          }),
          upsert: () => Promise.resolve({ error: mocks.state.profileUpsertError }),
        };
      }
      if (table === "user_permissions") {
        return {
          select: () => ({
            eq: () =>
              mocks.state.permissionsPromise ??
              Promise.resolve({ data: mocks.state.permissionsData, error: mocks.state.permissionsError }),
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
}));

const {
  appendAuthLogSpy,
  getAdminEmailsMock,
  isDevBypassActiveMock,
  setDomainDeniedMessageMock,
  unsubscribeMock,
  signOutMock,
  getSessionMock,
  state,
} = mocks;

function Observer({
  onChange,
}: {
  onChange: (state: {
    loading: boolean;
    user: User | null;
    permissions: Tables<"user_permissions">["section"][];
  }) => void;
}) {
  const { loading, user, permissions } = useUserPermissions();
  useEffect(() => {
    onChange({ loading, user, permissions });
  }, [loading, permissions, user, onChange]);
  return null;
}

async function tick() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function expectAuthLogEmitted() {
  const messages = appendAuthLogSpy.mock.calls.map(([message]) => String(message));
  expect(messages.some(message => message.includes("PermissionProvider"))).toBe(true);
}

describe("PermissionProvider", () => {
  beforeEach(() => {
    appendAuthLogSpy.mockReset();
    getAdminEmailsMock.mockReturnValue([]);
    isDevBypassActiveMock.mockReturnValue(false);
    setDomainDeniedMessageMock.mockReset();
    unsubscribeMock.mockReset();
    signOutMock.mockClear();
    getSessionMock.mockReset();
    state.authChangeHandler = null;
    state.profileData = {
      id: "profile-1",
      user_id: "user-1",
      email: "pilot@skyshare.com",
      first_name: "Pilot",
      last_name: "Test",
      full_name: "Pilot Test",
      role: "viewer",
      role_enum: "Read-Only",
      is_super_admin: false,
      is_readonly: false,
      status: "Active",
      last_login: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Tables<"profiles">;
    state.profileError = null;
    state.profileUpsertError = null;
    state.profilePromise = null;
    state.permissionsData = [{ section: "Overview" }];
    state.permissionsError = null;
    state.permissionsPromise = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    state.authChangeHandler = null;
    state.profilePromise = null;
    state.permissionsPromise = null;
  });

  it("settles loading with a valid session", async () => {
    const session = {
      user: { id: "user-1", email: "pilot@skyshare.com" },
    };
    getSessionMock.mockResolvedValue({ data: { session }, error: null });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const states: Array<{
      loading: boolean;
      user: User | null;
      permissions: Tables<"user_permissions">["section"][];
    }> = [];

    await act(async () => {
      root.render(
        <PermissionProvider>
          <Observer onChange={state => states.push(state)} />
        </PermissionProvider>,
      );
    });

    for (let i = 0; i < 5; i += 1) {
      await tick();
    }

    const lastState = states.at(-1);
    expect(lastState?.loading).toBe(false);
    expect(lastState?.user?.id).toBe("user-1");
    expectAuthLogEmitted();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("settles loading with a null session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const states: Array<{
      loading: boolean;
      user: User | null;
      permissions: Tables<"user_permissions">["section"][];
    }> = [];

    await act(async () => {
      root.render(
        <PermissionProvider>
          <Observer onChange={state => states.push(state)} />
        </PermissionProvider>,
      );
    });

    for (let i = 0; i < 5; i += 1) {
      await tick();
    }

    const lastState = states.at(-1);
    expect(lastState?.loading).toBe(false);
    expect(lastState?.user).toBeNull();
    expectAuthLogEmitted();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("recovers when getSession throws", async () => {
    getSessionMock.mockRejectedValue(new Error("boom"));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const states: Array<{
      loading: boolean;
      user: User | null;
      permissions: Tables<"user_permissions">["section"][];
    }> = [];

    await act(async () => {
      root.render(
        <PermissionProvider>
          <Observer onChange={state => states.push(state)} />
        </PermissionProvider>,
      );
    });

    for (let i = 0; i < 5; i += 1) {
      await tick();
    }

    const lastState = states.at(-1);
    expect(lastState?.loading).toBe(false);
    expect(lastState?.user).toBeNull();
    expectAuthLogEmitted();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("clears state on SIGNED_OUT when profile loading hangs", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const states: Array<{
      loading: boolean;
      user: User | null;
      permissions: Tables<"user_permissions">["section"][];
    }> = [];

    await act(async () => {
      root.render(
        <PermissionProvider>
          <Observer onChange={state => states.push(state)} />
        </PermissionProvider>,
      );
    });

    await tick();

    const session = {
      user: { id: "user-1", email: "pilot@skyshare.com" },
    } as Session;

    state.profilePromise = new Promise(() => {}) as Promise<{
      data: Tables<"profiles"> | null;
      error: unknown;
    }>;

    await act(async () => {
      state.authChangeHandler?.("SIGNED_IN", session);
    });

    await tick();

    expect(states.some(entry => entry.user?.id === "user-1")).toBe(true);
    expect(states.some(entry => entry.loading)).toBe(true);

    await act(async () => {
      state.authChangeHandler?.("SIGNED_OUT", null);
    });

    for (let i = 0; i < 3; i += 1) {
      await tick();
    }

    const finalState = states.at(-1);
    expect(finalState?.user).toBeNull();
    expect(finalState?.permissions).toEqual([]);
    expect(finalState?.loading).toBe(false);
    expectAuthLogEmitted();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
