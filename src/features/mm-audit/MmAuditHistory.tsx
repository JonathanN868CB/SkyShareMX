import { History, Loader2 } from "lucide-react"
import { useAuditHistory } from "./useMmAuditData"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

export default function MmAuditHistory({
  aircraftDocumentId,
  registration,
  documentName,
}: {
  aircraftDocumentId: string
  registration: string
  documentName: string
}) {
  const { data: records, isLoading } = useAuditHistory(aircraftDocumentId)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <History className="h-3.5 w-3.5" style={{ color: C }} />
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: rgba(0.7), fontFamily: "var(--font-heading)" }}
        >
          Audit History — {registration} · {documentName}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C }} />
          <span className="text-xs" style={{ color: rgba(0.5) }}>Loading…</span>
        </div>
      )}

      {!isLoading && (!records || records.length === 0) && (
        <div className="text-xs py-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          No audit records yet.
        </div>
      )}

      {!isLoading && records && records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${rgba(0.1)}` }}>
                {["Audit Date", "Revision", "Next Due", "Notes"].map(h => (
                  <th
                    key={h}
                    className="text-left py-1.5 pr-3"
                    style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${rgba(0.05)}` }}>
                  <td className="py-1.5 pr-3">{r.audit_date}</td>
                  <td className="py-1.5 pr-3" style={{ color: C }}>{r.audited_revision}</td>
                  <td className="py-1.5 pr-3">{r.next_due_date}</td>
                  <td className="py-1.5 pr-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
