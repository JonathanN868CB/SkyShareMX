/**
 * Deterministic SHA-256 signature fingerprint.
 *
 * Joins the given parts with `:` and returns a hex-encoded SHA-256 digest.
 * Used for both training acknowledgments (userId:recordId:timestamp) and
 * customer approval portals (name:email:approvalRequestId:timestamp) — the
 * verifiable record is `parts + hash` stored together.
 */

export async function computeSignatureHash(...parts: (string | number)[]): Promise<string> {
  const message = parts.map(String).join(":")
  const encoded = new TextEncoder().encode(message)
  const buffer  = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

export function shortSignatureHash(hash: string): string {
  return hash.slice(0, 12).toUpperCase()
}
