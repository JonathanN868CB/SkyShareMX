/**
 * extract-record-events — Supabase Edge Function
 *
 * Phase 2 intelligence layer. After a document is OCR-indexed, this function
 * reads every page's raw OCR text, sends batches to Claude Haiku for structured
 * aviation maintenance event extraction, and inserts the results into
 * rv_maintenance_events.
 *
 * Claude extracts:
 *   - Event type (logbook entry, inspection, AD compliance, install/removal, etc.)
 *   - Date, aircraft total time, cycles
 *   - Description (concise, plain-English summary)
 *   - Part numbers, serial numbers
 *   - Work order / AD / SB numbers
 *   - Performed by, approved by
 *
 * Auth: verify_jwt=false — caller must pass X-Service-Key header.
 *
 * Invoked by:
 *   - records-vault-register Netlify function (after process-record-source completes)
 *   - records-vault-reextract Netlify function (manual reprocessing)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;

const ANTHROPIC_URL    = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL     = "claude-haiku-4-5-20251001";
const PAGE_BATCH_SIZE  = 8;   // pages per Claude call
const MAX_CHARS_PAGE   = 3000; // truncate long pages to control token cost

interface ExtractRequest {
  record_source_id: string;
}

interface RvPage {
  id: string;
  page_number: number;
  raw_ocr_text: string;
}

interface MaintenanceEventRaw {
  event_type: string;
  event_date: string | null;
  aircraft_total_time: number | null;
  aircraft_cycles: number | null;
  description: string;
  part_numbers: string[];
  serial_numbers: string[];
  work_order_number: string | null;
  ad_sb_number: string | null;
  performed_by: string | null;
  approved_by: string | null;
  station: string | null;
  confidence: number;
  notes: string | null;
  page_indices: number[]; // 0-based indices into the batch
}

interface ClaudeResponse {
  events: MaintenanceEventRaw[];
}

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_EVENT_TYPES = new Set([
  "logbook_entry","inspection","ad_compliance","sb_compliance",
  "component_install","component_removal","repair","alteration",
  "overhaul","return_to_service","discrepancy","other",
]);

function sanitizeDate(s: string | null): string | null {
  if (!s) return null;
  const clean = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean) && !isNaN(new Date(clean).getTime())) return clean;
  return null;
}

function sanitizeEventType(s: string): string {
  const t = s.toLowerCase().replace(/[^a-z_]/g, "");
  return VALID_EVENT_TYPES.has(t) ? t : "other";
}

async function callClaude(
  pages: RvPage[],
  filename: string,
): Promise<MaintenanceEventRaw[]> {
  const pageText = pages
    .map((p, i) =>
      `=== Page ${p.page_number} (batch index ${i}) ===\n${p.raw_ocr_text.slice(0, MAX_CHARS_PAGE)}`
    )
    .join("\n\n");

  const systemPrompt = `You are an expert aviation maintenance records analyst. You extract structured maintenance events from OCR text of scanned aircraft maintenance records, logbooks, and work orders.

Return ONLY a valid JSON object with this exact shape:
{
  "events": [
    {
      "event_type": "<one of: logbook_entry|inspection|ad_compliance|sb_compliance|component_install|component_removal|repair|alteration|overhaul|return_to_service|discrepancy|other>",
      "event_date": "<YYYY-MM-DD or null>",
      "aircraft_total_time": <decimal hours as number, or null>,
      "aircraft_cycles": <integer or null>,
      "description": "<concise plain-English summary, 1-2 sentences max>",
      "part_numbers": ["<P/N>", ...],
      "serial_numbers": ["<S/N>", ...],
      "work_order_number": "<WO number or null>",
      "ad_sb_number": "<AD-YYYY-NN-NN or SB number, or null>",
      "performed_by": "<mechanic name and/or certificate number, or null>",
      "approved_by": "<IA or DER name and/or certificate, or null>",
      "station": "<maintenance facility name/city, or null>",
      "confidence": <0.0-1.0>,
      "notes": "<any extraction caveats or null>",
      "page_indices": [<0-based index into the batch>]
    }
  ]
}

Rules:
- Extract REAL maintenance events only. Ignore headers, table of contents, blank pages.
- One event per distinct maintenance action. A multi-page work order is ONE event.
- event_type: use 'logbook_entry' for standard A/C flight/maintenance log entries.
- aircraft_total_time: total airframe hours at time of work, NOT hours since last inspection.
- confidence: 1.0 = all fields clearly visible; 0.5 = key fields readable but some uncertain; 0.2 = barely decipherable.
- page_indices: which pages in THIS batch contain evidence for this event (0-based).
- If a page contains no events (blank, header, image-only with no data), return no events for it.
- Return empty events array if no events found in batch.`;

  const userMsg = `Document filename: ${filename}\n\nOCR text (${pages.length} pages):\n\n${pageText}`;

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${err}`);
  }

  const result = await resp.json();
  const content: string = result.content?.[0]?.text ?? "";
  if (!content) return [];

  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "");
    const parsed = JSON.parse(cleaned) as ClaudeResponse;
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    console.warn("[extract-record-events] Failed to parse Claude JSON:", content.slice(0, 200));
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  let body: ExtractRequest;
  try { body = await req.json(); }
  catch { return jsonResp(400, { error: "Invalid JSON body" }); }

  const { record_source_id } = body;
  if (!record_source_id) return jsonResp(400, { error: "record_source_id required" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Mark as extracting
  await supabase
    .from("rv_record_sources")
    .update({ extraction_status: "extracting" })
    .eq("id", record_source_id);

  try {
    // Fetch source record
    const { data: source, error: srcErr } = await supabase
      .from("rv_record_sources")
      .select("id, aircraft_id, original_filename, extraction_status")
      .eq("id", record_source_id)
      .single();

    if (srcErr || !source) throw new Error(`Source not found: ${srcErr?.message}`);

    // Fetch all indexed pages
    const { data: pages, error: pagesErr } = await supabase
      .from("rv_pages")
      .select("id, page_number, raw_ocr_text")
      .eq("record_source_id", record_source_id)
      .eq("ocr_status", "extracted")
      .order("page_number", { ascending: true });

    if (pagesErr) throw new Error(`Failed to fetch pages: ${pagesErr.message}`);
    if (!pages || pages.length === 0) throw new Error("No indexed pages found");

    // Delete any existing events for this source (idempotent re-extraction)
    await supabase
      .from("rv_maintenance_events")
      .delete()
      .eq("record_source_id", record_source_id);

    // Process in batches
    let totalEvents = 0;
    const allInsertRows: Record<string, unknown>[] = [];

    for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
      const batch = pages.slice(i, i + PAGE_BATCH_SIZE) as RvPage[];
      const rawEvents = await callClaude(batch, source.original_filename);

      for (const ev of rawEvents) {
        // Map batch-relative page_indices back to real page IDs
        const pageIds = (ev.page_indices ?? [])
          .map((idx: number) => batch[idx]?.id)
          .filter(Boolean);

        allInsertRows.push({
          aircraft_id:          source.aircraft_id,
          record_source_id:     record_source_id,
          page_ids:             pageIds,
          event_type:           sanitizeEventType(ev.event_type ?? "other"),
          event_date:           sanitizeDate(ev.event_date),
          aircraft_total_time:  typeof ev.aircraft_total_time === "number" ? ev.aircraft_total_time : null,
          aircraft_cycles:      typeof ev.aircraft_cycles === "number" ? Math.floor(ev.aircraft_cycles) : null,
          description:          String(ev.description ?? "").slice(0, 1000),
          part_numbers:         Array.isArray(ev.part_numbers) ? ev.part_numbers.map(String).filter(Boolean) : [],
          serial_numbers:       Array.isArray(ev.serial_numbers) ? ev.serial_numbers.map(String).filter(Boolean) : [],
          work_order_number:    ev.work_order_number ? String(ev.work_order_number).slice(0, 100) : null,
          ad_sb_number:         ev.ad_sb_number ? String(ev.ad_sb_number).slice(0, 100) : null,
          performed_by:         ev.performed_by ? String(ev.performed_by).slice(0, 200) : null,
          approved_by:          ev.approved_by ? String(ev.approved_by).slice(0, 200) : null,
          station:              ev.station ? String(ev.station).slice(0, 200) : null,
          confidence:           typeof ev.confidence === "number"
                                  ? Math.min(1, Math.max(0, ev.confidence))
                                  : null,
          extraction_model:     CLAUDE_MODEL,
          extraction_notes:     ev.notes ? String(ev.notes).slice(0, 500) : null,
        });
      }

      totalEvents += rawEvents.length;
    }

    // Batch insert all events
    if (allInsertRows.length > 0) {
      const { error: insertErr } = await supabase
        .from("rv_maintenance_events")
        .insert(allInsertRows);
      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
    }

    // Update source record
    await supabase
      .from("rv_record_sources")
      .update({
        extraction_status:       "complete",
        extraction_completed_at: new Date().toISOString(),
        extraction_error:        null,
        events_extracted:        allInsertRows.length,
      })
      .eq("id", record_source_id);

    return jsonResp(200, {
      success: true,
      pages_processed: pages.length,
      events_extracted: allInsertRows.length,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extract-record-events] Failed for ${record_source_id}:`, message);

    await supabase
      .from("rv_record_sources")
      .update({
        extraction_status:       "failed",
        extraction_error:        message,
        extraction_completed_at: new Date().toISOString(),
      })
      .eq("id", record_source_id);

    return jsonResp(500, { error: message });
  }
});
