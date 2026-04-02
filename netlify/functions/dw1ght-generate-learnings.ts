import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { DW1GHT_CONFIG } from "./_dw1ght-config";

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

  // Skip if there's nothing meaningful to learn from (approved, high rating, no notes, no rejections)
  const hasSignal = decision === "rejected"
    || (rating != null && rating <= 3)
    || (review_notes && review_notes.trim().length > 0)
    || (rejected_corrections && rejected_corrections.length > 0);

  // Even approvals with high ratings generate a positive reinforcement learning
  if (!hasSignal && decision === "approved" && (rating == null || rating >= 4)) {
    // Insert a simple positive reinforcement
    await supabase.from("dw1ght_learnings").insert({
      source_type: "dom_review",
      source_id: enrichment_id,
      lesson: `KEEP: DOM approved this interview${rating ? ` with ${rating}/5 stars` : ""}. The approach used was validated.`,
      category: "interview_flow",
      active: true,
    });

    console.log("[DW1GHT DOM Learning] Positive reinforcement saved for enrichment:", enrichment_id);
    return json(200, { ok: true, learnings_count: 1 });
  }

  const client = new Anthropic({ apiKey });

  const critiqueResponse = await client.messages.create({
    model: DW1GHT_CONFIG.reviewModel,
    max_tokens: 1000,
    system: DW1GHT_CONFIG.domReviewLearningPrompt,
    messages: [{ role: "user", content: `DOM feedback on interview (enrichment ${enrichment_id}):\n\n${feedbackParts.join("\n")}` }],
  });

  let raw = critiqueResponse.content[0].type === "text" ? critiqueResponse.content[0].text : "{}";
  raw = raw.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let result: {
    learnings?: Array<{
      lesson: string;
      category: string;
      aircraft_type?: string | null;
      severity?: string;
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

  const validCategories = ["question_quality", "record_validation", "domain_knowledge", "interview_flow", "prompt_behavior"];
  const learnings = (result.learnings || []).filter(
    (l) => l.lesson && validCategories.includes(l.category),
  );

  if (learnings.length > 0) {
    const rows = learnings.map((l) => ({
      source_type: "dom_review" as const,
      source_id: enrichment_id,
      lesson: l.lesson,
      category: l.category,
      aircraft_type: l.aircraft_type || null,
      active: true,
    }));

    const { error: insertErr } = await supabase.from("dw1ght_learnings").insert(rows);
    if (insertErr) {
      console.error("[DW1GHT DOM Learning] Insert failed:", insertErr.message);
      return json(500, { error: "Failed to save learnings" });
    }
  }

  console.log(`[DW1GHT DOM Learning] Generated ${learnings.length} learnings from ${decision} review of enrichment: ${enrichment_id}`);

  return json(200, {
    ok: true,
    learnings_count: learnings.length,
    usage: {
      input_tokens: critiqueResponse.usage.input_tokens,
      output_tokens: critiqueResponse.usage.output_tokens,
    },
  });
};
