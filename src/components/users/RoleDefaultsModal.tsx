import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

interface RoleDefaultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleDefaultsModal({ open, onOpenChange }: RoleDefaultsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Role defaults</DialogTitle>
          <DialogDescription>
            Configure default permissions, notification settings, and onboarding tasks for each role.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            This area will let administrators define baseline access for Admins, Managers, Technicians, and Viewers. It will
            also handle automated notifications when new teammates join.
          </p>
          <p className="text-slate-500">
            We&apos;re still finalizing the workflow. In the meantime, continue adjusting individual team members from the table
            above.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
