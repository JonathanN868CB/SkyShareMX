/**
 * generate-page-embeddings — Supabase Edge Function
 *
 * Reads rv_pages OCR text for a record source, splits into overlapping
 * chunks, generates Voyage AI embeddings (voyage-3, 1024 dims), and
 * upserts into rv_page_chunks.
 *
 * Called fire-and-forget from records-vault-register after OCR completes,
 * in parallel with extract-record-events.
 *
 * Auth: verify_jwt=false — caller must pass service role key in Authorization.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VOYAGE_API_KEY   = Deno.env.get("VOYAGE_API_KEY")!;

const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL     = "voyage-3";

// Chunking parameters
const MAX_CHUNK_CHARS  = 1800;  // ~450 tokens at avg 4 chars/token
const OVERLAP_CHARS    = 200;   // overlap between consecutive chunks
const EMBED_BATCH_SIZE = 64;    // Voyage AI accepts up to 128; 64 is safe

interface EmbedRequest {
  record_source_id: string;
}

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Text chunker ─────────────────────────────────────────────────────────────
// Splits text into overlapping segments. Short pages stay as a single chunk.
// Aviation documents have dense maintenance text — overlap preserves context
// across sentence boundaries (e.g., a P/N that spans a split point).

function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= MAX_CHUNK_CHARS) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + MAX_CHUNK_CHARS, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end >= trimmed.length) break;
    start = end - OVERLAP_CHARS;
  }
  return chunks;
}

// ─── Voyage AI embeddings ─────────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const resp = await fetch(VOYAGE_EMBED_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input:      texts,
      model:      VOYAGE_MODEL,
      input_type: "document",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Voyage AI error ${resp.status}: ${err}`);
  }

  const result = await resp.json() as {
    data: { index: number; embedding: number[] }[];
  };

  // Sort by index to ensure correct order
  return result.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  let body: EmbedRequest;
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

  async function log(step: string, message: string): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({ record_source_id, step, message });
  }

  // Mark as chunking
  await supabase
    .from("rv_record_sources")
    .update({ chunk_status: "chunking" })
    .eq("id", record_source_id);

  try {
    // ── 1. Fetch source info + all indexed pages ───────────────────────────
    const { data: source, error: srcErr } = await supabase
      .from("rv_record_sources")
      .select("id, aircraft_id, original_filename, source_category")
      .eq("id", record_source_id)
      .single();

    if (srcErr || !source) {
      throw new Error(`Source not found: ${srcErr?.message}`);
    }

    const { data: pages, error: pagesErr } = await supabase
      .from("rv_pages")
      .select("id, page_number, raw_ocr_text")
      .eq("record_source_id", record_source_id)
      .eq("ocr_status", "extracted")
      .order("page_number", { ascending: true });

    if (pagesErr || !pages || pages.length === 0) {
      throw new Error(`No indexed pages found: ${pagesErr?.message ?? "empty"}`);
    }

    // ── 2. Build chunk records ─────────────────────────────────────────────
    // Each chunk gets a context prefix so the embedding captures provenance.
    // The prefix is lightweight — main semantic content is the OCR text.
    type ChunkRecord = {
      page_id: string;
      aircraft_id: string;
      record_source_id: string;
      chunk_index: number;
      chunk_text: string;
      embedding: string; // pgvector format: "[0.1, 0.2, ...]"
    };

    const pendingChunks: { pageId: string; chunkIndex: number; text: string }[] = [];

    for (const page of pages) {
      const prefix = `[${source.source_category} | p.${page.page_number}]`;
      const fullText = page.raw_ocr_text?.trim() ? `${prefix} ${page.raw_ocr_text.trim()}` : "";
      const chunks = chunkText(fullText);

      chunks.forEach((text, idx) => {
        pendingChunks.push({ pageId: page.id, chunkIndex: idx, text });
      });
    }

    if (pendingChunks.length === 0) {
      await supabase
        .from("rv_record_sources")
        .update({ chunk_status: "chunked", chunks_generated: 0 })
        .eq("id", record_source_id);
      await log("embeddings_complete", "No text to embed — 0 chunks generated");
      return jsonResp(200, { success: true, chunks_generated: 0, note: "No text to embed" });
    }

    await log("embeddings_chunking", `Splitting ${pages.length} pages into ${pendingChunks.length} chunks for Voyage AI embedding`);

    // ── 3. Delete existing chunks for idempotency ──────────────────────────
    await supabase
      .from("rv_page_chunks")
      .delete()
      .eq("record_source_id", record_source_id);

    // ── 4. Embed in batches + insert ───────────────────────────────────────
    let totalInserted = 0;

    for (let i = 0; i < pendingChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = pendingChunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => c.text);

      const embeddings = await embedBatch(texts);

      const rows: ChunkRecord[] = batch.map((chunk, batchIdx) => ({
        page_id:          chunk.pageId,
        aircraft_id:      source.aircraft_id,
        record_source_id: record_source_id,
        chunk_index:      chunk.chunkIndex,
        chunk_text:       chunk.text,
        // pgvector expects "[n1,n2,...]"
        embedding:        `[${embeddings[batchIdx].join(",")}]`,
      }));

      const { error: insertErr } = await supabase
        .from("rv_page_chunks")
        .insert(rows);

      if (insertErr) {
        throw new Error(`Insert failed at batch ${i}: ${insertErr.message}`);
      }

      totalInserted += rows.length;
    }

    // ── 5. Mark complete ───────────────────────────────────────────────────
    await supabase
      .from("rv_record_sources")
      .update({ chunk_status: "chunked", chunks_generated: totalInserted })
      .eq("id", record_source_id);

    await log("embeddings_complete", `✓ Generated ${totalInserted} vector embedding${totalInserted !== 1 ? "s" : ""} from ${pages.length} pages`);

    console.log(`[generate-page-embeddings] ${record_source_id}: ${totalInserted} chunks from ${pages.length} pages`);

    return jsonResp(200, {
      success:          true,
      pages_processed:  pages.length,
      chunks_generated: totalInserted,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[generate-page-embeddings] Failed for ${record_source_id}:`, message);

    await log("embeddings_failed", `Vector embedding failed: ${message}`);

    await supabase
      .from("rv_record_sources")
      .update({ chunk_status: "failed" })
      .eq("id", record_source_id);

    return jsonResp(500, { error: message });
  }
});
