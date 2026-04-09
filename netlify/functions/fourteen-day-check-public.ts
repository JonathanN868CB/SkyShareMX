// fourteen-day-check-public — NO AUTH
// Validates a 14-day check token and returns the safe public payload for the mechanic form.
// Called by FourteenDayCheckResponse to load the aircraft registration + field schema.

import { createClient } from "@supabase/supabase-js";
import { decodeToken } from "./_token-encoder";

type HandlerEvent = {
  httpMethod: string;
  queryStringParameters?: Record<string, string> | null;
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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const raw = event.queryStringParameters?.token?.trim();
  if (!raw) {
    return jsonResponse(400, { error: "Missing token" });
  }

  let token: string;
  try {
    token = decodeToken(raw);
  } catch {
    return jsonResponse(404, { error: "Check not found" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load the token row + aircraft registration + assigned template
  const { data, error } = await adminClient
    .from("fourteen_day_check_tokens")
    .select(`
      id,
      token,
      field_schema,
      template:template_id ( id, field_schema ),
      aircraft:aircraft_id (
        id,
        aircraft_registrations (
          registration,
          is_current
        )
      )
    `)
    .eq("token", token)
    .single();

  if (error || !data) {
    return jsonResponse(404, { error: "Check not found" });
  }

  // Extract current registration
  const aircraft = data.aircraft as {
    id: string;
    aircraft_registrations: Array<{ registration: string; is_current: boolean }>;
  } | null;

  if (!aircraft) {
    return jsonResponse(404, { error: "Aircraft not found" });
  }

  const currentReg = aircraft.aircraft_registrations.find((r) => r.is_current);
  const registration = currentReg?.registration ?? "UNKNOWN";

  // Prefer the assigned template's field_schema over the token's own stale copy
  const template = data.template as { id: string; field_schema: unknown } | null;
  const fieldSchema = template?.field_schema ?? data.field_schema;

  // Return only the safe public payload — never expose token UUID, traxxall_url, created_by
  return jsonResponse(200, {
    tokenId: data.id,
    registration,
    aircraftId: aircraft.id,
    fieldSchema,
  });
};
