import { afterEach, describe, expect, it } from "vitest";

import { getAdminEmails } from "./env";

const MASTER_ADMIN_EMAIL = "jonathan@skyshare.com";
const ORIGINAL_ADMIN_EMAILS = process.env.VITE_ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL_ADMIN_EMAILS === undefined) {
    delete process.env.VITE_ADMIN_EMAILS;
  } else {
    process.env.VITE_ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  }
});

describe("getAdminEmails", () => {
  it("returns normalized admin emails while preserving non-empty entries", () => {
    process.env.VITE_ADMIN_EMAILS =
      " secondary@example.com , , Third@Example.com ,, secondary@example.com ";

    expect(getAdminEmails()).toEqual([
      MASTER_ADMIN_EMAIL,
      "secondary@example.com",
      "third@example.com",
    ]);
  });

  it("ensures the master admin email is always included", () => {
    delete process.env.VITE_ADMIN_EMAILS;

    expect(getAdminEmails()).toEqual([MASTER_ADMIN_EMAIL]);
  });
});
