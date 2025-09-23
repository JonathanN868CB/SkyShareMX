import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RoleDefaultsPage from "@/pages/admin/RoleDefaults";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  toast: (options: unknown) => toastMock(options),
}));

function renderRoleDefaultsPage() {
  return render(
    <MemoryRouter initialEntries={["/app/users/role-defaults"]}>
      <Routes>
        <Route path="/app/users/role-defaults" element={<RoleDefaultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

describe("RoleDefaultsPage", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the role defaults page", () => {
    renderRoleDefaultsPage();

    const heading = screen.getByRole("heading", { name: /role defaults/i });
    expect(heading).toBeInstanceOf(HTMLHeadingElement);
    const adminTab = screen.getByRole("tab", { name: /admin/i });
    expect(adminTab.getAttribute("data-state")).toBe("active");
  });

  it("switches to manager defaults", async () => {
    const user = userEvent.setup();
    renderRoleDefaultsPage();

    await user.click(screen.getByRole("tab", { name: /manager/i }));

    const operationsDocsLinks = getPermissionGroup("Operations", "Docs & Links");
    expect(within(operationsDocsLinks).getByRole("radio", { name: "Write" }).getAttribute("data-state")).toBe("on");

    const administrationUsers = getPermissionGroup("Administration", "Users");
    expect(within(administrationUsers).getByRole("radio", { name: "Read" }).getAttribute("data-state")).toBe("on");
  });

  it("keeps save disabled until a change is made", async () => {
    const user = userEvent.setup();
    renderRoleDefaultsPage();

    const saveButton = screen.getByRole("button", { name: /save/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const docsLinksGroup = getPermissionGroup("Operations", "Docs & Links");
    await user.click(within(docsLinksGroup).getByRole("radio", { name: "None" }));

    expect(saveButton.disabled).toBe(false);
  });
});
