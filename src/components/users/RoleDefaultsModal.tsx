import { useEffect, useMemo, useState } from "react";
import { Info, Lock } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/hooks/use-toast";

interface RoleDefaultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RoleKey = typeof ROLE_CONFIG[number]["id"];

interface PermissionDefinition {
  id: string;
  label: string;
}

interface PermissionSection {
  id: string;
  title: string;
  permissions: PermissionDefinition[];
}

const ROLE_CONFIG = [
  {
    id: "admin",
    label: "Admin",
    readOnly: true,
    noticeTitle: "Admin permissions",
    noticeDescription: "Admin permissions are fixed and cannot be modified.",
  },
  {
    id: "manager",
    label: "Manager",
    noticeTitle: "Manager defaults",
    noticeDescription: "Managers oversee day-to-day schedules, approvals, and training workflows.",
  },
  {
    id: "technician",
    label: "Technician",
    noticeTitle: "Technician defaults",
    noticeDescription: "Technicians focus on inspections, logbooks, and maintenance documentation.",
  },
  {
    id: "viewer",
    label: "Viewer",
    noticeTitle: "Viewer defaults",
    noticeDescription: "Viewers can monitor aircraft activity without making changes.",
  },
] as const;

const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    id: "overview",
    title: "Overview",
    permissions: [
      { id: "dashboard", label: "Dashboard" },
      { id: "aircraft-info", label: "Aircraft Info" },
      { id: "ai-assistant", label: "AI Assistant" },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    permissions: [
      { id: "aircraft-conformity", label: "Aircraft Conformity" },
      { id: "check-14-day", label: "14-Day Check" },
      { id: "training", label: "Training" },
      { id: "maintenance-planning", label: "Maintenance Planning" },
      { id: "maintenance-control", label: "Maintenance Control" },
      { id: "docs-links", label: "Docs & Links" },
    ],
  },
  {
    id: "administration",
    title: "Administration",
    permissions: [
      { id: "alerts", label: "Alerts & Notifications" },
      { id: "users", label: "Users" },
      { id: "settings", label: "Settings" },
    ],
  },
  {
    id: "development",
    title: "Development",
    permissions: [{ id: "style-guide", label: "Style Guide" }],
  },
  {
    id: "additional",
    title: "Additional Permissions",
    permissions: [
      { id: "export-data", label: "Can export data" },
      { id: "approve-signoff", label: "Can approve/sign-off" },
      { id: "templates", label: "Can manage templates/SOPs" },
      { id: "view-pmi", label: "Can view PMI" },
    ],
  },
];

const ROLE_DEFAULT_SELECTIONS: Record<RoleKey, string[] | "all"> = {
  admin: "all",
  manager: [
    "dashboard",
    "aircraft-info",
    "ai-assistant",
    "aircraft-conformity",
    "check-14-day",
    "training",
    "maintenance-planning",
    "maintenance-control",
    "docs-links",
    "alerts",
    "users",
    "style-guide",
    "export-data",
    "approve-signoff",
    "templates",
    "view-pmi",
  ],
  technician: [
    "dashboard",
    "aircraft-info",
    "aircraft-conformity",
    "check-14-day",
    "maintenance-planning",
    "docs-links",
    "style-guide",
  ],
  viewer: ["dashboard", "aircraft-info", "docs-links"],
};

const PERMISSION_IDS = PERMISSION_SECTIONS.flatMap(section => section.permissions.map(permission => permission.id));

type RolePermissionState = Record<RoleKey, Record<string, boolean>>;

function buildRoleDefault(role: RoleKey): Record<string, boolean> {
  const selection = ROLE_DEFAULT_SELECTIONS[role];
  return PERMISSION_IDS.reduce<Record<string, boolean>>((accumulator, permissionId) => {
    const isSelected = selection === "all" ? true : selection.includes(permissionId);
    accumulator[permissionId] = isSelected;
    return accumulator;
  }, {});
}

function createDefaultPermissions(): RolePermissionState {
  return ROLE_CONFIG.reduce<RolePermissionState>((accumulator, role) => {
    accumulator[role.id] = buildRoleDefault(role.id);
    return accumulator;
  }, {} as RolePermissionState);
}

export function RoleDefaultsModal({ open, onOpenChange }: RoleDefaultsModalProps) {
  const [activeRole, setActiveRole] = useState<RoleKey>("admin");
  const [permissions, setPermissions] = useState<RolePermissionState>(() => createDefaultPermissions());

  useEffect(() => {
    if (!open) {
      setActiveRole("admin");
      setPermissions(createDefaultPermissions());
    }
  }, [open]);

  const activeRoleConfig = ROLE_CONFIG.find(role => role.id === activeRole) ?? ROLE_CONFIG[0];
  const activeRoleDefaults = useMemo(() => buildRoleDefault(activeRole), [activeRole]);

  const isRoleDirty = useMemo(() => {
    const current = permissions[activeRole];
    return Object.keys(activeRoleDefaults).some(permissionId => current[permissionId] !== activeRoleDefaults[permissionId]);
  }, [activeRole, activeRoleDefaults, permissions]);

  const isActiveRoleReadOnly = Boolean(activeRoleConfig.readOnly);
  const saveDisabled = isActiveRoleReadOnly ? false : !isRoleDirty;

  const updateRolePermissions = (role: RoleKey, updates: Record<string, boolean>) => {
    setPermissions(previous => ({
      ...previous,
      [role]: { ...previous[role], ...updates },
    }));
  };

  const togglePermission = (role: RoleKey, permissionId: string, value: boolean) => {
    const roleConfig = ROLE_CONFIG.find(item => item.id === role);
    if (roleConfig?.readOnly) return;
    updateRolePermissions(role, { [permissionId]: value });
  };

  const toggleSection = (role: RoleKey, permissionIds: string[], value: boolean) => {
    const roleConfig = ROLE_CONFIG.find(item => item.id === role);
    if (roleConfig?.readOnly) return;
    const updates = permissionIds.reduce<Record<string, boolean>>((accumulator, permissionId) => {
      accumulator[permissionId] = value;
      return accumulator;
    }, {});
    updateRolePermissions(role, updates);
  };

  const handleResetRole = () => {
    if (isActiveRoleReadOnly) return;
    setPermissions(previous => ({
      ...previous,
      [activeRole]: buildRoleDefault(activeRole),
    }));
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleSave = () => {
    toast({
      title: "Permissions updated",
      description: `${activeRoleConfig.label} defaults saved.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl space-y-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900">Permissions</DialogTitle>
          <DialogDescription>
            Configure access and workflow defaults for each role. Updates apply to future invites automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeRole} onValueChange={value => setActiveRole(value as RoleKey)} className="space-y-6">
          <TabsList className="flex w-full flex-wrap gap-2 rounded-full bg-slate-100 p-1 sm:w-auto">
            {ROLE_CONFIG.map(role => (
              <TabsTrigger
                key={role.id}
                value={role.id}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
              >
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLE_CONFIG.map(role => {
            const rolePermissions = permissions[role.id];
            const isReadOnly = Boolean(role.readOnly);
            return (
              <TabsContent key={role.id} value={role.id} className="space-y-6">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                    isReadOnly
                      ? "border-slate-200 bg-slate-50 text-slate-700"
                      : "border-primary/30 bg-primary/5 text-slate-700",
                  )}
                >
                  {isReadOnly ? (
                    <Lock className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{role.noticeTitle}</p>
                    <p className="text-sm text-slate-600">{role.noticeDescription}</p>
                  </div>
                </div>

                {PERMISSION_SECTIONS.map(section => {
                  const permissionIds = section.permissions.map(permission => permission.id);
                  const allSelected = permissionIds.every(id => rolePermissions[id]);
                  const selectAllLabel = allSelected ? "Clear All" : "Select All";

                  return (
                    <div key={section.id} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                        {section.permissions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSection(role.id, permissionIds, !allSelected)}
                            disabled={isReadOnly}
                            className="rounded-full px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            {selectAllLabel}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {section.permissions.map(permission => {
                          const checked = rolePermissions[permission.id];
                          return (
                            <label
                              key={permission.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition",
                                checked
                                  ? "border-primary/50 bg-primary/5 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5",
                                isReadOnly && "cursor-default opacity-70 hover:border-slate-200 hover:bg-white",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={value => togglePermission(role.id, permission.id, value === true)}
                                disabled={isReadOnly}
                              />
                              <span className="font-medium text-slate-700">{permission.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleResetRole}
            disabled={isActiveRoleReadOnly || !isRoleDirty}
            className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            Reset Role to Defaults
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleCancel} className="text-slate-600 hover:bg-slate-100">
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saveDisabled} className="rounded-full px-5">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
