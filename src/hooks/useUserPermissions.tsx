import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type AppRole = 'Super Admin' | 'Admin' | 'Manager' | 'Technician' | 'Read-Only';
type UserStatus = 'Active' | 'Inactive' | 'Suspended' | 'Pending';
type AppSection = 'Overview' | 'Operations' | 'Administration' | 'Development';

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

interface UserPermissions {
  user_id: string;
  section: AppSection;
}

interface PermissionContextType {
  user: User | null;
  userProfile: UserProfile | null;
  permissions: AppSection[];
  loading: boolean;
  hasPermission: (section: AppSection) => boolean;
  isAdmin: () => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<AppSection[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPermissions = async () => {
    if (!user) return;

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);

        // Get user permissions
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select('section')
          .eq('user_id', user.id);

        if (userPermissions) {
          setPermissions(userPermissions.map(p => p.section));
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  useEffect(() => {
    // Check for dev bypass first
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || window.location.hostname === 'localhost' || window.location.hostname.includes('lovable.app');
    const devBypass = isDev && localStorage.getItem('dev-bypass') === 'true';
    
    if (devBypass) {
      console.log("🚧 PermissionProvider: Dev bypass active, setting mock permissions");
      setLoading(false);
      setPermissions(['Overview', 'Operations', 'Administration', 'Development']);
      // Return a cleanup function that does nothing
      return () => {};
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Update last login
          await supabase
            .from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', session.user.id);
        } else {
          setUserProfile(null);
          setPermissions([]);
        }
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Skip refreshing permissions if dev bypass is active
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || window.location.hostname === 'localhost' || window.location.hostname.includes('lovable.app');
    const devBypass = isDev && localStorage.getItem('dev-bypass') === 'true';
    
    if (devBypass || !user) return;
    
    refreshPermissions();
  }, [user]);

  const hasPermission = (section: AppSection) => {
    return permissions.includes(section);
  };

  const isAdmin = () => {
    return userProfile?.role === 'Admin' || userProfile?.role === 'Super Admin';
  };

  return (
    <PermissionContext.Provider value={{
      user,
      userProfile,
      permissions,
      loading,
      hasPermission,
      isAdmin,
      refreshPermissions
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function useUserPermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('useUserPermissions must be used within a PermissionProvider');
  }
  return context;
}