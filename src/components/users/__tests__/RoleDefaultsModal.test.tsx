import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoleDefaultsModal } from "@/components/users/RoleDefaultsModal";
import type { RoleDefaultSnapshot, RoleDefaultsMap } from "@/lib/api/role-defaults";
import type { Role } from "@/lib/types/users";

const fetchRoleDefaultsMock = vi.fn<[], Promise<RoleDefaultsMap>>();
const updateRoleDefaultsMock = vi.fn<
  [Role, Record<string, boolean>],
  Promise<RoleDefaultSnapshot>
>();
const toastMock = vi.fn();

vi.mock("@/lib/api/role-defaults", () => ({
  fetchRoleDefaults: () => fetchRoleDefaultsMock(),
  updateRoleDefaults: (role: Role, permissions: Record<string, boolean>) =>
    updateRoleDefaultsMock(role, permissions),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (options: unknown) => toastMock(options),
}));

describe("RoleDefaultsModal", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    fetchRoleDefaultsMock.mockReset();
    updateRoleDefaultsMock.mockReset();
    toastMock.mockReset();
    onOpenChange.mockReset();

    fetchRoleDefaultsMock.mockResolvedValue({});
    updateRoleDefaultsMock.mockResolvedValue({
      role: "viewer",
      permissions: {},
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("merges fetched defaults when opened", async () => {
    fetchRoleDefaultsMock.mockResolvedValue({ manager: { "ai-assistant": false } });

    render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => expect(fetchRoleDefaultsMock).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /manager/i }));

    await waitFor(() => {
      const aiAssistantCheckbox = screen.getByRole("checkbox", { name: /ai assistant/i });
      expect(aiAssistantCheckbox.getAttribute("data-state")).toBe("unchecked");
    });
  });

  it("shows a fallback error message when loading fails", async () => {
    fetchRoleDefaultsMock.mockRejectedValue(new Error("load failed"));

    render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    const errorBanner = await screen.findByTestId("role-defaults-error");
    expect(errorBanner.textContent).toContain("load failed");
    expect(errorBanner.textContent).toContain("Showing fallback defaults instead.");

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
        }),
      ),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /viewer/i }));

    await waitFor(() => {
      const docsLinksCheckbox = screen.getByRole("checkbox", { name: /docs & links/i });
      expect(docsLinksCheckbox.getAttribute("data-state")).toBe("checked");
    });
  });

  it("disables the save button while persisting changes", async () => {
    render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => expect(fetchRoleDefaultsMock).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /viewer/i }));

    const docsLinksCheckbox = screen.getByRole("checkbox", { name: /docs & links/i });
    expect(docsLinksCheckbox.getAttribute("data-state")).toBe("checked");

    await user.click(docsLinksCheckbox);

    await waitFor(() => {
      const checkbox = screen.getByRole("checkbox", { name: /docs & links/i });
      expect(checkbox.getAttribute("data-state")).toBe("unchecked");
    });

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);

    let resolveUpdate: ((value: RoleDefaultSnapshot) => void) | undefined;
    const updatePromise = new Promise<RoleDefaultSnapshot>(resolve => {
      resolveUpdate = resolve;
    });
    updateRoleDefaultsMock.mockReturnValueOnce(updatePromise);

    await user.click(saveButton);

    await waitFor(() => expect(updateRoleDefaultsMock).toHaveBeenCalledTimes(1));
    expect(updateRoleDefaultsMock).toHaveBeenCalledWith(
      "viewer",
      expect.objectContaining({
        "docs-links": false,
      }),
    );

    await waitFor(() => {
      const savingButton = screen.getByRole("button", { name: /saving/i });
      expect((savingButton as HTMLButtonElement).disabled).toBe(true);
    });

    resolveUpdate?.({
      role: "viewer",
      permissions: { "docs-links": false },
      updatedAt: new Date().toISOString(),
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Permissions updated",
        }),
      ),
    );
  });

  it("keeps local changes and shows an error when saving fails", async () => {
    render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => expect(fetchRoleDefaultsMock).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /viewer/i }));

    const docsLinksCheckbox = screen.getByRole("checkbox", { name: /docs & links/i });
    await user.click(docsLinksCheckbox);

    await waitFor(() => {
      const checkbox = screen.getByRole("checkbox", { name: /docs & links/i });
      expect(checkbox.getAttribute("data-state")).toBe("unchecked");
    });

    updateRoleDefaultsMock.mockRejectedValueOnce(new Error("network error"));

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => expect(updateRoleDefaultsMock).toHaveBeenCalledTimes(1));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Unable to save defaults",
          description: "network error",
        }),
      ),
    );

    const checkboxAfterFailure = screen.getByRole("checkbox", { name: /docs & links/i });
    expect(checkboxAfterFailure.getAttribute("data-state")).toBe("unchecked");
    expect(onOpenChange.mock.calls.some(call => call[0] === false)).toBe(false);
  });
});
