// records-vault-label — AUTH REQUIRED (Manager+ OR service role)
//
// Two actions, both operating on one record_source_id:
//
//   { recordSourceId, action: "generate" }
//     Reads the first ~3 and last ~3 pages of OCR text + forms from rv_pages,
//     asks Claude Haiku to produce a structured display label, writes it to
//     rv_record_sources.display_label.
//
//   { recordSourceId, action: "save", label: DisplayLabel }
//     Persists a user-provided label verbatim to display_label (edit modal).
//
// Called fire-and-forget from records-vault-textract-complete.ts at the tail
// of the pipeline (using the service role as Bearer), and from the UI when
// a manager clicks "Regenerate" or submits the edit modal.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runHaikuTask } from "./_haiku-task";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};
type HandlerResponse = { statusCode: number; headers?: Record<string, string>; body?: string };

type LogbookComponent = "airframe" | "engine" | "propeller";
type DisplayLabel = {
  registration:   string | null;
  serial:         string | null;
  component:      LogbookComponent | null;
  logbook_number: string | null;
  date_start:     string | null;
  date_end:       string | null;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  };
}

function getToken(event: HandlerEvent): string | null {
  const h = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const parts = h.trim().split(/\s+/);
  const token = parts.length >= 2 ? parts.slice(1).join(" ").trim() : parts[0] ?? "";
  return token.length > 0 ? token : null;
}

// ─── Label normalization ─────────────────────────────────────────────────────

function coerceLabel(raw: unknown): DisplayLabel {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 && t.toLowerCase() !== "null" ? t : null;
  };
  const comp = str(r.component)?.toLowerCase();
  const component: LogbookComponent | null =
    comp === "airframe" || comp === "engine" || comp === "propeller" ? comp : null;
  return {
    registration:   str(r.registration),
    serial:         str(r.serial),
    component,
    logbook_number: str(r.logbook_number),
    date_start:     str(r.date_start),
    date_end:       str(r.date_end),
  };
}

// ─── Haiku generation ────────────────────────────────────────────────────────
// All Haiku traffic routes through _haiku-task.runHaikuTask so we get task
// tagging, bounded tokens, a timeout, and a log row per call.

const LABEL_SYSTEM_PROMPT = `You label aviation maintenance logbook PDFs for a records vault. You will receive OCR text from the FIRST few pages AND the LAST few pages of a scanned document, plus any form fields the OCR engine pulled out.

IMPORTANT: Aviation logbooks stack newest entries on top. Page 1 is the MOST RECENT entry (date_end). The last pages contain the OLDEST entries (date_start). You are seeing both ends of the document specifically so you can determine the full date range.

Return ONE JSON object with exactly these keys:

{
  "registration":   string or null,   // aircraft tail/registration number (e.g. "N123AB"). null if not present.
  "serial":         string or null,   // aircraft, engine, or propeller serial number shown on the cover. null if not present.
  "component":      "airframe" | "engine" | "propeller" | null,  // what this logbook tracks. Guess from cover title / first page. null only if truly unclear.
  "logbook_number": string or null,   // which logbook volume this is. See rules below. null if unknown.
  "date_start":     string or null,   // earliest dated entry you can see, as YYYY-MM-DD. null if unknown.
  "date_end":       string or null    // latest dated entry you can see, as YYYY-MM-DD. null if unknown.
}

RULES:
- Return ONLY the JSON object. No prose, no markdown, no code fences.
- Do not invent data. If a field is not clearly stated, return null.
- Registrations are typically N-numbers (US) or ICAO-style tail codes. Do not confuse part numbers or serial numbers with registrations.
- Dates must be YYYY-MM-DD. If you see "3/15/22" interpret in context; if uncertain about year, return null.
- component: if you see "AIRFRAME LOG" / "AIRCRAFT LOG" → "airframe". "ENGINE LOG" → "engine". "PROPELLER LOG" → "propeller".
- logbook_number: look for volume markers on the cover or first page like "LOG BOOK NO. 2", "Book 1 of 3", "Volume III", "Logbook #4". Normalize to the form "Logbook One", "Logbook Two", "Logbook Three", etc. using the English word for the number (One through Ten; for 11+ use "Logbook 11"). If no volume marker is visible, return null — do NOT guess.`;

async function generateLabel(args: {
  apiKey:               string;
  adminClient:          SupabaseClient;
  recordSourceId:       string;
  originalFilename:     string;
  observedRegistration: string | null;
  dateRangeHintStart:   string | null;
  dateRangeHintEnd:     string | null;
  ocrText:              string;
  forms:                string;
}): Promise<DisplayLabel> {
  const userContent = [
    `FILENAME: ${args.originalFilename}`,
    args.observedRegistration ? `REGISTRATION HINT: ${args.observedRegistration}` : "",
    args.dateRangeHintStart || args.dateRangeHintEnd
      ? `DATE RANGE HINT: ${args.dateRangeHintStart ?? "?"} → ${args.dateRangeHintEnd ?? "?"}`
      : "",
    "",
    "OCR TEXT (first + last pages):",
    args.ocrText.slice(0, 12000),
    "",
    "FORM FIELDS:",
    args.forms.slice(0, 2000),
  ].filter(Boolean).join("\n");

  const { parsed } = await runHaikuTask({
    task:           "label_generate",
    apiKey:         args.apiKey,
    adminClient:    args.adminClient,
    recordSourceId: args.recordSourceId,
    system:         LABEL_SYSTEM_PROMPT,
    user:           userContent,
    maxTokens:      400,
    timeoutMs:      30_000,
  });

  return coerceLabel(parsed);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST")    return json(405, { error: "Method not allowed" });

  const supabaseUrl   = process.env.SUPABASE_URL;
  const serviceRole   = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey       = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return json(500, { error: "Server config error" });
  }

  const token = getToken(event);
  if (!token) return json(401, { error: "Authentication required" });

  const isServiceCall = token === serviceRole;

  // Manager+ gate (skipped for internal service-role calls)
  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!isServiceCall) {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) return json(401, { error: "Invalid session" });

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const managerRoles = ["Manager", "Director of Maintenance", "DPE", "Admin", "Super Admin"];
    if (!profile || !managerRoles.includes(profile.role)) {
      return json(403, { error: "Manager role required" });
    }
  }

  if (!event.body) return json(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId : null;
  const action         = typeof payload.action === "string" ? payload.action : "generate";
  if (!recordSourceId) return json(400, { error: "recordSourceId required" });

  // ── Action: save ──────────────────────────────────────────────────────────
  if (action === "save") {
    const label = coerceLabel(payload.label);
    const { error: updErr } = await adminClient
      .from("rv_record_sources")
      .update({ display_label: label, label_status: "generated" })
      .eq("id", recordSourceId);
    if (updErr) return json(500, { error: `Update failed: ${updErr.message}` });
    return json(200, { ok: true, label });
  }

  // ── Action: generate ──────────────────────────────────────────────────────
  if (action !== "generate") return json(400, { error: `Unknown action: ${action}` });

  if (!anthropicKey) {
    // Non-fatal — the card will just fall back to the filename
    return json(200, { ok: false, skipped: "ANTHROPIC_API_KEY not set" });
  }

  // 1. Pull the record source for context
  const { data: source, error: srcErr } = await adminClient
    .from("rv_record_sources")
    .select("id, original_filename, observed_registration, date_range_start, date_range_end")
    .eq("id", recordSourceId)
    .maybeSingle();

  if (srcErr || !source) return json(404, { error: "Record source not found" });

  // 2. Pull the first 3 + last 3 pages of OCR text + form fields.
  // Logbooks stack newest on top, so page 1 has the end date and the last
  // page has the start date. We need both ends for accurate date_start/end.
  const { data: firstPages } = await adminClient
    .from("rv_pages")
    .select("page_number, raw_ocr_text, forms_extracted")
    .eq("record_source_id", recordSourceId)
    .order("page_number", { ascending: true })
    .limit(3);

  const { data: lastPages } = await adminClient
    .from("rv_pages")
    .select("page_number, raw_ocr_text, forms_extracted")
    .eq("record_source_id", recordSourceId)
    .order("page_number", { ascending: false })
    .limit(3);

  // Merge and deduplicate (small docs where first/last overlap)
  const seenPages = new Set<number>();
  const pages: typeof firstPages = [];
  for (const p of [...(firstPages ?? []), ...(lastPages ?? [])]) {
    if (!seenPages.has(p.page_number)) {
      seenPages.add(p.page_number);
      pages.push(p);
    }
  }
  pages.sort((a, b) => a.page_number - b.page_number);

  const ocrText = pages
    .map((p) => `--- Page ${p.page_number} ---\n${p.raw_ocr_text ?? ""}`)
    .join("\n\n");

  const forms = pages
    .flatMap((p) => {
      const arr = Array.isArray(p.forms_extracted) ? p.forms_extracted : [];
      return arr.map((f: { key?: string; value?: string }) => `${f.key ?? ""}: ${f.value ?? ""}`);
    })
    .filter((s) => s.trim().length > 1)
    .join("\n");

  if (!ocrText.trim() && !forms.trim()) {
    return json(200, { ok: false, skipped: "No OCR text available yet" });
  }

  // 3. Call Haiku (via _haiku-task guardrail)
  let label: DisplayLabel;
  try {
    label = await generateLabel({
      apiKey:               anthropicKey,
      adminClient,
      recordSourceId,
      originalFilename:     source.original_filename,
      observedRegistration: source.observed_registration,
      dateRangeHintStart:   source.date_range_start,
      dateRangeHintEnd:     source.date_range_end,
      ocrText,
      forms,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[label] Haiku failed for ${recordSourceId}:`, msg);
    await adminClient
      .from("rv_record_sources")
      .update({ label_status: "failed" })
      .eq("id", recordSourceId);
    await adminClient.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step:             "label_failed",
      message:          `Label generation failed: ${msg}`,
    });
    return json(200, { ok: false, skipped: `Haiku error: ${msg}` });
  }

  // 4. Persist
  const { error: updErr } = await adminClient
    .from("rv_record_sources")
    .update({ display_label: label, label_status: "generated" })
    .eq("id", recordSourceId);

  if (updErr) {
    console.error(`[label] Update failed for ${recordSourceId}:`, updErr.message);
    await adminClient
      .from("rv_record_sources")
      .update({ label_status: "failed" })
      .eq("id", recordSourceId);
    return json(500, { error: `Update failed: ${updErr.message}` });
  }

  // Log to ingestion log for visibility in Pipeline tab
  try {
    await adminClient.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step:             "label_generated",
      message:          `✓ Display label generated: ${label.registration ?? "—"} · ${label.component ?? "—"}`,
    });
  } catch {
    // non-critical
  }

  return json(200, { ok: true, label });
};
