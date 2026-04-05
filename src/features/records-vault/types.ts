export type SourceCategory =
  | "logbook"
  | "work_package"
  | "inspection"
  | "ad_compliance"
  | "major_repair"
  | "other"

export type IngestionStatus = "pending" | "extracting" | "indexed" | "failed"

export type RecordSource = {
  id: string
  aircraft_id: string
  original_filename: string
  file_hash: string | null
  storage_path: string
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
  date_range_start: string | null   // ISO date string from rv_record_sources
  date_range_end: string | null     // ISO date string from rv_record_sources
  ocr_excerpt: string               // contains [[highlighted]] markers
  rank: number
}

// Shape for the upload modal form
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
