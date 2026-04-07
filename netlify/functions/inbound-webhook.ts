// inbound-webhook — NO SESSION AUTH
// Accepts POST from external scheduling software (e.g. Avianis).
// Authenticates via X-Webhook-Secret header (shared secret).
// Stores raw log + parsed maintenance events. Deduplicates by external_uuid.

import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

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
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Constant-time string comparison to prevent timing attacks
function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Still do a comparison to keep timing consistent
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

type SchedulingEvent = {
  start?: unknown;
  end?: unknown;
  title?: unknown;
  extendedProps?: {
    uuid?: unknown;
    aircraft?: unknown;
    notes?: unknown;
    created_by_user?: unknown;
    event_type_name?: unknown;
  };
};

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const webhookSecret = process.env.JETINSIGHT_NAPSTER_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[inbound-webhook] JETINSIGHT_NAPSTER_WEBHOOK_SECRET env var not set");
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const incomingSecret = event.headers?.["x-webhook-secret"] ?? "";
  if (!incomingSecret || !safeEqual(incomingSecret, webhookSecret)) {
    console.log("[inbound-webhook] Rejected: invalid or missing X-Webhook-Secret");
    return jsonResponse(401, { error: "Unauthorized" });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  if (!event.body) {
    return jsonResponse(400, { error: "Missing request body" });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  // Normalize to array
  const events: SchedulingEvent[] = Array.isArray(rawPayload)
    ? (rawPayload as SchedulingEvent[])
    : [rawPayload as SchedulingEvent];

  if (events.length === 0) {
    return jsonResponse(400, { error: "Payload contains no events" });
  }

  // ── DB setup ──────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    console.error("[inbound-webhook] Missing Supabase env vars");
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const db = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Insert inbound log row ─────────────────────────────────────────────────
  const { data: logRow, error: logError } = await db
    .from("webhook_inbound_log")
    .insert({
      source: "jetinsight_napster",
      raw_payload: rawPayload,
      event_count: events.length,
      status: "received",
    })
    .select("id")
    .single();

  if (logError || !logRow) {
    console.error("[inbound-webhook] Failed to insert log row", logError);
    return jsonResponse(500, { error: "Failed to log request" });
  }

  const logId = logRow.id;
  console.log(`[inbound-webhook] Log row created: ${logId}, events: ${events.length}`);

  // ── Process events ────────────────────────────────────────────────────────
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const ev of events) {
    const ext = ev.extendedProps ?? {};
    const externalUuid = typeof ext.uuid === "string" ? ext.uuid.trim() : null;
    const aircraftTail = typeof ext.aircraft === "string" ? ext.aircraft.trim() : null;
    const title = typeof ev.title === "string" ? ev.title.trim() : null;
    const startAt = typeof ev.start === "string" ? ev.start : null;
    const endAt = typeof ev.end === "string" ? ev.end : null;

    if (!externalUuid || !aircraftTail || !title || !startAt || !endAt) {
      console.log("[inbound-webhook] Skipping event — missing required fields", { externalUuid, aircraftTail, title });
      skipped++;
      continue;
    }

    const { error: insertError } = await db.from("scheduled_maintenance_events").insert({
      external_uuid: externalUuid,
      aircraft_tail: aircraftTail,
      title,
      start_at: startAt,
      end_at: endAt,
      notes: typeof ext.notes === "string" ? ext.notes.trim() || null : null,
      created_by_user: typeof ext.created_by_user === "string" ? ext.created_by_user.trim() || null : null,
      event_type: typeof ext.event_type_name === "string" ? ext.event_type_name : "Maintenance",
      raw_event: ev,
      webhook_log_id: logId,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        // UNIQUE violation on external_uuid — already received this event
        skipped++;
      } else {
        console.error("[inbound-webhook] Insert error for event", externalUuid, insertError);
        failed++;
      }
    } else {
      inserted++;
    }
  }

  // ── Update log row with results ───────────────────────────────────────────
  await db
    .from("webhook_inbound_log")
    .update({
      status: failed > 0 && inserted === 0 ? "failed" : "processed",
      inserted_count: inserted,
      skipped_count: skipped + failed,
    })
    .eq("id", logId);

  console.log(`[inbound-webhook] Done — inserted: ${inserted}, skipped: ${skipped}, failed: ${failed}`);

  return jsonResponse(200, {
    received: events.length,
    inserted,
    skipped,
  });
};
