import { buildAuthorizedHeaders } from "@/lib/api/users";

export type DeleteUserResponse = {
  ok: boolean;
  message: string;
};

export async function deleteUser(userId: string): Promise<DeleteUserResponse> {
  const endpoint = `/.netlify/functions/users-admin?id=${encodeURIComponent(userId)}`;

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: await buildAuthorizedHeaders({ Accept: "application/json" }),
    });
    const parsed = await response
      .json()
      .catch(() => ({} as Record<string, unknown>));

    const ok = response.ok && parsed && parsed.ok !== false;
    const message =
      typeof parsed?.message === "string"
        ? parsed.message
        : ok
          ? "Deleted"
          : "Delete failed";

    return { ok, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return { ok: false, message };
  }
}
