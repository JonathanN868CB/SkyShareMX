// records-vault-retry — DEPRECATED
//
// The Mistral OCR pipeline has been removed. OCR is now handled exclusively by the
// AWS Textract pipeline (S3 upload → SNS → records-vault-s3-ingest → Textract).
//
// To retry a document that failed OCR:
//   - Re-upload the document to S3 at the correct key path. The S3 event will
//     trigger records-vault-s3-ingest → Textract automatically.
//
// To retry a document that failed event extraction (OCR already done):
//   - Use records-vault-reextract instead, which re-triggers extract-record-events.

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};
type HandlerResponse = { statusCode: number; headers?: Record<string, string>; body?: string };

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  return {
    statusCode: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      error: "OCR retry is not available with the Textract pipeline. Re-upload the document to S3 to reprocess it, or use the re-extraction endpoint if OCR has already completed.",
    }),
  };
};
