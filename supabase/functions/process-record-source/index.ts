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
  /** When true, the client pre-rendered page images via PDFium WASM and
   *  uploaded them to Storage. Skip Mistral image extraction entirely. */
  page_images_pre_uploaded?: boolean;
}

interface MistralBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MistralOcrWord {
  text: string;
  bbox: MistralBoundingBox;
  confidence?: number;
}

interface MistralOcrPage {
  index: number;
  markdown?: string;
  text?: string;
  confidence?: number;
  // Mistral OCR returns page dimensions and image data when requested
  dimensions?: { width: number; height: number; dpi?: number };
  images?: Array<{ id: string; image_base64?: string }>;
  // Word/block-level bounding boxes (if available in response)
  words?: MistralOcrWord[];
  // Some Mistral versions return blocks instead of words
  blocks?: Array<{
    text: string;
    bbox: MistralBoundingBox;
    words?: MistralOcrWord[];
  }>;
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
}

interface ExtractedMetadata {
  date_range_start: string | null;
  date_range_end: string | null;
  observed_registration: string | null;
}

// ─── Codec detection ─────────────────────────────────────────────────────────

/**
 * Streams the PDF from its URL and scans for /JBIG2Decode or /CCITTFaxDecode
 * filter declarations. These compression codecs are used in scanned aviation
 * documents and cannot be rendered by PDF.js — when detected, the pipeline
 * stores pre-rendered page images as a rendering backup.
 *
 * Streams in chunks to avoid holding the full PDF in memory. Cancels the
 * download as soon as a match is found.
 */
async function pdfHasProblematicCodec(url: string): Promise<{ found: boolean; codec: string | null }> {
  const needles = ["/JBIG2Decode", "/CCITTFaxDecode"];
  const maxNeedleLen = Math.max(...needles.map((n) => n.length));

  try {
    const resp = await fetch(url);
    if (!resp.ok || !resp.body) return { found: false, codec: null };

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("ascii", { fatal: false });
    let overlap = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode chunk as ASCII (PDF structure tokens are ASCII)
      const chunk = overlap + decoder.decode(value, { stream: true });

      for (const needle of needles) {
        if (chunk.includes(needle)) {
          await reader.cancel();
          return { found: true, codec: needle.slice(1) }; // strip leading "/"
        }
      }

      // Keep tail overlap so needles split across chunk boundaries are caught
      overlap = chunk.slice(-maxNeedleLen);
    }
  } catch (err) {
    console.warn("[process-record-source] Codec scan failed, assuming standard PDF:", err);
  }

  return { found: false, codec: null };
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

  const { record_source_id, page_images_pre_uploaded } = body;
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

    // Detect file type — images use image_url, PDFs use document_url
    const lowerFilename = source.original_filename.toLowerCase();
    const isImage = /\.(jpg|jpeg|png|tiff|tif|webp|bmp)$/.test(lowerFilename);

    // ── 2b. Scan PDF for problematic compression codecs ───────────────────
    // JBIG2 and CCITTFax are used in scanned aviation documents but PDF.js
    // cannot decode them. When detected, we request page images from Mistral
    // and store them as the rendering backup path.
    let needsPageImages = false;
    let detectedCodec: string | null = null;
    const imagesAlreadyUploaded = !!page_images_pre_uploaded;

    if (!isImage) {
      const codecResult = await pdfHasProblematicCodec(signedData.signedUrl);
      needsPageImages = codecResult.found;
      detectedCodec = codecResult.codec;

      if (imagesAlreadyUploaded) {
        await log("codec_scan", `${detectedCodec ?? "Codec"} detected — page images pre-rendered by client (PDFium WASM), skipping Mistral images`);
      } else if (needsPageImages) {
        await log("codec_scan", `⚠ ${detectedCodec} compression detected — will store page images as rendering backup`);
      } else {
        await log("codec_scan", `Standard PDF compression — PDF.js will handle rendering directly`);
      }
    } else {
      // Single images always need the image stored for viewing
      needsPageImages = true;
    }

    await log("ocr_submitted", `${isImage ? "Image" : "PDF"} URL sent to Mistral OCR — awaiting response`);

    // ── 3. Call Mistral OCR ───��──────────────────���─────────────────────────
    const documentPayload = isImage
      ? { type: "image_url", image_url: signedData.signedUrl }
      : { type: "document_url", document_url: signedData.signedUrl };

    const mistralResponse = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: documentPayload,
        // Only request page images when the PDF uses codecs PDF.js can't handle
        // AND the client hasn't already pre-rendered them with PDFium WASM.
        include_image_base64: needsPageImages && !imagesAlreadyUploaded,
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

        // Extract word/block-level bounding boxes for search highlighting
        let wordPositions: MistralOcrWord[] | null = null;
        if (page.words && page.words.length > 0) {
          wordPositions = page.words;
        } else if (page.blocks && page.blocks.length > 0) {
          // Flatten blocks → words if Mistral returns block-level data
          wordPositions = page.blocks.flatMap((block) =>
            block.words && block.words.length > 0
              ? block.words
              : [{ text: block.text, bbox: block.bbox }]
          );
        }

        // Only include word_positions/page_dimensions if Mistral actually returned them.
        // When null, omit from upsert so client-uploaded Tesseract data is preserved.
        return {
          record_source_id: source.id,
          aircraft_id:      source.aircraft_id,
          page_number:      page.index + 1,
          raw_ocr_text:     page.markdown ?? page.text ?? "",
          ocr_confidence:   conf,
          ocr_status:       "extracted" as const,
          ...(page.dimensions ? { page_dimensions: page.dimensions } : {}),
          ...(wordPositions  ? { word_positions: wordPositions }     : {}),
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

    // ── 5b. Upload page images to Storage (only for problematic codecs) ──
    // Only runs when step 2b detected JBIG2/CCITTFax compression that PDF.js
    // cannot decode. For standard PDFs, page images are skipped entirely —
    // PDF.js handles rendering directly with full text-layer highlighting.
    //
    // When the client pre-rendered images with PDFium WASM, we skip Mistral
    // image extraction entirely and just set page_image_path on the pages.
    let pageImagesUploaded = 0;

    if (imagesAlreadyUploaded) {
      // Client already uploaded page images — just update rv_pages with paths
      for (let i = 0; i < pages.length; i++) {
        const imagePath = `${source.id}/pages/${i + 1}.jpg`;
        await supabase
          .from("rv_pages")
          .update({ page_image_path: imagePath })
          .eq("record_source_id", source.id)
          .eq("page_number", i + 1);
        pageImagesUploaded++;
      }
      await log("render_decision",
        `Rendering: ${detectedCodec ?? "problematic codec"} detected → ${pageImagesUploaded} page images pre-rendered by client (PDFium WASM). Viewer will use images with text overlay highlighting.`,
        pageImagesUploaded);
    }

    for (const page of pages) {
      if (imagesAlreadyUploaded) break; // Already handled above
      if (!needsPageImages) break; // Skip entirely for standard PDFs
      if (!page.images || page.images.length === 0) continue;

      // Use the first image (for scanned docs, this is the full page scan)
      const img = page.images[0];
      const raw = img.image_base64;
      if (!raw) continue;

      try {
        // Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
        const base64Data = raw.includes(",") ? raw.split(",")[1] : raw;
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }

        // Detect format from first bytes (JPEG: FF D8, PNG: 89 50 4E 47)
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const ext = isPng ? "png" : "jpg";
        const contentType = isPng ? "image/png" : "image/jpeg";

        const imagePath = `${source.id}/pages/${page.index + 1}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("records-vault")
          .upload(imagePath, bytes, { contentType, upsert: true });

        if (uploadErr) {
          console.warn(`[process-record-source] Image upload failed for page ${page.index + 1}:`, uploadErr.message);
          continue;
        }

        // Update the page row with the image path
        await supabase
          .from("rv_pages")
          .update({ page_image_path: imagePath })
          .eq("record_source_id", source.id)
          .eq("page_number", page.index + 1);

        pageImagesUploaded++;
      } catch (imgErr) {
        console.warn(`[process-record-source] Image processing failed for page ${page.index + 1}:`, imgErr);
      }
    }

    // ── 5c. Log rendering decision ────────────────────────────────────────
    // Make the rendering path visible in pipeline logs so operators can see
    // exactly how each document will be displayed in the viewer.
    const totalPages = pages.length;

    if (!imagesAlreadyUploaded) {
      // Only log if we haven't already logged in the pre-uploaded branch above
      if (needsPageImages && pageImagesUploaded > 0) {
        const codecLabel = detectedCodec ?? "problematic codec";
        await log("render_decision",
          `Rendering: ${codecLabel} detected → ${pageImagesUploaded}/${totalPages} page images stored as backup. PDF.js cannot decode this format; viewer will use images with text overlay highlighting.`,
          pageImagesUploaded);
      } else if (needsPageImages && pageImagesUploaded === 0) {
        await log("render_decision",
          `Rendering: problematic codec detected but no page images returned by OCR — pages may not render correctly. Consider re-ingesting.`,
          0);
      } else {
        await log("render_decision",
          `Rendering: standard PDF → all ${totalPages} pages use PDF.js with native text-layer highlighting`,
          totalPages);
      }
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
        // When images were pre-uploaded by the client, preserve that count
        // instead of overwriting with Mistral's (partial) image count.
        ...(imagesAlreadyUploaded ? {} : { page_images_stored: pageImagesUploaded }),
        verification_status:    verificationStatus,
        ocr_quality_score:      avgConfidence,
        ingestion_error:        null,
        ingestion_completed_at: new Date().toISOString(),
      })
      .eq("id", record_source_id);

    // ── 8. Chain post-OCR pipeline: events THEN embeddings (sequential) ──
    // Both are independent consumers of rv_pages but they hit different
    // AI APIs (Claude Haiku for events, Voyage AI for embeddings). Running
    // them sequentially prevents rate-limit collisions when multiple
    // documents are processing concurrently.
    // EdgeRuntime.waitUntil keeps the work alive after the HTTP response.
    const postOcrHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    };
    const postOcrBody = JSON.stringify({ record_source_id });
    const edgeBase    = `${SUPABASE_URL}/functions/v1`;

    const postOcrWork = (async () => {
      // Phase 1: Event extraction (Claude Haiku)
      try {
        const evtResp = await fetch(`${edgeBase}/extract-record-events`, {
          method: "POST", headers: postOcrHeaders, body: postOcrBody,
        });
        if (!evtResp.ok) {
          console.error(`[process-record-source] extract-record-events HTTP ${evtResp.status}`);
        }
      } catch (err) {
        console.error(`[process-record-source] extract-record-events trigger failed:`, err);
      }

      // Phase 2: Embedding generation (Voyage AI) — starts after events finish
      try {
        const embResp = await fetch(`${edgeBase}/generate-page-embeddings`, {
          method: "POST", headers: postOcrHeaders, body: postOcrBody,
        });
        if (!embResp.ok) {
          console.error(`[process-record-source] generate-page-embeddings HTTP ${embResp.status}`);
        }
      } catch (err) {
        console.error(`[process-record-source] generate-page-embeddings trigger failed:`, err);
      }
    })();

    try {
      // @ts-ignore — EdgeRuntime.waitUntil is available in Supabase Edge Function runtime
      EdgeRuntime.waitUntil(postOcrWork);
    } catch {
      // Local dev fallback — don't block the response
      postOcrWork.catch(() => {});
    }

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
