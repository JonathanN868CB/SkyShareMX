import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

import ProtectedRoute from "@/features/auth/components/ProtectedRoute";

const mocks = vi.hoisted(() => ({
  appendAuthLogSpy: vi.fn(),
  isDevBypassActiveMock: vi.fn(() => false),
  rememberReturnToMock: vi.fn(),
  state: {
    loading: true,
    user: null as User | null,
  },
}));

vi.mock("@/debug", () => ({
  appendAuthLog: (line: string) => mocks.appendAuthLogSpy(line),
}));

vi.mock("@/hooks/useUserPermissions", () => ({
  useUserPermissions: () => mocks.state,
}));

vi.mock("@/shared/lib/env", () => ({
  isDevBypassActive: () => mocks.isDevBypassActiveMock(),
  rememberReturnTo: (value: string) => mocks.rememberReturnToMock(value),
}));

const { appendAuthLogSpy, isDevBypassActiveMock, rememberReturnToMock, state } = mocks;

describe("ProtectedRoute", () => {
  beforeEach(() => {
    appendAuthLogSpy.mockReset();
    isDevBypassActiveMock.mockReturnValue(false);
    rememberReturnToMock.mockReset();
    state.loading = true;
    state.user = null;
  });

  it("defers mounting children until access is granted", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChildMount = vi.fn();

    function Child({ onMount }: { onMount: () => void }) {
      useEffect(() => {
        onMount();
      }, [onMount]);

      return <div data-testid="protected-content">Protected</div>;
    }

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/app/admin/users"]}>
          <ProtectedRoute>
            <Child onMount={onChildMount} />
          </ProtectedRoute>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Loading…");
    expect(container.querySelector("[data-testid=protected-content]")).toBeNull();
    expect(onChildMount).not.toHaveBeenCalled();

    state.loading = false;
    state.user = { id: "user-1" } as User;

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/app/admin/users"]}>
          <ProtectedRoute>
            <Child onMount={onChildMount} />
          </ProtectedRoute>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector("[data-testid=protected-content]")).not.toBeNull();
    expect(onChildMount).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
