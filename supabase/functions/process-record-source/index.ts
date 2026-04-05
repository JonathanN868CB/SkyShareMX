/**
 * process-record-source — Supabase Edge Function
 *
 * Downloads nothing. Instead it generates a short-lived signed URL for the PDF
 * in Storage and hands that URL directly to Mistral OCR. Mistral fetches the
 * file server-side — the Edge Function never holds PDF bytes in memory.
 *
 * After OCR, a second Mistral call extracts structured metadata:
 * date_range_start, date_range_end, observed_registration — automatically
 * populated from document content so users never have to type what's already
 * printed on the page.
 *
 * Pipeline steps:
 *   queued → download_started → ocr_submitted → ocr_complete →
 *   metadata_extracting → pages_inserting → verified | partial | failed
 *
 * Auth: verify_jwt=false — caller must be Netlify service function.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY   = Deno.env.get("MISTRAL_API_KEY")!;

const MISTRAL_OCR_URL   = "https://api.mistral.ai/v1/ocr";
const MISTRAL_CHAT_URL  = "https://api.mistral.ai/v1/chat/completions";
const PAGE_INSERT_CHUNK = 50;
const SIGNED_URL_EXPIRY = 3600;

// Pages sampled for metadata extraction (first N + last N)
const METADATA_SAMPLE_PAGES = 3;

interface ProcessRequest {
  record_source_id: string;
}

interface MistralOcrPage {
  index: number;
  markdown?: string;
  text?: string;
  confidence?: number;
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

interface ExtractedMetadata {
  date_range_start: string | null;
  date_range_end: string | null;
  observed_registration: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

/**
 * Ask Mistral to extract structured metadata from sampled OCR text.
 * Uses mistral-small-latest with JSON mode — fast and cheap.
 * Non-fatal: returns nulls if extraction fails for any reason.
 */
async function extractMetadata(
  pages: MistralOcrPage[],
  filename: string,
): Promise<ExtractedMetadata> {
  const nullResult: ExtractedMetadata = {
    date_range_start: null,
    date_range_end: null,
    observed_registration: null,
  };

  try {
    // Sample first and last N pages (deduplicated for short documents)
    const seen = new Set<number>();
    const sample: MistralOcrPage[] = [];
    const candidates = [
      ...pages.slice(0, METADATA_SAMPLE_PAGES),
      ...pages.slice(-METADATA_SAMPLE_PAGES),
    ];
    for (const p of candidates) {
      if (!seen.has(p.index)) {
        seen.add(p.index);
        sample.push(p);
      }
    }

    const sampleText = sample
      .map((p) => `=== Page ${p.index + 1} ===\n${(p.markdown ?? p.text ?? "").slice(0, 2000)}`)
      .join("\n\n");

    if (!sampleText.trim()) return nullResult;

    const resp = await fetch(MISTRAL_CHAT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        response_format: { type: "json_object" },
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content: `You extract metadata from aviation maintenance and flight record documents.
Return a JSON object with exactly these fields:
{
  "date_range_start": "YYYY-MM-DD",
  "date_range_end": "YYYY-MM-DD",
  "observed_registration": "tail number"
}
Rules:
- date_range_start: earliest date of actual flights or maintenance work in this document (not document publication or manual revision dates)
- date_range_end: latest date of actual flights or maintenance work in this document
- observed_registration: aircraft tail/registration number visible in the document (e.g. "N477KR", "HB-FXO")
- Use null for any field you cannot determine with confidence
- Dates must be in YYYY-MM-DD format`,
          },
          {
            role: "user",
            content: `Document filename: ${filename}\n\nOCR text sample:\n\n${sampleText}`,
          },
        ],
      }),
    });

    if (!resp.ok) return nullResult;

    const result = await resp.json();
    const content: string = result.choices?.[0]?.message?.content ?? "";
    if (!content) return nullResult;

    const parsed = JSON.parse(content) as Record<string, unknown>;

    return {
      date_range_start:
        typeof parsed.date_range_start === "string" &&
        isValidIsoDate(parsed.date_range_start)
          ? parsed.date_range_start
          : null,
      date_range_end:
        typeof parsed.date_range_end === "string" &&
        isValidIsoDate(parsed.date_range_end)
          ? parsed.date_range_end
          : null,
      observed_registration:
        typeof parsed.observed_registration === "string" &&
        parsed.observed_registration.trim().length > 0
          ? parsed.observed_registration.trim().toUpperCase()
          : null,
    };
  } catch {
    return nullResult;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  let body: ProcessRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResp(400, { error: "Invalid JSON body" });
  }

  const { record_source_id } = body;
  if (!record_source_id) return jsonResp(400, { error: "record_source_id required" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  async function log(step: string, message: string, page_count?: number): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({
      record_source_id,
      step,
      message,
      page_count: page_count ?? null,
    });
  }

  await supabase
    .from("rv_record_sources")
    .update({
      ingestion_status:     "extracting",
      ingestion_started_at: new Date().toISOString(),
    })
    .eq("id", record_source_id);

  try {
    // ── 1. Fetch source record ─────────────────────────────────────────────
    const { data: source, error: sourceErr } = await supabase
      .from("rv_record_sources")
      .select("id, aircraft_id, storage_path, original_filename, observed_registration, date_range_start, date_range_end")
      .eq("id", record_source_id)
      .single();

    if (sourceErr || !source) {
      throw new Error(`Source record not found: ${sourceErr?.message}`);
    }

    await log("download_started", `Generating signed URL for ${source.original_filename}`);

    // ── 2. Generate signed URL — Mistral fetches the PDF directly ──────────
    const { data: signedData, error: signErr } = await supabase.storage
      .from("records-vault")
      .createSignedUrl(source.storage_path, SIGNED_URL_EXPIRY);

    if (signErr || !signedData?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${signErr?.message}`);
    }

    await log("ocr_submitted", "PDF URL sent to Mistral OCR — awaiting response");

    // ── 3. Call Mistral OCR ────────────────────────────────────────────────
    const mistralResponse = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: signedData.signedUrl,
        },
        include_image_base64: false,
      }),
    });

    if (!mistralResponse.ok) {
      const errText = await mistralResponse.text();
      throw new Error(`Mistral OCR error ${mistralResponse.status}: ${errText}`);
    }

    const ocrResult: MistralOcrResponse = await mistralResponse.json();
    const pages = ocrResult.pages ?? [];

    if (pages.length === 0) {
      throw new Error("Mistral OCR returned zero pages — file may be empty or unreadable");
    }

    await log("ocr_complete", `Mistral returned ${pages.length} pages`, pages.length);

    await supabase
      .from("rv_record_sources")
      .update({ pages_extracted: pages.length })
      .eq("id", record_source_id);

    // ── 4. Auto-extract metadata from OCR text ────────────────────────────
    // Only fill fields the user left blank at upload time.
    await log("metadata_extracting", "Extracting dates and registration from document content");

    const meta = await extractMetadata(pages, source.original_filename);

    const metaUpdates: Record<string, unknown> = {};
    if (meta.date_range_start && !source.date_range_start) {
      metaUpdates.date_range_start = meta.date_range_start;
    }
    if (meta.date_range_end && !source.date_range_end) {
      metaUpdates.date_range_end = meta.date_range_end;
    }
    if (meta.observed_registration && !source.observed_registration) {
      metaUpdates.observed_registration = meta.observed_registration;
    }

    if (Object.keys(metaUpdates).length > 0) {
      await supabase
        .from("rv_record_sources")
        .update(metaUpdates)
        .eq("id", record_source_id);

      const parts: string[] = [];
      if (metaUpdates.date_range_start || metaUpdates.date_range_end) {
        parts.push(`dates ${metaUpdates.date_range_start ?? "?"} – ${metaUpdates.date_range_end ?? "?"}`);
      }
      if (metaUpdates.observed_registration) {
        parts.push(`reg ${metaUpdates.observed_registration}`);
      }
      await log("metadata_extracting", `Auto-filled: ${parts.join(", ")}`);
    } else {
      await log("metadata_extracting", "No new metadata to fill (fields already set or not found)");
    }

    // ── 5. Insert rv_pages in batches ──────────────────────────────────────
    await log("pages_inserting", `Inserting ${pages.length} pages into database`);

    let totalConfidence = 0;
    let confidenceCount = 0;
    let insertedCount   = 0;

    for (let i = 0; i < pages.length; i += PAGE_INSERT_CHUNK) {
      const chunk = pages.slice(i, i + PAGE_INSERT_CHUNK);

      const rows = chunk.map((page) => {
        const conf = page.confidence ?? null;
        if (conf !== null) { totalConfidence += conf; confidenceCount++; }
        return {
          record_source_id: source.id,
          aircraft_id:      source.aircraft_id,
          page_number:      page.index + 1,
          raw_ocr_text:     page.markdown ?? page.text ?? "",
          ocr_confidence:   conf,
          ocr_status:       "extracted" as const,
        };
      });

      const { error: insertErr } = await supabase
        .from("rv_pages")
        .upsert(rows, { onConflict: "record_source_id,page_number" });

      if (insertErr) {
        throw new Error(`Insert failed at chunk starting page ${i + 1}: ${insertErr.message}`);
      }

      insertedCount += rows.length;
    }

    // ── 6. Verify ─────────────────────────────────────────────────────────
    const { count: dbCount, error: countErr } = await supabase
      .from("rv_pages")
      .select("id", { count: "exact", head: true })
      .eq("record_source_id", record_source_id)
      .eq("ocr_status", "extracted");

    const pagesInDb = countErr ? null : (dbCount ?? 0);
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : null;

    const verificationStatus = pagesInDb === null
      ? "partial"
      : pagesInDb === pages.length ? "verified" : "partial";

    if (verificationStatus === "verified") {
      await log("verified", `✓ Verified: ${pagesInDb} of ${pages.length} pages confirmed in database`, pagesInDb);
    } else {
      await log("partial", `⚠ Partial: ${pagesInDb ?? "?"} of ${pages.length} pages found — may need retry`, pagesInDb ?? undefined);
    }

    // ── 7. Mark source as indexed ─────────────────────────────────────────
    await supabase
      .from("rv_record_sources")
      .update({
        ingestion_status:       "indexed",
        page_count:             pages.length,
        pages_extracted:        pages.length,
        pages_inserted:         pagesInDb ?? insertedCount,
        verification_status:    verificationStatus,
        ocr_quality_score:      avgConfidence,
        ingestion_error:        null,
        ingestion_completed_at: new Date().toISOString(),
      })
      .eq("id", record_source_id);

    return jsonResp(200, {
      success: true,
      pages_extracted:     pages.length,
      pages_in_db:         pagesInDb,
      verification_status: verificationStatus,
      metadata_extracted:  metaUpdates,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process-record-source] Failed for ${record_source_id}:`, message);

    await log("failed", message);

    await supabase
      .from("rv_record_sources")
      .update({
        ingestion_status:       "failed",
        ingestion_error:        message,
        ingestion_completed_at: new Date().toISOString(),
      })
      .eq("id", record_source_id);

    return jsonResp(500, { error: message });
  }
});
