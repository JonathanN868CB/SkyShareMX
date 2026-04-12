// -----------------------------------------------------------------
//  DW1GHT Re-Fire Critique
//  Manually re-runs the Sonnet self-critique on a completed interview.
//  Can be called multiple times — each run appends fresh pending suggestions.
//
//  POST body: { enrichment_id: string }
//  Auth: requires Supabase JWT; caller must be Admin or Super Admin.
// -----------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { DW1GHT_CONFIG } from "./_dw1ght-config";
import { resolvePlaybookSections, sectionsToContextBlock } from "./_dw1ght-playbooks";

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

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!event.body) return json(400, { error: "Missing request body" });

  // ── Auth ──────────────────────────────────────────────────────────
  const authHeader = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing authorization" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;
  const anonKey     = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { error: "Database not configured" });

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(jwt);
  if (authErr || !user) return json(401, { error: "Invalid token" });

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["Admin", "Super Admin"].includes(profile.role)) {
    return json(403, { error: "Admin access required" });
  }

  // ── Parse body ────────────────────────────────────────────────────
  let payload: { enrichment_id: string };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const { enrichment_id } = payload;
  if (!enrichment_id) return json(400, { error: "enrichment_id required" });

  // ── Fetch enrichment ──────────────────────────────────────────────
  const { data: enrichment, error: enrichErr } = await supabase
    .from("discrepancy_enrichments")
    .select("id, discrepancy_id, raw_transcript")
    .eq("id", enrichment_id)
    .single();

  if (enrichErr || !enrichment) return json(404, { error: "Interview not found" });

  const transcript = Array.isArray(enrichment.raw_transcript) ? enrichment.raw_transcript : [];
  if (transcript.length < 2) return json(400, { error: "Interview too short to review" });

  const transcriptText = transcript
    .map((t: { role: string; content: string }) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");

  // ── Fetch discrepancy context ─────────────────────────────────────
  const { data: disc } = await supabase
    .from("discrepancies")
    .select(`
      id, jetinsight_discrepancy_id, registration_at_event, title, pilot_report,
      corrective_action, technician_name, company, found_at, signoff_date,
      location_raw, location_icao, ata_chapter_raw, amm_references,
      airframe_hours, airframe_cycles, status,
      aircraft:aircraft_id (make, model_full, serial_number)
    `)
    .eq("id", enrichment.discrepancy_id)
    .single();

  const aircraft = disc?.aircraft as { make: string; model_full: string; serial_number: string } | null;
  const discrepancyContext = disc ? `DISCREPANCY RECORD CONTEXT:
ID: ${disc.jetinsight_discrepancy_id || disc.id}
Aircraft: ${aircraft?.model_full || "Unknown"} (S/N: ${aircraft?.serial_number || "N/A"})
Tail: ${disc.registration_at_event || "N/A"}
Title: ${disc.title}
Pilot Report: ${disc.pilot_report || "None"}
Corrective Action (formal): ${disc.corrective_action || "None recorded"}
ATA Chapter: ${disc.ata_chapter_raw || "N/A"}
AMM References: ${(disc.amm_references as string[] | null)?.join(", ") || "None"}
Technician: ${disc.technician_name || "Unknown"}${disc.company ? ` (${disc.company})` : ""}
Found: ${disc.found_at || "N/A"}
Signed Off: ${disc.signoff_date || "N/A"}
Location: ${disc.location_raw || ""}${disc.location_icao ? ` (${disc.location_icao})` : ""}
Airframe: ${disc.airframe_hours || "N/A"} hrs / ${disc.airframe_cycles || "N/A"} cycles
Status: ${disc.status}` : "";

  // ── Resolve live playbook sections ───────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "AI service not configured" });

  const sections = await resolvePlaybookSections("mechanic-interview", supabase);
  const sectionsBlock = sectionsToContextBlock(sections);

  // ── Run Sonnet critique ───────────────────────────────────────────
  const client = new Anthropic({ apiKey });

  const critiqueResponse = await client.messages.create({
    model: DW1GHT_CONFIG.reviewModel,
    max_tokens: 1500,
    system: DW1GHT_CONFIG.selfCritiquePrompt
      + `\n\n=== DW1GHT'S CURRENT PLAYBOOK SECTIONS (exact text — quote verbatim for replace_text) ===\n\n${sectionsBlock}`
      + (discrepancyContext ? `\n\n${discrepancyContext}` : ""),
    messages: [{ role: "user", content: `Review this interview transcript:\n\n${transcriptText}` }],
  });

  let raw = critiqueResponse.content[0].type === "text" ? critiqueResponse.content[0].text : "{}";
  raw = raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  let critique: {
    overall_grade?: string;
    story_extraction_assessment?: string;
    playbook_suggestions?: Array<{
      section_key: string;
      change_type: string;
      source_text?: string;
      suggested_text: string;
      reasoning?: string;
    }>;
  };

  try {
    critique = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) { try { critique = JSON.parse(match[0]); } catch { critique = {}; } }
    else { critique = {}; }
  }

  console.log(`[DW1GHT Refire] Grade: ${critique.overall_grade || "N/A"} | Enrichment: ${enrichment_id}`);

  // ── Save suggestions ──────────────────────────────────────────────
  const validSectionKeys = ["allowed_context", "instructions", "decision_logic", "output_definition", "post_processing", "tone_calibration"];
  const validChangeTypes = ["append", "replace_text", "replace_section"];
  const suggestions = (critique.playbook_suggestions || []).filter(
    (s) => s.section_key && s.suggested_text
      && validSectionKeys.includes(s.section_key)
      && validChangeTypes.includes(s.change_type),
  );

  if (suggestions.length > 0) {
    const { error: insErr } = await supabase.from("dw1ght_playbook_suggestions").insert(
      suggestions.map((s) => ({
        playbook_slug: "mechanic-interview",
        section_key: s.section_key,
        change_type: s.change_type,
        source_text: s.source_text || null,
        suggested_text: s.suggested_text,
        reasoning: s.reasoning || null,
        source_type: "self_critique",
        source_id: enrichment_id,
        review_status: "pending",
      })),
    );
    if (insErr) {
      console.error("[DW1GHT Refire] Suggestion insert failed:", insErr.message);
      return json(500, { error: "Failed to save suggestions" });
    }
  }

  return json(200, {
    ok: true,
    grade: critique.overall_grade || null,
    story_extraction_assessment: critique.story_extraction_assessment || null,
    suggestions_count: suggestions.length,
    usage: {
      input_tokens: critiqueResponse.usage.input_tokens,
      output_tokens: critiqueResponse.usage.output_tokens,
    },
  });
};
