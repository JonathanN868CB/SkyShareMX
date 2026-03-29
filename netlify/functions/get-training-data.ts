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

export interface TrainingRow {
  trainingItem:     string;
  category:         string;
  assignedDate:     string;
  dueDate:          string;
  trainingResource: string;
  status:           string;
  notes:            string;
  submitCompletion: string;
}

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

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function parseSheetRows(values: string[][]): TrainingRow[] {
  if (!values || values.length < 2) return [];
  // Row 0 is the header — skip it
  return values
    .slice(1)
    .filter(row => row.some(cell => cell?.trim()))
    .map(row => ({
      trainingItem:     row[0] ?? "",
      category:         row[1] ?? "",
      assignedDate:     row[2] ?? "",
      dueDate:          row[3] ?? "",
      trainingResource: row[4] ?? "",
      status:           row[5] ?? "",
      notes:            row[6] ?? "",
      submitCompletion: row[7] ?? "",
    }));
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseToken = getAccessToken(event);
  if (!supabaseToken) return json(401, { error: "Authentication required" });

  const supabaseUrl  = process.env.SUPABASE_URL;
  const anonKey      = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRole  = process.env.SUPABASE_SERVICE_ROLE;
  const clientId     = process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!supabaseUrl || !anonKey || !serviceRole || !clientId || !clientSecret) {
    return json(500, { error: "Server configuration error" });
  }

  // Verify the caller's Supabase session
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(supabaseToken);
  if (userError || !userData?.user) return json(401, { error: "Unauthorized" });

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the caller's own profile
  const { data: callerProfile, error: callerError } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userData.user.id)
    .single();

  if (callerError || !callerProfile) return json(404, { error: "Profile not found" });

  // Parse optional targetProfileId (admin only)
  let targetProfileId: string = callerProfile.id;

  if (event.body) {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(event.body); } catch { /* no body is fine */ }

    if (typeof payload.targetProfileId === "string" && payload.targetProfileId.trim()) {
      if (callerProfile.role !== "Super Admin") {
        return json(403, { error: "Only Super Admin can view other users' training" });
      }
      targetProfileId = payload.targetProfileId.trim();
    }
  }

  // Fetch the target profile's training credentials
  const { data: targetProfile, error: targetError } = await adminClient
    .from("profiles")
    .select("id, training_sheet_file_id, training_refresh_token, training_last_refreshed")
    .eq("id", targetProfileId)
    .single();

  if (targetError || !targetProfile) return json(404, { error: "Target profile not found" });

  if (!targetProfile.training_sheet_file_id || !targetProfile.training_refresh_token) {
    return json(200, { rows: [], linked: false, lastRefreshed: null });
  }

  // Get a fresh Google access token using the stored refresh token
  let accessToken: string;
  try {
    accessToken = await refreshGoogleToken(
      targetProfile.training_refresh_token,
      clientId,
      clientSecret
    );
  } catch (err) {
    console.error("Token refresh error:", err);
    // Refresh token may have been revoked — clear it so the user re-links
    await adminClient
      .from("profiles")
      .update({ training_refresh_token: null, training_sheet_file_id: null })
      .eq("id", targetProfileId);
    return json(401, { error: "google_auth_expired" });
  }

  // Read the sheet — A:H covers all 8 columns, defaults to first sheet tab
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetProfile.training_sheet_file_id}/values/A:H`;
  const sheetRes = await fetch(sheetUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!sheetRes.ok) {
    const err = await sheetRes.text();
    console.error("Sheets API error:", err);
    return json(502, { error: "Failed to read training sheet" });
  }

  const sheetData = await sheetRes.json() as { values?: string[][] };
  const rows = parseSheetRows(sheetData.values ?? []);

  // Stamp the last refreshed time
  const now = new Date().toISOString();
  await adminClient
    .from("profiles")
    .update({ training_last_refreshed: now })
    .eq("id", targetProfileId);

  return json(200, { rows, linked: true, lastRefreshed: now });
};
