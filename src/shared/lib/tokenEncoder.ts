// Encodes/decodes UUID tokens for use in public URLs.
// UUID (hex with dashes) → base62 (mixed-case alphanumeric, no dashes)
// /r/308cab32-bb2c-4fb2-8aff-ca3ee88090b5  →  /r/6JrDeZ2NwPTkYqBmX4vA8c

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

export function encodeToken(uuid: string): string {
  const hex = uuid.replace(/-/g, "")
  let num = BigInt("0x" + hex)
  let result = ""
  while (num > 0n) {
    result = BASE62[Number(num % 62n)] + result
    num /= 62n
  }
  return result.padStart(22, "0")
}

export function decodeToken(encoded: string): string {
  let num = 0n
  for (const char of encoded) {
    const idx = BASE62.indexOf(char)
    if (idx === -1) throw new Error("Invalid token")
    num = num * 62n + BigInt(idx)
  }
  const hex = num.toString(16).padStart(32, "0")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
