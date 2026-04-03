import { useState } from "react"
import { FileDown, ChevronDown } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { generateMmAuditPdf, type PdfReportData, type PdfExportMode } from "./MmAuditPdfReport"
import { useMmFleetOverview, useMelTracking } from "./useMmAuditData"
import type { CampaignSummary, MmCampaignRevisionChange } from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

interface Props {
  campaign: CampaignSummary | null
}

export default function MmPdfExportButton({ campaign }: Props) {
  const [open, setOpen] = useState(false)
  const fleet = useMmFleetOverview()
  const mel = useMelTracking()

  // Fetch revision changes for the campaign (staged or applied)
  const revChanges = useQuery<MmCampaignRevisionChange[]>({
    queryKey: ["mm_campaign_rev_changes", campaign?.id],
    queryFn: async () => {
      if (!campaign?.id) return []
      const { data, error } = await db
        .from("mm_campaign_revision_changes")
        .select("*")
        .eq("campaign_id", campaign.id)
      if (error) throw error
      return data ?? []
    },
    enabled: !!campaign?.id,
    staleTime: 30_000,
  })

  const isReady = fleet.data && mel.data

  const handleExport = (mode: PdfExportMode) => {
    if (!fleet.data || !mel.data) return
    setOpen(false)

    const data: PdfReportData = {
      campaign,
      profiles: fleet.data.profiles,
      allRows: fleet.data.rows,
      melRows: mel.data,
      auditorNames: [],
      revisionChanges: revChanges.data ?? [],
    }

    generateMmAuditPdf(data, mode)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!isReady}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ background: rgba(0.1), color: C, border: `1px solid ${rgba(0.2)}`, fontFamily: "var(--font-heading)" }}
      >
        <FileDown className="h-3.5 w-3.5" />
        Export PDF
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 z-50 rounded-lg py-1 shadow-xl min-w-[180px]"
            style={{ background: "#1a1a2e", border: `1px solid ${rgba(0.2)}` }}
          >
            {[
              { mode: "full" as PdfExportMode, label: "Full Report", desc: "All pages + attestation" },
              { mode: "summary" as PdfExportMode, label: "Summary Only", desc: "Cover + fleet summary" },
            ].map(opt => (
              <button
                key={opt.mode}
                onClick={() => handleExport(opt.mode)}
                className="w-full text-left px-3 py-2 transition-colors hover:bg-white/5"
              >
                <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{opt.label}</div>
                <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
