import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RoleDefaultsModal } from "@/components/users/RoleDefaultsModal";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  toast: (options: unknown) => toastMock(options),
}));

function getSectionByTitle(title: string) {
  const heading = screen.getByRole("heading", { name: title });
  const section = heading.closest("section");
  if (!section) {
    throw new Error(`Unable to find section for ${title}`);
  }
  return section;
}

function getPermissionGroup(sectionTitle: string, permissionLabel: string) {
  const section = getSectionByTitle(sectionTitle);
  return within(section).getByRole("group", { name: permissionLabel });
}

describe("RoleDefaultsModal", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  beforeEach(() => {
    toastMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders per-module defaults for manager", async () => {
    const onOpenChange = vi.fn();
    render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /manager/i }));

    const operationsDocsLinks = getPermissionGroup("Operations", "Docs & Links");
    expect(within(operationsDocsLinks).getByRole("radio", { name: "Write" }).getAttribute("data-state")).toBe("on");

    const administrationUsers = getPermissionGroup("Administration", "Users");
    expect(within(administrationUsers).getByRole("radio", { name: "Read" }).getAttribute("data-state")).toBe("on");

    const administrationSettings = getPermissionGroup("Administration", "Settings");
    expect(within(administrationSettings).getByRole("radio", { name: "None" }).getAttribute("data-state")).toBe("on");

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falls back to none when a snapshot omits a permission", async () => {
    const user = userEvent.setup();
    const snapshot = {
      manager: {
        dashboard: "read",
      },
    } as const;

    render(
      <RoleDefaultsModal open={true} onOpenChange={vi.fn()} initialMatrixSnapshot={snapshot} />,
    );

    await user.click(screen.getByRole("tab", { name: /manager/i }));

    const dashboardGroup = getPermissionGroup("Overview", "Dashboard");
    expect(within(dashboardGroup).getByRole("radio", { name: "Read" }).getAttribute("data-state")).toBe("on");

    const docsLinksGroup = getPermissionGroup("Operations", "Docs & Links");
    expect(within(docsLinksGroup).getByRole("radio", { name: "None" }).getAttribute("data-state")).toBe("on");
  });

  it("disables admin controls and shows notice", () => {
    render(<RoleDefaultsModal open={true} onOpenChange={vi.fn()} />);

    const notice = screen.getByText(/adjust the other roles to tailor access levels/i);
    expect(notice).toBeDefined();

    const operationsDocsLinks = getPermissionGroup("Operations", "Docs & Links");
    const writeButton = within(operationsDocsLinks).getByRole("radio", { name: "Write" }) as HTMLButtonElement;
    expect(writeButton.disabled).toBe(true);
  });

  it("saves changes locally and logs the matrix", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const onOpenChange = vi.fn();
    const { rerender } = render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /manager/i }));
    const settingsGroup = getPermissionGroup("Administration", "Settings");

    await user.click(within(settingsGroup).getByRole("radio", { name: "Write" }));

    const saveButton = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    await user.click(saveButton);

    expect(logSpy).toHaveBeenCalledWith(
      "Saved — local only (no DB yet)",
      expect.objectContaining({ manager: expect.objectContaining({ settings: "write" }) }),
    );
    expect(toastMock).toHaveBeenCalledWith({ title: "Saved — local only (no DB yet)" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(<RoleDefaultsModal open={false} onOpenChange={onOpenChange} />);
    rerender(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("tab", { name: /manager/i }));
    const reopenedSettingsGroup = getPermissionGroup("Administration", "Settings");
    expect(within(reopenedSettingsGroup).getByRole("radio", { name: "Write" }).getAttribute("data-state")).toBe("on");

    logSpy.mockRestore();
  });

  it("resets to initial defaults", async () => {
    render(<RoleDefaultsModal open={true} onOpenChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const docsLinksGroup = getPermissionGroup("Operations", "Docs & Links");

    await user.click(within(docsLinksGroup).getByRole("radio", { name: "None" }));

    const resetButton = screen.getByRole("button", { name: /reset to initial defaults/i }) as HTMLButtonElement;
    expect(resetButton.disabled).toBe(false);

    await user.click(resetButton);

    expect(within(docsLinksGroup).getByRole("radio", { name: "Read" }).getAttribute("data-state")).toBe("on");
  });

  it("reverts unsaved changes when reopened", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const docsLinksGroup = getPermissionGroup("Operations", "Docs & Links");
    await user.click(within(docsLinksGroup).getByRole("radio", { name: "None" }));

    rerender(<RoleDefaultsModal open={false} onOpenChange={onOpenChange} />);
    rerender(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const reopenedDocsLinks = getPermissionGroup("Operations", "Docs & Links");
    expect(within(reopenedDocsLinks).getByRole("radio", { name: "Read" }).getAttribute("data-state")).toBe("on");
  });
});
