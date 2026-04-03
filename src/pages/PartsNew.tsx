import { useNavigate } from "react-router-dom"
import { ArrowLeft, Package } from "lucide-react"
import { PartsRequestForm } from "@/features/parts/components/PartsRequestForm"

export default function PartsNew() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/app/parts")}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Package className="w-5 h-5" style={{ color: "var(--skyshare-gold)" }} />
        <h1
          className="text-xl font-bold tracking-wide"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          New Parts Request
        </h1>
      </div>

      <PartsRequestForm />
    </div>
  )
}
