/**
 * FedEx Tracking Proxy
 *
 * Proxies tracking requests to FedEx Track API v1.
 * Keeps credentials server-side, avoids CORS.
 *
 * ENV VARS REQUIRED:
 *   FEDEX_API_KEY     — from developer.fedex.com
 *   FEDEX_SECRET_KEY  — from developer.fedex.com
 *   SUPABASE_URL      — (already set)
 *   SUPABASE_SERVICE_ROLE_KEY — (already set)
 *
 * Usage:
 *   POST /.netlify/functions/fedex-track
 *   Body: { "trackingNumbers": ["789428073492"] }
 *   — or —
 *   POST /.netlify/functions/fedex-track
 *   Body: { "poll": true }   ← refreshes all shipped lines
 */

import { createClient } from "@supabase/supabase-js";

interface HandlerEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

// ─── FedEx OAuth ──────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getFedExToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const apiKey = process.env.FEDEX_API_KEY;
  const secret = process.env.FEDEX_SECRET_KEY;
  if (!apiKey || !secret) throw new Error("FedEx credentials not configured");

  const res = await fetch("https://apis.fedex.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${apiKey}&client_secret=${secret}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FedEx OAuth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in * 1000),
  };
  return cachedToken.token;
}

// ─── FedEx Track ──────────────────────────────────────────────────────────────

interface TrackingEvent {
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

interface TrackingResult {
  trackingNumber: string;
  status: string;
  statusDetail: string;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  events: TrackingEvent[];
  error?: string;
}

async function trackNumbers(trackingNumbers: string[]): Promise<TrackingResult[]> {
  const token = await getFedExToken();

  const body = {
    includeDetailedScans: true,
    trackingInfo: trackingNumbers.map(tn => ({
      trackingNumberInfo: { trackingNumber: tn },
    })),
  };

  const res = await fetch("https://apis.fedex.com/track/v1/trackingnumbers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-locale": "en_US",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FedEx Track API failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const results: TrackingResult[] = [];

  for (const output of data.output?.completeTrackResults ?? []) {
    for (const result of output.trackResults ?? []) {
      const tn = result.trackingNumberInfo?.trackingNumber ?? "";
      const latestStatus = result.latestStatusDetail;
      const dates = result.dateAndTimes ?? [];

      // Find estimated delivery
      const estDelivery = dates.find(
        (d: { type: string }) => d.type === "ESTIMATED_DELIVERY"
      );
      const actDelivery = dates.find(
        (d: { type: string }) => d.type === "ACTUAL_DELIVERY"
      );

      // Build scan events
      const events: TrackingEvent[] = (result.scanEvents ?? []).map(
        (e: { date: string; derivedStatus: string; eventDescription: string; scanLocation?: { city?: string; stateOrProvinceCode?: string; countryCode?: string } }) => ({
          timestamp: e.date,
          location: e.scanLocation
            ? [e.scanLocation.city, e.scanLocation.stateOrProvinceCode, e.scanLocation.countryCode]
                .filter(Boolean).join(", ")
            : "",
          status: e.derivedStatus ?? "",
          description: e.eventDescription ?? "",
        })
      );

      results.push({
        trackingNumber: tn,
        status: latestStatus?.code ?? "UNKNOWN",
        statusDetail: latestStatus?.description ?? "",
        estimatedDelivery: estDelivery?.dateOrTimestamp ?? null,
        actualDelivery: actDelivery?.dateOrTimestamp ?? null,
        events,
      });
    }
  }

  return results;
}

// ─── Poll mode — refresh all shipped lines ────────────────────────────────────

async function pollAllShippedLines(): Promise<{ updated: number; errors: string[] }> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase credentials not configured");

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all lines with tracking numbers in shipped status
  const { data: lines, error } = await supabase
    .from("parts_request_lines")
    .select("id, tracking_number")
    .eq("line_status", "shipped")
    .not("tracking_number", "is", null);

  if (error) throw error;
  if (!lines || lines.length === 0) return { updated: 0, errors: [] };

  // Batch into groups of 30 (FedEx limit)
  const trackingNumbers = lines
    .map((l: { tracking_number: string | null }) => l.tracking_number)
    .filter((tn): tn is string => tn !== null);

  const uniqueNumbers = [...new Set(trackingNumbers)];
  const batches: string[][] = [];
  for (let i = 0; i < uniqueNumbers.length; i += 30) {
    batches.push(uniqueNumbers.slice(i, i + 30));
  }

  let updated = 0;
  const errors: string[] = [];

  for (const batch of batches) {
    try {
      const results = await trackNumbers(batch);

      for (const result of results) {
        // Find lines with this tracking number
        const matchingLines = lines.filter(
          (l: { tracking_number: string | null }) => l.tracking_number === result.trackingNumber
        );

        const etaDate = result.estimatedDelivery
          ? result.estimatedDelivery.split("T")[0]
          : result.actualDelivery
            ? result.actualDelivery.split("T")[0]
            : null;

        for (const line of matchingLines) {
          const { error: updateErr } = await supabase
            .from("parts_request_lines")
            .update({
              tracking_status: result.statusDetail || result.status,
              tracking_eta: etaDate,
              tracking_events: result.events,
              tracking_last_checked: new Date().toISOString(),
            })
            .eq("id", line.id);

          if (updateErr) {
            errors.push(`Line ${line.id}: ${updateErr.message}`);
          } else {
            updated++;
          }
        }
      }
    } catch (err) {
      errors.push(`Batch error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { updated, errors };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handler(event: HandlerEvent): Promise<HandlerResponse> {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body ?? "{}");

    // Poll mode — refresh all shipped lines
    if (body.poll) {
      const result = await pollAllShippedLines();
      return jsonResponse(200, {
        ok: true,
        updated: result.updated,
        errors: result.errors,
      });
    }

    // Direct track mode — track specific numbers
    const trackingNumbers: string[] = body.trackingNumbers;
    if (!trackingNumbers || !Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
      return jsonResponse(400, { error: "trackingNumbers array required" });
    }

    if (trackingNumbers.length > 30) {
      return jsonResponse(400, { error: "Max 30 tracking numbers per request" });
    }

    const results = await trackNumbers(trackingNumbers);
    return jsonResponse(200, { ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("fedex-track error:", message);

    // If FedEx credentials aren't set up yet, return a clear message
    if (message.includes("not configured")) {
      return jsonResponse(503, {
        error: "FedEx tracking not yet configured",
        detail: "Set FEDEX_API_KEY and FEDEX_SECRET_KEY in Netlify environment variables",
      });
    }

    return jsonResponse(500, { error: message });
  }
}
