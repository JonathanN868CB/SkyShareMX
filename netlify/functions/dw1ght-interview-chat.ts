import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { DW1GHT_CONFIG } from "./_dw1ght-config";
import { resolvePlaybook, resolvePlaybookSections, sectionsToContextBlock } from "./_dw1ght-playbooks";

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

interface InterviewPayload {
  action: "start" | "message" | "complete";
  enrichment_id?: string;
  assignment_id?: string;
  discrepancy_id?: string;
  message?: string;
  history?: Array<{ role: string; content: string }>;
}

// ── Constants ────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helpers ──────────────────────────────────────────────────────
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

// ── Fetch discrepancy context for the interview ─────────────────
async function getDiscrepancyContext(discrepancyId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("discrepancies")
    .select(`
      id, jetinsight_discrepancy_id, registration_at_event, title, pilot_report,
      corrective_action, technician_name, company, found_at, signoff_date,
      location_raw, location_icao, ata_chapter_raw, amm_references,
      airframe_hours, airframe_cycles, status,
      aircraft:aircraft_id (make, model_full, serial_number)
    `)
    .eq("id", discrepancyId)
    .single();

  if (error || !data) return null;

  const aircraft = data.aircraft as { make: string; model_full: string; serial_number: string } | null;

  return `DISCREPANCY RECORD CONTEXT:
ID: ${data.jetinsight_discrepancy_id || data.id}
Aircraft: ${aircraft?.model_full || "Unknown"} (S/N: ${aircraft?.serial_number || "N/A"})
Tail: ${data.registration_at_event || "N/A"}
Title: ${data.title}
Pilot Report: ${data.pilot_report || "None"}
Corrective Action (formal): ${data.corrective_action || "None recorded"}
ATA Chapter: ${data.ata_chapter_raw || "N/A"}
AMM References: ${data.amm_references?.join(", ") || "None"}
Technician: ${data.technician_name || "Unknown"}${data.company ? ` (${data.company})` : ""}
Found: ${data.found_at || "N/A"}
Signed Off: ${data.signoff_date || "N/A"}
Location: ${data.location_raw || ""}${data.location_icao ? ` (${data.location_icao})` : ""}
Airframe: ${data.airframe_hours || "N/A"} hrs / ${data.airframe_cycles || "N/A"} cycles
Status: ${data.status}`;
}

// getLearningsContext() removed — replaced by getPlaybookLearnings() in _dw1ght-playbooks.ts
// System prompt is now assembled by resolvePlaybook("mechanic-interview", supabase)

// ── Start Interview: create enrichment row + return opening ─────
async function handleStart(
  client: Anthropic,
  payload: InterviewPayload,
): Promise<HandlerResponse> {
  const supabase = getSupabase();
  if (!supabase) return json(500, { error: "Database not configured" });

  const { assignment_id, discrepancy_id } = payload;
  if (!assignment_id || !discrepancy_id) {
    return json(400, { error: "assignment_id and discrepancy_id are required" });
  }

  // Get assignment details
  const { data: assignment, error: assignErr } = await supabase
    .from("interview_assignments")
    .select("id, assigned_to, dom_note, status")
    .eq("id", assignment_id)
    .single();

  if (assignErr || !assignment) {
    return json(404, { error: "Assignment not found" });
  }

  // Get the assignee's name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", assignment.assigned_to)
    .single();

  // Get discrepancy context
  const context = await getDiscrepancyContext(discrepancy_id);
  if (!context) {
    return json(404, { error: "Discrepancy not found" });
  }

  // Create the enrichment row
  const { data: enrichment, error: enrichErr } = await supabase
    .from("discrepancy_enrichments")
    .insert({
      discrepancy_id,
      enrichment_type: "mechanic_interview",
      interviewee_name: profile?.full_name || "Unknown",
      status: "in_progress",
      raw_transcript: [],
    })
    .select("id")
    .single();

  if (enrichErr) {
    console.error("[DW1GHT Interview] Enrichment insert failed:", enrichErr.message);
    return json(500, { error: "Failed to create interview session" });
  }

  // Update assignment status to in_progress
  await supabase
    .from("interview_assignments")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", assignment_id);

  // Generate opening message
  const domNoteContext = assignment.dom_note
    ? `\n\nThe DOM (Jonathan) left this note for the interview: "${assignment.dom_note}"\nWork this context into your questions naturally — don't read it verbatim.`
    : "";

  // resolvePlaybook builds: identity + instructions + decision_logic + tone_calibration + active learnings
  const playbookPrompt = await resolvePlaybook("mechanic-interview", supabase);

  const response = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: 500,
    system: playbookPrompt
      + `\n\nYou are in the OPENING phase. The mechanic's name is ${profile?.full_name || "the technician"}.`
      + domNoteContext
      + `\n\n${context}`
      + `\n\nGenerate your opening message. Lead with the discrepancy ID, tail number, title, and date prominently so the mechanic knows exactly which event this is about. Then ask ONE question: confirm whether they worked on this event directly. Do not assume they did the work.`,
    messages: [{ role: "user", content: "Begin the interview." }],
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Save opening to transcript
  const transcript = [
    { role: "assistant", content: reply, timestamp: new Date().toISOString() },
  ];

  await supabase
    .from("discrepancy_enrichments")
    .update({ raw_transcript: transcript })
    .eq("id", enrichment.id);

  return json(200, {
    enrichment_id: enrichment.id,
    reply,
    phase: "opening",
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
}

// ── Message: continue the interview conversation ────────────────
async function handleMessage(
  client: Anthropic,
  payload: InterviewPayload,
): Promise<HandlerResponse> {
  const supabase = getSupabase();
  if (!supabase) return json(500, { error: "Database not configured" });

  const { enrichment_id, discrepancy_id, message, history } = payload;
  if (!enrichment_id || !discrepancy_id || !message) {
    return json(400, { error: "enrichment_id, discrepancy_id, and message are required" });
  }

  // Get discrepancy context
  const context = await getDiscrepancyContext(discrepancy_id);
  if (!context) return json(404, { error: "Discrepancy not found" });

  // Determine phase based on exchange count
  const exchangeCount = (history?.length || 0) + 1; // +1 for current message
  let phase: "opening" | "deep_dive" | "closing";
  if (exchangeCount <= 2) phase = "opening";
  else if (exchangeCount >= 14) phase = "closing";
  else phase = "deep_dive";

  const phaseInstruction = phase === "closing"
    ? "\n\nYou are in the CLOSING phase. Start wrapping up. Summarize key points you heard and ask if there's anything else the next mechanic should know."
    : phase === "opening"
      ? "\n\nYou are in the OPENING phase. Focus on confirming the mechanic worked on this event and what they first encountered."
      : "\n\nYou are in the DEEP_DIVE phase. Extract diagnostic details, parts, tools, timeline, root cause thinking, and golden nuggets.";

  // Build conversation
  const recentHistory = (history || []).slice(-20);
  const messages: Anthropic.MessageParam[] = [
    ...recentHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  // resolvePlaybook builds: identity + instructions + decision_logic + tone_calibration + active learnings
  const playbookPrompt = await resolvePlaybook("mechanic-interview", supabase);

  const response = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: 400,
    system: playbookPrompt
      + phaseInstruction
      + `\n\n${context}`,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Save transcript (append user message + assistant reply)
  const { data: enrichment } = await supabase
    .from("discrepancy_enrichments")
    .select("raw_transcript")
    .eq("id", enrichment_id)
    .single();

  const transcript = Array.isArray(enrichment?.raw_transcript) ? enrichment.raw_transcript : [];
  transcript.push(
    { role: "user", content: message, timestamp: new Date().toISOString() },
    { role: "assistant", content: reply, timestamp: new Date().toISOString() },
  );

  await supabase
    .from("discrepancy_enrichments")
    .update({ raw_transcript: transcript })
    .eq("id", enrichment_id);

  return json(200, {
    reply,
    phase,
    exchangeCount,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
}

// ── Complete: generate summary + corrections ────────────────────
async function handleComplete(
  client: Anthropic,
  payload: InterviewPayload,
): Promise<HandlerResponse> {
  const supabase = getSupabase();
  if (!supabase) return json(500, { error: "Database not configured" });

  const { enrichment_id, discrepancy_id, assignment_id } = payload;
  if (!enrichment_id || !discrepancy_id) {
    return json(400, { error: "enrichment_id and discrepancy_id are required" });
  }

  // Fetch the full transcript
  const { data: enrichment, error: enrichErr } = await supabase
    .from("discrepancy_enrichments")
    .select("raw_transcript")
    .eq("id", enrichment_id)
    .single();

  if (enrichErr || !enrichment) {
    return json(404, { error: "Interview session not found" });
  }

  const transcript = Array.isArray(enrichment.raw_transcript) ? enrichment.raw_transcript : [];
  if (transcript.length < 2) {
    return json(400, { error: "Interview too short to generate summary" });
  }

  // Get discrepancy context for the completion prompt
  const context = await getDiscrepancyContext(discrepancy_id);

  // Format transcript for analysis
  const transcriptText = transcript
    .map((t: { role: string; content: string }) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");

  // Generate structured summary
  const response = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: 2000,
    system: DW1GHT_CONFIG.interviewCompletionPrompt + (context ? `\n\n${context}` : ""),
    messages: [{ role: "user", content: `Full interview transcript:\n\n${transcriptText}` }],
  });

  let rawOutput = response.content[0].type === "text" ? response.content[0].text : "{}";

  // Strip markdown code fences if Claude wrapped the JSON
  rawOutput = rawOutput.trim();
  if (rawOutput.startsWith("```")) {
    rawOutput = rawOutput.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Parse the JSON output
  let analysis: {
    narrative_summary?: string;
    structured_data?: Record<string, unknown>;
    golden_nuggets?: string;
    suggested_corrections?: Array<{
      field: string;
      original: string;
      suggested: string;
      reason: string;
    }>;
  };

  try {
    analysis = JSON.parse(rawOutput);
  } catch {
    // Try to extract JSON from the response if it's embedded in other text
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("[DW1GHT Interview] Failed to parse completion output:", rawOutput.slice(0, 200));
        analysis = {
          narrative_summary: rawOutput,
          structured_data: {},
          golden_nuggets: "",
          suggested_corrections: [],
        };
      }
    } else {
      console.error("[DW1GHT Interview] Failed to parse completion output:", rawOutput.slice(0, 200));
      analysis = {
        narrative_summary: rawOutput,
        structured_data: {},
        golden_nuggets: "",
        suggested_corrections: [],
      };
    }
  }

  // Filter corrections to only correctable fields
  const validCorrections = (analysis.suggested_corrections || []).filter((c) =>
    (DW1GHT_CONFIG.correctableFields as readonly string[]).includes(c.field),
  );

  // Update the enrichment row
  const { error: updateErr } = await supabase
    .from("discrepancy_enrichments")
    .update({
      status: "completed",
      session_completed_at: new Date().toISOString(),
      narrative_summary: analysis.narrative_summary || "",
      structured_data: analysis.structured_data || {},
      golden_nuggets: analysis.golden_nuggets || "",
      suggested_corrections: validCorrections,
    })
    .eq("id", enrichment_id);

  if (updateErr) {
    console.error("[DW1GHT Interview] Enrichment update failed:", updateErr.message);
    return json(500, { error: "Failed to save interview results" });
  }

  // Update assignment status
  if (assignment_id) {
    await supabase
      .from("interview_assignments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment_id);
  }

  // ── Self-critique via Sonnet (async, non-blocking) ────────────
  // Resolve the live playbook sections so Sonnet can quote exact passages
  // for replace_text suggestions — sections passed individually, not merged.
  resolvePlaybookSections("mechanic-interview", supabase).then((sections) => {
    generateSelfCritique(client, supabase, enrichment_id, transcriptText, context || "", sections).catch((err) => {
      console.error("[DW1GHT Self-Critique] Failed:", err);
    });
  }).catch((err) => {
    console.error("[DW1GHT Self-Critique] resolvePlaybookSections failed:", err);
  });

  return json(200, {
    status: "completed",
    narrative_summary: analysis.narrative_summary,
    structured_data: analysis.structured_data,
    golden_nuggets: analysis.golden_nuggets,
    suggested_corrections: validCorrections,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
}

// ── Self-Critique: Sonnet reviews Haiku's interview ────────────
async function generateSelfCritique(
  client: Anthropic,
  supabase: ReturnType<typeof createClient>,
  enrichmentId: string,
  transcriptText: string,
  discrepancyContext: string,
  sections: Record<string, string>,
) {
  console.log("[DW1GHT Self-Critique] Starting Sonnet review for enrichment:", enrichmentId);

  const sectionsBlock = sectionsToContextBlock(sections);

  const critiqueResponse = await client.messages.create({
    model: DW1GHT_CONFIG.reviewModel,
    max_tokens: 1500,
    system: DW1GHT_CONFIG.selfCritiquePrompt
      + `\n\n=== DW1GHT'S CURRENT PLAYBOOK SECTIONS (exact text — quote verbatim for replace_text) ===\n\n${sectionsBlock}`
      + (discrepancyContext ? `\n\n${discrepancyContext}` : ""),
    messages: [{ role: "user", content: `Review this interview transcript:\n\n${transcriptText}` }],
  });

  let critiqueRaw = critiqueResponse.content[0].type === "text" ? critiqueResponse.content[0].text : "{}";
  critiqueRaw = critiqueRaw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

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
    critique = JSON.parse(critiqueRaw);
  } catch {
    const jsonMatch = critiqueRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { critique = JSON.parse(jsonMatch[0]); } catch { critique = {}; }
    } else {
      critique = {};
    }
  }

  console.log("[DW1GHT Self-Critique] Grade:", critique.overall_grade || "N/A", "|", critique.story_extraction_assessment || "");

  // Save any playbook suggestions to the suggestions table
  const validSectionKeys = ["allowed_context", "instructions", "decision_logic", "output_definition", "post_processing", "tone_calibration"];
  const validChangeTypes = ["append", "replace_text", "replace_section"];
  const suggestions = (critique.playbook_suggestions || []).filter(
    (s) => s.section_key && s.suggested_text
      && validSectionKeys.includes(s.section_key)
      && validChangeTypes.includes(s.change_type),
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
        source_type: "self_critique",
        source_id: enrichmentId,
        review_status: "holding",
      })),
    );
    if (suggErr) {
      console.error("[DW1GHT Self-Critique] Suggestion insert failed:", suggErr.message);
    } else {
      console.log(`[DW1GHT Self-Critique] Saved ${suggestions.length} playbook suggestion(s).`);
    }
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

  let payload: InterviewPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, { error: "AI service not configured" });
  }

  const client = new Anthropic({ apiKey });

  console.log("[DW1GHT Interview] Action:", payload.action, "| Enrichment:", payload.enrichment_id || "NEW");

  switch (payload.action) {
    case "start":
      return handleStart(client, payload);
    case "message":
      return handleMessage(client, payload);
    case "complete":
      return handleComplete(client, payload);
    default:
      return json(400, { error: "Invalid action. Use: start, message, complete" });
  }
};
