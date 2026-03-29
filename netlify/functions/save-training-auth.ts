import { createClient } from "@supabase/supabase-js";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};
type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getAccessToken(event: HandlerEvent): string | null {
  const header = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const parts = header.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] || null;
  const [scheme, ...rest] = parts;
  if (!/^bearer$/i.test(scheme)) return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseToken = getAccessToken(event);
  if (!supabaseToken) return json(401, { error: "Authentication required" });

  const supabaseUrl   = process.env.SUPABASE_URL;
  const anonKey       = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRole   = process.env.SUPABASE_SERVICE_ROLE;
  const clientId      = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret  = process.env.GOOGLE_CLIENT_SECRET;

  if (!supabaseUrl || !anonKey || !serviceRole || !clientId || !clientSecret) {
    return json(500, { error: "Server configuration error" });
  }

  // Verify the caller has a valid Supabase session
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(supabaseToken);
  if (userError || !userData?.user) return json(401, { error: "Unauthorized" });

  if (!event.body) return json(400, { error: "Missing body" });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const authCode = typeof payload.authCode === "string" ? payload.authCode.trim() : "";
  if (!authCode) return json(400, { error: "authCode is required" });

  // Exchange auth code for tokens with Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code:          authCode,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  "postmessage",  // required for GIS popup flow
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("Google token exchange failed:", err);
    return json(502, { error: "Failed to exchange auth code" });
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  // Google only returns a refresh token when prompt=consent was used.
  // If it's missing the user needs to re-authorize with consent forced.
  if (!tokens.refresh_token) {
    return json(400, { error: "no_refresh_token" });
  }

  // Look up the profile for this auth user
  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("user_id", userData.user.id)
    .single();

  if (profileError || !profile) return json(404, { error: "Profile not found" });

  // Save the refresh token — access token is short-lived and not stored
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ training_refresh_token: tokens.refresh_token })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Failed to save refresh token:", updateError);
    return json(500, { error: "Failed to save authorization" });
  }

  // Return the short-lived access token to the client so it can open the Picker
  return json(200, { accessToken: tokens.access_token });
};
