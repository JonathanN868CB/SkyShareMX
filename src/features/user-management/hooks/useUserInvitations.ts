import { useCallback, useEffect, useState } from "react";

import type { Tables } from "@/entities/supabase";
import { supabase } from "@/shared/lib/api";
import { useToast } from "@/hooks/use-toast";

export type UserInvitation = Tables<"user_invitations">;

export function useUserInvitations(refreshKey?: number) {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setInvitations(data ?? []);
    } catch (error) {
      console.error("Failed to fetch invitations", error);
      toast({
        title: "Error",
        description: "Failed to fetch invitations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations, refreshKey]);

  const removeInvitation = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("user_invitations").delete().eq("id", id);

        if (error) {
          throw error;
        }

        setInvitations(current => current.filter(invitation => invitation.id !== id));

        toast({
          title: "Invitation deleted",
          description: "The user invitation was removed.",
        });
      } catch (error) {
        console.error("Failed to delete invitation", error);
        toast({
          title: "Error",
          description: "Failed to delete invitation",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  return {
    invitations,
    loading,
    fetchInvitations,
    removeInvitation,
  };
}
