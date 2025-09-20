import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { RoleDefaultsModal } from "@/components/users/RoleDefaultsModal";
import { UsersFilters } from "@/components/users/UsersFilters";
import { UsersTable } from "@/components/users/UsersTable";
import { deleteUser } from "@/lib/usersClient";
import { getMockUsers, listUsers, updateEmploymentStatus, updateUserRole } from "@/lib/api/users";
import type { EmploymentStatus, Role, UsersListResponse, UserSummary, UsersQuery } from "@/lib/types/users";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { toast as notify } from "@/hooks/use-toast";
import { toast as sonnerToast } from "@/shared/ui/sonner";

const PER_PAGE = 50;

export default function UsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [mockBannerDismissed, setMockBannerDismissed] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const [pendingRoles, setPendingRoles] = useState<Set<string>>(new Set());
  const [pendingStatuses, setPendingStatuses] = useState<Set<string>>(new Set());
  const [headerElevated, setHeaderElevated] = useState(false);
  const [roleDefaultsOpen, setRoleDefaultsOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderElevated(window.scrollY > 0);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const buildQuery = useCallback((): UsersQuery => ({
    search: search.trim() || undefined,
    role: roleFilter,
    employmentStatus: statusFilter,
    page,
    perPage: PER_PAGE,
  }), [search, roleFilter, statusFilter, page]);

  const applyResponse = useCallback((response: UsersListResponse) => {
    setUsers(response.data);
    setTotal(response.total);
  }, []);

  const loadUsers = useCallback(async (query: UsersQuery, { refresh = false } = {}) => {
    setError(null);
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await listUsers(query);
      applyResponse(response);
      setMockMode(false);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to load users";
      setError(message);
      const fallback = getMockUsers(query);
      applyResponse(fallback);
      setMockMode(prev => {
        if (!prev) {
          notify({
            title: "Using mock data",
            description: "Live data is unavailable. Showing mock users so you can continue exploring the UI.",
          });
        }
        return true;
      });
      setMockBannerDismissed(false);
    } finally {
      if (refresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [applyResponse]);

  useEffect(() => {
    const query = buildQuery();
    void loadUsers(query);
  }, [buildQuery, loadUsers]);

  const lockedUserIds = useMemo(() => users.filter(user => user.isSuperAdmin).map(user => user.userId), [users]);

  const pendingRoleIds = useMemo(() => Array.from(pendingRoles), [pendingRoles]);
  const pendingStatusIds = useMemo(() => Array.from(pendingStatuses), [pendingStatuses]);

  const handleRoleChange = async (userId: string, nextRole: Role) => {
    if (mockMode) {
      setUsers(prev => prev.map(user => (user.userId === userId ? { ...user, role: nextRole } : user)));
      notify({
        title: "Mock data",
        description: "Role changes aren’t persisted while using mock data.",
      });
      return;
    }

    setPendingRoles(prev => new Set(prev).add(userId));
    try {
      const updated = await updateUserRole(userId, nextRole);
      setUsers(prev => prev.map(user => (user.userId === userId ? { ...user, role: updated.role } : user)));
      notify({
        title: "Role updated",
        description: `${updated.fullName} is now ${nextRole === "admin" ? "an" : "a"} ${nextRole}.`,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not update role";
      notify({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPendingRoles(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleStatusChange = async (userId: string, nextStatus: EmploymentStatus) => {
    if (mockMode) {
      setUsers(prev => prev.map(user => (user.userId === userId ? { ...user, employmentStatus: nextStatus } : user)));
      notify({
        title: "Mock data",
        description: "Status updates aren’t persisted while using mock data.",
      });
      return;
    }

    setPendingStatuses(prev => new Set(prev).add(userId));
    try {
      const updated = await updateEmploymentStatus(userId, nextStatus);
      setUsers(prev => prev.map(user => (user.userId === userId ? { ...user, employmentStatus: updated.employmentStatus } : user)));
      notify({
        title: "Status updated",
        description: `${updated.fullName} is now marked ${updated.employmentStatus}.`,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Could not update employment status";
      notify({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPendingStatuses(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDeleteUser = async (user: UserSummary) => {
    setDeletingUserId(user.userId);
    try {
      const response = await deleteUser(user.userId);
      if (response.ok) {
        setUsers(prev => prev.filter(existing => existing.userId !== user.userId));
        sonnerToast.success(response.message);
      } else {
        sonnerToast.info(response.message);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to delete user.";
      console.error("Failed to delete user", requestError);
      sonnerToast.error(message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleRefresh = async () => {
    await loadUsers(buildQuery(), { refresh: true });
  };

  const headerClass = cn(
    "sticky top-0 z-10 -mx-6 mb-4 flex flex-col gap-2 border-b border-slate-200 bg-white/95 px-6 py-6 backdrop-blur",
    headerElevated && "shadow-sm",
  );

  return (
    <div className="flex flex-col gap-6 text-slate-900">
      <header className={headerClass}>
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Users</h1>
          <p className="mt-2 text-base text-slate-600">Invite teammates, update roles, and manage employment status.</p>
        </div>
        <div className="flex items-center pt-4">
          <span className="text-sm font-medium uppercase tracking-wide text-slate-500">Directory</span>
        </div>
        <div className="pt-4">
          <UsersFilters
            search={search}
            role={roleFilter}
            status={statusFilter}
            onSearchChange={value => {
              setSearch(value);
              setPage(1);
            }}
            onRoleChange={value => {
              setRoleFilter(value);
              setPage(1);
            }}
            onStatusChange={value => {
              setStatusFilter(value);
              setPage(1);
            }}
            disabled={loading && users.length === 0}
          />
        </div>
      </header>

      {mockMode && !mockBannerDismissed && (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="space-y-1">
            <p className="font-semibold">Mock data only</p>
            <p className="text-amber-800">Live API requests failed. You can keep exploring but changes will not persist.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleRefresh} className="border-amber-300 text-amber-900 hover:bg-amber-100">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Retry connection
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMockBannerDismissed(true)} className="text-amber-800 hover:bg-amber-100">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <UsersTable
        users={users}
        loading={loading}
        refreshing={refreshing}
        total={total}
        page={page}
        perPage={PER_PAGE}
        mockMode={mockMode}
        lockedUserIds={lockedUserIds}
        pendingRoleIds={pendingRoleIds}
        pendingStatusIds={pendingStatusIds}
        error={error}
        onRoleChange={handleRoleChange}
        onStatusChange={handleStatusChange}
        onDelete={handleDeleteUser}
        deletingUserId={deletingUserId}
        onPageChange={nextPage => {
          setPage(nextPage);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onRetry={handleRefresh}
      />

      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" onClick={() => setRoleDefaultsOpen(true)} className="border-slate-200 text-slate-700">
          Role defaults
        </Button>
      </div>

      <RoleDefaultsModal open={roleDefaultsOpen} onOpenChange={setRoleDefaultsOpen} />
    </div>
  );
}
