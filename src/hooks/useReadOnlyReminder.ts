import { useEffect } from "react";

import { hasSeenReadOnlyReminder, markReadOnlyReminderSeen } from "@/shared/lib/read-only-reminder";
import { showReadOnlyReminder } from "@/shared/ui/access-denied-dialog";

import { useReadOnly } from "./useUserPermissions";

export function useReadOnlyReminder() {
  const isReadOnly = useReadOnly();

  useEffect(() => {
    if (!isReadOnly) {
      return;
    }

    if (hasSeenReadOnlyReminder()) {
      return;
    }

    markReadOnlyReminderSeen();
    showReadOnlyReminder();
  }, [isReadOnly]);
}
