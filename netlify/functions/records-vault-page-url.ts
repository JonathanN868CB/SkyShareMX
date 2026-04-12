// records-vault-page-url — AUTH REQUIRED
//
// Returns a short-lived signed URL for viewing a PDF page.
//
// Supabase Storage is the only retrieval origin. S3 is used exclusively for
// ingest (records-vault-s3-ingest + records-vault-rasterize-background); once
// the rasterizer has mirrored the PDF to Supabase, every retrieval path reads
// from storage_path. Do not add S3 fallbacks here.
//
// If `pageNumber` is provided:
//   - Checks for a cached single-page PDF at page-cache/{id}/{page}.pdf
//   - On cache miss: downloads full PDF, extracts the page with pdf-lib,
//     uploads the single-page PDF to the cache, then returns its signed URL
//   - Cache hit path: sub-100ms response; cache miss path: 3–10s (one-time)
//
// If `pageNumber` is omitted: returns a signed URL for the full source PDF.
//
// Single-page PDF serving solves the primary lag issue: the browser downloads
// a 100-500 KB page file instead of a 50-200 MB complete document.

import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getAccessToken(event: HandlerEvent): string | null {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const [scheme, ...rest] = parts;
  if (!/^bearer$/i.test(scheme)) return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 60 minutes
const PAGE_CACHE_PREFIX = "page-cache";

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const accessToken = getAccessToken(event);
  if (!accessToken) {
    return jsonResponse(401, { error: "Authentication required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  // Verify caller session
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid or expired session" });
  }

  if (!event.body) {
    return jsonResponse(400, { error: "Missing request body" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId.trim() : "";
  if (!recordSourceId) {
    return jsonResponse(400, { error: "recordSourceId is required" });
  }

  const pageNumber = typeof payload.pageNumber === "number" ? Math.floor(payload.pageNumber) : null;

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the user has Records Vault permission via RLS
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: source, error: sourceErr } = await userClient
    .from("rv_record_sources")
    .select("id, storage_path")
    .eq("id", recordSourceId)
    .single();

  if (sourceErr || !source) {
    return jsonResponse(404, { error: "Record source not found or access denied" });
  }

  // Supabase is the only retrieval origin. S3-ingested documents must have
  // their storage_path set by the rasterizer (records-vault-rasterize-background).
  // If it's missing, rasterization hasn't finished mirroring the PDF yet.
  if (!source.storage_path) {
    return jsonResponse(404, { error: "Document file not available" });
  }

  // ── No page number → full PDF signed URL (Supabase Storage) ─────────────────
  if (pageNumber === null || pageNumber < 1) {
    const { data, error: urlError } = await adminClient.storage
      .from("records-vault")
      .createSignedUrl(source.storage_path, SIGNED_URL_EXPIRY_SECONDS);

    if (urlError || !data?.signedUrl) {
      return jsonResponse(500, { error: "Failed to generate download URL" });
    }
    return jsonResponse(200, { signedUrl: data.signedUrl });
  }

  // ── Page number provided → single-page cached PDF ──────────────────────────
  const cachePath = `${PAGE_CACHE_PREFIX}/${recordSourceId}/${pageNumber}.pdf`;

  // Check cache first
  const { data: cacheList } = await adminClient.storage
    .from("records-vault")
    .list(`${PAGE_CACHE_PREFIX}/${recordSourceId}`, {
      limit: 1,
      search: `${pageNumber}.pdf`,
    });

  const isCached = cacheList?.some((f) => f.name === `${pageNumber}.pdf`) ?? false;

  if (isCached) {
    const { data: cachedUrl, error: cachedErr } = await adminClient.storage
      .from("records-vault")
      .createSignedUrl(cachePath, SIGNED_URL_EXPIRY_SECONDS);

    if (!cachedErr && cachedUrl?.signedUrl) {
      return jsonResponse(200, { signedUrl: cachedUrl.signedUrl, cached: true });
    }
    // Fall through to extraction if signed URL generation unexpectedly failed
  }

  // Cache miss — download full PDF, extract the page, upload to cache
  const { data: fullPdfBlob, error: downloadError } = await adminClient.storage
    .from("records-vault")
    .download(source.storage_path);

  if (downloadError || !fullPdfBlob) {
    // Fallback: serve the full PDF with page anchor
    const { data: fallback, error: fallbackErr } = await adminClient.storage
      .from("records-vault")
      .createSignedUrl(source.storage_path, SIGNED_URL_EXPIRY_SECONDS);

    if (fallbackErr || !fallback?.signedUrl) {
      return jsonResponse(500, { error: "Failed to load source PDF" });
    }
    return jsonResponse(200, { signedUrl: fallback.signedUrl, fallback: true });
  }

  try {
    const pdfBytes = await fullPdfBlob.arrayBuffer();
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();
    const pageIdx = pageNumber - 1; // pdf-lib uses 0-based index

    if (pageIdx < 0 || pageIdx >= totalPages) {
      return jsonResponse(400, { error: `Page ${pageNumber} out of range (total: ${totalPages})` });
    }

    // Extract the single page into its own document
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [pageIdx]);
    singlePageDoc.addPage(copiedPage);
    const singlePageBytes = await singlePageDoc.save();

    // Upload to cache
    const { error: uploadError } = await adminClient.storage
      .from("records-vault")
      .upload(cachePath, singlePageBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[records-vault-page-url] Cache upload failed for ${cachePath}:`, uploadError.message);
      // Still return what we have — fall back to full PDF
      const { data: fallback } = await adminClient.storage
        .from("records-vault")
        .createSignedUrl(source.storage_path, SIGNED_URL_EXPIRY_SECONDS);
      if (fallback?.signedUrl) {
        return jsonResponse(200, { signedUrl: fallback.signedUrl, fallback: true });
      }
      return jsonResponse(500, { error: "Failed to cache extracted page" });
    }

    const { data: pageUrlData, error: pageUrlError } = await adminClient.storage
      .from("records-vault")
      .createSignedUrl(cachePath, SIGNED_URL_EXPIRY_SECONDS);

    if (pageUrlError || !pageUrlData?.signedUrl) {
      return jsonResponse(500, { error: "Failed to generate signed URL for cached page" });
    }

    return jsonResponse(200, { signedUrl: pageUrlData.signedUrl, cached: false });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[records-vault-page-url] Page extraction failed:`, message);

    // Fallback: serve full PDF
    const { data: fallback } = await adminClient.storage
      .from("records-vault")
      .createSignedUrl(source.storage_path, SIGNED_URL_EXPIRY_SECONDS);
    if (fallback?.signedUrl) {
      return jsonResponse(200, { signedUrl: fallback.signedUrl, fallback: true });
    }
    return jsonResponse(500, { error: "Page extraction failed" });
  }
};
