/**
 * process-record-source — Supabase Edge Function
 *
 * Called by records-vault-register Netlify function (fire-and-forget).
 * Downloads the uploaded PDF from Storage, sends it to Mistral OCR,
 * and populates rv_pages rows for full-text search.
 *
 * Auth: caller must provide SUPABASE_SERVICE_ROLE_KEY as Bearer token.
 * The Edge Function uses the service role client to bypass RLS when
 * writing rv_pages rows.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY")!;

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
// Mistral OCR processes up to 1000 pages per request; we chunk at 50
// to stay comfortably inside the 150s Edge Function timeout.
const CHUNK_SIZE = 50;

interface ProcessRequest {
  record_source_id: string;
}

interface MistralOcrPage {
  index: number;       // 0-based page index
  text: string;
  confidence?: number; // 0–1, not always present
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Verify caller is our own Netlify function using service role key
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ProcessRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { record_source_id } = body;
  if (!record_source_id) {
    return new Response(JSON.stringify({ error: "record_source_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Mark as extracting
  await supabase
    .from("rv_record_sources")
    .update({ ingestion_status: "extracting" })
    .eq("id", record_source_id);

  try {
    // Fetch the source record to get storage path + aircraft_id
    const { data: source, error: sourceErr } = await supabase
      .from("rv_record_sources")
      .select("id, aircraft_id, storage_path, original_filename")
      .eq("id", record_source_id)
      .single();

    if (sourceErr || !source) {
      throw new Error(`Source record not found: ${sourceErr?.message}`);
    }

    // Download the PDF from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("records-vault")
      .download(source.storage_path);

    if (downloadErr || !fileData) {
      throw new Error(`Storage download failed: ${downloadErr?.message}`);
    }

    const pdfBytes = await fileData.arrayBuffer();
    const pdfBase64 = btoa(
      String.fromCharCode(...new Uint8Array(pdfBytes))
    );

    // Call Mistral OCR — send the full PDF, get per-page text back
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
          // Mistral accepts base64 PDF via data URI
          document_url: `data:application/pdf;base64,${pdfBase64}`,
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
      throw new Error("Mistral OCR returned zero pages");
    }

    // Insert rv_pages in chunks to avoid hitting insert limits
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
      const chunk = pages.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map((page) => {
        const conf = page.confidence ?? null;
        if (conf !== null) {
          totalConfidence += conf;
          confidenceCount++;
        }
        return {
          record_source_id: source.id,
          aircraft_id: source.aircraft_id,
          page_number: page.index + 1,   // store 1-based for display
          raw_ocr_text: page.text ?? "",
          ocr_confidence: conf,
          ocr_status: "extracted" as const,
        };
      });

      const { error: insertErr } = await supabase
        .from("rv_pages")
        .upsert(rows, { onConflict: "record_source_id,page_number" });

      if (insertErr) {
        throw new Error(`Failed to insert pages chunk starting at ${i}: ${insertErr.message}`);
      }
    }

    const avgConfidence =
      confidenceCount > 0 ? totalConfidence / confidenceCount : null;

    // Mark source as indexed
    await supabase
      .from("rv_record_sources")
      .update({
        ingestion_status: "indexed",
        page_count: pages.length,
        ocr_quality_score: avgConfidence,
        ingestion_error: null,
      })
      .eq("id", record_source_id);

    return new Response(
      JSON.stringify({ success: true, pages_processed: pages.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process-record-source] Failed for ${record_source_id}:`, message);

    await supabase
      .from("rv_record_sources")
      .update({
        ingestion_status: "failed",
        ingestion_error: message,
      })
      .eq("id", record_source_id);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
