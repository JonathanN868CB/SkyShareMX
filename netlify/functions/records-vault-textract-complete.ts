// records-vault-textract-complete — NO AUTH (SNS webhook)
//
// Receives Textract async job completion notifications from AWS SNS.
// When a job succeeds, fetches all blocks via paginated GetDocumentAnalysis,
// processes them into per-page structured data, and stores results to Supabase.
//
// Per page this function stores:
//   rv_pages.raw_ocr_text     — reconstructed from LINE blocks (sorted top→bottom)
//   rv_pages.word_geometry    — WORD blocks with normalized bounding boxes + confidence
//   rv_pages.tables_extracted — TABLE/CELL grid structures
//   rv_pages.forms_extracted  — KEY_VALUE_SET pairs from AnalyzeForms
//   rv_pages.page_dimensions  — page width/height from PAGE block geometry (normalized)
//
// After all pages are stored:
//   - Computes ocr_quality_score (mean WORD confidence)
//   - Triggers extract-record-events (Phase 2, Claude Haiku)
//   - Triggers generate-page-embeddings (Phase 3, Voyage AI)
//   - Updates rv_record_sources.ingestion_status → "indexed"
//
// The Textract completion notification format:
//   SNS message body → JSON with fields:
//     { JobId, Status, API, Timestamp, DocumentLocation: { S3ObjectName, S3Bucket } }
//
// Environment variables required:
//   TEXTRACT_REGION           — e.g. "us-east-2" (AWS_REGION is reserved by Netlify)
//   TEXTRACT_KEY_ID           — IAM access key ID (AWS_ACCESS_KEY_ID is reserved by Netlify)
//   TEXTRACT_SECRET_KEY       — IAM secret access key
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)

import { createClient } from "@supabase/supabase-js";
import {
  TextractClient,
  GetDocumentAnalysisCommand,
  type Block,
  BlockType,
  RelationshipType,
  SelectionStatus,
  JobStatus,
} from "@aws-sdk/client-textract";
import https from "https";
import crypto from "crypto";

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

// ─── Textract block processing types ─────────────────────────────────────────

interface WordGeometry {
  text:       string;
  confidence: number;
  geometry: {
    left:   number;
    top:    number;
    width:  number;
    height: number;
  };
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

interface ExtractedForm {
  key:             string;
  value:           string;
  keyConfidence:   number;
  valueConfidence: number;
}

interface CheckboxElement {
  selected:   boolean;
  confidence: number;
  geometry: {
    left:   number;
    top:    number;
    width:  number;
    height: number;
  };
  label:   string | null;   // adjacent key text (form) or null
  context: "form" | "table" | "inline";
}

// Per-page aggregated data built from the Textract block tree
interface PageData {
  pageNumber:    number;
  lines:         Array<{ text: string; top: number }>; // for raw_ocr_text reconstruction
  wordGeometry:  WordGeometry[];
  tables:        ExtractedTable[];
  forms:         ExtractedForm[];
  checkboxes:    CheckboxElement[];
  dimensions?:   { width: number; height: number };
}

// ─── SNS verification (same as s3-ingest) ────────────────────────────────────

interface SnsEnvelope {
  Type: "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
}

function buildSignatureString(msg: SnsEnvelope): string {
  const fields: Array<[string, string | undefined]> =
    msg.Type === "Notification"
      ? [
          ["Message",     msg.Message],
          ["MessageId",   msg.MessageId],
          ["Subject",     msg.Subject],
          ["Timestamp",   msg.Timestamp],
          ["TopicArn",    msg.TopicArn],
          ["Type",        msg.Type],
        ]
      : [
          ["Message",      msg.Message],
          ["MessageId",    msg.MessageId],
          ["SubscribeURL", msg.SubscribeURL],
          ["Timestamp",    msg.Timestamp],
          ["Token",        (msg as Record<string, string | undefined>)["Token"]],
          ["TopicArn",     msg.TopicArn],
          ["Type",         msg.Type],
        ];

  return fields
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}\n${v}\n`)
    .join("");
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function verifySnsSignature(msg: SnsEnvelope): Promise<boolean> {
  try {
    const certUrl = msg.SigningCertURL;
    if (!/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//.test(certUrl)) {
      console.error("[textract-complete] Untrusted SigningCertURL:", certUrl);
      return false;
    }
    const pem       = await fetchText(certUrl);
    const text      = buildSignatureString(msg);
    const sig       = Buffer.from(msg.Signature, "base64");
    const algorithm = msg.SignatureVersion === "2" ? "sha256" : "sha1";
    return crypto.createVerify(`RSA-${algorithm.toUpperCase()}`).update(text).verify(pem, sig);
  } catch (err) {
    console.error("[textract-complete] Signature verification error:", err);
    return false;
  }
}

// ─── Textract block processing ────────────────────────────────────────────────

/**
 * Fetches all blocks from a completed Textract job via paginated calls.
 * Returns the flat block array — all pages combined.
 */
async function fetchAllBlocks(textract: TextractClient, jobId: string): Promise<Block[]> {
  const blocks: Block[] = [];
  let nextToken: string | undefined = undefined;

  do {
    const cmd = new GetDocumentAnalysisCommand({
      JobId:     jobId,
      MaxResults: 1000,
      ...(nextToken ? { NextToken: nextToken } : {}),
    });

    const resp = await textract.send(cmd);
    blocks.push(...(resp.Blocks ?? []));
    nextToken = resp.NextToken;
  } while (nextToken);

  return blocks;
}

/**
 * Given a block's child relationship IDs, concatenates the text of WORD child blocks.
 * SELECTION_ELEMENT children are emitted as ☑ (SELECTED) or ☐ (NOT_SELECTED) so that
 * checkbox state flows naturally into forms_extracted and tables_extracted values.
 */
function getChildText(block: Block, blockMap: Map<string, Block>): string {
  const childIds = block.Relationships
    ?.filter((r) => r.Type === RelationshipType.CHILD)
    .flatMap((r) => r.Ids ?? []) ?? [];

  const parts: string[] = [];
  for (const id of childIds) {
    const child = blockMap.get(id);
    if (!child) continue;
    if (child.BlockType === BlockType.WORD) {
      parts.push(child.Text ?? "");
    } else if (child.BlockType === BlockType.SELECTION_ELEMENT) {
      parts.push(child.SelectionStatus === SelectionStatus.SELECTED ? "☑" : "☐");
    }
  }
  return parts.join(" ");
}

/**
 * Processes a flat array of Textract blocks into a per-page map of PageData.
 * Handles all four structured outputs: plain text, word geometry, tables, forms.
 */
function processBlocks(blocks: Block[]): Map<number, PageData> {
  // Build an id→block lookup for relationship traversal
  const blockMap = new Map<string, Block>();
  for (const block of blocks) {
    if (block.Id) blockMap.set(block.Id, block);
  }

  const pages = new Map<number, PageData>();

  function getPage(pageNumber: number): PageData {
    if (!pages.has(pageNumber)) {
      pages.set(pageNumber, {
        pageNumber,
        lines:        [],
        wordGeometry: [],
        tables:       [],
        forms:        [],
        checkboxes:   [],
      });
    }
    return pages.get(pageNumber)!;
  }

  // ── Pre-pass 1: child→parent map (for SELECTION_ELEMENT context lookup) ──────
  const parentMap = new Map<string, Block>();
  for (const block of blocks) {
    const childIds = block.Relationships
      ?.filter((r) => r.Type === RelationshipType.CHILD)
      .flatMap((r) => r.Ids ?? []) ?? [];
    for (const id of childIds) {
      parentMap.set(id, block);
    }
  }

  // ── Pre-pass 2: VALUE block ID → key label text (for form checkbox labels) ───
  // KEY blocks reference VALUE blocks via a VALUE relationship; we reverse that
  // map so that when processing a SELECTION_ELEMENT whose parent is a VALUE block,
  // we can look up the human-readable label (the key text from the KEY block).
  const valueIdToKeyText = new Map<string, string>();
  for (const block of blocks) {
    if (block.BlockType !== BlockType.KEY_VALUE_SET) continue;
    if (!block.EntityTypes?.includes("KEY")) continue;
    const valueId = block.Relationships
      ?.find((r) => r.Type === RelationshipType.VALUE)
      ?.Ids?.[0];
    if (valueId) {
      valueIdToKeyText.set(valueId, getChildText(block, blockMap));
    }
  }

  // Track table index per page
  const tableIndexByPage = new Map<number, number>();

  for (const block of blocks) {
    const pageNum = block.Page ?? 1;
    const page    = getPage(pageNum);
    const geo     = block.Geometry?.BoundingBox;

    switch (block.BlockType) {

      // ── PAGE: extract dimensions ────────────────────────────────────────
      case BlockType.PAGE: {
        // Textract normalizes all coordinates to [0,1], so "page dimensions"
        // from the PAGE block polygon give us the aspect ratio.
        // Store as normalized 1×1 so the viewer knows the coordinate space.
        page.dimensions = { width: 1, height: 1 };
        break;
      }

      // ── LINE: build raw text (sorted later by top position) ────────────
      case BlockType.LINE: {
        if (block.Text && geo) {
          page.lines.push({ text: block.Text, top: geo.Top ?? 0 });
        }
        break;
      }

      // ── WORD: build word geometry overlay ──────────────────────────────
      case BlockType.WORD: {
        if (block.Text && geo) {
          page.wordGeometry.push({
            text:       block.Text,
            confidence: block.Confidence ?? 0,
            geometry: {
              left:   geo.Left   ?? 0,
              top:    geo.Top    ?? 0,
              width:  geo.Width  ?? 0,
              height: geo.Height ?? 0,
            },
          });
        }
        break;
      }

      // ── TABLE: build cell grid ─────────────────────────────────────────
      case BlockType.TABLE: {
        // Collect all CELL children for this table
        const cellIds = block.Relationships
          ?.filter((r) => r.Type === RelationshipType.CHILD)
          .flatMap((r) => r.Ids ?? []) ?? [];

        const cells: TableCell[] = [];
        let maxRow = 0;
        let maxCol = 0;

        for (const cellId of cellIds) {
          const cell = blockMap.get(cellId);
          if (cell?.BlockType !== BlockType.CELL) continue;

          const row     = cell.RowIndex    ?? 1;
          const col     = cell.ColumnIndex ?? 1;
          const rowSpan = cell.RowSpan     ?? 1;
          const colSpan = cell.ColumnSpan  ?? 1;
          const text    = getChildText(cell, blockMap);
          const conf    = cell.Confidence  ?? 0;

          cells.push({ row, col, rowSpan, colSpan, text, confidence: conf });
          if (row + rowSpan - 1 > maxRow) maxRow = row + rowSpan - 1;
          if (col + colSpan - 1 > maxCol) maxCol = col + colSpan - 1;
        }

        const tableIdx = (tableIndexByPage.get(pageNum) ?? 0);
        tableIndexByPage.set(pageNum, tableIdx + 1);

        page.tables.push({
          tableIndex: tableIdx,
          rows:       maxRow,
          cols:       maxCol,
          cells,
        });
        break;
      }

      // ── KEY_VALUE_SET (KEY): build form pairs ─────────────────────────
      case BlockType.KEY_VALUE_SET: {
        const entityTypes = block.EntityTypes ?? [];
        if (!entityTypes.includes("KEY")) break;

        // Key text comes from WORD children of this KEY block
        const keyText = getChildText(block, blockMap);
        const keyConf = block.Confidence ?? 0;

        // VALUE block is linked via a VALUE relationship
        const valueId = block.Relationships
          ?.find((r) => r.Type === RelationshipType.VALUE)
          ?.Ids?.[0];

        const valueBlock = valueId ? blockMap.get(valueId) : undefined;
        const valueText  = valueBlock ? getChildText(valueBlock, blockMap) : "";
        const valueConf  = valueBlock?.Confidence ?? 0;

        if (keyText.trim()) {
          page.forms.push({
            key:             keyText.trim(),
            value:           valueText.trim(),
            keyConfidence:   keyConf,
            valueConfidence: valueConf,
          });
        }
        break;
      }

      // ── SELECTION_ELEMENT: checkbox state + geometry ────────────────────
      case BlockType.SELECTION_ELEMENT: {
        if (!geo || !block.Id) break;

        const isSelected = block.SelectionStatus === SelectionStatus.SELECTED;

        // Determine context by looking up the immediate parent block
        const parent = parentMap.get(block.Id);
        let label:   string | null         = null;
        let context: CheckboxElement["context"] = "inline";

        if (parent?.BlockType === BlockType.KEY_VALUE_SET) {
          // Parent is a VALUE block — this checkbox is the answer to a form field
          context = "form";
          // Look up the KEY text that paired with this VALUE block
          label = parent.Id ? (valueIdToKeyText.get(parent.Id) ?? null) : null;
        } else if (parent?.BlockType === BlockType.CELL) {
          // Checkbox inside a table cell
          context = "table";
          // Column header label resolution would require the full table structure;
          // skip here — the cell text (☑/☐) already flows into tables_extracted.
        }

        page.checkboxes.push({
          selected:   isSelected,
          confidence: block.Confidence ?? 0,
          geometry: {
            left:   geo.Left   ?? 0,
            top:    geo.Top    ?? 0,
            width:  geo.Width  ?? 0,
            height: geo.Height ?? 0,
          },
          label,
          context,
        });
        break;
      }
    }
  }

  // Sort each page's lines top-to-bottom before returning
  for (const page of pages.values()) {
    page.lines.sort((a, b) => a.top - b.top);
  }

  return pages;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!event.body) return { statusCode: 400, body: "Empty body" };

  // ── 1. Parse SNS envelope ─────────────────────────────────────────────────
  let sns: SnsEnvelope;
  try {
    sns = JSON.parse(event.body) as SnsEnvelope;
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // ── 2. Verify SNS signature ───────────────────────────────────────────────
  const valid = await verifySnsSignature(sns);
  if (!valid) {
    console.error("[textract-complete] SNS signature verification failed");
    return { statusCode: 403, body: "Invalid SNS signature" };
  }

  // ── 3. Handle SubscriptionConfirmation ────────────────────────────────────
  if (sns.Type === "SubscriptionConfirmation") {
    if (sns.SubscribeURL) {
      try {
        await fetchText(sns.SubscribeURL);
        console.log("[textract-complete] SNS subscription confirmed");
      } catch (err) {
        console.error("[textract-complete] Subscription confirmation failed:", err);
        return { statusCode: 500, body: "Subscription confirmation failed" };
      }
    }
    return { statusCode: 200, body: "Confirmed" };
  }

  if (sns.Type !== "Notification") {
    return { statusCode: 200, body: "Ignored" };
  }

  // ── 4. Parse Textract completion notification ─────────────────────────────
  // Textract sends: { JobId, Status, API, Timestamp, DocumentLocation: {…} }
  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(sns.Message) as Record<string, unknown>;
  } catch {
    console.error("[textract-complete] Failed to parse Textract notification");
    return { statusCode: 400, body: "Invalid Textract notification" };
  }

  const jobId = typeof notification.JobId === "string" ? notification.JobId : null;
  const status = typeof notification.Status === "string" ? notification.Status : null;

  if (!jobId) {
    console.error("[textract-complete] No JobId in notification");
    return { statusCode: 400, body: "Missing JobId" };
  }

  console.log(`[textract-complete] Job ${jobId} status: ${status}`);

  // ── 5. Set up Supabase client ─────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const awsRegion   = process.env.TEXTRACT_REGION ?? "us-east-2";
  const awsKeyId    = process.env.TEXTRACT_KEY_ID;
  const awsSecret   = process.env.TEXTRACT_SECRET_KEY;

  if (!supabaseUrl || !serviceRole || !awsKeyId || !awsSecret) {
    return { statusCode: 500, body: "Server configuration error" };
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 6. Look up the record source by job ID ────────────────────────────────
  const { data: source, error: sourceErr } = await supabase
    .from("rv_record_sources")
    .select("id, aircraft_id, original_filename, s3_key")
    .eq("textract_job_id", jobId)
    .maybeSingle();

  if (sourceErr || !source) {
    console.error(`[textract-complete] No rv_record_sources row for job ${jobId}`);
    // Return 200 so SNS doesn't keep retrying an unfixable event
    return { statusCode: 200, body: "Record source not found" };
  }

  const recordSourceId = source.id;

  async function log(step: string, message: string, page_count?: number): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step,
      message,
      page_count: page_count ?? null,
    });
  }

  // ── 7. Handle failed Textract job ─────────────────────────────────────────
  if (status !== JobStatus.SUCCEEDED) {
    const msg = `Textract job ${jobId} ended with status: ${status}`;
    console.error(`[textract-complete] ${msg}`);
    await log("textract_failed", msg);
    await supabase
      .from("rv_record_sources")
      .update({ ingestion_status: "failed", ingestion_error: msg })
      .eq("id", recordSourceId);
    return { statusCode: 200, body: "Job failed — recorded" };
  }

  // ── 8. Fetch all Textract blocks (paginated) ──────────────────────────────
  const textract = new TextractClient({
    region: awsRegion,
    credentials: { accessKeyId: awsKeyId, secretAccessKey: awsSecret },
  });

  await log("textract_fetching", `Fetching Textract results for job ${jobId}`);

  let allBlocks: Block[];
  try {
    allBlocks = await fetchAllBlocks(textract, jobId);
  } catch (err) {
    const msg = `Failed to fetch Textract results: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[textract-complete] ${msg}`);
    await log("textract_failed", msg);
    await supabase
      .from("rv_record_sources")
      .update({ ingestion_status: "failed", ingestion_error: msg })
      .eq("id", recordSourceId);
    return { statusCode: 200, body: "Fetch failed — recorded" };
  }

  await log("textract_fetching", `Fetched ${allBlocks.length} blocks from Textract`);

  // ── 9. Process blocks into per-page structured data ───────────────────────
  const pageDataMap = processBlocks(allBlocks);
  const totalPages  = pageDataMap.size;

  await log("pages_inserting", `Processing ${totalPages} pages from Textract output`, totalPages);

  // ── 10. Insert / upsert rv_pages rows ─────────────────────────────────────
  let totalWordConfidence = 0;
  let totalWordCount      = 0;
  let insertedCount       = 0;
  const PAGE_CHUNK_SIZE   = 50;

  const pageDataArray = Array.from(pageDataMap.values()).sort(
    (a, b) => a.pageNumber - b.pageNumber
  );

  for (let i = 0; i < pageDataArray.length; i += PAGE_CHUNK_SIZE) {
    const chunk = pageDataArray.slice(i, i + PAGE_CHUNK_SIZE);

    const rows = chunk.map((pd) => {
      // raw_ocr_text: join sorted LINE texts
      const rawOcrText = pd.lines.map((l) => l.text).join("\n");

      // Accumulate confidence stats from word_geometry
      for (const w of pd.wordGeometry) {
        totalWordConfidence += w.confidence;
        totalWordCount++;
      }

      return {
        record_source_id:  recordSourceId,
        aircraft_id:       source.aircraft_id,
        page_number:       pd.pageNumber,
        raw_ocr_text:      rawOcrText,
        ocr_status:        "extracted" as const,
        word_geometry:        pd.wordGeometry.length > 0 ? pd.wordGeometry  : null,
        tables_extracted:     pd.tables.length     > 0 ? pd.tables         : null,
        forms_extracted:      pd.forms.length      > 0 ? pd.forms          : null,
        checkboxes_extracted: pd.checkboxes.length > 0 ? pd.checkboxes     : null,
        page_dimensions:      pd.dimensions ?? null,
      };
    });

    const { error: upsertErr } = await supabase
      .from("rv_pages")
      .upsert(rows, { onConflict: "record_source_id,page_number" });

    if (upsertErr) {
      const msg = `Page upsert failed at chunk ${i}: ${upsertErr.message}`;
      console.error(`[textract-complete] ${msg}`);
      await log("pages_inserting", `⚠ ${msg}`);
      // Continue rather than abort — partial data is better than none
    } else {
      insertedCount += rows.length;
    }
  }

  const avgConfidence = totalWordCount > 0
    ? totalWordConfidence / totalWordCount
    : null;

  // ── 11. Update rv_record_sources ──────────────────────────────────────────
  await supabase
    .from("rv_record_sources")
    .update({
      ingestion_status:       "indexed",
      page_count:             totalPages,
      pages_inserted:         insertedCount,
      ocr_quality_score:      avgConfidence,
      ingestion_error:        null,
      ingestion_completed_at: new Date().toISOString(),
    })
    .eq("id", recordSourceId);

  await log(
    "verified",
    `✓ Textract complete — ${insertedCount}/${totalPages} pages stored | ` +
    `avg word confidence: ${avgConfidence !== null ? (avgConfidence).toFixed(1) + "%" : "n/a"} | ` +
    `${pageDataArray.reduce((n, p) => n + p.tables.length, 0)} tables, ` +
    `${pageDataArray.reduce((n, p) => n + p.forms.length, 0)} form fields, ` +
    `${pageDataArray.reduce((n, p) => n + p.checkboxes.length, 0)} checkboxes`,
    insertedCount
  );

  console.log(
    `[textract-complete] Indexed ${recordSourceId}: ` +
    `${insertedCount} pages, avg conf ${avgConfidence?.toFixed(1)}%`
  );

  // ── 12. Trigger Phase 2 (Claude Haiku events) and Phase 3 (Voyage embeddings) ──
  // Same chain as process-record-source: events first, embeddings after.
  const edgeBase    = `${supabaseUrl}/functions/v1`;
  const postHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${serviceRole}`,
  };
  const postBody = JSON.stringify({ record_source_id: recordSourceId });

  // Phase 2: event extraction
  try {
    const evtResp = await fetch(`${edgeBase}/extract-record-events`, {
      method: "POST", headers: postHeaders, body: postBody,
    });
    if (!evtResp.ok) {
      console.error(`[textract-complete] extract-record-events HTTP ${evtResp.status}`);
      await log("extraction_error", `extract-record-events returned HTTP ${evtResp.status}`);
    } else {
      await log("extraction_triggered", "Phase 2: extract-record-events triggered");
    }
  } catch (err) {
    console.error("[textract-complete] extract-record-events trigger failed:", err);
    await log("extraction_error", `extract-record-events trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Phase 3: embedding generation
  try {
    const embResp = await fetch(`${edgeBase}/generate-page-embeddings`, {
      method: "POST", headers: postHeaders, body: postBody,
    });
    if (!embResp.ok) {
      console.error(`[textract-complete] generate-page-embeddings HTTP ${embResp.status}`);
      await log("embedding_error", `generate-page-embeddings returned HTTP ${embResp.status}`);
    } else {
      await log("embedding_triggered", "Phase 3: generate-page-embeddings triggered");
    }
  } catch (err) {
    console.error("[textract-complete] generate-page-embeddings trigger failed:", err);
    await log("embedding_error", `generate-page-embeddings trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Phase 4: rasterize PDF pages to JPEG via PDFium (background function)
  // Runs in parallel with extraction/embedding — doesn't block the response.
  // The viewer shows rendered images once they land; until then it falls back
  // to PDF.js rendering which may fail on JBIG2/CCITTFax pages.
  try {
    const siteUrl = process.env.URL ?? process.env.DEPLOY_URL;
    if (siteUrl) {
      const rasterizeUrl = `${siteUrl}/.netlify/functions/records-vault-rasterize-background`;
      // Fire-and-forget — background functions return 202 immediately
      fetch(rasterizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordSourceId }),
      }).catch((err) => {
        console.error("[textract-complete] rasterize trigger network error:", err);
      });
      await log("rasterize_triggered", "Phase 4: records-vault-rasterize-background triggered");
    } else {
      console.warn("[textract-complete] URL env missing — cannot trigger rasterize");
    }
  } catch (err) {
    console.error("[textract-complete] rasterize trigger failed:", err);
    await log("rasterize_error", `rasterize trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      recordSourceId,
      pages:      totalPages,
      inserted:   insertedCount,
      avgConf:    avgConfidence,
    }),
  };
};
