import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function useIsSuperAdmin() {
  const { profile, loading } = useUserPermissions();

  return {
    isSuper: Boolean(profile?.is_super_admin),
    loading,
  };
}
