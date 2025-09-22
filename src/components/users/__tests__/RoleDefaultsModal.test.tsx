import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("RoleDefaultsModal", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders tri-state defaults for manager", async () => {
    const onOpenChange = vi.fn();
    render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /manager/i }));

    const operationsSection = getSectionByTitle("Operations");
    expect(within(operationsSection).getByRole("button", { name: "Read" }).getAttribute("data-state")).toBe("on");
    expect(within(operationsSection).getByRole("button", { name: "Write" }).getAttribute("data-state")).toBe("off");

    const additionalSection = getSectionByTitle("Additional Permissions");
    expect(within(additionalSection).getByRole("button", { name: "Write" }).getAttribute("data-state")).toBe("on");

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("disables admin controls and shows notice", () => {
    render(<RoleDefaultsModal open={true} onOpenChange={vi.fn()} />);

    const notice = screen.getByText(/admin permissions are fixed/i);
    expect(notice).toBeInTheDocument();

    const operationsSection = getSectionByTitle("Operations");
    const writeButton = within(operationsSection).getByRole("button", { name: "Write" });
    expect(writeButton).toBeDisabled();
  });

  it("saves changes locally and logs the matrix", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const onOpenChange = vi.fn();
    const { rerender } = render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /manager/i }));
    const operationsSection = getSectionByTitle("Operations");

    await user.click(within(operationsSection).getByRole("button", { name: "Write" }));

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    expect(logSpy).toHaveBeenCalledWith(
      "Saved — local only (no DB yet)",
      expect.objectContaining({ manager: expect.objectContaining({ operations: "write" }) }),
    );
    expect(toastMock).toHaveBeenCalledWith({ title: "Saved — local only (no DB yet)" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(<RoleDefaultsModal open={false} onOpenChange={onOpenChange} />);
    rerender(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("tab", { name: /manager/i }));
    const reopenedOperationsSection = getSectionByTitle("Operations");
    expect(
      within(reopenedOperationsSection).getByRole("button", { name: "Write" }).getAttribute("data-state"),
    ).toBe("on");

    logSpy.mockRestore();
  });

  it("resets to initial defaults", async () => {
    render(<RoleDefaultsModal open={true} onOpenChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const operationsSection = getSectionByTitle("Operations");

    await user.click(within(operationsSection).getByRole("button", { name: "None" }));

    const resetButton = screen.getByRole("button", { name: /reset to initial defaults/i });
    expect(resetButton).not.toBeDisabled();

    await user.click(resetButton);

    expect(within(operationsSection).getByRole("button", { name: "Read" }).getAttribute("data-state")).toBe("on");
  });

  it("reverts unsaved changes when reopened", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const operationsSection = getSectionByTitle("Operations");
    await user.click(within(operationsSection).getByRole("button", { name: "None" }));

    rerender(<RoleDefaultsModal open={false} onOpenChange={onOpenChange} />);
    rerender(<RoleDefaultsModal open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("tab", { name: /viewer/i }));
    const reopenedSection = getSectionByTitle("Operations");
    expect(within(reopenedSection).getByRole("button", { name: "Read" }).getAttribute("data-state")).toBe("on");
  });
});
