// ============================================================================
// Server-side approval PDF renderer (Netlify function helper)
// ============================================================================
// Wraps buildApprovalPdf so the same pure-jsPDF builder used in the browser
// runs inside Netlify Node functions. Returns the PDF as a Uint8Array ready
// to upload into the bb-approvals storage bucket.
// ============================================================================

import {
  buildApprovalPdf,
  type BuildApprovalPdfOptions,
} from "../../src/features/beet-box/modules/work-orders/pdfs/buildApprovalPDF"

export function renderApprovalPdfBytes(opts: BuildApprovalPdfOptions): Uint8Array {
  const doc = buildApprovalPdf(opts)
  // jsPDF's arraybuffer output is the cleanest handoff for Supabase storage.
  // In Node (Netlify functions) `Buffer` is the supported upload body type;
  // Buffer is a Uint8Array subclass so the return type still holds.
  const ab = doc.output("arraybuffer") as ArrayBuffer
  if (typeof Buffer !== "undefined") {
    return Buffer.from(ab) as unknown as Uint8Array
  }
  return new Uint8Array(ab)
}
