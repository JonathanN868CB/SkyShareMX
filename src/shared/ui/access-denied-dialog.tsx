import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import logoAsset from "@/shared/assets/skyshare-logo.png";
import { getAdminEmails } from "@/shared/lib/env";
import { READ_ONLY_REMINDER_MESSAGE } from "@/shared/lib/read-only-reminder";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

type DialogVariant = "access-denied" | "read-only-reminder";

type AccessDeniedDialogContextValue = {
  show: (variant?: DialogVariant) => void;
  hide: () => void;
};

const AccessDeniedDialogContext = createContext<AccessDeniedDialogContextValue | null>(null);

const warnMissingProvider = (caller: string) => {
  if (import.meta.env.DEV) {
    console.warn(`${caller} called before AccessDeniedDialogProvider mounted.`);
  }
};

let showAccessDeniedHandler: () => void = () => warnMissingProvider("showAccessDenied()");
let showReadOnlyReminderHandler: () => void = () => warnMissingProvider("showReadOnlyReminder()");

// eslint-disable-next-line react-refresh/only-export-components
export function showAccessDenied() {
  showAccessDeniedHandler();
}

// eslint-disable-next-line react-refresh/only-export-components
export function showReadOnlyReminder() {
  showReadOnlyReminderHandler();
}

export function AccessDeniedDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<DialogVariant>("access-denied");

  const show = useCallback((nextVariant: DialogVariant = "access-denied") => {
    setVariant(nextVariant);
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    showAccessDeniedHandler = () => show("access-denied");
    showReadOnlyReminderHandler = () => show("read-only-reminder");
    return () => {
      showAccessDeniedHandler = () => warnMissingProvider("showAccessDenied()");
      showReadOnlyReminderHandler = () => warnMissingProvider("showReadOnlyReminder()");
    };
  }, [show]);

  const contextValue = useMemo(() => ({ show, hide }), [show, hide]);

  const adminEmails = useMemo(() => getAdminEmails(), []);
  const contactHref = useMemo(() => {
    const recipients = adminEmails.filter(Boolean);
    if (recipients.length === 0) {
      return "mailto:support@skyshare.com";
    }
    return `mailto:${recipients.join(",")}`;
  }, [adminEmails]);

  const dialogCopy = useMemo(() => {
    if (variant === "read-only-reminder") {
      return {
        title: "Viewer access",
        description: READ_ONLY_REMINDER_MESSAGE,
        body: "Reach out to your SkyShare administrator to request elevated permissions.",
      };
    }

    return {
      title: "Access restricted",
      description: "You don’t have access to this module.",
      body: "Reach out to your SkyShare administrator to request the permissions you need.",
    };
  }, [variant]);

  return (
    <AccessDeniedDialogContext.Provider value={contextValue}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-4 text-center">
            <img
              src={logoAsset}
              alt="SkyShare"
              className="h-10 w-auto object-contain"
              draggable={false}
            />
            <DialogHeader className="space-y-2 text-center">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {dialogCopy.title}
              </DialogTitle>
              <DialogDescription className="text-base">
                {dialogCopy.description}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{dialogCopy.body}</p>
            <DialogFooter className="w-full justify-center">
              <Button asChild className="px-6" onClick={hide}>
                <a href={contactHref}>Contact an admin</a>
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AccessDeniedDialogContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccessDeniedDialog() {
  const context = useContext(AccessDeniedDialogContext);
  if (!context) {
    throw new Error("useAccessDeniedDialog must be used within an AccessDeniedDialogProvider");
  }
  return context;
}
