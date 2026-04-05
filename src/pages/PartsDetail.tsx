import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { PartsDetailView } from "@/features/parts/components/PartsDetailView"

export default function PartsDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/app/beet-box/parts")}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: "rgba(255,255,255,0.5)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Parts
      </button>

      <PartsDetailView requestId={id} />
    </div>
  )
}
