import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Skull, Users as UsersIcon } from "lucide-react";

import type { EmploymentStatus, Role, UserSummary } from "@/lib/types/users";
import { ROLES } from "@/lib/types/users";
import { formatDate } from "@/lib/utils/date";
import { RoleDropdown } from "@/components/users/RoleDropdown";
import { StatusPill } from "@/components/users/StatusPill";
import { LockedBadge } from "@/components/users/LockedBadge";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/shared/ui/pagination";

interface UsersTableProps {
  users: UserSummary[];
  loading: boolean;
  refreshing?: boolean;
  total: number;
  page: number;
  perPage: number;
  mockMode?: boolean;
  canManage?: boolean;
  lockedUserIds?: string[];
  pendingRoleIds?: string[];
  pendingStatusIds?: string[];
  error?: string | null;
  onRoleChange: (userId: string, role: Role) => void;
  onStatusChange: (userId: string, status: EmploymentStatus) => void;
  onDelete?: (user: UserSummary) => Promise<void> | void;
  deletingUserId?: string | null;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
  headerTitle?: string;
  headerDescription?: string;
  headerActions?: ReactNode;
  filters?: ReactNode;
  className?: string;
}

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(part => part.charAt(0).toUpperCase()).join("");
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

const STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

const readOnlyRoleClass =
  "inline-flex h-10 min-w-[160px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-600";
const readOnlyStatusClass =
  "inline-flex h-11 min-w-[210px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-600";
const readOnlyActionClass =
  "inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500";

export function UsersTable({
  users,
  loading,
  refreshing = false,
  total,
  page,
  perPage,
  mockMode = false,
  canManage = true,
  lockedUserIds = [],
  pendingRoleIds = [],
  pendingStatusIds = [],
  error,
  onRoleChange,
  onStatusChange,
  onDelete,
  deletingUserId,
  onPageChange,
  onRetry,
  headerTitle = "Team roster",
  headerDescription = "Manage access across administrators, managers, technicians, and viewers.",
  headerActions,
  filters,
  className,
}: UsersTableProps) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const lockedSet = useMemo(() => new Set(lockedUserIds), [lockedUserIds]);
  const rolePendingSet = useMemo(() => new Set(pendingRoleIds), [pendingRoleIds]);
  const statusPendingSet = useMemo(() => new Set(pendingStatusIds), [pendingStatusIds]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handlePageChange = (nextPage: number) => {
    if (onPageChange) {
      onPageChange(nextPage);
    }
  };

  const showEmptyState = !loading && users.length === 0;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{headerTitle}</h2>
          <p className="text-sm text-slate-600">{headerDescription}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
          {refreshing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Refreshing
            </span>
          )}
          {mockMode && (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Mock data
            </span>
          )}
          {headerActions}
        </div>
      </div>
      {filters && <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">{filters}</div>}
      <div className="overflow-x-auto px-6 pb-6 pt-4">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-white">
            <tr className="h-12 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-6 py-0">User</th>
              <th scope="col" className="px-4 py-0">Role</th>
              <th scope="col" className="px-4 py-0">Employment Status</th>
              <th scope="col" className="px-4 py-0 text-right">Last Login</th>
              <th scope="col" className="px-4 py-0 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, index) => (
                <tr key={index} className="h-12 border-b border-slate-100">
                  <td className="px-6 py-3">
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-9 w-[130px] animate-pulse rounded-md bg-slate-100" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-11 w-[210px] animate-pulse rounded-full bg-slate-100" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : showEmptyState ? (
              <tr>
                <td colSpan={5} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center gap-4 text-center text-slate-500">
                      <UsersIcon className="h-10 w-10 text-slate-300" aria-hidden />
                      <div>
                        <h3 className="text-lg font-medium text-slate-600">No users found</h3>
                        <p className="mt-1 text-sm">Adjust your filters or have the teammate sign in with Google.</p>
                      </div>
                      {onRetry && (
                        <Button type="button" variant="outline" onClick={onRetry}>
                          Retry
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              users.map(user => {
                const isLocked = lockedSet.has(user.userId);
                const roleLoading = rolePendingSet.has(user.userId);
                const statusLoading = statusPendingSet.has(user.userId);
                const initials = getInitials(user.fullName || user.email);
                const isActiveRow = activeUserId === user.userId;
                const canMutateRow = canManage && !isLocked;
                const canDelete = Boolean(onDelete) && canMutateRow;
                const isDeleting = deletingUserId === user.userId;
                const normalizedEmail = user.email.trim().toLowerCase();
                const isMasterAdmin = normalizedEmail === "jonathan@skyshare.com";
                const roleOptions = isMasterAdmin ? ROLES : ROLES.filter(role => role !== "admin");

                return (
                  <tr
                    key={user.userId}
                    tabIndex={0}
                    onFocus={() => setActiveUserId(user.userId)}
                    onClick={() => setActiveUserId(user.userId)}
                    onBlur={() => setActiveUserId(prev => (prev === user.userId ? null : prev))}
                    className={cn(
                      "group h-12 border-b border-slate-100 transition-colors hover:bg-slate-50 focus-visible:outline-none", 
                      isActiveRow && "bg-slate-50",
                    )}
                    aria-selected={isActiveRow}
                  >
                    <td className="relative px-6 py-3">
                      <span
                        className={cn(
                          "pointer-events-none absolute left-0 top-1/2 h-10 -translate-y-1/2 rounded-r",
                          isActiveRow ? "w-0.5 bg-primary" : "w-0",
                        )}
                        aria-hidden
                      />
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-slate-100 text-sm font-medium text-slate-600">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{user.fullName}</span>
                            {user.isSuperAdmin && <LockedBadge />}
                          </div>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <RoleDropdown
                          value={user.role}
                          onChange={next => onRoleChange(user.userId, next)}
                          disabled={!canMutateRow}
                          loading={roleLoading}
                          options={roleOptions}
                        />
                      ) : (
                        <div className={readOnlyRoleClass}>{ROLE_LABELS[user.role]}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <StatusPill
                          value={user.employmentStatus}
                          onChange={next => onStatusChange(user.userId, next)}
                          disabled={!canMutateRow}
                          loading={statusLoading}
                        />
                      ) : (
                        <div className={readOnlyStatusClass}>{STATUS_LABELS[user.employmentStatus]}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDelete ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-9 w-9 rounded-full text-slate-400 transition-colors hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                isDeleting && "pointer-events-none opacity-50",
                              )}
                              aria-label={`Delete ${user.fullName}`}
                              disabled={isDeleting}
                            >
                              <Skull className="h-[18px] w-[18px]" aria-hidden />
                              <span className="sr-only">Delete {user.fullName}</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete user {user.fullName}?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                onClick={async () => {
                                  if (onDelete) {
                                    await onDelete(user);
                                  }
                                }}
                                disabled={isDeleting}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className={readOnlyActionClass}>
                          {isLocked ? "Protected" : "Admins only"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {error && !loading && (
        <div className="border-t border-slate-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
          <span>
            Showing {(page - 1) * perPage + 1} – {Math.min(page * perPage, total)} of {total}
          </span>
          <Pagination className="mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={event => {
                    event.preventDefault();
                    if (page > 1) handlePageChange(page - 1);
                  }}
                  className={cn(page <= 1 && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, index) => {
                const pageIndex = index + 1;
                const isCurrent = pageIndex === page;
                return (
                  <PaginationItem key={pageIndex}>
                    <PaginationLink
                      href="#"
                      isActive={isCurrent}
                      onClick={event => {
                        event.preventDefault();
                        handlePageChange(pageIndex);
                      }}
                    >
                      {pageIndex}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={event => {
                    event.preventDefault();
                    if (page < totalPages) handlePageChange(page + 1);
                  }}
                  className={cn(page >= totalPages && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
