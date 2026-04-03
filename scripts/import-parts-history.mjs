/**
 * One-time import of historical parts orders from the Google Form CSV.
 *
 * Usage:  node scripts/import-parts-history.mjs
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (service role bypasses RLS).
 */

import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

// ─── Config ──────────────────────────────────────────────────────────────────

const CSV_PATH =
  "C:/Users/jon_b/Downloads/Parts Ordering for Skyshare.csv/Parts Ordering for Skyshare.csv"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE env vars")
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Lookup maps ─────────────────────────────────────────────────────────────

// email → profile id (from Supabase)
const EMAIL_TO_PROFILE = {
  "rpaden@skyshare.com":      "ffe0c505-b77d-4093-b57d-cb29c6dc53e1",
  "esantana@skyshare.com":    "e80af166-908c-45f5-9606-856fc5bee8cb",
  "dbassett@skyshare.com":    "0639d1e7-2e03-494d-b6ca-441c26d2a207",
}

// Fallback profile for users without accounts (historical)
const FALLBACK_PROFILE = "ffe0c505-b77d-4093-b57d-cb29c6dc53e1" // Rich Paden

// tail → aircraft_id
const TAIL_TO_AIRCRAFT = {
  "N409KG": "08e0e6ea-1bcb-40de-80e5-538c3639ddf2",
  "N413UU": "2e880dd0-8562-4497-8e4b-2cfbdbd22def",
  "N418T":  "84399632-4904-4e42-a9d3-dd60360f8f0d",
  "N450JF": "0d82cc67-0153-4264-84df-768ff7048fe2",
  "N477KR": "d6714593-fe9b-4862-ae33-29c0c4e243b2",
  "N499CB": "243f41dd-3922-401c-b6b2-f4624591e290",
  "N511DR": "ac116cbc-a88d-4397-830f-406a3cbac9ed",
  "N515RP": "3ee2618b-1e6f-4c50-b925-04aa451cce4d",
  "N563CB": "d8df23ea-9f24-48e5-a80d-65a4414186b8",
  "N606CB": "dfece469-1f12-4c78-8005-ea289fc85dff",
  "N612FA": "867f572e-2ba2-43e6-83a3-bf39326f7ab5",
  "N650JF": "b9b4fb41-a7bd-49af-a28e-e2523290969f",
  "N663CB": "372dbceb-f992-436f-9876-5f272aa0e5a6",
  "N6TM":   "feb7772e-83e1-4b0e-96a2-dbdd6611894f",
  "N739S":  "a1647869-4928-40f7-990f-ddfcfe3264f4",
  "N744CB": "582b5a57-ac50-4ba9-821a-ed9d49cdeb73",
  "N766CB": "c7bccd07-1818-4d99-8526-cf74f6039533",
  "N785PD": "c92f2049-bb6c-4fbf-a31e-3b3d85590782",
  "N787JS": "7fbc07f9-7015-43c3-9719-272a01f0ef47",
  "N860CB": "ba7a2ae4-3e68-4c31-ac6c-b5b1ecfdc679",
  "N861CB": "628fb55b-c1e7-4d63-b2cc-883be58c80a3",
  "N863CB": "80bd387a-3406-4280-88b6-a9c6514ec9f6",
  "N868CB": "8185372e-488c-498c-8214-f34604dc2df0",
  "N870CB": "a57d7aa9-8e6b-4078-845d-f82502f3f757",
  "N871CB": "a55eb8c8-23f5-4f47-8e7a-1717f82aecf4",
  "N963CB": "7823f399-f623-4f43-8005-098753196a46",
}

// ─── CSV parser (handles quoted fields with embedded newlines) ────────────────

function parseCSV(text) {
  const rows = []
  let i = 0
  const len = text.length

  while (i < len) {
    const row = []
    while (i < len) {
      if (text[i] === '"') {
        // Quoted field
        i++ // skip opening quote
        let field = ""
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              field += '"'
              i += 2
            } else {
              i++ // skip closing quote
              break
            }
          } else {
            field += text[i]
            i++
          }
        }
        row.push(field)
        // skip comma or line break after field
        if (i < len && text[i] === ',') i++
        else if (i < len && (text[i] === '\r' || text[i] === '\n')) {
          if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i += 2
          else i++
          break
        }
      } else {
        // Unquoted field
        let field = ""
        while (i < len && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
          field += text[i]
          i++
        }
        row.push(field)
        if (i < len && text[i] === ',') i++
        else if (i < len && (text[i] === '\r' || text[i] === '\n')) {
          if (text[i] === '\r' && i + 1 < len && text[i + 1] === '\n') i += 2
          else i++
          break
        }
      }
    }
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
  }
  return rows
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isStockOrder(tail) {
  const t = tail.toLowerCase().trim()
  return t === "stock" || t === "stoxk" || t === "shop" || t.includes("stock") || t.includes("shop")
}

function normalizeTail(raw) {
  let t = raw.trim().toUpperCase()
  // Fix common data entry: "871cb" → "N871CB"
  if (/^\d{3,4}[A-Z]{2}$/.test(t)) t = "N" + t
  return t
}

function parseCondition(raw) {
  const c = raw.toLowerCase().trim()
  if (c.includes("any")) return "any"
  if (c.includes("time")) return "new_overhaul_with_times"
  return "new_overhaul"
}

function parseYesNo(raw) {
  const v = raw.toLowerCase().trim()
  return v === "yes" || v === "y" || v === "true"
}

function parseTimestamp(raw) {
  // "2025/03/24 10:06:45 AM CST" → ISO
  const cleaned = raw.replace(" CST", "").replace(" CDT", "").trim()
  const d = new Date(cleaned)
  if (isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

function parseShipTo(raw) {
  const v = raw.trim().toUpperCase()
  if (v === "OGD" || v === "OGDEN" || v === "KOGD") return "OGD"
  if (v === "SLC") return "SLC"
  if (v === "MZJ") return "MZJ"
  return raw.trim() || "OGD"
}

/**
 * Parse the messy "Part Numbers" field into individual lines.
 * People entered things like:
 *   "973.81.15.106   QTY 1"
 *   "P/N 9914130-6 QTY 1"
 *   "34-0050656-00   Lamp Assy   1 (ea)"
 *   "PE4397 QTY 3, PE4044 QTY 3"
 *   Multi-line with Shift+Enter
 */
function parsePartLines(raw) {
  if (!raw || !raw.trim()) return [{ part_number: "See notes", quantity: 1 }]

  // Split on newlines first, then commas that separate distinct parts
  const chunks = raw.split(/\n/)
    .flatMap(line => {
      // Split on comma only if it separates what looks like distinct parts
      const parts = line.split(/,\s*(?=[A-Z0-9])/)
      return parts
    })
    .map(s => s.trim())
    .filter(Boolean)

  const results = []

  for (const chunk of chunks) {
    let pn = chunk
    let qty = 1
    let desc = null
    let altPn = null

    // Extract QTY patterns
    const qtyMatch = chunk.match(/QTY[:\s]*(\d+)/i) ||
                     chunk.match(/[Xx](\d+)\b/) ||
                     chunk.match(/(\d+)\s*\(ea\)/i)
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1]) || 1
      pn = pn.replace(qtyMatch[0], "").trim()
    }

    // Extract "Item N" references (not part of the P/N)
    pn = pn.replace(/\s*Item\s*#?\s*\d+/gi, "").trim()

    // Extract description after P/N (e.g. "34-0050656-00   Lamp Assy")
    const descMatch = pn.match(/^([A-Z0-9][\w.-]+)\s{2,}(.+)$/i)
    if (descMatch) {
      pn = descMatch[1].trim()
      desc = descMatch[2].trim()
    }

    // Extract ALT P/N
    const altMatch = pn.match(/\bALT(?:ERNATE)?S?\s*(?:P\/N)?\s*[:\s]*([A-Z0-9][\w.-]+(?:\s*,\s*[A-Z0-9][\w.-]+)*)/i)
    if (altMatch) {
      altPn = altMatch[1].trim()
      pn = pn.replace(altMatch[0], "").trim()
    }

    // Clean up "P/N" prefix
    pn = pn.replace(/^P\/N\s*/i, "").trim()
    // Remove trailing commas, dashes, spaces
    pn = pn.replace(/[,\s-]+$/, "").trim()
    // Remove "from Aviall" or similar vendor notes from P/N
    pn = pn.replace(/\s+from\s+\w+$/i, "").trim()

    if (pn) {
      results.push({ part_number: pn, quantity: qty, description: desc, alternate_pn: altPn })
    }
  }

  return results.length > 0 ? results : [{ part_number: "See notes", quantity: 1 }]
}

function parseWO(raw) {
  const v = raw.trim()
  if (!v || v.toLowerCase() === "stock" || v.toLowerCase() === "n/a" || v.toLowerCase() === "na" || v.toLowerCase() === "none") {
    return { workOrder: null, itemNumber: null }
  }
  // "3553 Item 1" or "WO 4494 Item 1" or "3585 item 1"
  const m = v.match(/(?:WO\s*)?(\S+)\s*(?:Item\s*#?\s*(\d+))?/i)
  if (m) {
    return { workOrder: m[1], itemNumber: m[2] || null }
  }
  return { workOrder: v, itemNumber: null }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const raw = readFileSync(CSV_PATH, "utf-8")
  const rows = parseCSV(raw)

  // Skip header
  const header = rows[0]
  console.log(`CSV columns: ${header.length}`)
  console.log(`Data rows: ${rows.length - 1}`)

  // Skip test rows (first 3 data rows are tests from rpaden/jgammel)
  const dataRows = rows.slice(1).filter(row => {
    const tail = row[2]?.toLowerCase().trim() || ""
    const wo = row[3]?.toLowerCase().trim() || ""
    return !(tail.startsWith("test") || wo.startsWith("test"))
  })
  console.log(`After removing test rows: ${dataRows.length}`)

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const row of dataRows) {
    try {
      const [
        timestamp, username, tailRaw, woRaw, partsRaw,
        /* qtyCheck */, conditionRaw, dateNeeded, allAtOnceRaw,
        delayRtsRaw, shipToRaw, aogRaw, notes, aogSn, squawk
      ] = row

      const email = username?.trim().toLowerCase()
      const profileId = EMAIL_TO_PROFILE[email] || FALLBACK_PROFILE
      const stock = isStockOrder(tailRaw)
      const tail = stock ? null : normalizeTail(tailRaw)
      const aircraftId = tail ? (TAIL_TO_AIRCRAFT[tail] || null) : null
      const { workOrder, itemNumber } = parseWO(woRaw)
      const condition = parseCondition(conditionRaw || "")
      const aog = parseYesNo(aogRaw || "")
      const allAtOnce = parseYesNo(allAtOnceRaw || "")
      const delayRts = parseYesNo(delayRtsRaw || "")
      const shipTo = parseShipTo(shipToRaw || "")
      const createdAt = parseTimestamp(timestamp)

      // Job description: for aircraft = tail + context, for stock = purpose
      let jobDescription = ""
      if (stock) {
        jobDescription = woRaw?.trim() || tailRaw?.trim() || "Stock order"
        if (jobDescription.toLowerCase() === "stock" || jobDescription.toLowerCase() === "n/a") {
          jobDescription = notes?.trim() || "Stock order"
        }
      } else {
        // Use WO as job description context, or fallback
        jobDescription = woRaw?.trim() || "Parts request"
      }

      // Build ship_to_address for non-standard locations
      let shipToAddress = null
      const stdLocations = ["OGD", "SLC", "MZJ"]
      if (!stdLocations.includes(shipTo)) {
        shipToAddress = shipTo
      }
      const finalShipTo = stdLocations.includes(shipTo) ? shipTo : "Other"

      // Parse date needed
      let parsedDateNeeded = dateNeeded?.trim() || null
      if (parsedDateNeeded) {
        const d = new Date(parsedDateNeeded)
        if (isNaN(d.getTime())) parsedDateNeeded = null
        else parsedDateNeeded = d.toISOString().split("T")[0]
      }
      if (!parsedDateNeeded) parsedDateNeeded = createdAt.split("T")[0]

      // Build notes combining original notes + AOG info
      const notesParts = []
      if (notes?.trim() && !["stock", "hi", "n/a"].includes(notes.trim().toLowerCase())) {
        notesParts.push(notes.trim())
      }
      if (aog && aogSn?.trim() && !["stock", "hi", "n/a"].includes(aogSn.trim().toLowerCase())) {
        notesParts.push(`Removed: ${aogSn.trim()}`)
      }
      if (aog && squawk?.trim() && !["stock", "hi", "n/a"].includes(squawk.trim().toLowerCase())) {
        notesParts.push(`Squawk: ${squawk.trim()}`)
      }
      // Add original submitter email for reference
      notesParts.push(`Submitted by: ${email}`)
      const combinedNotes = notesParts.join("\n")

      // AOG fields
      const aogRemovedPn = aog && aogSn?.trim() ? aogSn.trim().split(/\n/)[0].replace(/^(?:PN|P\/N)[:\s]*/i, "").trim() || null : null
      const aogRemovedSn = aog && aogSn?.trim() ? (() => {
        const snMatch = aogSn.match(/S\/?\s*N[:\s]*(\S+)/i)
        return snMatch ? snMatch[1] : null
      })() : null
      const aogSquawk = aog && squawk?.trim() && !["stock", "hi", "n/a"].includes(squawk.trim().toLowerCase()) ? squawk.trim() : null

      // Insert request
      const { data: req, error: reqErr } = await db
        .from("parts_requests")
        .insert({
          order_type: stock ? "stock" : "aircraft",
          aircraft_id: aircraftId,
          aircraft_tail: tail,
          job_description: jobDescription,
          work_order: workOrder,
          item_number: itemNumber,
          stock_purpose: stock ? jobDescription : null,
          date_needed: parsedDateNeeded,
          ship_to: finalShipTo,
          ship_to_address: shipToAddress,
          all_at_once: allAtOnce,
          delay_affects_rts: delayRts,
          aog,
          aog_removed_pn: aogRemovedPn,
          aog_removed_sn: aogRemovedSn,
          aog_squawk: aogSquawk,
          notes: combinedNotes,
          status: "closed",
          requested_by: profileId,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select("id")
        .single()

      if (reqErr) {
        console.error(`Row error: ${reqErr.message} | tail=${tailRaw} wo=${woRaw}`)
        errors++
        continue
      }

      // Parse and insert part lines
      const partLines = parsePartLines(partsRaw)
      const lineInserts = partLines.map((pl, i) => ({
        request_id: req.id,
        line_number: i + 1,
        part_number: pl.part_number,
        alternate_pn: pl.alternate_pn || null,
        description: pl.description || null,
        quantity: pl.quantity,
        condition,
        line_status: "closed",
      }))

      const { error: lineErr } = await db
        .from("parts_request_lines")
        .insert(lineInserts)

      if (lineErr) {
        console.error(`Lines error for ${req.id}: ${lineErr.message}`)
        errors++
        continue
      }

      // Status history entry
      await db.from("parts_status_history").insert({
        request_id: req.id,
        old_status: null,
        new_status: "closed",
        changed_by: profileId,
        note: `Imported from Google Form history`,
      })

      inserted++
    } catch (err) {
      console.error(`Exception: ${err.message}`)
      errors++
    }
  }

  console.log(`\nDone: ${inserted} imported, ${skipped} skipped, ${errors} errors`)
}

main()
