import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/shared/lib/api";
import { fetchRoleDefaults, updateRoleDefaults, type PermissionLevel, type RoleDefaultsMap } from "@/lib/api/role-defaults";

const ROLE_CONFIG = [
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Manager" },
  { id: "technician", label: "Technician" },
  { id: "viewer", label: "Viewer" },
] as const;

type RoleKey = (typeof ROLE_CONFIG)[number]["id"];

type PermissionKey = string;

interface PermissionDefinition {
  id: PermissionKey;
  label: string;
  description?: string | null;
}

interface PermissionSection {
  id: string;
  title: string;
  description?: string | null;
  permissions: PermissionDefinition[];
}

type RolePermissionMatrix = Record<RoleKey, Record<PermissionKey, PermissionLevel>>;

type RolePermissionMatrixSnapshot = Partial<
  Record<RoleKey, Partial<Record<PermissionKey, PermissionLevel | null | undefined>>>
>;

const PERMISSION_LEVELS: Array<{ value: PermissionLevel; label: string }> = [
  { value: "none", label: "None" },
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
];

const ROLE_LOOKUP = new Map<string, RoleKey>(ROLE_CONFIG.map(role => [role.id, role.id]));

function toTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }

  return null;
}

function toNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const result = toTrimmedString(row[key]);
    if (result) {
      return result;
    }
  }

  return null;
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const result = toNumericValue(row[key]);
    if (result !== null) {
      return result;
    }
  }

  return null;
}

interface SectionAccumulator {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  permissions: Array<PermissionDefinition & { sortOrder: number }>;
}

function mapSectionCatalogRows(
  rows: Array<Record<string, unknown>> | null | undefined,
): PermissionSection[] {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const sections = new Map<string, SectionAccumulator>();
  let fallbackSectionCounter = 0;

  normalizedRows.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const row = entry as Record<string, unknown>;

    const rawSectionId = pickString(row, "section_id", "section_key", "section_slug", "group_id", "section");
    const rawSectionGroup = pickString(row, "section_group", "group_label", "group_name");
    const rawSectionTitle = pickString(row, "section_title", "section_label", "section_name") ?? rawSectionGroup;

    const sectionId =
      rawSectionId ??
      (rawSectionTitle ? slugify(rawSectionTitle) : null) ??
      (rawSectionGroup ? slugify(rawSectionGroup) : null) ??
      `section-${fallbackSectionCounter++}`;
    const sectionTitle = rawSectionTitle ?? rawSectionGroup ?? "Section";
    const sectionDescription = pickString(row, "section_description", "group_description");
    const sectionOrder =
      pickNumber(row, "section_order", "section_sort_order", "group_order", "group_sort_order") ?? index;

    const permissionId = pickString(
      row,
      "permission_id",
      "permission_key",
      "permission_slug",
      "permission",
      "feature_id",
      "feature_key",
      "id",
    );

    if (!permissionId) {
      return;
    }

    const permissionLabel =
      pickString(row, "permission_label", "permission_name", "label", "name", "title", "feature_label") ??
      permissionId;
    const permissionDescription = pickString(row, "permission_description", "description", "details", "summary");
    const permissionOrder =
      pickNumber(
        row,
        "permission_order",
        "permission_sort_order",
        "item_order",
        "display_order",
        "order",
        "sort_order",
        "position",
      ) ?? index;

    let section = sections.get(sectionId);
    if (!section) {
      section = {
        id: sectionId,
        title: sectionTitle,
        description: sectionDescription ?? null,
        sortOrder: sectionOrder,
        permissions: [],
      } satisfies SectionAccumulator;
      sections.set(sectionId, section);
    }

    if (section.permissions.some(permission => permission.id === permissionId)) {
      return;
    }

    section.permissions.push({
      id: permissionId,
      label: permissionLabel,
      description: permissionDescription ?? null,
      sortOrder: permissionOrder,
    });
  });

  return Array.from(sections.values())
    .map(section => ({
      ...section,
      permissions: section.permissions
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ sortOrder, ...permission }) => permission),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder, ...section }) => section);
}

function derivePermissionIds(sections: PermissionSection[]): PermissionKey[] {
  const seen = new Set<PermissionKey>();
  const ids: PermissionKey[] = [];

  sections.forEach(section => {
    section.permissions.forEach(permission => {
      if (!seen.has(permission.id)) {
        seen.add(permission.id);
        ids.push(permission.id);
      }
    });
  });

  return ids;
}

function isPermissionLevel(value: unknown): value is PermissionLevel {
  return value === "none" || value === "read" || value === "write";
}

function cloneRolePermissions(
  permissionIds: PermissionKey[],
  snapshot?: Partial<Record<PermissionKey, PermissionLevel | null | undefined>>,
): Record<PermissionKey, PermissionLevel> {
  return permissionIds.reduce<Record<PermissionKey, PermissionLevel>>((accumulator, permissionId) => {
    const level = snapshot?.[permissionId];
    accumulator[permissionId] = isPermissionLevel(level) ? level : "none";
    return accumulator;
  }, {} as Record<PermissionKey, PermissionLevel>);
}

function cloneMatrixFromSnapshot(
  permissionIds: PermissionKey[],
  snapshot?: RolePermissionMatrixSnapshot | RolePermissionMatrix | null | undefined,
): RolePermissionMatrix {
  return ROLE_CONFIG.reduce<RolePermissionMatrix>((rolesAccumulator, role) => {
    const rolePermissions = (snapshot as RolePermissionMatrixSnapshot | RolePermissionMatrix | undefined)?.[role.id];

    rolesAccumulator[role.id] = cloneRolePermissions(
      permissionIds,
      rolePermissions as Partial<Record<PermissionKey, PermissionLevel | null | undefined>> | undefined,
    );

    return rolesAccumulator;
  }, {} as RolePermissionMatrix);
}

function roleMatricesEqual(
  first: RolePermissionMatrix,
  second: RolePermissionMatrix,
  role: RoleKey,
  permissionIds: PermissionKey[],
): boolean {
  const firstPermissions = first[role] ?? {};
  const secondPermissions = second[role] ?? {};

  return permissionIds.every(permissionId => {
    const firstLevel = firstPermissions[permissionId] ?? "none";
    const secondLevel = secondPermissions[permissionId] ?? "none";
    return firstLevel === secondLevel;
  });
}

function matricesEqual(
  first: RolePermissionMatrix,
  second: RolePermissionMatrix,
  permissionIds: PermissionKey[],
): boolean {
  return ROLE_CONFIG.every(role => roleMatricesEqual(first, second, role.id, permissionIds));
}

function normalizeRoleKey(value: unknown): RoleKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ROLE_LOOKUP.get(normalized) ?? null;
}

function sanitizeRoleDefaults(defaults: Record<string, PermissionLevel>): Record<PermissionKey, PermissionLevel> {
  return Object.entries(defaults).reduce<Record<PermissionKey, PermissionLevel>>((accumulator, [section, level]) => {
    const key = toTrimmedString(section);
    if (!key || !isPermissionLevel(level)) {
      return accumulator;
    }

    accumulator[key] = level;
    return accumulator;
  }, {} as Record<PermissionKey, PermissionLevel>);
}

function convertRoleDefaultsToSnapshot(defaults: RoleDefaultsMap): RolePermissionMatrixSnapshot {
  const snapshot: RolePermissionMatrixSnapshot = {};

  const entries = Object.entries(defaults ?? {}) as Array<[string, Record<string, PermissionLevel>]>;

  entries.forEach(([roleKey, permissions]) => {
    const role = normalizeRoleKey(roleKey);
    if (!role || !permissions) {
      return;
    }

    snapshot[role] = sanitizeRoleDefaults(permissions);
  });

  ROLE_CONFIG.forEach(role => {
    if (!snapshot[role.id]) {
      snapshot[role.id] = {};
    }
  });

  return snapshot;
}

export default function RoleDefaultsPage() {
  const navigate = useNavigate();
  const initialMatrixRef = useRef<RolePermissionMatrix>();
  const isMountedRef = useRef(true);

  const [sections, setSections] = useState<PermissionSection[]>([]);
  const [matrix, setMatrix] = useState<RolePermissionMatrix | null>(null);
  const [savedMatrix, setSavedMatrix] = useState<RolePermissionMatrix | null>(null);
  const [activeRole, setActiveRole] = useState<RoleKey>(ROLE_CONFIG[0].id);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const permissionIds = useMemo(() => derivePermissionIds(sections), [sections]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const loadData = useCallback(async () => {
    setIsFetching(true);
    setLoadError(null);

    try {
      const { data: sectionRows, error: sectionError } = await supabase
        .from("app_section_catalog" as unknown as string)
        .select("*")
        .order("section_group", { ascending: true });

      if (sectionError) {
        throw new Error(sectionError.message ?? "Failed to load section catalog");
      }

      const mappedSections = mapSectionCatalogRows(sectionRows as Array<Record<string, unknown>> | null);
      const permissionIdList = derivePermissionIds(mappedSections);

      const roleDefaults = await fetchRoleDefaults();
      const snapshot = convertRoleDefaultsToSnapshot(roleDefaults);
      const normalizedMatrix = cloneMatrixFromSnapshot(permissionIdList, snapshot);

      if (!isMountedRef.current) {
        return;
      }

      initialMatrixRef.current = normalizedMatrix;
      setSections(mappedSections);
      setSavedMatrix(cloneMatrixFromSnapshot(permissionIdList, normalizedMatrix));
      setMatrix(cloneMatrixFromSnapshot(permissionIdList, normalizedMatrix));
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to load role defaults.";
      setLoadError(message);
      toast({
        title: "Unable to load role defaults",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const disableToggleGroup = isFetching || isSaving || !matrix;

  const canReset = useMemo(() => {
    if (!matrix || !initialMatrixRef.current) {
      return false;
    }

    return !matricesEqual(matrix, initialMatrixRef.current, permissionIds);
  }, [matrix, permissionIds]);

  const activeRoleHasChanges = useMemo(() => {
    if (!matrix || !savedMatrix) {
      return false;
    }

    return !roleMatricesEqual(matrix, savedMatrix, activeRole, permissionIds);
  }, [matrix, savedMatrix, activeRole, permissionIds]);

  const updatePermissionLevel = (role: RoleKey, permissionId: PermissionKey, level: PermissionLevel) => {
    setMatrix(previous => {
      if (!previous) {
        return previous;
      }

      const rolePermissions = previous[role] ?? {};
      if (rolePermissions[permissionId] === level) {
        return previous;
      }

      return {
        ...previous,
        [role]: {
          ...rolePermissions,
          [permissionId]: level,
        },
      } satisfies RolePermissionMatrix;
    });
  };

  const handleReset = () => {
    if (!initialMatrixRef.current) {
      return;
    }

    setMatrix(cloneMatrixFromSnapshot(permissionIds, initialMatrixRef.current));
  };

  const handleCancel = () => {
    if (savedMatrix) {
      setMatrix(cloneMatrixFromSnapshot(permissionIds, savedMatrix));
    }

    navigate("/app/admin/users");
  };

  const handleSave = async () => {
    if (!matrix || !savedMatrix) {
      return;
    }

    const pendingChanges = permissionIds.reduce<Array<{ section: string; level: PermissionLevel }>>((accumulator, id) => {
      const nextLevel = matrix[activeRole]?.[id] ?? "none";
      const previousLevel = savedMatrix[activeRole]?.[id] ?? "none";

      if (nextLevel !== previousLevel) {
        accumulator.push({ section: id, level: nextLevel });
      }

      return accumulator;
    }, []);

    if (pendingChanges.length === 0) {
      toast({
        title: "No changes to save",
        description: "Update a permission before saving.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateRoleDefaults(activeRole, pendingChanges);
      if (!isMountedRef.current) {
        return;
      }

      setSavedMatrix(previous => {
        const baseSnapshot = previous ?? initialMatrixRef.current ?? null;
        const next = cloneMatrixFromSnapshot(permissionIds, baseSnapshot);
        next[activeRole] = cloneRolePermissions(permissionIds, matrix[activeRole]);
        return next;
      });

      const roleLabel = ROLE_CONFIG.find(role => role.id === activeRole)?.label ?? "Role";
      toast({
        title: "Role defaults updated",
        description: `${roleLabel} defaults saved successfully.`,
      });
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to save role defaults.";
      toast({
        title: "Failed to save role defaults",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const handleRetry = () => {
    if (isFetching) {
      return;
    }

    loadData();
  };

  const shouldShowEmptyState = !matrix || sections.length === 0;

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
          {ROLE_CONFIG.map(role => (
            <TabsContent key={role.id} value={role.id} className="space-y-4 focus-visible:outline-none">
              {shouldShowEmptyState ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-600">
                    {isFetching
                      ? "Loading role defaults…"
                      : loadError ?? "No sections are configured yet."}
                  </p>
                  {loadError ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={isFetching}
                        className="border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        Try again
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  {sections.map(section => {
                    const headingId = `${role.id}-${section.id}-heading`;
                    const sectionDescription =
                      section.description ?? "Adjust defaults for each module in this section.";

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
                            <p className="text-xs text-slate-500">{sectionDescription}</p>
                          </div>

                          <div className="space-y-3">
                            {section.permissions.map(permission => {
                              const permissionLabelId = `${role.id}-${section.id}-${permission.id}-label`;
                              const permissionLevel = matrix?.[role.id]?.[permission.id] ?? "none";

                              return (
                                <div
                                  key={`${role.id}-${permission.id}`}
                                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="space-y-0.5">
                                    <p id={permissionLabelId} className="text-sm font-medium text-slate-900">
                                      {permission.label}
                                    </p>
                                    {permission.description ? (
                                      <p className="text-xs text-slate-500">{permission.description}</p>
                                    ) : null}
                                  </div>
                                  <div className={cn("flex items-center justify-end", disableToggleGroup && "opacity-60")}>
                                    <ToggleGroup
                                      type="single"
                                      value={permissionLevel}
                                      onValueChange={value => {
                                        if (!value) {
                                          return;
                                        }
                                        updatePermissionLevel(role.id, permission.id, value as PermissionLevel);
                                      }}
                                      aria-labelledby={permissionLabelId}
                                      className="gap-1"
                                      disabled={disableToggleGroup}
                                    >
                                      {PERMISSION_LEVELS.map(level => (
                                        <ToggleGroupItem
                                          key={level.value}
                                          value={level.value}
                                          disabled={disableToggleGroup}
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
              )}
            </TabsContent>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!canReset || isSaving || isFetching}
            className="border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            Reset to Initial Defaults
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="text-slate-600 hover:bg-slate-100"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!activeRoleHasChanges || isSaving || !matrix}
              className="rounded-full px-5"
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
