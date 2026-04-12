// records-vault-textract-process-background — NO AUTH (internal call only)
//
// Background function (15-minute ceiling) that does the heavy Textract work:
//   1. Fetches all blocks via paginated GetDocumentAnalysis
//   2. Processes blocks into per-page structured data
//   3. Upserts rv_pages rows
//   4. Triggers downstream: events, embeddings, rasterize, label
//
// Split from records-vault-textract-complete so the thin SNS handler can
// return 200 to AWS within seconds. This function handles multi-hundred-page
// docs that need minutes of paginated Textract fetches.

import { createClient } from "@supabase/supabase-js";
import {
  TextractClient,
  GetDocumentAnalysisCommand,
  type Block,
  BlockType,
  RelationshipType,
  SelectionStatus,
} from "@aws-sdk/client-textract";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
};
type HandlerResponse = {
  statusCode: number;
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
  label:   string | null;
  context: "form" | "table" | "inline";
}

interface PageData {
  pageNumber:    number;
  lines:         Array<{ text: string; top: number }>;
  wordGeometry:  WordGeometry[];
  tables:        ExtractedTable[];
  forms:         ExtractedForm[];
  checkboxes:    CheckboxElement[];
  dimensions?:   { width: number; height: number };
}

// ─── Textract block fetching ─────────────────────────────────────────────────

async function fetchAllBlocks(
  textract: TextractClient,
  jobId: string,
  onRetry?: (attempt: number, errName: string, delayMs: number) => Promise<void>,
): Promise<Block[]> {
  const blocks: Block[] = [];
  let nextToken: string | undefined = undefined;

  const BACKOFF_MS = [300, 600, 1200, 2400, 4800, 9600, 15000, 30000];
  const MAX_ATTEMPTS = BACKOFF_MS.length;
  const PAGE_JITTER_MS = 150;

  const isThrottle = (err: unknown): boolean => {
    const name = (err as { name?: string } | null)?.name ?? "";
    const code = (err as { Code?: string } | null)?.Code ?? "";
    const msg  = (err as { message?: string } | null)?.message ?? "";
    return (
      name === "ThrottlingException" ||
      name === "ProvisionedThroughputExceededException" ||
      code === "ThrottlingException" ||
      code === "ProvisionedThroughputExceededException" ||
      msg.includes("Provisioned rate exceeded") ||
      msg.includes("Rate exceeded")
    );
  };

  do {
    const cmd = new GetDocumentAnalysisCommand({
      JobId:     jobId,
      MaxResults: 1000,
      ...(nextToken ? { NextToken: nextToken } : {}),
    });

    let resp: Awaited<ReturnType<typeof textract.send<typeof cmd>>> | undefined;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        resp = await textract.send(cmd);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        if (!isThrottle(err)) throw err;
        const baseDelay = BACKOFF_MS[attempt];
        const jitter = Math.round(baseDelay * (0.6 + Math.random() * 0.8));
        if (onRetry) {
          const errName = (err as { name?: string } | null)?.name ?? "Throttle";
          try { await onRetry(attempt + 1, errName, jitter); } catch { /* swallow */ }
        }
        await new Promise((r) => setTimeout(r, jitter));
      }
    }

    if (!resp) throw lastErr ?? new Error("Textract fetch failed after retries");

    blocks.push(...(resp.Blocks ?? []));
    nextToken = resp.NextToken;

    if (nextToken) await new Promise((r) => setTimeout(r, PAGE_JITTER_MS));
  } while (nextToken);

  return blocks;
}

// ─── Textract block processing ───────────────────────────────────────────────

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

function processBlocks(blocks: Block[]): Map<number, PageData> {
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

  const parentMap = new Map<string, Block>();
  for (const block of blocks) {
    const childIds = block.Relationships
      ?.filter((r) => r.Type === RelationshipType.CHILD)
      .flatMap((r) => r.Ids ?? []) ?? [];
    for (const id of childIds) {
      parentMap.set(id, block);
    }
  }

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

  const tableIndexByPage = new Map<number, number>();

  for (const block of blocks) {
    const pageNum = block.Page ?? 1;
    const page    = getPage(pageNum);
    const geo     = block.Geometry?.BoundingBox;

    switch (block.BlockType) {
      case BlockType.PAGE: {
        page.dimensions = { width: 1, height: 1 };
        break;
      }
      case BlockType.LINE: {
        if (block.Text && geo) {
          page.lines.push({ text: block.Text, top: geo.Top ?? 0 });
        }
        break;
      }
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
      case BlockType.TABLE: {
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
      case BlockType.KEY_VALUE_SET: {
        const entityTypes = block.EntityTypes ?? [];
        if (!entityTypes.includes("KEY")) break;

        const keyText = getChildText(block, blockMap);
        const keyConf = block.Confidence ?? 0;

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
      case BlockType.SELECTION_ELEMENT: {
        if (!geo || !block.Id) break;

        const isSelected = block.SelectionStatus === SelectionStatus.SELECTED;

        const parent = parentMap.get(block.Id);
        let label:   string | null                = null;
        let context: CheckboxElement["context"]   = "inline";

        if (parent?.BlockType === BlockType.KEY_VALUE_SET) {
          context = "form";
          label = parent.Id ? (valueIdToKeyText.get(parent.Id) ?? null) : null;
        } else if (parent?.BlockType === BlockType.CELL) {
          context = "table";
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

  for (const page of pages.values()) {
    page.lines.sort((a, b) => a.top - b.top);
  }

  return pages;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!event.body) return { statusCode: 400, body: "Empty body" };

  let payload: { recordSourceId: string; jobId: string };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { recordSourceId, jobId } = payload;
  if (!recordSourceId || !jobId) {
    return { statusCode: 400, body: "recordSourceId and jobId required" };
  }

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

  const { data: source, error: sourceErr } = await supabase
    .from("rv_record_sources")
    .select("id, aircraft_id, original_filename, s3_key")
    .eq("id", recordSourceId)
    .maybeSingle();

  if (sourceErr || !source) {
    console.error(`[textract-process-bg] No source for ${recordSourceId}`);
    return { statusCode: 200, body: "Record source not found" };
  }

  async function log(step: string, message: string, page_count?: number): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step,
      message,
      page_count: page_count ?? null,
    });
  }

  // ── Fetch all Textract blocks (paginated) — this is the slow part ─────────
  const textract = new TextractClient({
    region: awsRegion,
    credentials: { accessKeyId: awsKeyId, secretAccessKey: awsSecret },
  });

  await log("textract_fetching", `Background: fetching Textract results for job ${jobId}`);

  let allBlocks: Block[];
  try {
    allBlocks = await fetchAllBlocks(textract, jobId, async (attempt, errName, delayMs) => {
      await log(
        "textract_throttled",
        `Textract throttled (${errName}) on attempt ${attempt} — backing off ${delayMs}ms`,
      );
    });
  } catch (err) {
    const msg = `Failed to fetch Textract results: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[textract-process-bg] ${msg}`);
    await log("textract_failed", msg);
    await supabase
      .from("rv_record_sources")
      .update({ ingestion_status: "failed", ingestion_error: msg })
      .eq("id", recordSourceId);
    return { statusCode: 200, body: "Fetch failed — recorded" };
  }

  await log("textract_fetched", `Fetched ${allBlocks.length} blocks from Textract`);

  // ── Process blocks into per-page structured data ──────────────────────────
  const pageDataMap = processBlocks(allBlocks);
  const totalPages  = pageDataMap.size;

  await log("pages_inserting", `Processing ${totalPages} pages from Textract output`, totalPages);

  // ── Insert / upsert rv_pages rows ─────────────────────────────────────────
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
      const rawOcrText = pd.lines.map((l) => l.text).join("\n");

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
      console.error(`[textract-process-bg] ${msg}`);
      await log("pages_inserting", `⚠ ${msg}`);
    } else {
      insertedCount += rows.length;
    }
  }

  const avgConfidence = totalWordCount > 0
    ? totalWordConfidence / totalWordCount
    : null;

  // ── Update rv_record_sources ──────────────────────────────────────────────
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
    `[textract-process-bg] Indexed ${recordSourceId}: ` +
    `${insertedCount} pages, avg conf ${avgConfidence?.toFixed(1)}%`
  );

  // ── Trigger downstream phases ─────────────────────────────────────────────
  const edgeBase    = `${supabaseUrl}/functions/v1`;
  const postHeaders = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${serviceRole}`,
  };
  const postBody = JSON.stringify({ record_source_id: recordSourceId });

  // Embedding generation
  try {
    const embResp = await fetch(`${edgeBase}/generate-page-embeddings`, {
      method: "POST", headers: postHeaders, body: postBody,
    });
    if (!embResp.ok) {
      console.error(`[textract-process-bg] generate-page-embeddings HTTP ${embResp.status}`);
      await log("embedding_error", `generate-page-embeddings returned HTTP ${embResp.status}`);
    } else {
      await log("embedding_triggered", "generate-page-embeddings triggered");
    }
  } catch (err) {
    console.error("[textract-process-bg] generate-page-embeddings trigger failed:", err);
    await log("embedding_error", `generate-page-embeddings trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Rasterize PDF pages to JPEG
  try {
    const siteUrl = process.env.URL ?? process.env.DEPLOY_URL;
    if (siteUrl) {
      const rasterizeUrl = `${siteUrl}/.netlify/functions/records-vault-rasterize-background`;
      fetch(rasterizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordSourceId }),
      }).catch((err) => {
        console.error("[textract-process-bg] rasterize trigger network error:", err);
      });
      await log("rasterize_triggered", "records-vault-rasterize-background triggered");
    } else {
      console.warn("[textract-process-bg] URL env missing — cannot trigger rasterize");
    }
  } catch (err) {
    console.error("[textract-process-bg] rasterize trigger failed:", err);
    await log("rasterize_error", `rasterize trigger failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // AI display label generation (Haiku)
  try {
    const siteUrl = process.env.URL ?? process.env.DEPLOY_URL;
    if (siteUrl) {
      const labelUrl = `${siteUrl}/.netlify/functions/records-vault-label`;
      fetch(labelUrl, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ recordSourceId, action: "generate" }),
      }).catch((err) => {
        console.error("[textract-process-bg] label trigger network error:", err);
      });
      await log("label_triggered", "records-vault-label (Haiku) triggered");
    }
  } catch (err) {
    console.error("[textract-process-bg] label trigger failed:", err);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      recordSourceId,
      pages:    totalPages,
      inserted: insertedCount,
      avgConf:  avgConfidence,
    }),
  };
};
