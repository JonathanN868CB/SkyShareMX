/**
 * Date utilities — all local-timezone-aware.
 *
 * JS quirk: `new Date("2026-04-08")` parses as UTC midnight, which shifts to
 * the previous day in any negative-UTC offset (like US Mountain Time).
 * These helpers avoid that by always appending `T00:00:00` when parsing
 * date-only strings and by using local date parts for "today."
 */

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight, not UTC.
 * If the string already contains "T", it's returned as-is via `new Date()`.
 */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes("T")) return new Date(dateStr)
  return new Date(dateStr + "T00:00:00")
}
