import Anthropic from "@anthropic-ai/sdk";
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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!event.body) {
    return jsonResponse(400, { error: "Missing request body" });
  }

  let payload: { message?: unknown; history?: unknown };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  if (typeof payload.message !== "string" || !payload.message.trim()) {
    return jsonResponse(400, { error: "message is required" });
  }

  const history = Array.isArray(payload.history) ? payload.history : [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "AI service not configured" });
  }

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6), // keep last 3 exchanges max
    { role: "user", content: payload.message.trim() },
  ];

  const response = await client.messages.create({
    model: DW1GHT_CONFIG.model,
    max_tokens: DW1GHT_CONFIG.max_tokens,
    system: DW1GHT_CONFIG.systemPrompt,
    messages,
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  return jsonResponse(200, {
    reply,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
};
