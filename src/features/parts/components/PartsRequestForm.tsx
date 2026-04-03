import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, AlertTriangle, Plane, Package as PackageIcon } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { ORDER_TYPES, type OrderType } from "../constants"
import { PartsLineItem, EMPTY_LINE, type LineItemData } from "./PartsLineItem"
import { shouldRequireApproval, notifyByRoles, getApproverProfileIds, notifyProfileIds } from "../helpers"

interface AircraftOption {
  aircraft_id: string
  registration: string
  model_family: string
}

interface ShipToOption {
  label: string
  address: string
}

export function PartsRequestForm() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  // Data
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([])
  const [shipToOptions, setShipToOptions] = useState<ShipToOption[]>([])

  // Form state — header
  const [orderType, setOrderType] = useState<OrderType>("aircraft")
  const [aircraftId, setAircraftId] = useState("")
  const [aircraftTail, setAircraftTail] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [workOrder, setWorkOrder] = useState("")
  const [itemNumber, setItemNumber] = useState("")
  const [stockPurpose, setStockPurpose] = useState("")

  // Logistics
  const [dateNeeded, setDateNeeded] = useState("")
  const [shipTo, setShipTo] = useState("")
  const [shipToAddress, setShipToAddress] = useState("")
  const [allAtOnce, setAllAtOnce] = useState("yes")
  const [delayAffectsRts, setDelayAffectsRts] = useState("no")

  // AOG
  const [aog, setAog] = useState(false)
  const [aogRemovedPn, setAogRemovedPn] = useState("")
  const [aogRemovedSn, setAogRemovedSn] = useState("")
  const [aogSquawk, setAogSquawk] = useState("")

  // Notes
  const [notes, setNotes] = useState("")

  // Parts lines
  const [lines, setLines] = useState<LineItemData[]>([{ ...EMPTY_LINE }])

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lineErrors, setLineErrors] = useState<Record<number, Partial<Record<keyof LineItemData, string>>>>(
    {}
  )

  // Load aircraft + ship-to config
  useEffect(() => {
    async function load() {
      const [acRes, configRes] = await Promise.all([
        supabase
          .from("aircraft_registrations")
          .select("aircraft_id, registration")
          .eq("is_current", true)
          .order("registration"),
        supabase
          .from("parts_config")
          .select("value")
          .eq("key", "ship_to_addresses")
          .single(),
      ])

      if (acRes.data) {
        // Enrich with model info
        const ids = acRes.data.map((r: { aircraft_id: string }) => r.aircraft_id)
        const { data: acData } = await supabase
          .from("aircraft")
          .select("id, model_family")
          .in("id", ids)

        const modelMap = new Map(acData?.map((a: { id: string; model_family: string }) => [a.id, a.model_family]) ?? [])
        setAircraftOptions(
          acRes.data.map((r: { aircraft_id: string; registration: string }) => ({
            aircraft_id: r.aircraft_id,
            registration: r.registration,
            model_family: (modelMap.get(r.aircraft_id) as string) ?? "",
          }))
        )
      }

      if (configRes.data?.value) {
        setShipToOptions(configRes.data.value as ShipToOption[])
      }
    }
    load()
  }, [])

  // Aircraft selection handler
  function handleAircraftChange(value: string) {
    setAircraftId(value)
    const ac = aircraftOptions.find(a => a.aircraft_id === value)
    setAircraftTail(ac?.registration ?? "")
  }

  // Line management
  function addLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE }])
  }

  function updateLine(index: number, data: LineItemData) {
    setLines(prev => prev.map((l, i) => (i === index ? data : l)))
    // Clear errors for this line on edit
    setLineErrors(prev => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  // Validation
  function validate(): boolean {
    const e: Record<string, string> = {}
    const le: Record<number, Partial<Record<keyof LineItemData, string>>> = {}

    // Header
    if (orderType === "aircraft") {
      if (!aircraftId) e.aircraftId = "Select an aircraft"
      if (!jobDescription.trim()) e.jobDescription = "Describe the job"
      if (!workOrder.trim()) e.workOrder = "Enter work order number"
    } else {
      if (!jobDescription.trim()) e.jobDescription = "Describe the purpose"
    }

    if (!dateNeeded) e.dateNeeded = "Select a date"
    if (!shipTo) e.shipTo = "Select ship-to location"
    if (shipTo === "other" && !shipToAddress.trim()) e.shipToAddress = "Enter address"

    // AOG
    if (aog) {
      if (!aogRemovedPn.trim()) e.aogRemovedPn = "Enter removed part number"
      if (!aogRemovedSn.trim()) e.aogRemovedSn = "Enter removed part serial"
      if (!aogSquawk.trim()) e.aogSquawk = "Describe the squawk"
    }

    // Lines
    lines.forEach((line, i) => {
      const lineErr: Partial<Record<keyof LineItemData, string>> = {}
      if (!line.part_number.trim()) lineErr.part_number = "Required"
      if (line.quantity < 1) lineErr.quantity = "Min 1"
      if (Object.keys(lineErr).length > 0) le[i] = lineErr
    })

    setErrors(e)
    setLineErrors(le)
    return Object.keys(e).length === 0 && Object.keys(le).length === 0
  }

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      toast.error("Please fix the highlighted fields")
      return
    }
    if (!profile?.id) {
      toast.error("Not authenticated")
      return
    }

    setSubmitting(true)
    try {
      // 1. Determine initial status (approval routing)
      const needsApproval = await shouldRequireApproval(profile.role)
      const initialStatus = needsApproval ? "pending_approval" : "requested"

      // 2. Build job label for notifications
      const jobLabel = orderType === "aircraft"
        ? `${aircraftTail} — ${jobDescription.trim()}`
        : `Stock — ${jobDescription.trim()}`

      // 3. Insert request
      const { data: request, error: reqErr } = await supabase
        .from("parts_requests")
        .insert({
          order_type: orderType,
          aircraft_id: orderType === "aircraft" ? aircraftId : null,
          aircraft_tail: orderType === "aircraft" ? aircraftTail : null,
          job_description: jobDescription.trim(),
          work_order: orderType === "aircraft" ? workOrder.trim() || null : null,
          item_number: orderType === "aircraft" ? itemNumber.trim() || null : null,
          stock_purpose: orderType === "stock" ? stockPurpose.trim() || null : null,
          date_needed: dateNeeded,
          ship_to: shipTo === "other" ? "Other" : shipTo,
          ship_to_address: shipTo === "other" ? shipToAddress.trim() : null,
          all_at_once: allAtOnce === "yes",
          delay_affects_rts: delayAffectsRts === "yes",
          aog,
          aog_removed_pn: aog ? aogRemovedPn.trim() : null,
          aog_removed_sn: aog ? aogRemovedSn.trim() : null,
          aog_squawk: aog ? aogSquawk.trim() : null,
          notes: notes.trim() || null,
          status: initialStatus,
          requested_by: profile.id,
        })
        .select("id")
        .single()

      if (reqErr) throw reqErr

      // 4. Insert lines
      const lineInserts = lines.map((line, i) => ({
        request_id: request.id,
        line_number: i + 1,
        part_number: line.part_number.trim(),
        alternate_pn: line.alternate_pn.trim() || null,
        description: line.description.trim() || null,
        quantity: line.quantity,
        condition: line.condition,
        line_status: "requested",
      }))

      const { error: lineErr } = await supabase
        .from("parts_request_lines")
        .insert(lineInserts)

      if (lineErr) throw lineErr

      // 5. Initial status history
      await supabase.from("parts_status_history").insert({
        request_id: request.id,
        old_status: null,
        new_status: initialStatus,
        changed_by: profile.id,
        note: `${lines.length} part${lines.length > 1 ? "s" : ""} requested${needsApproval ? " — awaiting approval" : ""}`,
      })

      // 6. Notifications
      const notifMeta = { request_id: request.id, path: `/app/parts/${request.id}` }
      const aogPrefix = aog ? "🔴 AOG: " : ""

      if (needsApproval) {
        // Notify approvers
        const approverIds = await getApproverProfileIds()
        await notifyProfileIds(
          approverIds,
          "parts_approval_needed",
          `${aogPrefix}Parts approval needed`,
          `${profile.display_name || profile.full_name || "A technician"} submitted a parts request for ${jobLabel} — ${lines.length} part${lines.length > 1 ? "s" : ""}`,
          notifMeta
        )
      } else {
        // Notify parts manager + shop manager roles
        await notifyByRoles(
          ["Manager", "Admin", "Super Admin"],
          "parts_new_request",
          `${aogPrefix}New parts request`,
          `${profile.display_name || profile.full_name || "Someone"} submitted a parts request for ${jobLabel} — ${lines.length} part${lines.length > 1 ? "s" : ""}`,
          notifMeta,
          profile.id
        )
      }

      toast.success(needsApproval ? "Parts request submitted — awaiting approval" : "Parts request submitted")
      navigate("/app/parts")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Failed to submit: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Field styling helpers ──────────────────────────────────────────────────

  const inputStyle = (hasError?: boolean) => ({
    background: "rgba(255,255,255,0.05)",
    border: hasError ? "1px solid rgba(255,100,100,0.5)" : "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.9)",
  })

  const labelClass = "block text-xs mb-1"
  const labelStyle = { color: "rgba(255,255,255,0.5)" }
  const requiredMark = <span style={{ color: "rgba(255,100,100,0.7)" }}> *</span>

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── ORDER TYPE ─────────────────────────────────────────────────────── */}
      <section
        className="rounded-lg border p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <h2
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
        >
          Order Type
        </h2>

        <div className="flex gap-3">
          {ORDER_TYPES.map(ot => (
            <button
              key={ot.value}
              type="button"
              onClick={() => setOrderType(ot.value)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: orderType === ot.value ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.03)",
                border: orderType === ot.value ? "1px solid rgba(212,160,23,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: orderType === ot.value ? "var(--skyshare-gold)" : "rgba(255,255,255,0.5)",
              }}
            >
              {ot.value === "aircraft" ? <Plane className="w-4 h-4" /> : <PackageIcon className="w-4 h-4" />}
              {ot.label}
            </button>
          ))}
        </div>

        {/* Aircraft fields */}
        {orderType === "aircraft" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Aircraft{requiredMark}</label>
              <select
                value={aircraftId}
                onChange={e => handleAircraftChange(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle(!!errors.aircraftId)}
              >
                <option value="">Select aircraft...</option>
                {aircraftOptions.map(ac => (
                  <option key={ac.aircraft_id} value={ac.aircraft_id}>
                    {ac.registration} — {ac.model_family}
                  </option>
                ))}
              </select>
              {errors.aircraftId && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.aircraftId}</p>}
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Job Description{requiredMark}</label>
              <input
                type="text"
                value={jobDescription}
                onChange={e => { setJobDescription(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.jobDescription; return n }) }}
                placeholder='e.g. "Brake Change", "600hr Engine Check"'
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle(!!errors.jobDescription)}
              />
              {errors.jobDescription && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.jobDescription}</p>}
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Work Order #{requiredMark}</label>
              <input
                type="text"
                value={workOrder}
                onChange={e => { setWorkOrder(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.workOrder; return n }) }}
                placeholder="e.g. 26-0392"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle(!!errors.workOrder)}
              />
              {errors.workOrder && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.workOrder}</p>}
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Item #</label>
              <input
                type="text"
                value={itemNumber}
                onChange={e => setItemNumber(e.target.value)}
                placeholder="e.g. 003"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle()}
              />
            </div>
          </div>
        )}

        {/* Stock fields */}
        {orderType === "stock" && (
          <div className="space-y-4">
            <div>
              <label className={labelClass} style={labelStyle}>Job Description{requiredMark}</label>
              <input
                type="text"
                value={jobDescription}
                onChange={e => { setJobDescription(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.jobDescription; return n }) }}
                placeholder='e.g. "Replenish brake pads for CL-604 fleet"'
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle(!!errors.jobDescription)}
              />
              {errors.jobDescription && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.jobDescription}</p>}
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Purpose / Reason</label>
              <input
                type="text"
                value={stockPurpose}
                onChange={e => setStockPurpose(e.target.value)}
                placeholder="Why are we ordering for stock?"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle()}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── PARTS LINES ────────────────────────────────────────────────────── */}
      <section
        className="rounded-lg border p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <h2
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
        >
          Parts
        </h2>

        <div className="space-y-3">
          {lines.map((line, i) => (
            <PartsLineItem
              key={i}
              index={i}
              data={line}
              onChange={updateLine}
              onRemove={removeLine}
              canRemove={lines.length > 1}
              errors={lineErrors[i]}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: "rgba(212,160,23,0.1)",
            color: "var(--skyshare-gold)",
            border: "1px solid rgba(212,160,23,0.2)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.1)")}
        >
          <Plus className="w-4 h-4" />
          Add Part
        </button>
      </section>

      {/* ── LOGISTICS ──────────────────────────────────────────────────────── */}
      <section
        className="rounded-lg border p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <h2
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
        >
          Logistics
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>When are parts needed by?{requiredMark}</label>
            <input
              type="date"
              value={dateNeeded}
              onChange={e => { setDateNeeded(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.dateNeeded; return n }) }}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle(!!errors.dateNeeded)}
            />
            {errors.dateNeeded && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.dateNeeded}</p>}
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Ship To{requiredMark}</label>
            <select
              value={shipTo}
              onChange={e => { setShipTo(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.shipTo; return n }) }}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle(!!errors.shipTo)}
            >
              <option value="">Select location...</option>
              {shipToOptions.map(opt => (
                <option key={opt.label} value={opt.label}>{opt.label}</option>
              ))}
              <option value="other">Other (specify below)</option>
            </select>
            {errors.shipTo && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.shipTo}</p>}
          </div>
        </div>

        {shipTo === "other" && (
          <div>
            <label className={labelClass} style={labelStyle}>Ship-to Address{requiredMark}</label>
            <input
              type="text"
              value={shipToAddress}
              onChange={e => { setShipToAddress(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.shipToAddress; return n }) }}
              placeholder="Full shipping address"
              className="w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle(!!errors.shipToAddress)}
            />
            {errors.shipToAddress && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.shipToAddress}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Are all parts needed at once?</label>
            <select
              value={allAtOnce}
              onChange={e => setAllAtOnce(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle()}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>If delayed, changes expected RTS?</label>
            <select
              value={delayAffectsRts}
              onChange={e => setDelayAffectsRts(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle()}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        {/* AOG Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setAog(!aog)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-sm font-medium transition-all"
            style={{
              background: aog ? "rgba(255,60,60,0.12)" : "rgba(255,255,255,0.03)",
              border: aog ? "1px solid rgba(255,60,60,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: aog ? "rgba(255,100,100,0.95)" : "rgba(255,255,255,0.5)",
            }}
          >
            <AlertTriangle className="w-4 h-4" />
            AOG — Aircraft on Ground
            <span
              className="ml-auto text-xs px-2 py-0.5 rounded"
              style={{
                background: aog ? "rgba(255,60,60,0.2)" : "rgba(255,255,255,0.05)",
                color: aog ? "rgba(255,100,100,0.9)" : "rgba(255,255,255,0.3)",
              }}
            >
              {aog ? "YES" : "NO"}
            </span>
          </button>
        </div>
      </section>

      {/* ── AOG DETAILS ────────────────────────────────────────────────────── */}
      {aog && (
        <section
          className="rounded-lg border p-5 space-y-4"
          style={{
            background: "rgba(255,60,60,0.04)",
            borderColor: "rgba(255,60,60,0.2)",
          }}
        >
          <h2
            className="text-xs font-semibold tracking-widest uppercase flex items-center gap-2"
            style={{ color: "rgba(255,100,100,0.85)", fontFamily: "var(--font-heading)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            AOG Details
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Removed Part Number{requiredMark}</label>
              <input
                type="text"
                value={aogRemovedPn}
                onChange={e => { setAogRemovedPn(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.aogRemovedPn; return n }) }}
                placeholder="P/N of removed part"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle(!!errors.aogRemovedPn)}
              />
              {errors.aogRemovedPn && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.aogRemovedPn}</p>}
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>Removed Part Serial{requiredMark}</label>
              <input
                type="text"
                value={aogRemovedSn}
                onChange={e => { setAogRemovedSn(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.aogRemovedSn; return n }) }}
                placeholder="S/N of removed part"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle(!!errors.aogRemovedSn)}
              />
              {errors.aogRemovedSn && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.aogRemovedSn}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>Squawk / Discrepancy{requiredMark}</label>
            <textarea
              value={aogSquawk}
              onChange={e => { setAogSquawk(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.aogSquawk; return n }) }}
              placeholder="Describe the discrepancy that grounded the aircraft"
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm resize-none"
              style={inputStyle(!!errors.aogSquawk)}
            />
            {errors.aogSquawk && <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.aogSquawk}</p>}
          </div>
        </section>
      )}

      {/* ── NOTES ──────────────────────────────────────────────────────────── */}
      <section
        className="rounded-lg border p-5 space-y-4"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <h2
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
        >
          Notes
        </h2>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything else Jessica should know — vendor preferences, special instructions, etc."
          rows={3}
          className="w-full rounded-md px-3 py-2 text-sm resize-none"
          style={inputStyle()}
        />
      </section>

      {/* ── SUBMIT ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-4 pt-2">
        <button
          type="button"
          onClick={() => navigate("/app/parts")}
          className="px-4 py-2 rounded-md text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--skyshare-gold)",
            color: "#111",
          }}
        >
          {submitting ? "Submitting..." : "Submit Parts Request"}
        </button>
      </div>
    </form>
  )
}
