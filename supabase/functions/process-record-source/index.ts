/**
 * process-record-source — Supabase Edge Function
 *
 * Downloads nothing. Instead it generates a short-lived signed URL for the PDF
 * in Storage and hands that URL directly to Mistral OCR. Mistral fetches the
 * file server-side — the Edge Function never holds PDF bytes in memory.
 *
 * Pipeline steps logged to rv_ingestion_log for real-time UI visibility:
 *   queued → download_started → ocr_submitted → ocr_complete →
 *   pages_inserting → verified | partial | failed
 *
 * Auth: caller must present SUPABASE_SERVICE_ROLE_KEY as Bearer token.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY     = Deno.env.get("MISTRAL_API_KEY")!;

const MISTRAL_OCR_URL     = "https://api.mistral.ai/v1/ocr";
const PAGE_INSERT_CHUNK   = 50;   // rows per upsert batch
const SIGNED_URL_EXPIRY   = 3600; // seconds — long enough for Mistral to fetch

interface ProcessRequest {
  record_source_id: string;
}

interface MistralOcrPage {
  index: number;
  text: string;
  confidence?: number;
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return jsonResp(401, { error: "Unauthorized" });
  }

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

  // ── Convenience: log a step ──────────────────────────────────────────────
  async function log(
    step: string,
    message: string,
    page_count?: number
  ): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({
      record_source_id,
      step,
      message,
      page_count: page_count ?? null,
    });
  }

  // Mark as extracting + record start time
  await supabase
    .from("rv_record_sources")
    .update({
      ingestion_status: "extracting",
      ingestion_started_at: new Date().toISOString(),
    })
    .eq("id", record_source_id);

  try {
    // ── 1. Fetch source record ─────────────────────────────────────────────
    const { data: source, error: sourceErr } = await supabase
      .from("rv_record_sources")
      .select("id, aircraft_id, storage_path, original_filename")
      .eq("id", record_source_id)
      .single();

    if (sourceErr || !source) {
      throw new Error(`Source record not found: ${sourceErr?.message}`);
    }

    await log("download_started", `Generating signed URL for ${source.original_filename}`);

    // ── 2. Generate signed URL — Mistral fetches the PDF directly ──────────
    // No PDF bytes ever held in Edge Function memory.
    const { data: signedData, error: signErr } = await supabase.storage
      .from("records-vault")
      .createSignedUrl(source.storage_path, SIGNED_URL_EXPIRY);

    if (signErr || !signedData?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${signErr?.message}`);
    }

    await log("ocr_submitted", "PDF URL sent to Mistral OCR — awaiting response");

    // ── 3. Call Mistral OCR with the signed URL ────────────────────────────
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

    // Update pages_extracted immediately so the UI can show expected count
    await supabase
      .from("rv_record_sources")
      .update({ pages_extracted: pages.length })
      .eq("id", record_source_id);

    // ── 4. Insert rv_pages in batches ──────────────────────────────────────
    await log("pages_inserting", `Inserting ${pages.length} pages into database`);

    let totalConfidence = 0;
    let confidenceCount = 0;
    let insertedCount = 0;

    for (let i = 0; i < pages.length; i += PAGE_INSERT_CHUNK) {
      const chunk = pages.slice(i, i + PAGE_INSERT_CHUNK);

      const rows = chunk.map((page) => {
        const conf = page.confidence ?? null;
        if (conf !== null) {
          totalConfidence += conf;
          confidenceCount++;
        }
        return {
          record_source_id: source.id,
          aircraft_id:      source.aircraft_id,
          page_number:      page.index + 1,   // 1-based for display
          raw_ocr_text:     page.text ?? "",
          ocr_confidence:   conf,
          ocr_status:       "extracted" as const,
        };
      });

      const { error: insertErr } = await supabase
        .from("rv_pages")
        .upsert(rows, { onConflict: "record_source_id,page_number" });

      if (insertErr) {
        throw new Error(
          `Insert failed at chunk starting page ${i + 1}: ${insertErr.message}`
        );
      }

      insertedCount += rows.length;
    }

    // ── 5. Verify: count pages actually in the DB ─────────────────────────
    const { count: dbCount, error: countErr } = await supabase
      .from("rv_pages")
      .select("id", { count: "exact", head: true })
      .eq("record_source_id", record_source_id)
      .eq("ocr_status", "extracted");

    const pagesInDb = countErr ? null : (dbCount ?? 0);
    const avgConfidence =
      confidenceCount > 0 ? totalConfidence / confidenceCount : null;

    const isVerified = pagesInDb !== null && pagesInDb === pages.length;
    const verificationStatus = pagesInDb === null
      ? "partial"
      : pagesInDb === pages.length
        ? "verified"
        : "partial";

    if (isVerified) {
      await log(
        "verified",
        `✓ Verified: ${pagesInDb} of ${pages.length} pages confirmed in database`,
        pagesInDb
      );
    } else {
      await log(
        "partial",
        `⚠ Partial: ${pagesInDb ?? "?"} of ${pages.length} pages found in database — may need retry`,
        pagesInDb ?? undefined
      );
    }

    // ── 6. Mark source as indexed ─────────────────────────────────────────
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
      pages_extracted: pages.length,
      pages_in_db: pagesInDb,
      verification_status: verificationStatus,
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
