import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Info, Lock } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/shared/ui/breadcrumb";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/hooks/use-toast";

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
    noticeTitle: "",
    noticeDescription: "",
  },
  {
    id: "technician",
    label: "Technician",
    noticeTitle: "",
    noticeDescription: "",
  },
  {
    id: "viewer",
    label: "Viewer",
    noticeTitle: "",
    noticeDescription: "",
  },
] as const;

type RoleKey = (typeof ROLE_CONFIG)[number]["id"];

type PermissionLevel = "none" | "read" | "write";

const PERMISSION_SECTIONS = [
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
] as const;

type SectionKey = (typeof PERMISSION_SECTIONS)[number]["id"];

type PermissionDefinition = (typeof PERMISSION_SECTIONS)[number]["permissions"][number];

type PermissionKey = PermissionDefinition["id"];

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

const SECTION_PERMISSION_LOOKUP = PERMISSION_SECTIONS.reduce<Record<SectionKey, string[]>>(
  (accumulator, section) => {
    accumulator[section.id] = section.permissions.map(permission => permission.id);
    return accumulator;
  },
  {} as Record<SectionKey, string[]>,
);

const PERMISSION_SECTION_LOOKUP = PERMISSION_SECTIONS.reduce<Record<PermissionKey, SectionKey>>(
  (accumulator, section) => {
    section.permissions.forEach(permission => {
      accumulator[permission.id] = section.id;
    });
    return accumulator;
  },
  {} as Record<PermissionKey, SectionKey>,
);

const PERMISSION_IDS = PERMISSION_SECTIONS.flatMap(section => section.permissions.map(permission => permission.id)) as PermissionKey[];

type RolePermissionMatrix = Record<RoleKey, Record<PermissionKey, PermissionLevel>>;

type RolePermissionMatrixSnapshot = Partial<
  Record<RoleKey, Partial<Record<PermissionKey, PermissionLevel | null | undefined>>>
>;

function isPermissionLevel(value: unknown): value is PermissionLevel {
  return value === "none" || value === "read" || value === "write";
}

const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
];

function deriveSectionLevel(role: RoleKey, sectionId: SectionKey): PermissionLevel {
  if (role === "admin") {
    return "write";
  }

  const selection = ROLE_DEFAULT_SELECTIONS[role];
  const permissionIds = SECTION_PERMISSION_LOOKUP[sectionId] ?? [];

  if (selection === "all") {
    return role === "viewer" ? "read" : "write";
  }

  const selectedCount = permissionIds.filter(id => selection.includes(id)).length;

  if (selectedCount === 0) {
    return "none";
  }

  if (selectedCount === permissionIds.length) {
    return role === "viewer" ? "read" : "write";
  }

  return "read";
}

function derivePermissionLevel(role: RoleKey, permissionId: PermissionKey): PermissionLevel {
  if (role === "admin") {
    return "write";
  }

  const selection = ROLE_DEFAULT_SELECTIONS[role];
  if (selection === "all") {
    return role === "viewer" ? "read" : "write";
  }

  const sectionId = PERMISSION_SECTION_LOOKUP[permissionId];
  const sectionLevel = deriveSectionLevel(role, sectionId);

  if (!selection.includes(permissionId)) {
    return "none";
  }

  if (sectionLevel === "write") {
    return role === "viewer" ? "read" : "write";
  }

  return "read";
}

function createInitialMatrix(): RolePermissionMatrix {
  return ROLE_CONFIG.reduce<RolePermissionMatrix>((rolesAccumulator, role) => {
    rolesAccumulator[role.id] = PERMISSION_IDS.reduce<Record<PermissionKey, PermissionLevel>>(
      (permissionsAccumulator, permissionId) => {
        permissionsAccumulator[permissionId] = derivePermissionLevel(role.id, permissionId);
        return permissionsAccumulator;
      },
      {} as Record<PermissionKey, PermissionLevel>,
    );
    return rolesAccumulator;
  }, {} as RolePermissionMatrix);
}

function cloneMatrix(matrix?: RolePermissionMatrixSnapshot | RolePermissionMatrix): RolePermissionMatrix {
  return ROLE_CONFIG.reduce<RolePermissionMatrix>((rolesAccumulator, role) => {
    const rolePermissions = matrix?.[role.id] ?? {};

    rolesAccumulator[role.id] = PERMISSION_IDS.reduce<Record<PermissionKey, PermissionLevel>>(
      (permissionsAccumulator, permissionId) => {
        const level = rolePermissions?.[permissionId];
        permissionsAccumulator[permissionId] = isPermissionLevel(level) ? level : "none";
        return permissionsAccumulator;
      },
      {} as Record<PermissionKey, PermissionLevel>,
    );

    return rolesAccumulator;
  }, {} as RolePermissionMatrix);
}

function matricesEqual(first: RolePermissionMatrix, second: RolePermissionMatrix): boolean {
  return ROLE_CONFIG.every(role =>
    PERMISSION_IDS.every(permissionId => first[role.id][permissionId] === second[role.id][permissionId]),
  );
}

export default function RoleDefaultsPage() {
  const navigate = useNavigate();
  const initialMatrixRef = useRef<RolePermissionMatrix>();

  if (!initialMatrixRef.current) {
    initialMatrixRef.current = createInitialMatrix();
  }

  const [activeRole, setActiveRole] = useState<RoleKey>("admin");
  const [savedMatrix, setSavedMatrix] = useState<RolePermissionMatrix>(() => cloneMatrix(initialMatrixRef.current!));
  const [matrix, setMatrix] = useState<RolePermissionMatrix>(() => cloneMatrix(initialMatrixRef.current!));

  const initialMatrix = initialMatrixRef.current!;

  const hasChanges = useMemo(() => !matricesEqual(matrix, savedMatrix), [matrix, savedMatrix]);
  const canReset = useMemo(() => !matricesEqual(matrix, initialMatrix), [matrix, initialMatrix]);

  const updatePermissionLevel = (role: RoleKey, permissionId: PermissionKey, level: PermissionLevel) => {
    const roleConfig = ROLE_CONFIG.find(item => item.id === role);
    if (roleConfig?.readOnly) return;

    setMatrix(previous => ({
      ...previous,
      [role]: {
        ...previous[role],
        [permissionId]: level,
      },
    }));
  };

  const handleReset = () => {
    setMatrix(cloneMatrix(initialMatrix));
  };

  const handleCancel = () => {
    setMatrix(cloneMatrix(savedMatrix));
    navigate("/app/admin/users");
  };

  const handleSave = () => {
    if (!hasChanges) return;

    const normalizedMatrix = cloneMatrix(matrix);
    setSavedMatrix(normalizedMatrix);
    console.log("Saved — local only (no DB yet)", normalizedMatrix);
    toast({ title: "Saved — local only (no DB yet)" });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 text-slate-900">
      <div className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app/admin/users">Users</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Role Defaults</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Role Defaults</h1>
          <p className="text-base text-slate-600">
            Configure access and workflow defaults for each role. Updates apply to future Google sign-ins automatically.
          </p>
        </div>
      </div>

      <Tabs
        value={activeRole}
        onValueChange={value => setActiveRole(value as RoleKey)}
        className="grid h-[min(100dvh-4rem,900px)] grid-rows-[auto,1fr,auto] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="space-y-4 border-b border-slate-200 px-6 py-4 sm:px-8">
          <p className="text-sm text-slate-600">
            Choose a role to review module-level defaults. These permissions apply the next time teammates sign in with Google.
          </p>
          <div className="overflow-x-auto pb-1">
            <TabsList className="flex w-full min-w-max gap-2 rounded-full bg-slate-100 p-1 text-slate-600">
              {ROLE_CONFIG.map(role => (
                <TabsTrigger
                  key={role.id}
                  value={role.id}
                  className="rounded-full px-4 py-2 text-sm font-medium transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                >
                  {role.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="overflow-y-auto px-6 pb-6 pt-4 sm:px-8">
          {ROLE_CONFIG.map(role => {
            const isReadOnly = Boolean(role.readOnly);
            return (
              <TabsContent key={role.id} value={role.id} className="space-y-4 focus-visible:outline-none">
                {(isReadOnly || Boolean(role.noticeTitle || role.noticeDescription)) && (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                      isReadOnly ? "border-slate-200 bg-slate-50 text-slate-700" : "border-primary/30 bg-primary/5 text-slate-700",
                    )}
                  >
                    {isReadOnly ? (
                      <Lock className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                    )}
                    <div className="space-y-1">
                      {role.noticeTitle && (
                        <p className="text-sm font-semibold text-slate-900">{role.noticeTitle}</p>
                      )}
                      {role.noticeDescription && (
                        <p className="text-sm text-slate-600">{role.noticeDescription}</p>
                      )}
                      {isReadOnly && (
                        <p className="text-xs text-slate-500">
                          Admin permissions are fixed for now—adjust the other roles to tailor access levels.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {PERMISSION_SECTIONS.map(section => {
                    const headingId = `${role.id}-${section.id}-heading`;

                    return (
                      <section
                        key={`${role.id}-${section.id}`}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        aria-labelledby={headingId}
                      >
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <h3 id={headingId} className="text-sm font-semibold text-slate-900">
                              {section.title}
                            </h3>
                            <p className="text-xs text-slate-500">Adjust defaults for each module in this section.</p>
                          </div>

                          <div className="space-y-3">
                            {section.permissions.map(permission => {
                              const permissionLabelId = `${role.id}-${section.id}-${permission.id}-label`;
                              const permissionLevel = matrix[role.id]?.[permission.id] ?? "none";

                              return (
                                <div
                                  key={`${role.id}-${permission.id}`}
                                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="space-y-0.5">
                                    <p id={permissionLabelId} className="text-sm font-medium text-slate-900">
                                      {permission.label}
                                    </p>
                                  </div>
                                  <div className={cn("flex items-center justify-end", isReadOnly && "opacity-60")}>
                                    <ToggleGroup
                                      type="single"
                                      value={permissionLevel}
                                      onValueChange={value => {
                                        if (!value) return;
                                        updatePermissionLevel(role.id, permission.id, value as PermissionLevel);
                                      }}
                                      aria-labelledby={permissionLabelId}
                                      className="gap-1"
                                      disabled={isReadOnly}
                                    >
                                      {PERMISSION_LEVELS.map(level => (
                                        <ToggleGroupItem
                                          key={level.value}
                                          value={level.value}
                                          disabled={isReadOnly}
                                          className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 transition data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                        >
                                          {level.label}
                                        </ToggleGroupItem>
                                      ))}
                                    </ToggleGroup>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </TabsContent>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!canReset}
            className="border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            Reset to Initial Defaults
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleCancel} className="text-slate-600 hover:bg-slate-100">
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!hasChanges} className="rounded-full px-5">
              Save
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
