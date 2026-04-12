// -----------------------------------------------------------------
//  DW1GHT Playbook Metadata — frontend-safe constants
//  This file mirrors the structure defined in netlify/functions/_dw1ght-playbooks.ts
//  but contains only display/schema metadata — no system prompt text.
//
//  The editable defaults (instructions, decision_logic, tone_calibration)
//  live in _dw1ght-playbooks.ts and are applied server-side at inference time.
//  The frontend shows overrides from dw1ght_playbook_overrides; if no override
//  exists the backend falls back to the code default automatically.
// -----------------------------------------------------------------

export type PlaybookSlug = "mechanic-interview" | "intel-chat" | "receiving-inspection";

export interface PlaybookMeta {
  slug: PlaybookSlug;
  name: string;
  description: string;
  triggerType: "user_invoke" | "workflow_step" | "auto";
  triggerLabel: string;
  status: "active" | "coming_soon";
  emoji: string;
  inputSchema: Record<string, string>;
  outputFormat: string;
  postProcessingSteps: string[];
  editableSections: Array<{
    key: "allowed_context" | "instructions" | "decision_logic" | "output_definition" | "post_processing" | "tone_calibration";
    label: string;
    description: string;
  }>;
}

export const PLAYBOOK_META: PlaybookMeta[] = [
  {
    slug: "mechanic-interview",
    name: "Mechanic Interview",
    description: "Structured post-maintenance interview. DW1GHT validates the discrepancy record against what the mechanic actually did, then extracts diagnostic steps, tribal knowledge, and golden nuggets not captured in the formal record.",
    triggerType: "workflow_step",
    triggerLabel: "Start Interview",
    status: "active",
    emoji: "🔧",
    inputSchema: {
      "discrepancy_id": "UUID of the discrepancy record being interviewed",
      "discrepancy_record": "Full field dump of the discrepancy (title, corrective action, ATA chapter, technician, location, etc.)",
      "phase": "'opening' | 'deep_dive' | 'closing' — advances automatically based on exchange count",
    },
    outputFormat: "Conversational AI response (2–3 sentences max). On completion: JSON with narrative_summary, structured_data, golden_nuggets, suggested_corrections.",
    postProcessingSteps: [
      "Self-critique via Sonnet — reviews transcript against interview rules, generates learnings",
      "DOM review gate — Jonathan reviews narrative, approves/rejects suggested field corrections",
      "Learnings to Inbox — both pathways produce inbox items for admin review before injection",
    ],
    editableSections: [
      {
        key: "allowed_context",
        label: "Allowed Context",
        description: "What data DW1GHT is permitted to reference. Sets the boundary between what it can cite, what it must ignore, and how to handle references to data outside its context window.",
      },
      {
        key: "instructions",
        label: "Operating Instructions",
        description: "The core job definition: mission, record validation protocol, interview conduct rules, phase guidance, and all special-case handling (proxy, MEL, repeat discrepancy, closing).",
      },
      {
        key: "decision_logic",
        label: "Decision / Escalation Rules",
        description: "How DW1GHT triages events (ROUTINE vs COMPLEX), when to go deep vs wrap up fast, and when to flag an issue for human escalation.",
      },
      {
        key: "output_definition",
        label: "Output Definition",
        description: "The exact structure of the final output: JSON schema, required fields, narrative format, and any flags DW1GHT must emit (REPEAT:, OPEN:, NOTE:).",
      },
      {
        key: "post_processing",
        label: "Post-Processing / Actions",
        description: "What signals DW1GHT must include in its output to drive downstream actions: self-critique triggers, DOM review routing, field correction flagging, follow-up creation.",
      },
      {
        key: "tone_calibration",
        label: "Persona & Tone",
        description: "Brevity rules and Schrute intensity dial. Controls response length, personality vs diagnostic balance, and how DW1GHT paces and closes the conversation.",
      },
    ],
  },
  {
    slug: "intel-chat",
    name: "Intelligence Chat",
    description: "General-purpose AI chat against fleet data. Handles SQL queries against discrepancy records, vector search against uploaded aircraft documents, and general aviation knowledge questions.",
    triggerType: "user_invoke",
    triggerLabel: "Ask DW1GHT",
    status: "coming_soon",
    emoji: "💬",
    inputSchema: {
      "message": "User's natural language question",
      "mode": "'schrute' | 'corporate' | 'troubleshooting'",
      "contextSources": "Array of active data lanes: 'discrepancies' | 'records' | 'interviews'",
      "history": "Recent message pairs for conversation context",
    },
    outputFormat: "Markdown reply with metadata: queryType, sqlGenerated, resultCount, ragChunksUsed.",
    postProcessingSteps: ["None — stateless per-request"],
    editableSections: [
      {
        key: "allowed_context",
        label: "Allowed Context",
        description: "Which data lanes DW1GHT can query: discrepancy records, interview transcripts, uploaded documents, fleet data. Sets hard limits on what it may cite.",
      },
      {
        key: "instructions",
        label: "Operating Instructions",
        description: "DW1GHT's identity and core behavior rules across all intel-chat modes.",
      },
      {
        key: "decision_logic",
        label: "Decision / Escalation Rules",
        description: "Query intent classification: when to hit SQL, when to use vector search, when to ask for clarification, fleet confirmation rules.",
      },
      {
        key: "output_definition",
        label: "Output Definition",
        description: "Response format for each query type: markdown structure, metadata fields, citation format, result count display.",
      },
      {
        key: "post_processing",
        label: "Post-Processing / Actions",
        description: "Stateless per-request — no post-processing for intel-chat. Use this section if logging or feedback capture is added.",
      },
      {
        key: "tone_calibration",
        label: "Persona & Tone",
        description: "Per-mode personality text (Full Schrute / Corporate / Troubleshooting). Controls register switching based on user's selected mode.",
      },
    ],
  },
  {
    slug: "receiving-inspection",
    name: "Receiving Inspection",
    description: "Reviews incoming parts against purchase orders. Triggered by a 'DW1GHT Review' button on a packing slip or PO record. Flags discrepancies, missing certs, wrong quantities, or airworthiness concerns.",
    triggerType: "workflow_step",
    triggerLabel: "DW1GHT Review",
    status: "coming_soon",
    emoji: "📦",
    inputSchema: {
      "po_number": "Purchase order number",
      "aircraft_id": "UUID of the target aircraft (optional)",
      "document_text": "OCR text from the packing slip or receiving document",
      "line_items": "Array of {part_number, qty, description} from the PO",
    },
    outputFormat: "JSON: { status: 'pass' | 'flag' | 'fail', findings[], suggested_actions[], confidence }",
    postProcessingSteps: [
      "Findings saved to dw1ght_receiving_reviews table",
      "Flagged items surface in receiving UI",
      "DOM notified for 'fail' decisions",
    ],
    editableSections: [
      {
        key: "allowed_context",
        label: "Allowed Context",
        description: "What source documents DW1GHT may reference: the provided packing slip OCR, the linked PO line items, the target aircraft record. Sets limits on outside inference.",
      },
      {
        key: "instructions",
        label: "Operating Instructions",
        description: "What DW1GHT checks during receiving inspection: quantity match, part number verification, cert documentation, airworthiness concerns, and how to structure findings.",
      },
      {
        key: "decision_logic",
        label: "Decision / Escalation Rules",
        description: "Pass / flag / fail thresholds, confidence minimums, when to escalate to the DOM, and when to reject outright vs hold for further review.",
      },
      {
        key: "output_definition",
        label: "Output Definition",
        description: "The required JSON structure: status, findings array, suggested_actions, confidence score, and any cert-tracking fields the receiving UI expects.",
      },
      {
        key: "post_processing",
        label: "Post-Processing / Actions",
        description: "What happens after the inspection runs: save findings to dw1ght_receiving_reviews, surface flagged items in the receiving UI, notify DOM on fail decisions.",
      },
      {
        key: "tone_calibration",
        label: "Persona & Tone",
        description: "Communication style for inspection reports. Compliance/corporate mode — precise, no personality, findings only.",
      },
    ],
  },
];
