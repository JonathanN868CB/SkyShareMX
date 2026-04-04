import type { SourceCategory, IngestionStatus } from "./types"

export const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
  logbook:       "Logbook",
  work_package:  "Work Package",
  inspection:    "Inspection",
  ad_compliance: "AD Compliance",
  major_repair:  "Major Repair",
  other:         "Other",
}

export const SOURCE_CATEGORIES: SourceCategory[] = [
  "logbook",
  "work_package",
  "inspection",
  "ad_compliance",
  "major_repair",
  "other",
]

export const INGESTION_STATUS_LABELS: Record<IngestionStatus, string> = {
  pending:    "Queued",
  extracting: "Processing",
  indexed:    "Ready",
  failed:     "Failed",
}

export const INGESTION_STATUS_COLORS: Record<IngestionStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  extracting: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  indexed:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed:     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

export const MANAGER_ROLES = ["Super Admin", "Admin", "Manager"] as const
