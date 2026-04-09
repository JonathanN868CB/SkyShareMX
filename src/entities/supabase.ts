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
          display_name: string | null
          avatar_color: string | null
          avatar_url: string | null
          avatar_initials: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          is_readonly: boolean
          last_login: string | null
          last_seen_at: string | null
          mxlms_technician_id: number | null
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
          display_name?: string | null
          avatar_color?: string | null
          avatar_url?: string | null
          avatar_initials?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          is_readonly?: boolean
          last_login?: string | null
          last_seen_at?: string | null
          mxlms_technician_id?: number | null
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
          display_name?: string | null
          avatar_color?: string | null
          avatar_url?: string | null
          avatar_initials?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          is_readonly?: boolean
          last_login?: string | null
          last_seen_at?: string | null
          mxlms_technician_id?: number | null
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
      app_role: "Super Admin" | "Admin" | "Manager" | "Technician" | "Guest"
      app_section: "Dashboard" | "Aircraft Info" | "AI Assistant" | "Aircraft Conformity" | "14-Day Check" | "Maintenance Planning" | "Ten or More" | "Terminal-OGD" | "Projects" | "My Training" | "Docs & Links" | "My Journey" | "My Team" | "Vendor Map" | "Compliance" | "Safety" | "Discrepancy Intelligence" | "Parts" | "External Requests" | "Work Orders" | "Records Vault"
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
  "Guest",
]

/**
 * APP_SECTIONS — Authoritative list of all module/nav sections
 *
 * Keep synchronized with FOUR places:
 * • sidebarSections in app/layout/AppSidebar.tsx
 * • HARDCODED_RULES in pages/admin/PermissionsIndex.tsx
 * • PERMISSION_GROUPS in pages/admin/Users.tsx
 *
 * When adding a new section, update all four places to keep navigation and permissions in sync.
 */
export const APP_SECTIONS: AppSection[] = [
  // ── Overview ──────────────────────────────────────────────
  "Dashboard",
  "Aircraft Info",
  "AI Assistant",
  // ── Operations ────────────────────────────────────────────
  "Discrepancy Intelligence",
  "Records Vault",
  "Work Orders",
  "My Journey",
  "My Training",
  "Vendor Map",
  "14-Day Check",
  "Projects",
  "Compliance",
  "Safety",
  "Parts",
  "External Requests",
  // ── Pending Cert. (collapsible group) ─────────────────────
  "Aircraft Conformity",
  "Maintenance Planning",
  "Ten or More",
  "Terminal-OGD",
  "Docs & Links",
  // ── Supervisors ───────────────────────────────────────────
  "My Team",
]

// ─── External Requests types ─────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "number" | "photo" | "file" | "checkbox" | "section"

export type FieldDef = {
  id: string
  label: string
  type: FieldType
  required: boolean
  hint?: string
}

// ─── Aircraft Photos ──────────────────────────────────────────────────────────

export type AircraftPhoto = {
  tail_number: string
  storage_path: string
  photo_url: string
  uploaded_by: string | null
  photographer_name: string
  uploaded_at: string
}

export type AircraftPhotoRating = {
  tail_number: string
  profile_id: string
  rating: number
  rated_at: string
}

export type ExternalRequest = {
  id: string
  title: string
  instructions: string | null
  field_schema: FieldDef[]
  recipient_name: string
  recipient_email: string
  delivery_channel: string
  token: string
  status: "draft" | "sent" | "submitted" | "reviewed"
  expires_at: string | null
  parent_type: string | null
  parent_id: string | null
  parent_label: string | null
  review_notes: string | null
  created_by: string
  created_at: string
  sent_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
}

export type ExternalSubmission = {
  id: string
  request_id: string
  field_values: Record<string, string | number | boolean | null>
  notes: string | null
  submitted_at: string
  submitter_ip: string | null
}

export type ExternalSubmissionAttachment = {
  id: string
  submission_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
}

// ─── 14-Day Check ────────────────────────────────────────────────────────────

export type InspectionCardTemplate = {
  id: string
  name: string
  aircraft_type: string | null
  field_schema: FieldDef[]
  created_by: string | null
  created_at: string
  updated_at: string | null
  updated_by: string | null
}

export type TemplateAuditEntry = {
  id: string
  template_id: string
  action: string
  actor_id: string | null
  actor_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export type FourteenDayCheckToken = {
  id: string
  aircraft_id: string
  token: string
  field_schema: FieldDef[]
  traxxall_url: string | null
  template_id: string | null
  created_by: string
  created_at: string
}

export type FourteenDayCheckSubmission = {
  id: string
  token_id: string
  aircraft_id: string
  submitter_name: string
  field_values: Record<string, string | number | boolean | null>
  notes: string | null
  submitted_at: string
  submitter_ip: string | null
  review_status: "pending" | "flagged" | "cleared" | "archived"
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

export type FourteenDayCheckAttachment = {
  id: string
  submission_id: string
  field_id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_at: string
}

export const DEFAULT_PERMISSIONS: AppSection[] = [
  "Dashboard",
  "Aircraft Info",
  "AI Assistant",
]

// ─── Projects Module ──────────────────────────────────────────────────────────

export type PmBoard = {
  id: string
  name: string
  color: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type PmBoardMember = {
  id: string
  board_id: string
  profile_id: string
  added_by: string | null
  added_at: string
}

export type PmStatus = {
  id: string
  board_id: string
  label: string
  color: string
  sort_order: number
  is_default: boolean
  created_at: string
}

export type PmGroup = {
  id: string
  board_id: string
  name: string
  color: string
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PmTask = {
  id: string
  group_id: string
  parent_task_id: string | null
  name: string
  champion_id: string | null
  status_id: string | null
  due_date: string | null
  completion_note: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type PmTaskContributor = {
  task_id: string
  profile_id: string
  added_at: string
}

export type PmTaskComment = {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
}

export type PmTaskAttachment = {
  id: string
  task_id: string
  file_name: string
  file_size: number | null
  storage_path: string
  uploaded_by: string | null
  created_at: string
}

// Enriched types used by the UI (joined with profile data)
export type PmProfile = {
  id: string
  full_name: string
  display_name: string | null
  avatar_color: string
  avatar_initials: string
  avatar_url: string | null
}

export type PmTaskWithRelations = PmTask & {
  champion: PmProfile | null
  contributors: PmProfile[]
  status: PmStatus | null
  subtasks: PmTask[]
  comment_count: number
  attachment_count: number
}

export type PmGroupWithTasks = PmGroup & {
  tasks: PmTaskWithRelations[]
}

export type PmBoardWithGroups = PmBoard & {
  groups: PmGroupWithTasks[]
  statuses: PmStatus[]
  members: (PmBoardMember & { profile: PmProfile })[]
}

export const PM_DEFAULT_STATUSES: Omit<PmStatus, "id" | "board_id" | "created_at">[] = [
  { label: "Not Started",   color: "#6b7280", sort_order: 0, is_default: true  },
  { label: "Working On It", color: "#3b82f6", sort_order: 1, is_default: false },
  { label: "Need Help",     color: "#f59e0b", sort_order: 2, is_default: false },
  { label: "Stuck",         color: "#ef4444", sort_order: 3, is_default: false },
  { label: "Done",          color: "#10b981", sort_order: 4, is_default: false },
]

export const PM_BOARD_COLORS: { label: string; value: string }[] = [
  { label: "Navy",    value: "#012E45" },
  { label: "Blue",    value: "#466481" },
  { label: "Gold",    value: "#D4A017" },
  { label: "Red",     value: "#C10230" },
  { label: "Green",   value: "#10B981" },
  { label: "Purple",  value: "#7c3aed" },
  { label: "Teal",    value: "#0d9488" },
  { label: "Orange",  value: "#ea580c" },
]
