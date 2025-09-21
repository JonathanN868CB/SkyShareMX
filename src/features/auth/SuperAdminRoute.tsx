import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import useIsSuperAdmin from "./useIsSuperAdmin";
import { toast } from "@/hooks/use-toast";

interface SuperAdminRouteProps {
  children: JSX.Element;
}

export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const navigate = useNavigate();
  const { isSuper, loading } = useIsSuperAdmin();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (loading || isSuper || hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    toast({
      title: "Admins only",
      description: "Super admin access is required to manage users.",
    });
    navigate("/app", { replace: true });
  }, [isSuper, loading, navigate]);

  if (loading) {
    return null;
  }

  if (!isSuper) {
    return null;
  }

  return children;
}
