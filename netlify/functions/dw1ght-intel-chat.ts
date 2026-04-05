import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { DW1GHT_CONFIG, type Dw1ghtMode } from "./_dw1ght-config";

// ── Types ────────────────────────────────────────────────────────
type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

type ContextSource = "discrepancies" | "records" | "manuals";

interface RequestPayload {
  message?: unknown;
  history?: unknown;
  mode?: unknown;
  contextSources?: unknown;
}

interface RagChunk {
  chunk_id: string;
  chunk_text: string;
  original_filename: string;
  source_category: string;
  page_number: number;
  similarity: number;
}

// ── Constants ────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC)\b/i;

const VALID_MODES: Dw1ghtMode[] = ["schrute", "corporate", "troubleshooting"];

// ── Helpers ──────────────────────────────────────────────────────
function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getMode(raw: unknown): Dw1ghtMode {
  if (typeof raw === "string" && VALID_MODES.includes(raw as Dw1ghtMode)) return raw as Dw1ghtMode;
  return "schrute";
}

function buildSystemPrompt(mode: Dw1ghtMode): string {
  return DW1GHT_CONFIG.identity + "\n\n" + DW1GHT_CONFIG.modes[mode];
}

// ── Context Sources ─────────────────────────────────────────
function getContextSources(raw: unknown): Set<ContextSource> {
  const defaults = new Set<ContextSource>(["discrepancies"]);
  if (!Array.isArray(raw)) return defaults;
  const valid: ContextSource[] = ["discrepancies", "records", "manuals"];
  const sources = raw.filter((s): s is ContextSource => valid.includes(s as ContextSource));
  return sources.length > 0 ? new Set(sources) : defaults;
}

// ── Voyage AI Query Embedding ───────────────────────────────
async function embedQuery(query: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    console.error("[DW1GHT] VOYAGE_API_KEY not set — cannot embed query");
    return null;
  }

  try {
    const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: [query], model: "voyage-3" }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[DW1GHT] Voyage AI error ${resp.status}: ${err}`);
      return null;
    }

    const result = await resp.json() as { data: { embedding: number[] }[] };
    return result.data[0].embedding;
  } catch (err) {
    console.error("[DW1GHT] Voyage AI embed failed:", err);
    return null;
  }
}

// ── RAG Retrieval via rv_match_chunks ───────────────────────
async function retrieveRecordsContext(
  queryEmbedding: number[],
): Promise<{ chunks: RagChunk[]; error: string | null }> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    return { chunks: [], error: "Database not configured for RAG" };
  }

  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase.rpc("rv_match_chunks", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      p_aircraft_id: null, // fleet-wide
      p_limit: DW1GHT_CONFIG.ragChunkLimit,
      p_threshold: DW1GHT_CONFIG.ragThreshold,
    });

    if (error) {
      return { chunks: [], error: error.message };
    }

    return { chunks: (data ?? []) as RagChunk[], error: null };
  } catch (err) {
    return { chunks: [], error: err instanceof Error ? err.message : "RAG query failed" };
  }
}

// ── SQL Classification ──────────────────────────────────────────
async function classifyQuestion(
  client: Anthropic,
  message: string,
): Promise<"data" | "general"> {
  const res = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: 10,
    system: `You classify user questions. If the question requires querying a database of aircraft discrepancies, maintenance records, fleet statistics, technician history, or aircraft details, respond with exactly: DATA
If the question is general aviation knowledge, FAA regulations, greetings, personality chat, or anything that does NOT need database access, respond with exactly: GENERAL
Respond with only one word: DATA or GENERAL`,
    messages: [{ role: "user", content: message }],
  });
  const text = res.content[0].type === "text" ? res.content[0].text.trim().toUpperCase() : "GENERAL";
  return text.startsWith("DATA") ? "data" : "general";
}

// ── SQL Generation ──────────────────────────────────────────────
async function generateSQL(
  client: Anthropic,
  message: string,
  conversationContext: string,
): Promise<string | null> {
  const res = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: 500,
    system: DW1GHT_CONFIG.sqlSystemPrompt + "\n\n" + DW1GHT_CONFIG.dbSchema,
    messages: [
      ...(conversationContext
        ? [{ role: "user" as const, content: `Previous conversation context for reference:\n${conversationContext}` },
           { role: "assistant" as const, content: "Understood. I have the conversation context. What is the query?" }]
        : []),
      { role: "user", content: message },
    ],
  });
  let sql = res.content[0].type === "text" ? res.content[0].text.trim() : "NO_SQL";
  if (sql === "NO_SQL" || !sql.toUpperCase().startsWith("SELECT")) return null;
  if (FORBIDDEN_SQL.test(sql)) return null;
  // Strip trailing semicolons — the RPC wraps this in a subquery
  sql = sql.replace(/;\s*$/, "");
  return sql;
}

// ── Execute SQL via Supabase ────────────────────────────────────
async function runQuery(sql: string): Promise<{ data: unknown[] | null; error: string | null }> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  console.log("[DW1GHT] DB config — URL:", url ? "SET" : "MISSING", "| Key:", key ? `SET (${key.slice(0, 20)}...)` : "MISSING");

  if (!url || !key) {
    return { data: null, error: "Database not configured" };
  }

  const supabase = createClient(url, key);

  try {
    const { data, error } = await supabase.rpc("exec_readonly_sql", { query: sql });
    if (error) {
      return { data: null, error: error.message };
    }
    const rows = Array.isArray(data) ? data : (data ? [data] : []);
    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Query failed" };
  }
}

// ── Main Handler ────────────────────────────────────────────────
export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!event.body) {
    return json(400, { error: "Missing request body" });
  }

  let payload: RequestPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (typeof payload.message !== "string" || !payload.message.trim()) {
    return json(400, { error: "message is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, { error: "AI service not configured" });
  }

  const mode = getMode(payload.mode);
  const sources = getContextSources(payload.contextSources);
  const history = Array.isArray(payload.history) ? payload.history : [];
  const message = payload.message.trim();
  const client = new Anthropic({ apiKey });

  console.log("[DW1GHT] Context sources:", [...sources].join(", "));

  // Keep conversation history within window
  const recentHistory = history.slice(-(DW1GHT_CONFIG.historyWindow * 2));

  // Step 1: Classify the question — does it need the database?
  const classification = await classifyQuestion(client, message);
  console.log("[DW1GHT] Mode:", mode, "| Classification:", classification, "| Question:", message.slice(0, 80));

  // ── General knowledge path (no database needed) ───────────────
  if (classification === "general") {
    const messages: Anthropic.MessageParam[] = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: DW1GHT_CONFIG.model,
      max_tokens: DW1GHT_CONFIG.maxTokens[mode],
      system: buildSystemPrompt(mode),
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    return json(200, {
      reply,
      mode,
      queryType: "general",
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  }

  // ── Data path ─────────────────────────────────────────────────
  const conversationContext = recentHistory
    .slice(-4)
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
    .join("\n");

  // Run SQL and RAG pipelines in parallel based on active sources
  const useDiscrepancies = sources.has("discrepancies");
  const useRecords = sources.has("records");

  const [sqlResult, ragResult] = await Promise.all([
    // SQL pipeline (discrepancy history)
    useDiscrepancies
      ? generateSQL(client, message, conversationContext).then(async (sql) => {
          console.log("[DW1GHT] Generated SQL:", sql ?? "NO_SQL");
          if (!sql) return { sql: null, data: null, error: null };
          const result = await runQuery(sql);
          console.log("[DW1GHT] Query result:", result.error ? `ERROR: ${result.error}` : `${result.data?.length ?? 0} rows`);
          return { sql, ...result };
        })
      : Promise.resolve({ sql: null, data: null, error: null }),

    // RAG pipeline (aircraft records)
    useRecords
      ? embedQuery(message).then(async (embedding) => {
          if (!embedding) return { chunks: [] as RagChunk[], error: "Embedding generation failed" };
          console.log("[DW1GHT] Query embedded, searching rv_page_chunks...");
          const result = await retrieveRecordsContext(embedding);
          console.log("[DW1GHT] RAG result:", result.error ? `ERROR: ${result.error}` : `${result.chunks.length} chunks`);
          return result;
        })
      : Promise.resolve({ chunks: [] as RagChunk[], error: null }),
  ]);

  // ── Build combined data context ───────────────────────────────
  const contextSections: string[] = [];
  let sqlGenerated = false;
  let resultCount = 0;
  let ragChunksUsed = 0;

  // SQL results section
  if (useDiscrepancies) {
    if (sqlResult.sql) {
      sqlGenerated = true;
      if (sqlResult.error) {
        contextSections.push(`DISCREPANCY DATABASE QUERY FAILED.\nSQL attempted: ${sqlResult.sql}\nError: ${sqlResult.error}\n\nTell the user the query encountered an issue. Do not expose raw SQL or error details — just say the retrieval hit a snag and ask them to try rephrasing.`);
      } else if (!sqlResult.data || sqlResult.data.length === 0) {
        contextSections.push(`DISCREPANCY DATABASE QUERY RETURNED NO RESULTS.\nSQL executed: ${sqlResult.sql}\n\nTell the user no matching discrepancy records were found. Be specific about what was searched for.`);
      } else {
        resultCount = sqlResult.data.length;
        const truncated = sqlResult.data.slice(0, DW1GHT_CONFIG.sqlResultLimit);
        const overflow = sqlResult.data.length > DW1GHT_CONFIG.sqlResultLimit;
        contextSections.push(`DISCREPANCY DATABASE RESULTS (${sqlResult.data.length} rows${overflow ? `, showing first ${DW1GHT_CONFIG.sqlResultLimit}` : ""}):\n${JSON.stringify(truncated, null, 2)}${overflow ? `\n\n(${sqlResult.data.length - DW1GHT_CONFIG.sqlResultLimit} additional rows not shown)` : ""}`);
      }
    } else {
      contextSections.push(`DISCREPANCY DATABASE: Could not generate a SQL query for this question. The discrepancy history was searched but no structured query could be formed.`);
    }
  }

  // RAG results section
  if (useRecords) {
    if (ragResult.error && ragResult.chunks.length === 0) {
      contextSections.push(`RECORDS VAULT SEARCH FAILED: ${ragResult.error}`);
    } else if (ragResult.chunks.length === 0) {
      contextSections.push(`RECORDS VAULT: No semantically similar content found in uploaded aircraft records.`);
    } else {
      ragChunksUsed = ragResult.chunks.length;
      const chunkTexts = ragResult.chunks.map((c) =>
        `[Source: ${c.original_filename}, p.${c.page_number}, category: ${c.source_category}, similarity: ${c.similarity.toFixed(3)}]\n${c.chunk_text}`
      ).join("\n\n");
      contextSections.push(`RECORDS VAULT RESULTS (semantic search, ${ragResult.chunks.length} chunks from aircraft records):\n${chunkTexts}`);
    }
  }

  // If neither pipeline produced anything useful, tell the user
  if (contextSections.length === 0) {
    contextSections.push(`No context sources are active. The user should enable at least one data source (Discrepancy History or Aircraft Records) to search fleet data.`);
  }

  const dataContext = contextSections.join("\n\n─────────────────────────────────────\n\n");

  const messages: Anthropic.MessageParam[] = [
    ...recentHistory,
    {
      role: "user",
      content: `${message}\n\n--- INTERNAL: QUERY RESULTS FOR DW1GHT (do not show raw data to user, synthesize it) ---\n${dataContext}`,
    },
  ];

  const response = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: DW1GHT_CONFIG.maxTokens[mode],
    system: buildSystemPrompt(mode),
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";
  return json(200, {
    reply,
    mode,
    queryType: "data",
    sqlGenerated,
    resultCount,
    ragChunksUsed,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
};
