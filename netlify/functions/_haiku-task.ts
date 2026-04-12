// _haiku-task — shared guardrail for every Records Vault Haiku call
//
// Every Haiku invocation in the Records Vault pipeline (label generation,
// future targeted post-processing) must route through runHaikuTask. The
// helper enforces:
//
//   1. Named task — every call carries a `task` string so `rv_ingestion_log`
//      shows what Haiku is being used for. No silent Haiku traffic.
//   2. Bounded tokens — hard cap at 2000 output tokens; caller picks a
//      lower budget per task. Prevents a runaway prompt from costing $$.
//   3. Structured JSON — the helper parses the first `{...}` block out of
//      the response, strips code fences, and returns `unknown`. Callers
//      run their own coerce/validate step.
//   4. Timeout — abortable fetch with a 60s default ceiling. Haiku is fast;
//      anything slower than a minute is a signal to bail, not to wait.
//   5. Per-call logging — one row per call in `rv_ingestion_log` with the
//      task name, model, duration, and token counts. Operator can grep
//      "haiku_task" in the log to see exactly what's been run.
//
// Usage:
//   import { runHaikuTask } from "./_haiku-task";
//   const parsed = await runHaikuTask({
//     task:         "label_generate",
//     apiKey:       process.env.ANTHROPIC_API_KEY!,
//     adminClient,                    // SupabaseClient for logging
//     recordSourceId,                 // nullable — links log row to source
//     system:       LABEL_SYSTEM_PROMPT,
//     user:         userContent,
//     maxTokens:    400,
//     timeoutMs:    30000,            // optional — default 60000
//   });
//   // parsed is `unknown` — caller coerces to its own shape.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const HAIKU_MODEL      = "claude-haiku-4-5-20251001";
const DEFAULT_TIMEOUT  = 60_000;
const HARD_MAX_TOKENS  = 2000;

export type HaikuTaskArgs = {
  task:             string;                 // short tag, e.g. "label_generate"
  apiKey:           string;
  adminClient:      SupabaseClient;         // for rv_ingestion_log
  recordSourceId:   string | null;          // optional linkage to a source row
  system:           string;
  user:             string;
  maxTokens:        number;                 // caller budget — capped at 2000
  timeoutMs?:       number;                 // default 60000
};

export type HaikuTaskResult = {
  parsed:           unknown;                // first {...} JSON block
  rawText:          string;                 // verbatim assistant text
  durationMs:       number;
  inputTokens:      number | null;
  outputTokens:     number | null;
};

export class HaikuTaskError extends Error {
  constructor(public task: string, message: string, public cause?: unknown) {
    super(`[haiku:${task}] ${message}`);
    this.name = "HaikuTaskError";
  }
}

export async function runHaikuTask(args: HaikuTaskArgs): Promise<HaikuTaskResult> {
  const {
    task, apiKey, adminClient, recordSourceId,
    system, user, maxTokens,
  } = args;

  if (!task || task.trim().length === 0) {
    throw new HaikuTaskError("unknown", "task name is required");
  }
  const budget   = Math.min(Math.max(1, maxTokens), HARD_MAX_TOKENS);
  const timeout  = args.timeoutMs ?? DEFAULT_TIMEOUT;
  const anthropic = new Anthropic({ apiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const startedAt = Date.now();

  try {
    const resp = await anthropic.messages.create(
      {
        model:      HAIKU_MODEL,
        max_tokens: budget,
        system,
        messages:   [{ role: "user", content: user }],
      },
      { signal: controller.signal },
    );

    const durationMs   = Date.now() - startedAt;
    const inputTokens  = resp.usage?.input_tokens  ?? null;
    const outputTokens = resp.usage?.output_tokens ?? null;

    // Pull first text block, strip fences, extract first JSON object.
    const rawText = resp.content[0]?.type === "text" ? resp.content[0].text : "";
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
    const match = cleaned.match(/\{[\s\S]*\}/);
    let parsed: unknown = {};
    if (match) {
      try { parsed = JSON.parse(match[0]); }
      catch (parseErr) {
        await logTask(adminClient, recordSourceId, {
          task, outcome: "parse_error", durationMs, inputTokens, outputTokens,
          detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
        throw new HaikuTaskError(task, "Response was not valid JSON", parseErr);
      }
    }

    await logTask(adminClient, recordSourceId, {
      task, outcome: "ok", durationMs, inputTokens, outputTokens,
    });

    return { parsed, rawText, durationMs, inputTokens, outputTokens };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const aborted    = controller.signal.aborted;
    const msg        = err instanceof Error ? err.message : String(err);

    await logTask(adminClient, recordSourceId, {
      task,
      outcome:   aborted ? "timeout" : "error",
      durationMs,
      inputTokens:  null,
      outputTokens: null,
      detail:    aborted ? `aborted after ${timeout}ms` : msg,
    });

    if (err instanceof HaikuTaskError) throw err;
    throw new HaikuTaskError(task, aborted ? "timed out" : msg, err);
  } finally {
    clearTimeout(timer);
  }
}

async function logTask(
  adminClient: SupabaseClient,
  recordSourceId: string | null,
  entry: {
    task:         string;
    outcome:      "ok" | "parse_error" | "timeout" | "error";
    durationMs:   number;
    inputTokens:  number | null;
    outputTokens: number | null;
    detail?:      string;
  },
) {
  const parts: string[] = [
    `task=${entry.task}`,
    `outcome=${entry.outcome}`,
    `model=${HAIKU_MODEL}`,
    `duration_ms=${entry.durationMs}`,
  ];
  if (entry.inputTokens  !== null) parts.push(`input_tokens=${entry.inputTokens}`);
  if (entry.outputTokens !== null) parts.push(`output_tokens=${entry.outputTokens}`);
  if (entry.detail)                parts.push(`detail=${entry.detail.slice(0, 200)}`);

  try {
    await adminClient.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step:             `haiku_task_${entry.outcome}`,
      message:          parts.join(" "),
    });
  } catch {
    // Logging is best-effort — never block the task on a log write failure.
  }
}
