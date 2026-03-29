export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          email: string
          first_name: string | null
          last_name: string | null
          full_name: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          is_readonly: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          is_readonly?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          is_readonly?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_requests: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company: string | null
          reason: string | null
          status: "new" | "approved" | "rejected" | "closed"
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          company?: string | null
          reason?: string | null
          status?: "new" | "approved" | "rejected" | "closed"
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company?: string | null
          reason?: string | null
          status?: "new" | "approved" | "rejected" | "closed"
          created_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          section: Database["public"]["Enums"]["app_section"]
          granted_at: string
        }
        Insert: {
          id?: string
          user_id: string
          section: Database["public"]["Enums"]["app_section"]
          granted_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          section?: Database["public"]["Enums"]["app_section"]
          granted_at?: string
        }
        Relationships: []
      }
      role_default_permissions: {
        Row: {
          role: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          role: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          role?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { required_section: Database["public"]["Enums"]["app_section"]; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["app_role"]; user_uuid: string }
        Returns: boolean
      }
      is_admin_or_super: {
        Args: { user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "Super Admin" | "Admin" | "Manager" | "Technician" | "Read-Only"
      app_section: "Dashboard" | "Aircraft Info" | "AI Assistant" | "Aircraft Conformity" | "14-Day Check" | "Maintenance Planning" | "Ten or More" | "Terminal-OGD" | "Projects" | "Training" | "Docs & Links"
      user_status: "Active" | "Inactive" | "Suspended" | "Pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

export type Profile = Tables<"profiles">
export type AccessRequest = Tables<"access_requests">
export type UserPermission = Tables<"user_permissions">
export type AppRole = Enums<"app_role">
export type AppSection = Enums<"app_section">
export type UserStatus = Enums<"user_status">

export const APP_ROLES: AppRole[] = [
  "Super Admin",
  "Admin",
  "Manager",
  "Technician",
  "Read-Only",
]

export const APP_SECTIONS: AppSection[] = [
  "Dashboard",
  "Aircraft Info",
  "AI Assistant",
  "Aircraft Conformity",
  "14-Day Check",
  "Maintenance Planning",
  "Ten or More",
  "Terminal-OGD",
  "Projects",
  "Training",
  "Docs & Links",
]

export const DEFAULT_PERMISSIONS: AppSection[] = [
  "Dashboard",
  "Aircraft Info",
  "AI Assistant",
  "Training",
  "Docs & Links",
]
