export const READ_ONLY_REMINDER_MESSAGE =
  "Your account is limited to Viewer access. Ask an admin to upgrade your permissions.";

const STORAGE_KEY = "skyshare:read-only-reminder";

export function hasSeenReadOnlyReminder() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Unable to read read-only reminder state", error);
    }
    return false;
  }
}

export function markReadOnlyReminderSeen() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, "true");
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Unable to persist read-only reminder state", error);
    }
  }
}
