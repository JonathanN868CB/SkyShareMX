/**
 * extract-record-events — Supabase Edge Function
 *
 * Phase 2 intelligence layer. After a document is OCR-indexed, this function
 * reads every page's data and routes it through one of three extraction paths:
 *
 *   PATH A — Forms (Textract AnalyzeForms output)
 *     Pages with forms_extracted KEY_VALUE pairs are mapped directly to event
 *     fields using a normalized field-name dictionary. No LLM. Confidence 0.95.
 *     Aviation logbook pre-printed forms (Total Airframe Hours, Date of Work,
 *     Mechanic Cert No., etc.) populate event columns without any guessing.
 *
 *   PATH B — Tables (Textract AnalyzeTables output)
 *     Pages with tables_extracted CELL grids are parsed row-by-row. Row 1 is
 *     treated as the column header. Each subsequent non-empty row becomes one
 *     maintenance event candidate. Confidence 0.82.
 *
 *   PATH C — Narrative (Claude Haiku, existing behaviour)
 *     Pages without structured Textract output — Mistral-indexed documents,
 *     handwritten entries, multi-paragraph work narratives — are batched to
 *     Claude Haiku for freeform extraction. Unchanged from previous behavior.
 *
 * Routing: a page goes to Path A if forms_extracted has ≥ 1 meaningful pair.
 *          Path B if tables_extracted has ≥ 1 table with ≥ 2 rows. Otherwise Path C.
 *          A page that qualifies for A is NOT also sent to C (avoid double events).
 *
 * Auth: verify_jwt=false — caller must be a trusted Netlify service function.
 *
 * Invoked by:
 *   - records-vault-textract-complete Netlify function (after Textract pipeline)
 *   - records-vault-register Netlify function (after Mistral OCR pipeline)
 *   - records-vault-reextract Netlify function (manual reprocessing)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY")!;

const ANTHROPIC_URL   = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL    = "claude-haiku-4-5-20251001";
const PAGE_BATCH_SIZE = 8;    // pages per Claude call
const MAX_CHARS_PAGE  = 3000; // truncate per page for token control

// ─── Data types from rv_pages ─────────────────────────────────────────────────

interface FormField {
  key:             string;
  value:           string;
  keyConfidence:   number;
  valueConfidence: number;
}

interface TableCell {
  row:        number;
  col:        number;
  rowSpan:    number;
  colSpan:    number;
  text:       string;
  confidence: number;
}

interface ExtractedTable {
  tableIndex: number;
  rows:       number;
  cols:       number;
  cells:      TableCell[];
}

interface RvPage {
  id:               string;
  page_number:      number;
  raw_ocr_text:     string | null;
  forms_extracted:  FormField[]     | null;
  tables_extracted: ExtractedTable[] | null;
}

// ─── Canonical event row (shared by all three paths) ─────────────────────────

interface EventRow {
  aircraft_id:          string;
  record_source_id:     string;
  page_ids:             string[];
  event_type:           string;
  event_date:           string | null;
  aircraft_total_time:  number | null;
  aircraft_cycles:      number | null;
  description:          string;
  part_numbers:         string[];
  serial_numbers:       string[];
  work_order_number:    string | null;
  ad_sb_number:         string | null;
  performed_by:         string | null;
  approved_by:          string | null;
  station:              string | null;
  confidence:           number | null;
  extraction_model:     string;
  extraction_notes:     string | null;
}

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Shared sanitizers ────────────────────────────────────────────────────────

const VALID_EVENT_TYPES = new Set([
  "logbook_entry", "inspection", "ad_compliance", "sb_compliance",
  "component_install", "component_removal", "repair", "alteration",
  "overhaul", "return_to_service", "discrepancy", "other",
]);

function sanitizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const clean = s.trim();
  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean) && !isNaN(new Date(clean).getTime())) return clean;
  // Try MM/DD/YYYY → YYYY-MM-DD
  const mdyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const iso = `${mdyMatch[3]}-${mdyMatch[1].padStart(2,"0")}-${mdyMatch[2].padStart(2,"0")}`;
    if (!isNaN(new Date(iso).getTime())) return iso;
  }
  // Try DD-Mon-YYYY (e.g. 14-Aug-2023)
  const dmyMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})$/);
  if (dmyMatch) {
    const d = new Date(`${dmyMatch[2]} ${dmyMatch[1]} ${dmyMatch[3]}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function sanitizeEventType(s: string): string {
  const t = (s ?? "").toLowerCase().replace(/[^a-z_]/g, "");
  return VALID_EVENT_TYPES.has(t) ? t : "other";
}

function sanitizeHours(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/,/g, "").trim());
  return isNaN(n) || n <= 0 || n > 100_000 ? null : n;
}

function sanitizeCycles(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/,/g, "").trim(), 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// ─── PATH A: Forms extraction ─────────────────────────────────────────────────

/**
 * Normalizes a Textract form key for dictionary lookup.
 * "Total Airframe Hours:" → "total airframe hours"
 */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// Known aviation maintenance form field names → event property
// Ordered from most specific to least to prioritize matches.
const FORM_FIELD_MAP: Array<{ patterns: string[]; field: string }> = [
  // Dates
  { patterns: ["date of work", "maintenance date", "work date", "date performed", "completion date", "date"], field: "event_date" },
  // Aircraft time
  { patterns: ["total airframe time", "total airframe hours", "aircraft total time", "airframe total time", "total time in service", "aircraft hours", "total time", "hobbs", "tach time"], field: "aircraft_total_time" },
  // Cycles
  { patterns: ["aircraft cycles", "total cycles", "landings", "cycles", "cycle"], field: "aircraft_cycles" },
  // Description
  { patterns: ["work performed", "work description", "description of work", "maintenance performed", "work accomplished", "discrepancy", "corrective action", "description", "remarks", "narrative"], field: "description" },
  // Part numbers
  { patterns: ["part number", "p/n", "pn", "part no", "part no."], field: "part_numbers" },
  // Serial numbers
  { patterns: ["serial number", "s/n", "sn", "serial no", "serial no."], field: "serial_numbers" },
  // Work order
  { patterns: ["work order number", "work order no", "work order", "wo number", "wo no", "wo", "order number"], field: "work_order_number" },
  // AD/SB
  { patterns: ["ad number", "ad no", "airworthiness directive", "ad/sb number", "ad sb number", "service bulletin", "sb number", "sb no"], field: "ad_sb_number" },
  // Personnel
  { patterns: ["performed by", "mechanic name", "mechanic signature", "mechanic", "technician", "performed", "signed by"], field: "performed_by" },
  { patterns: ["approved by", "inspector", "ia signature", "ia name", "returned to service by", "certifying authority", "approved"], field: "approved_by" },
  // Station
  { patterns: ["maintenance facility", "station", "facility", "location", "maintenance base"], field: "station" },
];

function matchFormField(key: string): string | null {
  const nk = normKey(key);
  for (const entry of FORM_FIELD_MAP) {
    if (entry.patterns.some((p) => nk === p || nk.includes(p))) {
      return entry.field;
    }
  }
  return null;
}

/**
 * Infer event type from available form fields and description text.
 */
function inferEventTypeFromForm(
  fields: Record<string, string>,
  adSbNumber: string | null,
  woNumber: string | null,
): string {
  if (adSbNumber) return "ad_compliance";
  const desc = (fields["description"] ?? "").toLowerCase();
  if (/\boverhaul\b/.test(desc)) return "overhaul";
  if (/\breturn to service|rts\b/.test(desc)) return "return_to_service";
  if (/\binspection|100[- ]hour|annual\b/.test(desc)) return "inspection";
  if (/\binstall(ed)?\b/.test(desc)) return "component_install";
  if (/\bremov(ed|al)\b/.test(desc)) return "component_removal";
  if (/\brepair\b/.test(desc)) return "repair";
  if (/\balteration\b/.test(desc)) return "alteration";
  if (woNumber) return "repair";
  return "logbook_entry";
}

/**
 * PATH A: Convert a page's forms_extracted array into a single EventRow.
 * Returns null if there's insufficient data to form a meaningful event.
 */
function extractFromForms(
  page: RvPage,
  aircraftId: string,
  recordSourceId: string,
): EventRow | null {
  const forms = page.forms_extracted;
  if (!forms || forms.length === 0) return null;

  const raw: Record<string, string[]> = {};

  for (const field of forms) {
    const val = field.value.trim();
    if (!val) continue;
    // Skip very low confidence values
    if (field.valueConfidence < 40) continue;

    const mapped = matchFormField(field.key);
    if (!mapped) continue;

    // Checkbox values emitted by Textract SELECTION_ELEMENT (via getChildText) —
    // skip them so ☑/☐ symbols don't end up in description or other text fields.
    if (val === "☑" || val === "☐") continue;

    if (!raw[mapped]) raw[mapped] = [];
    raw[mapped].push(val);
  }

  // Must have at least a description or date to be a meaningful event
  const hasDescription = !!raw["description"]?.length;
  const hasDate        = !!raw["event_date"]?.length;
  const hasHours       = !!raw["aircraft_total_time"]?.length;
  if (!hasDescription && !hasDate && !hasHours) return null;

  const description     = (raw["description"]      ?? []).join(" ").slice(0, 1000) || "Maintenance record";
  const eventDateRaw    = (raw["event_date"]        ?? [])[0] ?? null;
  const totalTimeRaw    = (raw["aircraft_total_time"] ?? [])[0] ?? null;
  const cyclesRaw       = (raw["aircraft_cycles"]   ?? [])[0] ?? null;
  const woNumber        = (raw["work_order_number"] ?? [])[0]?.slice(0, 100) ?? null;
  const adSbNumber      = (raw["ad_sb_number"]      ?? [])[0]?.slice(0, 100) ?? null;
  const performedBy     = (raw["performed_by"]      ?? []).join(", ").slice(0, 200) || null;
  const approvedBy      = (raw["approved_by"]       ?? []).join(", ").slice(0, 200) || null;
  const station         = (raw["station"]           ?? [])[0]?.slice(0, 200) ?? null;
  const partNumbers     = (raw["part_numbers"]      ?? []).filter(Boolean);
  const serialNumbers   = (raw["serial_numbers"]    ?? []).filter(Boolean);

  const eventDate       = sanitizeDate(eventDateRaw);
  const aircraftTotalTime = sanitizeHours(totalTimeRaw);
  const aircraftCycles  = sanitizeCycles(cyclesRaw);
  const eventType       = inferEventTypeFromForm(raw as Record<string, string>, adSbNumber, woNumber);

  // Confidence: average of value confidences for the fields we captured
  const usedFields = forms.filter((f) => matchFormField(f.key) && f.value.trim() && f.valueConfidence >= 40);
  const avgConf    = usedFields.length > 0
    ? usedFields.reduce((s, f) => s + f.valueConfidence, 0) / usedFields.length / 100
    : 0.85;

  return {
    aircraft_id:         aircraftId,
    record_source_id:    recordSourceId,
    page_ids:            [page.id],
    event_type:          eventType,
    event_date:          eventDate,
    aircraft_total_time: aircraftTotalTime,
    aircraft_cycles:     aircraftCycles,
    description,
    part_numbers:        partNumbers,
    serial_numbers:      serialNumbers,
    work_order_number:   woNumber,
    ad_sb_number:        adSbNumber,
    performed_by:        performedBy,
    approved_by:         approvedBy,
    station,
    confidence:          Math.min(0.97, Math.max(0.60, avgConf)),
    extraction_model:    "textract-forms",
    extraction_notes:    `Extracted from ${usedFields.length} form field(s) via Textract AnalyzeForms`,
  };
}

// ─── PATH B: Tables extraction ────────────────────────────────────────────────

// Column header patterns → event field
const TABLE_COLUMN_MAP: Array<{ patterns: string[]; field: string }> = [
  { patterns: ["date", "work date", "completion date"],                           field: "event_date" },
  { patterns: ["total time", "tt", "hours", "airframe hours", "aircraft hours", "hobbs"], field: "aircraft_total_time" },
  { patterns: ["cycles", "cycle", "landings"],                                    field: "aircraft_cycles" },
  { patterns: ["description", "work", "work performed", "discrepancy", "action"], field: "description" },
  { patterns: ["p/n", "pn", "part no", "part number", "part"],                   field: "part_numbers" },
  { patterns: ["s/n", "sn", "serial", "serial no", "serial number"],             field: "serial_numbers" },
  { patterns: ["wo", "work order", "order no", "order number"],                  field: "work_order_number" },
  { patterns: ["ad", "ad no", "ad number", "sb", "sb no", "ad/sb"],             field: "ad_sb_number" },
  { patterns: ["mechanic", "performed by", "tech", "technician", "signed"],     field: "performed_by" },
  { patterns: ["approved", "approved by", "ia", "inspector"],                   field: "approved_by" },
  { patterns: ["station", "facility", "base", "location"],                      field: "station" },
];

function matchTableColumn(header: string): string | null {
  const nh = normKey(header);
  for (const entry of TABLE_COLUMN_MAP) {
    if (entry.patterns.some((p) => nh === p || nh.startsWith(p))) {
      return entry.field;
    }
  }
  return null;
}

/**
 * PATH B: Convert a table's rows into EventRow[] — one per data row.
 * Row 1 is used as column headers. Rows with no recognizable data are skipped.
 */
function extractFromTable(
  table: ExtractedTable,
  pageId: string,
  aircraftId: string,
  recordSourceId: string,
): EventRow[] {
  if (table.rows < 2) return []; // need at least header + 1 data row

  // Build a (row, col) → cell text lookup
  const cellMap = new Map<string, string>();
  for (const cell of table.cells) {
    cellMap.set(`${cell.row}:${cell.col}`, cell.text.trim());
  }

  // Extract headers from row 1
  const colToField = new Map<number, string>(); // col index → event field
  let recognizedHeaders = 0;
  for (let c = 1; c <= table.cols; c++) {
    const headerText = cellMap.get(`1:${c}`) ?? "";
    const field = matchTableColumn(headerText);
    if (field) {
      colToField.set(c, field);
      recognizedHeaders++;
    }
  }

  // If we can't map at least one column, skip this table (can't make structured events)
  if (recognizedHeaders === 0) return [];

  const events: EventRow[] = [];

  for (let r = 2; r <= table.rows; r++) {
    const raw: Record<string, string[]> = {};
    let nonEmpty = 0;

    for (let c = 1; c <= table.cols; c++) {
      const text = cellMap.get(`${r}:${c}`) ?? "";
      if (!text) continue;
      nonEmpty++;
      const field = colToField.get(c);
      if (!field) continue;
      if (!raw[field]) raw[field] = [];
      raw[field].push(text);
    }

    if (nonEmpty === 0) continue; // blank row

    const description       = (raw["description"]           ?? []).join(" ").slice(0, 1000);
    const eventDateRaw      = (raw["event_date"]            ?? [])[0] ?? null;
    const totalTimeRaw      = (raw["aircraft_total_time"]   ?? [])[0] ?? null;
    const cyclesRaw         = (raw["aircraft_cycles"]       ?? [])[0] ?? null;
    const woNumber          = (raw["work_order_number"]     ?? [])[0]?.slice(0, 100) ?? null;
    const adSbNumber        = (raw["ad_sb_number"]          ?? [])[0]?.slice(0, 100) ?? null;
    const performedBy       = (raw["performed_by"]          ?? []).join(", ").slice(0, 200) || null;
    const approvedBy        = (raw["approved_by"]           ?? []).join(", ").slice(0, 200) || null;
    const station           = (raw["station"]               ?? [])[0]?.slice(0, 200) ?? null;
    const partNumbers       = (raw["part_numbers"]          ?? []).filter(Boolean);
    const serialNumbers     = (raw["serial_numbers"]        ?? []).filter(Boolean);

    const eventDate         = sanitizeDate(eventDateRaw);
    const aircraftTotalTime = sanitizeHours(totalTimeRaw);
    const aircraftCycles    = sanitizeCycles(cyclesRaw);

    // Skip rows that are clearly just repeat headers or have no usable data
    if (!description && !eventDate && !aircraftTotalTime) continue;

    const eventType = inferEventTypeFromForm(
      { description: description ?? "" },
      adSbNumber,
      woNumber,
    );

    events.push({
      aircraft_id:         aircraftId,
      record_source_id:    recordSourceId,
      page_ids:            [pageId],
      event_type:          eventType,
      event_date:          eventDate,
      aircraft_total_time: aircraftTotalTime,
      aircraft_cycles:     aircraftCycles,
      description:         description || "Logbook entry",
      part_numbers:        partNumbers,
      serial_numbers:      serialNumbers,
      work_order_number:   woNumber,
      ad_sb_number:        adSbNumber,
      performed_by:        performedBy,
      approved_by:         approvedBy,
      station,
      confidence:          0.82,
      extraction_model:    "textract-tables",
      extraction_notes:    `Row ${r} of table ${table.tableIndex} — ${recognizedHeaders} column(s) mapped`,
    });
  }

  return events;
}

/**
 * PATH B entry point: process all tables on a page.
 */
function extractFromTables(
  page: RvPage,
  aircraftId: string,
  recordSourceId: string,
): EventRow[] {
  const tables = page.tables_extracted;
  if (!tables || tables.length === 0) return [];

  const events: EventRow[] = [];
  for (const table of tables) {
    events.push(...extractFromTable(table, page.id, aircraftId, recordSourceId));
  }
  return events;
}

// ─── PATH C: Claude Haiku (narrative) ────────────────────────────────────────

interface MaintenanceEventRaw {
  event_type:          string;
  event_date:          string | null;
  aircraft_total_time: number | null;
  aircraft_cycles:     number | null;
  description:         string;
  part_numbers:        string[];
  serial_numbers:      string[];
  work_order_number:   string | null;
  ad_sb_number:        string | null;
  performed_by:        string | null;
  approved_by:         string | null;
  station:             string | null;
  confidence:          number;
  notes:               string | null;
  page_indices:        number[];
}

async function callClaude(
  narrativePages: RvPage[],
  filename: string,
): Promise<MaintenanceEventRaw[]> {
  const pageText = narrativePages
    .map((p, i) =>
      `=== Page ${p.page_number} (batch index ${i}) ===\n${(p.raw_ocr_text ?? "").slice(0, MAX_CHARS_PAGE)}`
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
- event_type: use 'logbook_entry' for standard flight/maintenance log entries.
- aircraft_total_time: total airframe hours at time of work, NOT hours since last inspection.
- confidence: 1.0 = all fields clearly visible; 0.5 = key fields readable but some uncertain; 0.2 = barely decipherable.
- page_indices: which pages in THIS batch contain evidence for this event (0-based).
- If a page contains no events (blank, header, image-only with no data), return no events for it.
- Return empty events array if no events found in batch.`;

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
      messages: [{ role: "user", content: `Document: ${filename}\n\nOCR text (${narrativePages.length} pages):\n\n${pageText}` }],
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
    const cleaned = content.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "");
    const parsed  = JSON.parse(cleaned) as { events: MaintenanceEventRaw[] };
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    console.warn("[extract-record-events] Failed to parse Claude JSON:", content.slice(0, 200));
    return [];
  }
}

function narrativeEventToRow(
  ev: MaintenanceEventRaw,
  batch: RvPage[],
  aircraftId: string,
  recordSourceId: string,
): EventRow {
  const pageIds = (ev.page_indices ?? []).map((idx) => batch[idx]?.id).filter(Boolean) as string[];
  return {
    aircraft_id:         aircraftId,
    record_source_id:    recordSourceId,
    page_ids:            pageIds,
    event_type:          sanitizeEventType(ev.event_type ?? "other"),
    event_date:          sanitizeDate(ev.event_date),
    aircraft_total_time: typeof ev.aircraft_total_time === "number" ? ev.aircraft_total_time : null,
    aircraft_cycles:     typeof ev.aircraft_cycles === "number" ? Math.floor(ev.aircraft_cycles) : null,
    description:         String(ev.description ?? "").slice(0, 1000),
    part_numbers:        Array.isArray(ev.part_numbers) ? ev.part_numbers.map(String).filter(Boolean) : [],
    serial_numbers:      Array.isArray(ev.serial_numbers) ? ev.serial_numbers.map(String).filter(Boolean) : [],
    work_order_number:   ev.work_order_number   ? String(ev.work_order_number).slice(0, 100)   : null,
    ad_sb_number:        ev.ad_sb_number        ? String(ev.ad_sb_number).slice(0, 100)        : null,
    performed_by:        ev.performed_by        ? String(ev.performed_by).slice(0, 200)        : null,
    approved_by:         ev.approved_by         ? String(ev.approved_by).slice(0, 200)         : null,
    station:             ev.station             ? String(ev.station).slice(0, 200)             : null,
    confidence:          typeof ev.confidence === "number" ? Math.min(1, Math.max(0, ev.confidence)) : null,
    extraction_model:    CLAUDE_MODEL,
    extraction_notes:    ev.notes ? String(ev.notes).slice(0, 500) : null,
  };
}

// ─── Page routing ─────────────────────────────────────────────────────────────

type PagePath = "forms" | "tables" | "narrative";

function classifyPage(page: RvPage): PagePath {
  // Forms path: has at least one form field with a non-empty value
  if (page.forms_extracted && page.forms_extracted.length > 0) {
    const meaningful = page.forms_extracted.filter((f) =>
      f.value.trim().length > 0 && matchFormField(f.key) !== null && f.valueConfidence >= 40
    );
    if (meaningful.length >= 1) return "forms";
  }

  // Tables path: has at least one table with ≥ 2 rows and recognized headers
  if (page.tables_extracted && page.tables_extracted.length > 0) {
    const hasUsableTable = page.tables_extracted.some((t) => {
      if (t.rows < 2) return false;
      const headers = t.cells
        .filter((c) => c.row === 1)
        .map((c) => c.text.trim())
        .filter(Boolean);
      return headers.some((h) => matchTableColumn(h) !== null);
    });
    if (hasUsableTable) return "tables";
  }

  return "narrative";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  let body: { record_source_id: string };
  try { body = await req.json(); }
  catch { return jsonResp(400, { error: "Invalid JSON body" }); }

  const { record_source_id } = body;
  if (!record_source_id) return jsonResp(400, { error: "record_source_id required" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  async function log(step: string, message: string): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({ record_source_id, step, message });
  }

  await supabase
    .from("rv_record_sources")
    .update({ extraction_status: "extracting" })
    .eq("id", record_source_id);

  try {
    // ── 1. Fetch source record ─────────────────────────────────────────────
    const { data: source, error: srcErr } = await supabase
      .from("rv_record_sources")
      .select("id, aircraft_id, original_filename")
      .eq("id", record_source_id)
      .single();

    if (srcErr || !source) throw new Error(`Source not found: ${srcErr?.message}`);

    const { aircraft_id, original_filename } = source as { aircraft_id: string; original_filename: string };

    // ── 2. Fetch all pages (now including structured Textract columns) ─────
    const { data: rawPages, error: pagesErr } = await supabase
      .from("rv_pages")
      .select("id, page_number, raw_ocr_text, forms_extracted, tables_extracted")
      .eq("record_source_id", record_source_id)
      .eq("ocr_status", "extracted")
      .order("page_number", { ascending: true });

    if (pagesErr) throw new Error(`Failed to fetch pages: ${pagesErr.message}`);
    if (!rawPages || rawPages.length === 0) throw new Error("No indexed pages found");

    const pages = rawPages as RvPage[];

    // ── 3. Classify pages into extraction paths ───────────────────────────
    const formsPages:     RvPage[] = [];
    const tablesPages:    RvPage[] = [];
    const narrativePages: RvPage[] = [];

    for (const p of pages) {
      const path = classifyPage(p);
      if (path === "forms")     formsPages.push(p);
      else if (path === "tables") tablesPages.push(p);
      else                      narrativePages.push(p);
    }

    const batchCount = Math.ceil(narrativePages.length / PAGE_BATCH_SIZE);
    await log(
      "events_extracting",
      `${pages.length} pages → ` +
      `${formsPages.length} via forms, ` +
      `${tablesPages.length} via tables, ` +
      `${narrativePages.length} via Claude Haiku` +
      (batchCount > 0 ? ` (${batchCount} batch${batchCount !== 1 ? "es" : ""})` : ""),
    );

    // ── 4. Delete existing events (idempotent re-extraction) ──────────────
    await supabase
      .from("rv_maintenance_events")
      .delete()
      .eq("record_source_id", record_source_id);

    const allRows: EventRow[] = [];

    // ── 5. PATH A: Forms extraction ───────────────────────────────────────
    for (const page of formsPages) {
      const row = extractFromForms(page, aircraft_id, record_source_id);
      if (row) allRows.push(row);
    }

    // ── 6. PATH B: Tables extraction ──────────────────────────────────────
    for (const page of tablesPages) {
      const rows = extractFromTables(page, aircraft_id, record_source_id);
      allRows.push(...rows);
    }

    // ── 7. PATH C: Claude Haiku (narrative pages) ─────────────────────────
    for (let i = 0; i < narrativePages.length; i += PAGE_BATCH_SIZE) {
      const batch = narrativePages.slice(i, i + PAGE_BATCH_SIZE);
      const rawEvents = await callClaude(batch, original_filename);
      for (const ev of rawEvents) {
        allRows.push(narrativeEventToRow(ev, batch, aircraft_id, record_source_id));
      }
    }

    // ── 8. Insert all events ──────────────────────────────────────────────
    if (allRows.length > 0) {
      const { error: insertErr } = await supabase
        .from("rv_maintenance_events")
        .insert(allRows);
      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
    }

    // Count by path for logging
    const formsCount     = allRows.filter((r) => r.extraction_model === "textract-forms").length;
    const tablesCount    = allRows.filter((r) => r.extraction_model === "textract-tables").length;
    const narrativeCount = allRows.filter((r) => r.extraction_model === CLAUDE_MODEL).length;

    // ── 9. Update source record ───────────────────────────────────────────
    await supabase
      .from("rv_record_sources")
      .update({
        extraction_status:       "complete",
        extraction_completed_at: new Date().toISOString(),
        extraction_error:        null,
        events_extracted:        allRows.length,
      })
      .eq("id", record_source_id);

    const summary = [
      formsCount     > 0 ? `${formsCount} from forms`     : null,
      tablesCount    > 0 ? `${tablesCount} from tables`    : null,
      narrativeCount > 0 ? `${narrativeCount} from Claude` : null,
    ].filter(Boolean).join(", ") || "0 events";

    await log(
      "events_complete",
      `✓ Extracted ${allRows.length} maintenance event${allRows.length !== 1 ? "s" : ""} — ${summary}`,
    );

    return jsonResp(200, {
      success:          true,
      pages_processed:  pages.length,
      events_extracted: allRows.length,
      breakdown: {
        forms:     formsCount,
        tables:    tablesCount,
        narrative: narrativeCount,
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extract-record-events] Failed for ${record_source_id}:`, message);

    await log("events_failed", `Event extraction failed: ${message}`);
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
