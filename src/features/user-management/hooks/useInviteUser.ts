import { useCallback } from "react";

const INVITE_FUNCTION_URL =
  import.meta.env.VITE_INVITE_FUNCTION_URL ??
  (typeof process !== "undefined" ? process.env?.VITE_INVITE_FUNCTION_URL : undefined) ??
  "/.netlify/functions/send-user-invitation";

export interface InviteUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface InviteUserResult {
  success: boolean;
  error?: string;
  emailSent?: boolean;
}

export function useInviteUser() {
  return useCallback(async ({ email, firstName, lastName, role }: InviteUserPayload): Promise<InviteUserResult> => {
    try {
      const response = await fetch(INVITE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, firstName, lastName, role }),
      });

      let parsed: Record<string, unknown> | undefined;

      try {
        parsed = await response.json();
      } catch (error) {
        console.warn("Invitation response was not JSON", error);
      }

      const parsedSuccess = typeof parsed?.success === "boolean" ? parsed.success : undefined;
      const parsedEmailSent =
        typeof parsed?.email_sent === "boolean"
          ? (parsed.email_sent as boolean)
          : typeof parsed?.emailSent === "boolean"
            ? (parsed.emailSent as boolean)
            : undefined;
      const parsedError =
        typeof parsed?.error === "string"
          ? parsed.error
          : typeof parsed?.message === "string"
            ? parsed.message
            : undefined;

      if (!response.ok || parsedSuccess === false || parsedEmailSent === false) {
        const errorMessage = parsedError || `Could not send invitation email (status ${response.status}).`;
        return { success: false, error: errorMessage, emailSent: parsedEmailSent };
      }

      return { success: true, emailSent: parsedEmailSent ?? true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send invitation",
      };
    }
  }, []);
}
