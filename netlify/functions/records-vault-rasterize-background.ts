// records-vault-rasterize-background — NO AUTH (internal trigger)
//
// Background function that downloads a PDF from S3, renders every page to JPEG
// using PDFium WASM, and uploads each page image to Supabase Storage. The
// viewer reads these images via records-vault-page-image-url, bypassing any
// browser codec limitations (JBIG2, CCITTFax, etc.) entirely.
//
// Invocation:
//   POST with body { recordSourceId }
//   Returns 202 immediately. Rasterization runs for up to 15 minutes.
//
// Storage output:
//   Supabase Storage bucket "records-vault"
//   Path: {recordSourceId}/pages/{pageNumber}.jpg
//
// PDFium is Google's PDF rendering engine — the same one Chrome ships — and
// handles every compression codec the web has ever seen. It's permissively
// licensed (BSD) and the WASM build is already used client-side in the upload
// modal.
//
// Environment variables required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)
//   TEXTRACT_REGION           — AWS region for S3 (e.g. "us-east-2")
//   TEXTRACT_KEY_ID           — IAM access key ID
//   TEXTRACT_SECRET_KEY       — IAM secret access key
//   TEXTRACT_S3_BUCKET        — S3 bucket holding the source PDFs

import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium";
import * as jpeg from "jpeg-js";

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

// ─── PDFium loader ────────────────────────────────────────────────────────────
// Cache the compiled module across warm invocations to avoid re-downloading
// and re-instantiating the WASM on every call.

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.13.0/dist/pdfium.wasm";

let pdfiumCache: WrappedPdfiumModule | null = null;

async function loadPdfium(): Promise<WrappedPdfiumModule> {
  if (pdfiumCache) return pdfiumCache;
  const resp = await fetch(WASM_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch PDFium WASM: HTTP ${resp.status}`);
  }
  const wasmBinary = await resp.arrayBuffer();
  pdfiumCache = await init({ wasmBinary });
  pdfiumCache.PDFiumExt_Init();
  return pdfiumCache;
}

// ─── Rasterize one page to a JPEG buffer ──────────────────────────────────────

const DPI = 150;
const JPEG_QUALITY = 85;

function rasterizePage(
  pdfium: WrappedPdfiumModule,
  doc: number,
  pageIndex: number,
): Buffer {
  const page = pdfium.FPDF_LoadPage(doc, pageIndex);
  if (!page) throw new Error(`PDFium failed to load page ${pageIndex + 1}`);

  try {
    const widthPt  = pdfium.FPDF_GetPageWidthF(page);
    const heightPt = pdfium.FPDF_GetPageHeightF(page);
    const pxW = Math.round((widthPt  * DPI) / 72);
    const pxH = Math.round((heightPt * DPI) / 72);

    // Guardrails — refuse absurd dimensions to avoid OOM
    if (pxW <= 0 || pxH <= 0 || pxW > 10000 || pxH > 10000) {
      throw new Error(`Page ${pageIndex + 1} dimensions out of range: ${pxW}×${pxH}`);
    }

    // Format 0 → BGRx (no alpha). Fill white, render with annotations + print quality
    const bitmap = pdfium.FPDFBitmap_Create(pxW, pxH, 0);
    if (!bitmap) throw new Error("PDFium bitmap allocation failed");

    try {
      pdfium.FPDFBitmap_FillRect(bitmap, 0, 0, pxW, pxH, 0xffffffff);
      pdfium.FPDF_RenderPageBitmap(
        bitmap, page, 0, 0, pxW, pxH, 0,
        0x01 /* FPDF_ANNOT */ | 0x800 /* FPDF_PRINTING */,
      );

      const bufPtr = pdfium.FPDFBitmap_GetBuffer(bitmap);
      const stride = pdfium.FPDFBitmap_GetStride(bitmap);

      // HEAPU8 lives on the underlying emscripten module — not in the public
      // WrappedPdfiumModule types but present at runtime.
      const heap = (pdfium as unknown as { pdfium: { HEAPU8: Uint8Array } }).pdfium.HEAPU8;

      // Copy out of WASM memory before we free it. Source is BGRA byte order.
      const src = new Uint8Array(heap.buffer.slice(bufPtr, bufPtr + stride * pxH));

      // Convert BGRA → RGBA for jpeg-js
      const rgba = new Uint8Array(pxW * pxH * 4);
      for (let y = 0; y < pxH; y++) {
        for (let x = 0; x < pxW; x++) {
          const s = y * stride + x * 4;
          const d = (y * pxW + x) * 4;
          rgba[d]     = src[s + 2]; // R ← B
          rgba[d + 1] = src[s + 1]; // G
          rgba[d + 2] = src[s];     // B ← R
          rgba[d + 3] = 255;
        }
      }

      const encoded = jpeg.encode(
        { data: rgba, width: pxW, height: pxH },
        JPEG_QUALITY,
      );
      return Buffer.from(encoded.data);
    } finally {
      pdfium.FPDFBitmap_Destroy(bitmap);
    }
  } finally {
    pdfium.FPDF_ClosePage(page);
  }
}

// ─── Stream an S3 object body to a buffer ─────────────────────────────────────

async function s3ToBuffer(s3: S3Client, bucket: string, key: string): Promise<Buffer> {
  const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = resp.Body;
  if (!body) throw new Error(`S3 returned empty body for ${key}`);

  // aws-sdk v3 returns a Node Readable stream in Lambda
  const chunks: Buffer[] = [];
  const stream = body as AsyncIterable<Buffer | Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  if (event.httpMethod !== "POST")    return { statusCode: 405, body: "Method not allowed" };
  if (!event.body)                    return { statusCode: 400, body: "Empty body" };

  let payload: { recordSourceId?: string };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const recordSourceId = payload.recordSourceId?.trim();
  if (!recordSourceId) {
    return { statusCode: 400, body: "recordSourceId is required" };
  }

  // ── Env validation ────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const awsRegion   = process.env.TEXTRACT_REGION ?? "us-east-2";
  const awsKeyId    = process.env.TEXTRACT_KEY_ID;
  const awsSecret   = process.env.TEXTRACT_SECRET_KEY;
  const s3Bucket    = process.env.TEXTRACT_S3_BUCKET;

  if (!supabaseUrl || !serviceRole || !awsKeyId || !awsSecret || !s3Bucket) {
    console.error("[rasterize] Missing env vars");
    return { statusCode: 500, body: "Server configuration error" };
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const s3 = new S3Client({
    region: awsRegion,
    credentials: { accessKeyId: awsKeyId, secretAccessKey: awsSecret },
  });

  async function log(step: string, message: string, page_count?: number): Promise<void> {
    try {
      await supabase.from("rv_ingestion_log").insert({
        record_source_id: recordSourceId,
        step,
        message,
        page_count: page_count ?? null,
      });
    } catch (err) {
      console.error("[rasterize] log insert failed:", err);
    }
  }

  // Outer safety net — any throw below this point writes rasterize_error so
  // the UI's Pipeline tab doesn't stick at "rasterizing…" forever. Without
  // this, a crash before line 319 leaves the user guessing what went wrong.
  try {
  // ── 1. Look up the record source ──────────────────────────────────────────
  const { data: source, error: sourceErr } = await supabase
    .from("rv_record_sources")
    .select("id, s3_key, storage_path, original_filename")
    .eq("id", recordSourceId)
    .maybeSingle();

  if (sourceErr || !source) {
    console.error(`[rasterize] Record source not found: ${recordSourceId}`);
    return { statusCode: 404, body: "Record source not found" };
  }

  if (!source.s3_key) {
    // Only S3-ingested docs need server-side rasterization — client-side
    // upload path (RecordsUploadModal) already produces JPEGs via PDFium.
    await log("rasterize_skipped", "No s3_key on record source — skipping rasterization");
    return { statusCode: 200, body: "No s3_key" };
  }

  console.log(`[rasterize] Starting for ${recordSourceId} (${source.original_filename})`);
  await log("rasterize_started", `Downloading PDF from s3://${s3Bucket}/${source.s3_key}`);

  // ── 2. Download the PDF from S3 ───────────────────────────────────────────
  let pdfBytes: Buffer;
  try {
    pdfBytes = await s3ToBuffer(s3, s3Bucket, source.s3_key);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rasterize] S3 download failed for ${source.s3_key}:`, msg);
    await log("rasterize_error", `S3 download failed: ${msg}`);
    return { statusCode: 500, body: "S3 download failed" };
  }

  await log("rasterize_started", `PDF downloaded (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB) — loading PDFium`);

  // ── 3. Load PDFium and open the document ──────────────────────────────────
  let pdfium: WrappedPdfiumModule;
  try {
    pdfium = await loadPdfium();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[rasterize] PDFium load failed:", msg);
    await log("rasterize_error", `PDFium load failed: ${msg}`);
    return { statusCode: 500, body: "PDFium load failed" };
  }

  // Copy PDF into WASM memory
  const wasm = (pdfium as unknown as {
    pdfium: {
      HEAPU8: Uint8Array;
      wasmExports: { malloc: (n: number) => number; free: (p: number) => void };
    };
  }).pdfium;
  const dataPtr = wasm.wasmExports.malloc(pdfBytes.length);
  wasm.HEAPU8.set(pdfBytes, dataPtr);

  const doc = pdfium.FPDF_LoadMemDocument(dataPtr, pdfBytes.length, "");
  if (!doc) {
    wasm.wasmExports.free(dataPtr);
    await log("rasterize_error", "PDFium failed to open document");
    return { statusCode: 500, body: "PDFium failed to open document" };
  }

  const pageCount = pdfium.FPDF_GetPageCount(doc);
  await log("rasterize_started", `PDFium opened document: ${pageCount} pages`, pageCount);

  // ── 4. Render each page and upload to Supabase Storage ────────────────────
  const storage = supabase.storage.from("records-vault");
  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < pageCount; i++) {
    const pageNumber = i + 1;

    try {
      const jpegBuf = rasterizePage(pdfium, doc, i);
      const storagePath = `${recordSourceId}/pages/${pageNumber}.jpg`;

      const { error: uploadErr } = await storage.upload(storagePath, jpegBuf, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (uploadErr) {
        throw new Error(`Supabase upload failed: ${uploadErr.message}`);
      }

      succeeded++;

      // Progress log every 10 pages (and on the first page)
      if (pageNumber === 1 || pageNumber % 10 === 0 || pageNumber === pageCount) {
        await log(
          "rasterize_progress",
          `Rendered page ${pageNumber}/${pageCount} (${(jpegBuf.length / 1024).toFixed(0)} KB)`,
          pageNumber,
        );
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[rasterize] Page ${pageNumber} failed:`, msg);
      await log("rasterize_error", `Page ${pageNumber} failed: ${msg}`, pageNumber);
      // Continue — partial pages are still useful
    }
  }

  // ── 5. Clean up PDFium resources ──────────────────────────────────────────
  pdfium.FPDF_CloseDocument(doc);
  wasm.wasmExports.free(dataPtr);

  // ── 6. Final log ──────────────────────────────────────────────────────────
  const summary = `✓ Rasterization complete — ${succeeded}/${pageCount} pages stored${failed > 0 ? ` (${failed} failed)` : ""}`;
  await log("rasterize_complete", summary, succeeded);
  console.log(`[rasterize] ${recordSourceId}: ${summary}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ recordSourceId, pageCount, succeeded, failed }),
  };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    console.error(`[rasterize] Fatal for ${recordSourceId}:`, msg, stack);
    await log("rasterize_error", `Fatal: ${msg}`);
    return { statusCode: 500, body: JSON.stringify({ error: msg }) };
  }
};
