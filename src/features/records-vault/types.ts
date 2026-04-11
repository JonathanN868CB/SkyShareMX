export type SourceCategory =
  | "logbook"
  | "work_package"
  | "inspection"
  | "ad_compliance"
  | "major_repair"
  | "other"

export type IngestionStatus   = "pending" | "extracting" | "indexed" | "failed"
export type ExtractionStatus  = "pending" | "extracting" | "complete" | "failed"
export type ChunkStatus       = "pending" | "chunking" | "chunked" | "failed"

export type EventType =
  | "logbook_entry"
  | "inspection"
  | "ad_compliance"
  | "sb_compliance"
  | "component_install"
  | "component_removal"
  | "repair"
  | "alteration"
  | "overhaul"
  | "return_to_service"
  | "discrepancy"
  | "other"

export type RecordSource = {
  id: string
  aircraft_id: string
  original_filename: string
  file_hash: string | null
  storage_path: string | null
  file_size_bytes: number | null
  page_count: number | null
  source_category: SourceCategory
  observed_registration: string | null
  date_range_start: string | null
  date_range_end: string | null
  notes: string | null
  import_batch: string | null
  imported_by: string | null
  ingestion_status: IngestionStatus
  ingestion_error: string | null
  ocr_quality_score: number | null
  // Phase 2 fields
  extraction_status: ExtractionStatus
  extraction_completed_at: string | null
  extraction_error: string | null
  events_extracted: number | null
  // Phase 3 fields
  chunk_status: ChunkStatus
  chunks_generated: number | null
  // Rendering
  page_images_stored: number | null
  // AWS Textract pipeline fields
  s3_key: string | null
  textract_job_id: string | null
  created_at: string
  updated_at: string
}

export type SearchHit = {
  page_id: string
  record_source_id: string
  aircraft_id: string
  page_number: number
  original_filename: string
  source_category: SourceCategory
  observed_registration: string | null
  date_range_start: string | null
  date_range_end: string | null
  ocr_excerpt: string              // ts_headline output — contains <b>…</b> markers
  rank: number
}

export type MaintenanceEvent = {
  id: string
  aircraft_id: string
  record_source_id: string
  page_ids: string[]
  event_type: EventType
  event_date: string | null
  aircraft_total_time: number | null
  aircraft_cycles: number | null
  description: string
  part_numbers: string[]
  serial_numbers: string[]
  work_order_number: string | null
  ad_sb_number: string | null
  performed_by: string | null
  approved_by: string | null
  station: string | null
  confidence: number | null
  extraction_model: string | null
  extraction_notes: string | null
  // Joined from rv_record_sources (timeline RPC)
  original_filename?: string
  source_category?: SourceCategory
  // Pagination meta (timeline RPC)
  total_count?: number
  created_at: string
}

export type RecordComponent = {
  id: string
  aircraft_id: string
  part_number: string
  serial_number: string | null
  description: string | null
  installed_event_id: string | null
  installed_date: string | null
  installed_hours: number | null
  removed_event_id: string | null
  removed_date: string | null
  removed_hours: number | null
  time_installed: number | null   // computed by DB
  created_at: string
}

// Phase 3 — vector chunk (rv_page_chunks + rv_match_chunks RPC result)
export type PageChunk = {
  chunk_id: string
  page_id: string
  record_source_id: string
  aircraft_id: string
  chunk_index: number
  chunk_text: string
  original_filename: string
  source_category: SourceCategory
  page_number: number
  page_image_path: string | null
  similarity: number
}

// ─── Textract geometry types (Phase A columns, consumed by Phase B viewer) ────

/** Normalized bounding box from a Textract WORD block (all values 0.0–1.0) */
export type WordGeometry = {
  text:       string
  confidence: number
  geometry: {
    left:   number
    top:    number
    width:  number
    height: number
  }
}

/** A single cell within a Textract-extracted table */
export type TableCell = {
  row:        number
  col:        number
  rowSpan:    number
  colSpan:    number
  text:       string
  confidence: number
}

/** One table extracted by Textract AnalyzeTables */
export type ExtractedTable = {
  tableIndex: number
  rows:       number
  cols:       number
  cells:      TableCell[]
}

/** One key/value pair extracted by Textract AnalyzeForms */
export type ExtractedFormField = {
  key:             string
  value:           string
  keyConfidence:   number
  valueConfidence: number
}

/**
 * One checkbox (SELECTION_ELEMENT) extracted by Textract.
 * context: "form"   — the VALUE of a KEY_VALUE_SET pair
 *          "table"  — a child of a TABLE CELL
 *          "inline" — standalone checkbox on the page
 */
export type CheckboxElement = {
  selected:   boolean
  confidence: number
  geometry: {
    left:   number
    top:    number
    width:  number
    height: number
  }
  label:   string | null   // adjacent key text (form) or column header (table)
  context: "form" | "table" | "inline"
}

// ─── Shape for the upload modal form ─────────────────────────────────────────

export type UploadFormValues = {
  aircraftId: string
  sourceCategory: SourceCategory
  observedRegistration: string
  dateRangeStart: string
  dateRangeEnd: string
  notes: string
  importBatch: string
  file: File | null
}
