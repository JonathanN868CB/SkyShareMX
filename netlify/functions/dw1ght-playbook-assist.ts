// -----------------------------------------------------------------
//  DW1GHT Playbook Assist
//  On-demand AI-assisted playbook improvement suggestions.
//
//  Two modes (via action field in POST body):
//    "assist"  — call Sonnet with current section content + learnings,
//                generate suggestions, save to dw1ght_playbook_suggestions
//    "import"  — accept pre-parsed suggestions array from frontend
//                (user pasted external AI response), save to DB
//
//  Auth: requires Supabase JWT in Authorization header.
//        Verifies the caller is Admin or Super Admin before saving.
// -----------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { PLAYBOOK_META } from "../../src/shared/dw1ght-playbooks-meta";

type HandlerEvent = {
  httpMethod: string;
  headers?: Record<string, string>;
  body?: string | null;
};
type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const VALID_SECTION_KEYS = [
  "allowed_context", "instructions", "decision_logic",
  "output_definition", "post_processing", "tone_calibration",
];
const VALID_CHANGE_TYPES = ["append", "replace_text", "replace_section"];

const SECTION_LABELS: Record<string, string> = {
  allowed_context:   "Allowed Context",
  instructions:      "Operating Instructions",
  decision_logic:    "Decision / Escalation Rules",
  output_definition: "Output Definition",
  post_processing:   "Post-Processing / Actions",
  tone_calibration:  "Persona & Tone",
};

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!event.body) return json(400, { error: "Missing request body" });

  // ── Auth ──────────────────────────────────────────────────────────
  const authHeader = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing authorization" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Database not configured" });

  // Verify caller's JWT
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) return json(500, { error: "Anon key not configured" });
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(jwt);
  if (authErr || !user) return json(401, { error: "Invalid token" });

  // Check admin/super role via service client
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "Super Admin") {
    return json(403, { error: "Super Admin access required" });
  }

  // ── Parse body ────────────────────────────────────────────────────
  let payload: {
    action: "assist" | "import";
    playbook_slug: string;
    sections?: Record<string, string>;
    inbox_learnings?: Array<{ lesson: string; category: string; source_type: string }>;
    suggestions?: Array<{
      section_key: string;
      change_type: string;
      source_text?: string;
      suggested_text: string;
      reasoning?: string;
    }>;
  };

  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { action, playbook_slug } = payload;
  if (!action || !playbook_slug) return json(400, { error: "action and playbook_slug required" });

  // ── IMPORT mode ───────────────────────────────────────────────────
  if (action === "import") {
    const raw = payload.suggestions || [];
    const valid = raw.filter(
      (s) => s.section_key && s.suggested_text
        && VALID_SECTION_KEYS.includes(s.section_key)
        && VALID_CHANGE_TYPES.includes(s.change_type),
    );
    if (valid.length === 0) return json(400, { error: "No valid suggestions found in payload" });

    const { error: insErr } = await supabase.from("dw1ght_playbook_suggestions").insert(
      valid.map((s) => ({
        playbook_slug,
        section_key: s.section_key,
        change_type: s.change_type,
        source_text: s.source_text || null,
        suggested_text: s.suggested_text,
        reasoning: s.reasoning || null,
        source_type: "import",
        source_id: null,
        review_status: "pending",
      })),
    );
    if (insErr) return json(500, { error: "Failed to save suggestions" });
    return json(200, { ok: true, count: valid.length });
  }

  // ── ASSIST mode ───────────────────────────────────────────────────
  if (action !== "assist") return json(400, { error: "action must be 'assist' or 'import'" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "AI service not configured" });

  const { sections = {}, inbox_learnings = [] } = payload;
  const playbook = PLAYBOOK_META.find((p) => p.slug === playbook_slug);
  if (!playbook) return json(400, { error: `Unknown playbook: ${playbook_slug}` });

  // ── Build prompt ──────────────────────────────────────────────────
  const sectionBlock = VALID_SECTION_KEYS.map((key) => {
    const label = SECTION_LABELS[key];
    const text = sections[key]?.trim() || "";
    return `[${label.toUpperCase()}]\n${text || "(using code default — not overridden)"}`;
  }).join("\n\n");

  const inboxBlock = inbox_learnings.length > 0
    ? inbox_learnings.map((l, i) => `${i + 1}. ${l.lesson} | ${l.category} | via ${l.source_type}`).join("\n")
    : "(none)";

  const systemPrompt = `THE MISSION:
DW1GHT mechanic interviews exist to capture the MIDDLE of the troubleshooting story — the diagnostic sequence, dead ends, pivot moments, and tribal knowledge that never appears in the formal record. This knowledge feeds a searchable database so future mechanics can find what worked, what failed, and what the trap was.

You are helping improve the DW1GHT ${playbook.name} playbook for an aviation maintenance management system. Review the current section contents and inbox learnings, then suggest targeted improvements. Be surgical — only suggest changes where there is a clear gap or problem.

CHANGE TYPES — choose the most surgical option:
- "replace_text" — replace a specific passage with better wording. Provide source_text as an exact verbatim quote from the section. PREFERRED for wording improvements.
- "append" — add a new rule or clause that does not exist in the section.
- "replace_section" — fundamental rewrite of an entire section. Use sparingly.

Respond with ONLY valid JSON (no markdown fences, no prose outside the JSON):
{
  "analysis": "1-2 sentence overall assessment of the playbook health and what the learnings reveal",
  "suggestions": [
    {
      "section_key": "${VALID_SECTION_KEYS.join(" | ")}",
      "change_type": "replace_text | append | replace_section",
      "source_text": "EXACT verbatim text from the section being replaced — required for replace_text, omit for append and replace_section",
      "suggested_text": "replacement passage (replace_text) / new rule (append) / full new section (replace_section)",
      "reasoning": "what specific problem this solves and which learnings motivated it"
    }
  ]
}

Rules:
- 2–5 suggestions maximum. Quality over quantity.
- Every suggestion must cite specific evidence from the learnings or section content.
- section_key must be one of the exact values listed above.`;

  const userMessage = `=== CURRENT PLAYBOOK SECTIONS ===

${sectionBlock}

=== INBOX LEARNINGS (${inbox_learnings.length} pending review) ===
${inboxBlock}`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  let raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  raw = raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  let parsed: { analysis?: string; suggestions?: typeof payload.suggestions } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch { /* leave empty */ } }
  }

  const valid = (parsed.suggestions || []).filter(
    (s) => s && s.section_key && s.suggested_text
      && VALID_SECTION_KEYS.includes(s.section_key)
      && VALID_CHANGE_TYPES.includes(s.change_type ?? "append"),
  );

  if (valid.length > 0) {
    const { error: insErr } = await supabase.from("dw1ght_playbook_suggestions").insert(
      valid.map((s) => ({
        playbook_slug,
        section_key: s!.section_key,
        change_type: s!.change_type || "append",
        source_text: s!.source_text || null,
        suggested_text: s!.suggested_text,
        reasoning: s!.reasoning || null,
        source_type: "ai_assist",
        source_id: null,
        review_status: "pending",
      })),
    );
    if (insErr) return json(500, { error: "Failed to save suggestions" });
  }

  return json(200, {
    ok: true,
    analysis: parsed.analysis || "",
    count: valid.length,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
};
