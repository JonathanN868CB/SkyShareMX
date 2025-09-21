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
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

type AccessDeniedDialogContextValue = {
  show: () => void;
  hide: () => void;
};

const AccessDeniedDialogContext = createContext<AccessDeniedDialogContextValue | null>(null);

const warnMissingProvider = () => {
  if (import.meta.env.DEV) {
    console.warn("showAccessDenied() called before AccessDeniedDialogProvider mounted.");
  }
};

let showAccessDeniedHandler: () => void = warnMissingProvider;

// eslint-disable-next-line react-refresh/only-export-components
export function showAccessDenied() {
  showAccessDeniedHandler();
}

export function AccessDeniedDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    showAccessDeniedHandler = show;
    return () => {
      showAccessDeniedHandler = warnMissingProvider;
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
                Access restricted
              </DialogTitle>
              <DialogDescription className="text-base">
                You don’t have access to this module.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Reach out to your SkyShare administrator to request the permissions you need.
            </p>
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
