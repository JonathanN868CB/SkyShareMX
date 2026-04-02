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

interface RequestPayload {
  message?: unknown;
  history?: unknown;
  mode?: unknown;
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
  const history = Array.isArray(payload.history) ? payload.history : [];
  const message = payload.message.trim();
  const client = new Anthropic({ apiKey });

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

  // ── Data path: generate SQL ───────────────────────────────────
  const conversationContext = recentHistory
    .slice(-4)
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
    .join("\n");

  const sql = await generateSQL(client, message, conversationContext);
  console.log("[DW1GHT] Generated SQL:", sql ?? "NO_SQL");

  if (!sql) {
    const messages: Anthropic.MessageParam[] = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: DW1GHT_CONFIG.model,
      max_tokens: DW1GHT_CONFIG.maxTokens[mode],
      system: buildSystemPrompt(mode) + `\n\nIMPORTANT: The user asked a data question but the system could not generate a database query for it. Tell the user you understood their question but could not formulate a precise query. Ask them to rephrase with specifics — a tail number, date range, or technician name.`,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    return json(200, {
      reply,
      mode,
      queryType: "data",
      sqlGenerated: false,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  }

  // ── Data path: execute SQL ────────────────────────────────────
  const { data: queryResults, error: queryError } = await runQuery(sql);
  console.log("[DW1GHT] Query result:", queryError ? `ERROR: ${queryError}` : `${queryResults?.length ?? 0} rows`);

  // ── Data path: generate grounded response ─────────────────────
  let dataContext: string;
  if (queryError) {
    dataContext = `DATABASE QUERY FAILED.\nSQL attempted: ${sql}\nError: ${queryError}\n\nTell the user the query encountered an issue. Do not expose raw SQL or error details — just say the retrieval hit a snag and ask them to try rephrasing.`;
  } else if (!queryResults || queryResults.length === 0) {
    dataContext = `DATABASE QUERY RETURNED NO RESULTS.\nSQL executed: ${sql}\n\nTell the user no matching records were found. Be specific about what was searched for.`;
  } else {
    const truncated = queryResults.slice(0, DW1GHT_CONFIG.sqlResultLimit);
    const overflow = queryResults.length > DW1GHT_CONFIG.sqlResultLimit;
    dataContext = `DATABASE QUERY RESULTS (${queryResults.length} rows${overflow ? `, showing first ${DW1GHT_CONFIG.sqlResultLimit}` : ""}):\n${JSON.stringify(truncated, null, 2)}${overflow ? `\n\n(${queryResults.length - DW1GHT_CONFIG.sqlResultLimit} additional rows not shown)` : ""}`;
  }

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
    sqlGenerated: true,
    resultCount: queryResults?.length ?? 0,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
};
