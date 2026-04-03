// ─── Parts Module Constants ──────────────────────────────────────────────────

export const REQUEST_STATUSES = [
  "requested",
  "pending_approval",
  "approved",
  "denied",
  "sourcing",
  "ordered",
  "shipped",
  "received",
  "closed",
  "cancelled",
] as const

export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const LINE_STATUSES = [
  "requested",
  "sourcing",
  "ordered",
  "shipped",
  "received",
  "closed",
] as const

export type LineStatus = (typeof LINE_STATUSES)[number]

export const CONDITIONS = [
  { value: "new_overhaul", label: "New/Overhaul" },
  { value: "any", label: "Any" },
  { value: "new_overhaul_with_times", label: "New/Overhaul with Times" },
] as const

export type PartCondition = (typeof CONDITIONS)[number]["value"]

export const CORE_STATUSES = [
  "pending",
  "paperwork_complete",
  "shipped",
  "vendor_received",
  "closed",
] as const

export type CoreStatus = (typeof CORE_STATUSES)[number]

export const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; color: string; bg: string }
> = {
  requested:        { label: "Requested",        color: "rgba(100,180,255,0.9)",  bg: "rgba(100,180,255,0.12)" },
  pending_approval: { label: "Pending Approval", color: "rgba(245,180,60,0.9)",   bg: "rgba(245,180,60,0.12)" },
  approved:         { label: "Approved",         color: "rgba(100,220,100,0.9)",  bg: "rgba(100,220,100,0.12)" },
  denied:           { label: "Denied",           color: "rgba(255,100,100,0.9)",  bg: "rgba(255,100,100,0.12)" },
  sourcing:         { label: "Sourcing",         color: "rgba(255,210,80,0.9)",   bg: "rgba(255,210,80,0.12)" },
  ordered:          { label: "Ordered",          color: "rgba(178,130,255,0.9)",  bg: "rgba(178,130,255,0.12)" },
  shipped:          { label: "Shipped",          color: "rgba(255,165,80,0.9)",   bg: "rgba(255,165,80,0.12)" },
  received:         { label: "Received",         color: "rgba(100,220,100,0.9)",  bg: "rgba(100,220,100,0.12)" },
  closed:           { label: "Closed",           color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.05)" },
  cancelled:        { label: "Cancelled",        color: "rgba(255,100,100,0.6)",  bg: "rgba(255,100,100,0.08)" },
}

export const LINE_STATUS_CONFIG: Record<
  LineStatus,
  { label: string; color: string; bg: string }
> = {
  requested: STATUS_CONFIG.requested,
  sourcing:  STATUS_CONFIG.sourcing,
  ordered:   STATUS_CONFIG.ordered,
  shipped:   STATUS_CONFIG.shipped,
  received:  STATUS_CONFIG.received,
  closed:    STATUS_CONFIG.closed,
}

export const ORDER_TYPES = [
  { value: "aircraft", label: "Aircraft Work Order" },
  { value: "stock", label: "Stock / Shop Supply" },
] as const

export type OrderType = (typeof ORDER_TYPES)[number]["value"]
