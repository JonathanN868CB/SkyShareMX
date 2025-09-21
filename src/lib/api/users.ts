import type {
  EmploymentStatus,
  Role,
  UserSummary,
  UsersListResponse,
  UsersQuery,
} from "@/lib/types/users";
import { getSession } from "@/shared/lib/api";

const USERS_LIST_ENDPOINT = "/.netlify/functions/users-list";
const USERS_ADMIN_ENDPOINT = "/.netlify/functions/users-admin";

export let isMockUsersData = false;

async function resolveAccessToken(): Promise<string> {
  const { data, error } = await getSession();
  if (error) {
    throw error;
  }

  const token = data?.session?.access_token;
  if (!token) {
    throw new Error("Authentication required");
  }

  return token;
}

export async function buildAuthorizedHeaders(base: Record<string, string> = {}) {
  const token = await resolveAccessToken();
  return { ...base, Authorization: `Bearer ${token}` } satisfies Record<string, string>;
}

const SEARCHABLE_ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

function assertClientSide() {
  if (typeof window === "undefined" && typeof fetch === "undefined") {
    throw new Error("Users API is not available in this execution environment");
  }
}

function buildQueryString(query: UsersQuery = {}): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  if (query.role) {
    params.set("role", query.role);
  }

  if (query.employmentStatus) {
    params.set("status", query.employmentStatus);
  }

  if (typeof query.page === "number" && query.page > 0) {
    params.set("page", String(query.page));
  }

  if (typeof query.perPage === "number" && query.perPage > 0) {
    params.set("perPage", String(query.perPage));
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!response.ok) {
    const errorMessage = typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}

export async function listUsers(query: UsersQuery = {}): Promise<UsersListResponse> {
  assertClientSide();

  const queryString = buildQueryString(query);
  const headers = await buildAuthorizedHeaders({ Accept: "application/json" });
  const response = await fetch(`${USERS_LIST_ENDPOINT}${queryString}`, {
    method: "GET",
    headers,
  });

  const payload = await handleResponse(response);
  isMockUsersData = false;
  return payload as UsersListResponse;
}

async function mutateUser(payload: Record<string, unknown>): Promise<UserSummary> {
  assertClientSide();

  const response = await fetch(USERS_ADMIN_ENDPOINT, {
    method: "PATCH",
    headers: await buildAuthorizedHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify(payload),
  });

  const parsed = await handleResponse(response);
  return (parsed?.user ?? parsed) as UserSummary;
}

export async function updateUserRole(userId: string, role: Role): Promise<UserSummary> {
  return mutateUser({ userId, action: "role", role });
}

export async function updateEmploymentStatus(userId: string, employmentStatus: EmploymentStatus): Promise<UserSummary> {
  return mutateUser({ userId, action: "employment_status", employmentStatus });
}

const mockUsersSeed: UserSummary[] = [
  {
    userId: "11111111-1111-4111-8111-111111111111",
    fullName: "Jonathan Schaedig",
    email: "jonathan@skyshare.com",
    role: "admin",
    employmentStatus: "active",
    lastLogin: new Date("2024-01-15T14:12:00Z").toISOString(),
    isSuperAdmin: true,
  },
  {
    userId: "22222222-2222-4222-8222-222222222222",
    fullName: "Marisol Vega",
    email: "marisol.vega@skyshare.com",
    role: "manager",
    employmentStatus: "active",
    lastLogin: new Date("2024-03-01T09:00:00Z").toISOString(),
    isSuperAdmin: false,
  },
  {
    userId: "33333333-3333-4333-8333-333333333333",
    fullName: "Noah Rivers",
    email: "noah.rivers@skyshare.com",
    role: "technician",
    employmentStatus: "active",
    lastLogin: new Date("2024-02-12T16:45:00Z").toISOString(),
    isSuperAdmin: false,
  },
  {
    userId: "44444444-4444-4444-8444-444444444444",
    fullName: "Avery Price",
    email: "avery.price@skyshare.com",
    role: "viewer",
    employmentStatus: "inactive",
    lastLogin: null,
    isSuperAdmin: false,
  },
  {
    userId: "55555555-5555-4555-8555-555555555555",
    fullName: "Imani Brooks",
    email: "imani.brooks@skyshare.com",
    role: "manager",
    employmentStatus: "inactive",
    lastLogin: new Date("2023-12-20T11:10:00Z").toISOString(),
    isSuperAdmin: false,
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(user: UserSummary, search?: string) {
  if (!search) return true;
  const needle = normalize(search);
  return (
    normalize(user.fullName).includes(needle) ||
    normalize(user.email).includes(needle) ||
    normalize(user.role).includes(needle) ||
    SEARCHABLE_ROLE_LABELS[user.role].toLowerCase().includes(needle)
  );
}

export function getMockUsers(query: UsersQuery = {}): UsersListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const perPage = query.perPage && query.perPage > 0 ? query.perPage : 50;

  let filtered = mockUsersSeed.filter(user => matchesSearch(user, query.search));

  if (query.role) {
    filtered = filtered.filter(user => user.role === query.role);
  }

  if (query.employmentStatus) {
    filtered = filtered.filter(user => user.employmentStatus === query.employmentStatus);
  }

  const total = filtered.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const data = filtered.slice(start, end);

  isMockUsersData = true;

  return {
    data,
    total,
    page,
    perPage,
  };
}

export function resetMockUsersFlag() {
  isMockUsersData = false;
}

export function seedMockUsers(): UserSummary[] {
  return [...mockUsersSeed];
}
