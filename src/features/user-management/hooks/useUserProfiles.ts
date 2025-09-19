import { useCallback, useEffect, useState } from "react";

import type { Tables } from "@/entities/supabase";
import { supabase } from "@/shared/lib/api";
import { useToast } from "@/hooks/use-toast";

export type UserProfile = Tables<"profiles">;
export type RoleOption = UserProfile["role"];
export type UserStatus = UserProfile["status"];

const ROLE_ENUM_BY_ROLE: Record<RoleOption, UserProfile["role_enum"]> = {
  admin: "Admin",
  technician: "Technician",
  qc: "Manager",
  viewer: "Read-Only",
};

export function useUserProfiles() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, user_id, email, first_name, last_name, full_name, role, role_enum, is_readonly, status, last_login, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setProfiles(data ?? []);
    } catch (error) {
      console.error("Failed to fetch profiles", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const updateRole = useCallback(
    async (userId: string, nextRole: RoleOption) => {
      try {
        const roleEnum = ROLE_ENUM_BY_ROLE[nextRole];
        const { error } = await supabase
          .from("profiles")
          .update({ role: nextRole, role_enum: roleEnum })
          .eq("user_id", userId);

        if (error) {
          throw error;
        }

        setProfiles(current =>
          current.map(profile =>
            profile.user_id === userId ? { ...profile, role: nextRole, role_enum: roleEnum } : profile,
          ),
        );

        toast({
          title: "Success",
          description: "User role updated successfully",
        });
      } catch (error) {
        console.error("Failed to update user role", error);
        toast({
          title: "Error",
          description: "Failed to update user role",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const updateReadOnly = useCallback(
    async (userId: string, isReadOnly: boolean) => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ is_readonly: isReadOnly })
          .eq("user_id", userId);

        if (error) {
          throw error;
        }

        setProfiles(current =>
          current.map(profile =>
            profile.user_id === userId ? { ...profile, is_readonly: isReadOnly } : profile,
          ),
        );

        toast({
          title: "Success",
          description: isReadOnly ? "User set to read-only" : "User granted write access",
        });
      } catch (error) {
        console.error("Failed to update user access", error);
        toast({
          title: "Error",
          description: "Failed to update access level",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const updateStatus = useCallback(
    async (userId: string, nextStatus: UserStatus) => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ status: nextStatus })
          .eq("user_id", userId);

        if (error) {
          throw error;
        }

        setProfiles(current =>
          current.map(profile =>
            profile.user_id === userId ? { ...profile, status: nextStatus } : profile,
          ),
        );

        toast({
          title: "Success",
          description: "User status updated successfully",
        });
      } catch (error) {
        console.error("Failed to update user status", error);
        toast({
          title: "Error",
          description: "Failed to update user status",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  return {
    profiles,
    loading,
    fetchProfiles,
    updateRole,
    updateReadOnly,
    updateStatus,
  };
}
