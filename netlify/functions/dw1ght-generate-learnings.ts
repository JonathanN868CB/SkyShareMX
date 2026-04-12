import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { DW1GHT_CONFIG } from "./_dw1ght-config";
import { resolvePlaybookSections, sectionsToContextBlock } from "./_dw1ght-playbooks";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key);
}

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

  let payload: {
    enrichment_id: string;
    decision: "approved" | "rejected";
    review_notes?: string | null;
    rating?: number | null;
    rejected_corrections?: Array<{ field: string; original: string; suggested: string; reason: string }>;
    accepted_corrections?: Array<{ field: string; original: string; suggested: string; reason: string }>;
  };

  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { enrichment_id, decision, review_notes, rating, rejected_corrections, accepted_corrections } = payload;

  if (!enrichment_id) {
    return json(400, { error: "enrichment_id is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "AI service not configured" });

  const supabase = getSupabase();
  if (!supabase) return json(500, { error: "Database not configured" });

  // Build context for Sonnet
  const feedbackParts: string[] = [];

  feedbackParts.push(`DOM Decision: ${decision.toUpperCase()}`);

  if (rating != null) {
    feedbackParts.push(`Interview Rating: ${rating}/5 stars`);
  }

  if (review_notes) {
    feedbackParts.push(`DOM Review Notes: "${review_notes}"`);
  }

  if (rejected_corrections && rejected_corrections.length > 0) {
    feedbackParts.push("REJECTED CORRECTIONS:");
    rejected_corrections.forEach((c) => {
      feedbackParts.push(`  - Field: ${c.field} | DW1GHT suggested: "${c.suggested}" (was: "${c.original}") | Reason given: "${c.reason}" | DOM REJECTED THIS`);
    });
  }

  if (accepted_corrections && accepted_corrections.length > 0) {
    feedbackParts.push("ACCEPTED CORRECTIONS:");
    accepted_corrections.forEach((c) => {
      feedbackParts.push(`  - Field: ${c.field} | Changed from "${c.original}" to "${c.suggested}" | Reason: "${c.reason}"`);
    });
  }

  // Skip if there's no meaningful signal to generate suggestions from
  const hasSignal = decision === "rejected"
    || (rating != null && rating <= 3)
    || (review_notes && review_notes.trim().length > 0)
    || (rejected_corrections && rejected_corrections.length > 0);

  if (!hasSignal) {
    console.log("[DW1GHT DOM Review] No signal — skipping suggestion generation for enrichment:", enrichment_id);
    return json(200, { ok: true, suggestions_count: 0 });
  }

  const client = new Anthropic({ apiKey });

  // Fetch current sections so Sonnet can quote exact text for replace_text suggestions
  const sections = await resolvePlaybookSections("mechanic-interview", supabase);
  const sectionsBlock = sectionsToContextBlock(sections);

  const critiqueResponse = await client.messages.create({
    model: DW1GHT_CONFIG.reviewModel,
    max_tokens: 1000,
    system: DW1GHT_CONFIG.domReviewLearningPrompt
      + `\n\n=== CURRENT PLAYBOOK SECTIONS (quote verbatim for replace_text) ===\n\n${sectionsBlock}`,
    messages: [{ role: "user", content: `DOM feedback on interview (enrichment ${enrichment_id}):\n\n${feedbackParts.join("\n")}` }],
  });

  let raw = critiqueResponse.content[0].type === "text" ? critiqueResponse.content[0].text : "{}";
  raw = raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  let result: {
    playbook_suggestions?: Array<{
      section_key: string;
      change_type: string;
      source_text?: string;
      suggested_text: string;
      reasoning?: string;
    }>;
  };

  try {
    result = JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch { result = {}; }
    } else {
      result = {};
    }
  }

  const validSectionKeys = ["allowed_context", "instructions", "decision_logic", "output_definition", "post_processing", "tone_calibration"];
  const validChangeTypes = ["append", "replace_text", "replace_section"];
  const suggestions = (result.playbook_suggestions || []).filter(
    (s) => s.section_key && s.suggested_text && validSectionKeys.includes(s.section_key) && validChangeTypes.includes(s.change_type),
  );
  if (suggestions.length > 0) {
    const { error: suggErr } = await supabase.from("dw1ght_playbook_suggestions").insert(
      suggestions.map((s) => ({
        playbook_slug: "mechanic-interview",
        section_key: s.section_key,
        change_type: s.change_type,
        source_text: s.source_text || null,
        suggested_text: s.suggested_text,
        reasoning: s.reasoning || null,
        source_type: "dom_review",
        source_id: enrichment_id,
        review_status: "pending",
      })),
    );
    if (suggErr) {
      console.error("[DW1GHT DOM Review] Suggestion insert failed:", suggErr.message);
    } else {
      console.log(`[DW1GHT DOM Review] Saved ${suggestions.length} playbook suggestion(s) from ${decision} review.`);
    }
  }

  return json(200, {
    ok: true,
    suggestions_count: suggestions.length,
    usage: {
      input_tokens: critiqueResponse.usage.input_tokens,
      output_tokens: critiqueResponse.usage.output_tokens,
    },
  });
};
