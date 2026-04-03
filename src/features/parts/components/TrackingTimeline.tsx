import { useState } from "react"
import { Truck, MapPin, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface TrackingEvent {
  timestamp: string
  location: string
  status: string
  description: string
}

interface Props {
  trackingNumber: string
  trackingStatus: string | null
  trackingEta: string | null
  trackingEvents: TrackingEvent[] | null
  trackingLastChecked: string | null
  canRefresh?: boolean
  onRefresh?: () => void
}

export function TrackingTimeline({
  trackingNumber,
  trackingStatus,
  trackingEta,
  trackingEvents,
  trackingLastChecked,
  canRefresh,
  onRefresh,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const events = trackingEvents ?? []
  const hasEvents = events.length > 0

  async function handleRefresh() {
    if (!canRefresh) return
    setRefreshing(true)
    try {
      const res = await fetch("/.netlify/functions/fedex-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumbers: [trackingNumber] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to refresh tracking")
      } else {
        toast.success("Tracking refreshed")
        onRefresh?.()
      }
    } catch {
      toast.error("Failed to connect to tracking service")
    } finally {
      setRefreshing(false)
    }
  }

  function formatEventTime(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    } catch {
      return iso
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso + "T00:00:00")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  // Derive a status color
  const statusLower = (trackingStatus ?? "").toLowerCase()
  const isDelivered = statusLower.includes("deliver")
  const isInTransit = statusLower.includes("transit") || statusLower.includes("ship")
  const statusColor = isDelivered
    ? "rgba(100,220,100,0.85)"
    : isInTransit
      ? "rgba(255,165,80,0.85)"
      : "rgba(255,255,255,0.5)"

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2 cursor-pointer"
        onClick={() => hasEvents && setExpanded(!expanded)}
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <Truck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: statusColor }} />
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>
          {trackingNumber}
        </span>

        {trackingStatus && (
          <span
            className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: isDelivered ? "rgba(100,220,100,0.1)" : isInTransit ? "rgba(255,165,80,0.1)" : "rgba(255,255,255,0.05)",
              color: statusColor,
            }}
          >
            {trackingStatus}
          </span>
        )}

        {trackingEta && (
          <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            ETA: {formatDate(trackingEta)}
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {canRefresh && (
            <button
              onClick={e => { e.stopPropagation(); handleRefresh() }}
              disabled={refreshing}
              className="p-1 rounded transition-colors disabled:opacity-30"
              title="Refresh tracking"
            >
              <RefreshCw
                className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
                style={{ color: "rgba(255,255,255,0.3)" }}
              />
            </button>
          )}
          {hasEvents && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
              : <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
          )}
        </div>
      </div>

      {/* Event timeline */}
      {expanded && hasEvents && (
        <div className="px-3 pb-3 pt-1">
          <div className="space-y-0">
            {events.map((event, i) => (
              <div key={i} className="flex gap-3 relative">
                {/* Timeline line */}
                <div className="flex flex-col items-center" style={{ width: "12px" }}>
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{
                      background: i === 0 ? statusColor : "rgba(255,255,255,0.15)",
                    }}
                  />
                  {i < events.length - 1 && (
                    <div
                      className="w-px flex-1 my-0.5"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    />
                  )}
                </div>

                {/* Event content */}
                <div className="pb-3 min-w-0">
                  <p className="text-xs font-medium" style={{ color: i === 0 ? statusColor : "rgba(255,255,255,0.6)" }}>
                    {event.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.location && (
                      <span className="text-[10px] flex items-center gap-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        <MapPin className="w-2.5 h-2.5" />
                        {event.location}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {formatEventTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {trackingLastChecked && (
            <p className="text-[10px] mt-1 pt-2" style={{ color: "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              Last checked: {formatEventTime(trackingLastChecked)}
            </p>
          )}
        </div>
      )}

      {/* No events yet — just show the tracking number as a link */}
      {!hasEvents && (
        <div className="px-3 pb-2">
          <a
            href={`https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] flex items-center gap-1 hover:underline"
            style={{ color: "rgba(100,180,255,0.7)" }}
          >
            Track on FedEx.com <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
    </div>
  )
}
