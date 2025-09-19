export type Role = "admin" | "manager" | "technician" | "viewer";

export const ROLES: Role[] = ["admin", "manager", "technician", "viewer"];

export type EmploymentStatus = "active" | "inactive";

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = ["active", "inactive"];

export interface UserSummary {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  employmentStatus: EmploymentStatus;
  lastLogin: string | null;
  isSuperAdmin: boolean;
}

export interface UsersQuery {
  search?: string;
  role?: Role;
  employmentStatus?: EmploymentStatus;
  page?: number;
  perPage?: number;
}

export interface UsersListResponse {
  data: UserSummary[];
  total: number;
  page: number;
  perPage: number;
}
