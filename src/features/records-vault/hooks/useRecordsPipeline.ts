/**
 * useRecordsPipeline
 *
 * Fetches all rv_record_sources + their ingestion logs for the pipeline view,
 * and subscribes to Supabase Realtime so status updates arrive instantly
 * without polling.
 */

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { RecordSource } from "../types"

export type IngestionLogEntry = {
  id: string
  record_source_id: string
  step: string
  message: string | null
  page_count: number | null
  created_at: string
}

export type PipelineSource = RecordSource & {
  pages_extracted: number | null
  pages_inserted: number | null
  verification_status: "unverified" | "verified" | "partial" | "failed"
  ingestion_started_at: string | null
  ingestion_completed_at: string | null
  log: IngestionLogEntry[]
}

async function fetchPipelineSources(aircraftId: string | null): Promise<PipelineSource[]> {
  let sourcesQuery = supabase
    .from("rv_record_sources")
    .select("*")
    .order("created_at", { ascending: false })

  if (aircraftId) {
    sourcesQuery = sourcesQuery.eq("aircraft_id", aircraftId)
  }

  const { data: sources, error: sourcesErr } = await sourcesQuery
  if (sourcesErr) throw sourcesErr

  if (!sources || sources.length === 0) return []

  const sourceIds = sources.map((s: RecordSource) => s.id)

  const { data: logs, error: logsErr } = await supabase
    .from("rv_ingestion_log")
    .select("*")
    .in("record_source_id", sourceIds)
    .order("created_at", { ascending: true })

  if (logsErr) throw logsErr

  const logsBySource = new Map<string, IngestionLogEntry[]>()
  for (const log of logs ?? []) {
    if (!logsBySource.has(log.record_source_id)) {
      logsBySource.set(log.record_source_id, [])
    }
    logsBySource.get(log.record_source_id)!.push(log as IngestionLogEntry)
  }

  return (sources as PipelineSource[]).map((s) => ({
    ...s,
    log: logsBySource.get(s.id) ?? [],
  }))
}

export function useRecordsPipeline(aircraftId: string | null) {
  const [sources, setSources] = useState<PipelineSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchPipelineSources(aircraftId)
      setSources(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [aircraftId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Realtime: update a single source row when ingestion_status or page counts change
  useEffect(() => {
    const channel = supabase
      .channel("rv_pipeline_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rv_record_sources" },
        (payload) => {
          setSources((prev) =>
            prev.map((s) =>
              s.id === payload.new.id
                ? { ...s, ...(payload.new as Partial<PipelineSource>) }
                : s
            )
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rv_ingestion_log" },
        (payload) => {
          const entry = payload.new as IngestionLogEntry
          setSources((prev) =>
            prev.map((s) =>
              s.id === entry.record_source_id
                ? { ...s, log: [...s.log, entry] }
                : s
            )
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rv_record_sources" },
        () => {
          // New source added — reload the full list
          load()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load])

  return { sources, loading, error, reload: load }
}
