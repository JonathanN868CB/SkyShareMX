import { Star } from "lucide-react"
import { GOLD, STATUS_DISPLAY, TYPE_CONFIG, type Vendor } from "../constants"

export function VendorPopup({ vendor, onClose, onDetail }: {
  vendor: Vendor; onClose: () => void; onDetail: () => void
}) {
  const cfg = TYPE_CONFIG[vendor.vendor_type]
  const opStatus = STATUS_DISPLAY[vendor.operational_status] ?? STATUS_DISPLAY.discovered
  return (
    <div style={{ minWidth: 190, maxWidth: 240, fontFamily: "sans-serif", position: "relative" }}>
      <button onClick={onClose}
        style={{ position: "absolute", top: 0, right: 0, cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, color: "#666", fontSize: 16 }}
      >×</button>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, paddingRight: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${cfg.color}20`, color: cfg.color }}>
          {cfg.sym} {cfg.label}
        </span>
        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: opStatus.bg, color: opStatus.color }}>
          {opStatus.label}
        </span>
        {vendor.preferred && <Star style={{ width: 11, height: 11, color: GOLD }} fill={GOLD} />}
      </div>
      <strong style={{ fontSize: 13, display: "block", marginBottom: 2 }}>{vendor.name}</strong>
      {vendor.city && <p style={{ fontSize: 11, color: "#777", margin: "2px 0" }}>{vendor.city}{vendor.state ? `, ${vendor.state}` : ""}</p>}
      {vendor.phone && (
        <p style={{ fontSize: 11, margin: "3px 0" }}>
          <a href={`tel:${vendor.phone}`} style={{ color: "#1a73e8" }}>{vendor.phone}</a>
        </p>
      )}
      <button onClick={onDetail}
        style={{ marginTop: 6, fontSize: 11, color: "#1a73e8", cursor: "pointer", background: "none", border: "none", padding: 0, textDecoration: "underline" }}>
        Full details →
      </button>
    </div>
  )
}
