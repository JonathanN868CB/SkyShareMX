import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";

type AppRole = 'Super Admin' | 'Admin' | 'Manager' | 'Technician' | 'Read-Only';
type UserStatus = 'Active' | 'Inactive' | 'Suspended' | 'Pending';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: AppRole;
  status: UserStatus;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export function UserManagementTable() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { userProfile, isAdmin } = useUserPermissions();

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.user_id === userId ? { ...user, status: newStatus } : user
      ));

      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'Super Admin': return 'default';
      case 'Admin': return 'secondary';
      case 'Manager': return 'outline';
      case 'Technician': return 'outline';
      case 'Read-Only': return 'outline';
      default: return 'outline';
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

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isProtectedUser = (email: string) => email === 'jonathan@skyshare.com';
  const canEditUser = (targetUser: UserProfile) => {
    if (!isAdmin()) return false;
    if (isProtectedUser(targetUser.email) && userProfile?.email !== targetUser.email) return false;
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
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}`
                        : user.email
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {canEditUser(user) ? (
                    <Select
                      value={user.role}
                      onValueChange={(value: AppRole) => updateUserRole(user.user_id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Read-Only">Read-Only</SelectItem>
                        <SelectItem value="Technician">Technician</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                        {userProfile?.role === 'Super Admin' && (
                          <SelectItem value="Super Admin">Super Admin</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={user.status === 'Active'}
                      onCheckedChange={(checked) => 
                        updateUserStatus(user.user_id, checked ? 'Active' : 'Inactive')
                      }
                      disabled={!canEditUser(user)}
                    />
                    <span className={`text-sm ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </div>
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
                      {canEditUser(user) && !isProtectedUser(user.email) && (
                        <DropdownMenuItem className="text-destructive">
                          Delete User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}