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
type QueryIntent = "data_aircraft" | "data_fleet" | "general";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

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

// FAA N-number pattern: N followed by 3-5 digits, optionally 1-2 letters
const TAIL_NUMBER_REGEX = /\b(N\d{3,5}[A-Z]{0,2})\b/gi;

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

// ── Context Sources ──────────────────────────────────────────────
function getContextSources(raw: unknown): Set<ContextSource> {
  const defaults = new Set<ContextSource>(["discrepancies"]);
  if (!Array.isArray(raw)) return defaults;
  const valid: ContextSource[] = ["discrepancies", "records", "manuals"];
  const sources = raw.filter((s): s is ContextSource => valid.includes(s as ContextSource));
  return sources.length > 0 ? new Set(sources) : defaults;
}

// ── Tail Number Extraction ───────────────────────────────────────
// Returns all N-numbers found in the message, uppercased and deduplicated.
function extractTailNumbers(message: string): string[] {
  const matches = message.match(TAIL_NUMBER_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map((t) => t.toUpperCase()))];
}

// ── Aircraft ID Lookup ───────────────────────────────────────────
// Resolves a tail number to the Supabase aircraft UUID.
async function lookupAircraftId(tailNumber: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase
    .from("aircraft_registrations")
    .select("aircraft_id")
    .eq("registration", tailNumber)
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log(`[DW1GHT] No aircraft_id found for tail ${tailNumber}`);
    return null;
  }
  return data.aircraft_id as string;
}

// ── Fleet Confirmation Detection ─────────────────────────────────
// Returns true if the current message is a short affirmative reply to a
// prior DW1GHT fleet-confirmation request found in history.
function isFleetConfirmationReply(message: string, history: HistoryMessage[]): boolean {
  if (message.trim().length > 60) return false;
  const affirmative = /\b(yes|yeah|yep|correct|go ahead|all|fleet|all aircraft|all pc-12s?|confirm|proceed|sure|do it)\b/i;
  if (!affirmative.test(message)) return false;
  // Check that the last assistant turn asked about fleet confirmation
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return false;
  return /fleet|all aircraft|all pc-12|specific tail/i.test(lastAssistant.content);
}

// ── Mode-aware short replies ─────────────────────────────────────
function tailMissingReply(mode: Dw1ghtMode): string {
  switch (mode) {
    case "schrute":
      return "Tail number. I need a tail number. Which aircraft are you asking about? Specify it.";
    case "corporate":
      return "Please specify the aircraft tail number you're referring to, and I'll search the records.";
    case "troubleshooting":
      return "Which aircraft? Provide the tail number and I'll pull the relevant records.";
  }
}

function fleetConfirmReply(mode: Dw1ghtMode): string {
  switch (mode) {
    case "schrute":
      return "I can run a fleet-wide search across all aircraft in the system. Confirming — do you want all aircraft, or a specific tail number?";
    case "corporate":
      return "This appears to be a fleet-wide query. Please confirm — should I search all aircraft records, or did you have a specific tail number in mind?";
    case "troubleshooting":
      return "I can search across the full fleet for this. Confirming — all aircraft, or a specific tail number?";
  }
}

// ── Voyage AI Query Embedding ────────────────────────────────────
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

// ── RAG Retrieval via rv_match_chunks ────────────────────────────
// aircraftId: pass a UUID to scope search to one aircraft, null for fleet-wide.
async function retrieveRecordsContext(
  queryEmbedding: number[],
  aircraftId: string | null,
): Promise<{ chunks: RagChunk[]; error: string | null }> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    return { chunks: [], error: "Database not configured for RAG" };
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data, error } = await supabase.rpc("rv_match_chunks", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      p_aircraft_id: aircraftId,
      p_limit: DW1GHT_CONFIG.ragChunkLimit,
      p_threshold: DW1GHT_CONFIG.ragThreshold,
    });

    if (error) {
      console.error("[DW1GHT] rv_match_chunks error:", error.message);
      return { chunks: [], error: error.message };
    }

    return { chunks: (data ?? []) as RagChunk[], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RAG query failed";
    console.error("[DW1GHT] retrieveRecordsContext exception:", msg);
    return { chunks: [], error: msg };
  }
}

// ── Intent Classification ────────────────────────────────────────
// Returns:
//   "data_aircraft" — question needs data for a specific aircraft
//   "data_fleet"    — question needs data across the whole fleet
//   "general"       — no database access needed
async function classifyQuestion(
  client: Anthropic,
  message: string,
): Promise<QueryIntent> {
  const res = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: 20,
    system: `You classify aviation maintenance questions. Choose exactly one of three categories:

DATA_AIRCRAFT — the question requires database or document access for one or more specific aircraft (e.g. asks about discrepancies, records, logbooks, maintenance history for a particular aircraft — even if no tail number is given yet)
DATA_FLEET — the question explicitly asks about the entire fleet, all aircraft, fleet-wide statistics, or all PC-12s
GENERAL — general aviation knowledge, FAA regulations, how-to questions, greetings, or anything that does NOT need database access

Respond with only one word: DATA_AIRCRAFT, DATA_FLEET, or GENERAL`,
    messages: [{ role: "user", content: message }],
  });
  const text = res.content[0].type === "text" ? res.content[0].text.trim().toUpperCase() : "GENERAL";
  if (text.startsWith("DATA_FLEET")) return "data_fleet";
  if (text.startsWith("DATA_AIRCRAFT") || text.startsWith("DATA")) return "data_aircraft";
  return "general";
}

// ── SQL Generation ───────────────────────────────────────────────
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
  sql = sql.replace(/;\s*$/, "");
  return sql;
}

// ── Execute SQL via Supabase ─────────────────────────────────────
async function runQuery(sql: string): Promise<{ data: unknown[] | null; error: string | null }> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  console.log("[DW1GHT] DB config — URL:", url ? "SET" : "MISSING", "| Key:", key ? `SET (${key.slice(0, 20)}...)` : "MISSING");

  if (!url || !key) {
    return { data: null, error: "Database not configured" };
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

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

// ── Main Handler ─────────────────────────────────────────────────
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
  const history = (Array.isArray(payload.history) ? payload.history : []) as HistoryMessage[];
  const message = payload.message.trim();
  const client = new Anthropic({ apiKey });

  const useDiscrepancies = sources.has("discrepancies");
  const useRecords = sources.has("records");

  console.log("[DW1GHT] Context sources:", [...sources].join(", "));

  const recentHistory = history.slice(-(DW1GHT_CONFIG.historyWindow * 2));

  // ── Step 1: Extract tail numbers from the message ────────────────
  const tailNumbers = extractTailNumbers(message);
  const hasTail = tailNumbers.length > 0;
  console.log("[DW1GHT] Tail numbers found:", hasTail ? tailNumbers.join(", ") : "none");

  // ── Step 2: Check if this is a confirmed fleet follow-up ─────────
  const confirmedFleet = isFleetConfirmationReply(message, recentHistory);

  // ── Step 3: Fire RAG in parallel with classification ─────────────
  // RAG starts immediately if "records" is ON — the toggle is the gate.
  const ragPromise = useRecords
    ? embedQuery(message).then(async (embedding) => {
        if (!embedding) return { chunks: [] as RagChunk[], error: "Embedding generation failed", aircraftId: null as string | null };
        console.log("[DW1GHT] Query embedded, searching rv_page_chunks...");
        // Aircraft ID resolved after classification — placeholder null, resolved below
        return { embedding, chunks: null as RagChunk[] | null, error: null, aircraftId: null as string | null };
      })
    : Promise.resolve(null);

  // ── Step 4: Classify intent ───────────────────────────────────────
  const intent = confirmedFleet ? "data_fleet" : await classifyQuestion(client, message);
  console.log("[DW1GHT] Mode:", mode, "| Intent:", intent, "| Tail:", hasTail ? tailNumbers.join(",") : "none", "| Question:", message.slice(0, 80));

  // ── Step 5: Intent routing ────────────────────────────────────────

  // GENERAL — no database needed and no RAG data expected
  if (intent === "general") {
    // Still need to drain the ragPromise to avoid unhandled rejection
    await ragPromise;
    const msgs: Anthropic.MessageParam[] = [...recentHistory, { role: "user", content: message }];
    const response = await client.messages.create({
      model: DW1GHT_CONFIG.model,
      max_tokens: DW1GHT_CONFIG.maxTokens[mode],
      system: buildSystemPrompt(mode),
      messages: msgs,
    });
    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    return json(200, { reply, mode, queryType: "general", usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens } });
  }

  // DATA_AIRCRAFT — needs a tail number
  if (intent === "data_aircraft" && !hasTail) {
    await ragPromise;
    return json(200, {
      reply: tailMissingReply(mode),
      mode,
      queryType: "clarification",
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  }

  // DATA_FLEET (first time) — pause and ask to confirm
  if (intent === "data_fleet" && !confirmedFleet) {
    await ragPromise;
    return json(200, {
      reply: fleetConfirmReply(mode),
      mode,
      queryType: "clarification",
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  }

  // ── Step 6: Resolve aircraft ID for RAG scoping ───────────────────
  // data_aircraft: scope RAG to the specific tail. data_fleet: fleet-wide (null).
  let ragAircraftId: string | null = null;
  if (intent === "data_aircraft" && hasTail) {
    ragAircraftId = await lookupAircraftId(tailNumbers[0]);
    console.log("[DW1GHT] Aircraft ID for", tailNumbers[0], ":", ragAircraftId ?? "not found (will search fleet-wide)");
  }

  // ── Step 7: Execute RAG with correct aircraft scope ───────────────
  let ragResult: { chunks: RagChunk[]; error: string | null } = { chunks: [], error: null };
  if (useRecords) {
    const partial = await ragPromise;
    if (partial && "embedding" in partial && partial.embedding) {
      const result = await retrieveRecordsContext(partial.embedding, ragAircraftId);
      ragResult = result;
      console.log("[DW1GHT] RAG result:", ragResult.error ? `ERROR: ${ragResult.error}` : `${ragResult.chunks.length} chunks (aircraft: ${ragAircraftId ?? "fleet-wide"})`);
    }
  }

  const hasRagData = ragResult.chunks.length > 0;

  // ── Step 8: SQL pipeline ──────────────────────────────────────────
  const conversationContext = recentHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const sqlResult = useDiscrepancies
    ? await generateSQL(client, message, conversationContext).then(async (sql) => {
        console.log("[DW1GHT] Generated SQL:", sql ?? "NO_SQL");
        if (!sql) return { sql: null, data: null, error: null };
        const result = await runQuery(sql);
        console.log("[DW1GHT] Query result:", result.error ? `ERROR: ${result.error}` : `${result.data?.length ?? 0} rows`);
        return { sql, ...result };
      })
    : { sql: null, data: null, error: null };

  // ── Step 9: Build data context ────────────────────────────────────
  const contextSections: string[] = [];
  let sqlGenerated = false;
  let resultCount = 0;
  let ragChunksUsed = 0;

  if (useDiscrepancies) {
    if (sqlResult.sql) {
      sqlGenerated = true;
      if (sqlResult.error) {
        contextSections.push(`DISCREPANCY DATABASE QUERY FAILED.\nSQL attempted: ${sqlResult.sql}\nError: ${sqlResult.error}\n\nTell the user the query encountered an issue. Do not expose raw SQL or error details.`);
      } else if (!sqlResult.data || sqlResult.data.length === 0) {
        contextSections.push(`DISCREPANCY DATABASE QUERY RETURNED NO RESULTS.\nSQL executed: ${sqlResult.sql}\n\nTell the user no matching discrepancy records were found. Be specific about what was searched for.`);
      } else {
        resultCount = sqlResult.data.length;
        const truncated = sqlResult.data.slice(0, DW1GHT_CONFIG.sqlResultLimit);
        const overflow = sqlResult.data.length > DW1GHT_CONFIG.sqlResultLimit;
        contextSections.push(`DISCREPANCY DATABASE RESULTS (${sqlResult.data.length} rows${overflow ? `, showing first ${DW1GHT_CONFIG.sqlResultLimit}` : ""}):\n${JSON.stringify(truncated, null, 2)}${overflow ? `\n\n(${sqlResult.data.length - DW1GHT_CONFIG.sqlResultLimit} additional rows not shown)` : ""}`);
      }
    } else {
      contextSections.push(`DISCREPANCY DATABASE: Could not generate a SQL query for this question.`);
    }
  }

  if (useRecords) {
    if (ragResult.error && ragResult.chunks.length === 0) {
      contextSections.push(`RECORDS VAULT SEARCH FAILED: ${ragResult.error}`);
    } else if (ragResult.chunks.length === 0) {
      const scope = ragAircraftId ? `aircraft ${tailNumbers[0]}` : "all fleet records";
      contextSections.push(`RECORDS VAULT: No semantically similar content found in uploaded records for ${scope}.`);
    } else {
      ragChunksUsed = ragResult.chunks.length;
      const chunkTexts = ragResult.chunks
        .map((c) => `[Source: ${c.original_filename}, p.${c.page_number}, category: ${c.source_category}, similarity: ${c.similarity.toFixed(3)}]\n${c.chunk_text}`)
        .join("\n\n");
      const scope = ragAircraftId ? `aircraft ${tailNumbers[0]}` : "fleet-wide";
      contextSections.push(`RECORDS VAULT RESULTS (semantic search, ${ragResult.chunks.length} chunks, scope: ${scope}):\n${chunkTexts}`);
    }
  }

  if (contextSections.length === 0) {
    contextSections.push(`No context sources are active. Enable Discrepancy History or Aircraft Records to search fleet data.`);
  }

  const dataContext = contextSections.join("\n\n─────────────────────────────────────\n\n");

  // ── Step 10: Generate final response ─────────────────────────────
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
    queryType: (sqlGenerated || hasRagData) ? "data" : "general",
    sqlGenerated,
    resultCount,
    ragChunksUsed,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
};
