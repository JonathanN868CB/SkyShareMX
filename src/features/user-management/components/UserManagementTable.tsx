import { useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";

import { useUserPermissions, useReadOnly } from "@/hooks/useUserPermissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

import {
  useUserProfiles,
  type RoleOption,
  type UserProfile,
  type UserStatus,
} from "../hooks/useUserProfiles";

 

const ROLE_LABELS: Record<RoleOption, string> = {
  admin: 'Admin',
  technician: 'Technician',
  qc: 'QC',
  viewer: 'Viewer',
};

const ROLE_OPTIONS: RoleOption[] = ['admin', 'technician', 'qc', 'viewer'];

const VIEWER_MESSAGE = 'Your account is limited to Viewer access. Ask an admin to upgrade your permissions.';

export function UserManagementTable() {
  const {
    profiles: users,
    loading,
    updateRole,
    updateReadOnly,
    updateStatus,
  } = useUserProfiles();
  const [searchTerm, setSearchTerm] = useState("");
  const { profile: currentProfile, isAdmin } = useUserPermissions();
  const isReadOnly = useReadOnly();

  const getRoleBadgeVariant = (role: RoleOption, roleEnum: UserProfile['role_enum']) => {
    if (roleEnum === 'Super Admin') return 'default';
    switch (role) {
      case 'admin':
        return 'secondary';
      case 'technician':
      case 'qc':
        return 'outline';
      case 'viewer':
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'Active': return 'text-green-600';
      case 'Inactive': return 'text-gray-500';
      case 'Suspended': return 'text-red-600';
      case 'Pending': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const normalizedSearch = searchTerm.toLowerCase();
  const filteredUsers = users.filter(user => {
    const roleLabel = ROLE_LABELS[user.role].toLowerCase();
    return (
      user.email.toLowerCase().includes(normalizedSearch) ||
      (user.first_name?.toLowerCase().includes(normalizedSearch)) ||
      (user.last_name?.toLowerCase().includes(normalizedSearch)) ||
      (user.full_name?.toLowerCase().includes(normalizedSearch)) ||
      user.role.toLowerCase().includes(normalizedSearch) ||
      roleLabel.includes(normalizedSearch)
    );
  });

  const isProtectedUser = (email: string) => email === 'jonathan@skyshare.com';
  const canEditUser = (targetUser: UserProfile) => {
    if (isReadOnly) return false;
    if (!isAdmin()) return false;
    if (isProtectedUser(targetUser.email) && currentProfile?.email !== targetUser.email) return false;
    return true;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search users by name, email, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(user => {
              const canModify = canEditUser(user);
              const disableTooltip = isReadOnly && !canModify;
              const displayRoleLabel =
                user.role_enum === 'Super Admin'
                  ? 'Super Admin'
                  : ROLE_LABELS[user.role];

              const roleControl = canModify ? (
                <Select
                  value={user.role}
                  onValueChange={(value: RoleOption) => updateRole(user.user_id, value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>
                        {ROLE_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={getRoleBadgeVariant(user.role, user.role_enum)}>
                  {displayRoleLabel}
                </Badge>
              );

              const roleCell = disableTooltip ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed">{roleControl}</span>
                    </TooltipTrigger>
                    <TooltipContent>{VIEWER_MESSAGE}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                roleControl
              );

              const readOnlyToggle = (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={user.is_readonly}
                    onCheckedChange={checked => updateReadOnly(user.user_id, checked)}
                    disabled={!canModify}
                  />
                  <span className="text-sm text-muted-foreground">
                    {user.is_readonly ? 'Viewer access' : 'Editor access'}
                  </span>
                </div>
              );

              const accessCell = disableTooltip ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed">{readOnlyToggle}</span>
                    </TooltipTrigger>
                    <TooltipContent>{VIEWER_MESSAGE}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                readOnlyToggle
              );

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.full_name?.trim() ||
                          (user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user.email)}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{roleCell}</TableCell>
                  <TableCell>{accessCell}</TableCell>
                <TableCell>
                  {(() => {
                    const statusControl = (
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={user.status === 'Active'}
                          onCheckedChange={checked =>
                            updateStatus(user.user_id, checked ? 'Active' : 'Inactive')
                          }
                          disabled={!canModify}
                        />
                        <span className={`text-sm ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </div>
                    );

                    if (disableTooltip) {
                      return (
                        <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-not-allowed">{statusControl}</span>
                          </TooltipTrigger>
                          <TooltipContent>{VIEWER_MESSAGE}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                    return statusControl;
                  })()}
                </TableCell>
                <TableCell>
                  {user.last_login 
                    ? new Date(user.last_login).toLocaleDateString()
                    : 'Never'
                  }
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Permissions</DropdownMenuItem>
                      <DropdownMenuItem>Reset Password</DropdownMenuItem>
                      {canModify && !isProtectedUser(user.email) && (
                        <DropdownMenuItem className="text-destructive">
                          Delete User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}