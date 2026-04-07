import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { ChevronDown, ChevronUp, Copy, Check, Webhook, TableIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Badge } from "@/shared/ui/badge"

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduledEvent = {
  id: string
  external_uuid: string
  aircraft_tail: string
  title: string
  start_at: string
  end_at: string
  notes: string | null
  created_by_user: string | null
  event_type: string
  received_at: string
}

type WebhookLog = {
  id: string
  received_at: string
  status: string
  event_count: number | null
  inserted_count: number | null
  skipped_count: number | null
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchEvents(): Promise<ScheduledEvent[]> {
  const { data, error } = await supabase
    .from("scheduled_maintenance_events")
    .select("id, external_uuid, aircraft_tail, title, start_at, end_at, notes, created_by_user, event_type, received_at")
    .order("start_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchLastLog(): Promise<WebhookLog | null> {
  const { data, error } = await supabase
    .from("webhook_inbound_log")
    .select("id, received_at, status, event_count, inserted_count, skipped_count")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ─── Setup instructions panel ─────────────────────────────────────────────────

const WEBHOOK_URL = "https://skysharemx.com/.netlify/functions/inbound-webhook"

const EXAMPLE_PAYLOAD = JSON.stringify(
  [
    {
      start: "2026-04-06T06:30:00-07:00",
      end: "2026-04-10T16:00:00-07:00",
      title: "Inspection Document 1, 9.",
      extendedProps: {
        uuid: "7067ff9a-452d-4ab1-80d0-a15ed943e011",
        aircraft: "N868CB",
        notes: "173(30)- CWH 01/13/26",
        event_type_name: "Maintenance",
        created_by_user: "C Hicks on 01/13/26 17:40 PST",
      },
    },
  ],
  null,
  2
)

const CURL_COMMAND = `curl -X POST ${WEBHOOK_URL} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: YOUR_SECRET_HERE" \\
  -d '[{"start":"2026-04-06T06:30:00-07:00","end":"2026-04-10T16:00:00-07:00","title":"Test Inspection","extendedProps":{"uuid":"7067ff9a-0000-0000-0000-a15ed943e011","aircraft":"N868CB","notes":"Test notes","event_type_name":"Maintenance","created_by_user":"Your Name"}}]'`

function SetupInstructions({ lastLog }: { lastLog: WebhookLog | null }) {
  const [open, setOpen] = useState(true)

  return (
    <Card className="card-elevated border-0">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Webhook size={16} className="text-white/40" />
            <CardTitle
              className="text-white/80"
              style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase" }}
            >
              Webhook Setup Guide
            </CardTitle>
          </div>
          <div className="flex items-center gap-4">
            {lastLog ? (
              <span className="text-[11px] text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
                Last received:{" "}
                <span className="text-white/60">{format(new Date(lastLog.received_at), "MMM d, yyyy h:mm a")}</span>
              </span>
            ) : (
              <span className="text-[11px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                No calls received yet
              </span>
            )}
            {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-8 pt-0">
          {/* What is a webhook */}
          <section className="space-y-2">
            <h3 className="text-white/70 text-sm font-medium">What is a webhook?</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              A webhook is a URL on SkyShare MX that your scheduling software calls automatically whenever something
              happens — like when a maintenance event is created or updated. Instead of someone manually copying data
              between systems, your software sends it here in real time. Think of it as your software dialing a phone
              number to deliver a message: SkyShare MX picks up, checks who's calling, saves the message, and hangs up.
            </p>
          </section>

          {/* Step 1 */}
          <section className="space-y-3">
            <h3 className="text-white/70 text-sm font-medium flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.08] text-[11px] text-white/50">1</span>
              Get your secret key from Jonathan
            </h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Every webhook call must include a secret key in the request headers so SkyShare MX knows the call is
              coming from you and not a stranger. Jonathan will give you this value — keep it private.
            </p>
          </section>

          {/* Step 2 */}
          <section className="space-y-3">
            <h3 className="text-white/70 text-sm font-medium flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.08] text-[11px] text-white/50">2</span>
              Configure your software
            </h3>
            <p className="text-white/50 text-sm leading-relaxed mb-3">
              In your scheduling software's webhook settings, point it at this URL and add the secret header:
            </p>
            <div className="rounded-md bg-white/[0.04] border border-white/[0.06] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30 uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Endpoint URL</span>
                <CopyButton text={WEBHOOK_URL} />
              </div>
              <code className="text-sm text-emerald-400/80 break-all">{WEBHOOK_URL}</code>
            </div>
            <div className="rounded-md bg-white/[0.04] border border-white/[0.06] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30 uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Required Header</span>
              </div>
              <code className="text-sm text-white/60">
                <span className="text-blue-400/70">X-Webhook-Secret</span>
                <span className="text-white/30">: </span>
                <span className="text-amber-400/70">{"<JETINSIGHT_NAPSTER_WEBHOOK_SECRET value from Jonathan>"}</span>
              </code>
            </div>
          </section>

          {/* Step 3 — Payload */}
          <section className="space-y-3">
            <h3 className="text-white/70 text-sm font-medium flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.08] text-[11px] text-white/50">3</span>
              Payload format
            </h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Send a JSON array of maintenance events. The fields SkyShare MX reads are shown below — your software
              likely already sends all of these. Extra fields (colors, edit URLs, etc.) are ignored.
            </p>
            <div className="rounded-md bg-white/[0.04] border border-white/[0.06] p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-white/30 uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Example payload</span>
                <CopyButton text={EXAMPLE_PAYLOAD} />
              </div>
              <pre className="text-xs text-white/50 overflow-x-auto leading-relaxed">{EXAMPLE_PAYLOAD}</pre>
            </div>
            <div className="rounded-md bg-white/[0.04] border border-white/[0.06] p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["Field", "Path in JSON", "Required", "Notes"].map((h) => (
                      <th key={h} className="text-left text-white/30 pb-2 pr-4 uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)", fontSize: "10px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-white/50">
                  {[
                    ["External ID", "extendedProps.uuid", "Yes", "Used to prevent duplicate imports"],
                    ["Aircraft tail", "extendedProps.aircraft", "Yes", 'e.g. "N868CB"'],
                    ["Title", "title", "Yes", "Description of the maintenance event"],
                    ["Start time", "start", "Yes", "ISO 8601 datetime"],
                    ["End time", "end", "Yes", "ISO 8601 datetime"],
                    ["Notes", "extendedProps.notes", "No", "Hours remaining, date move history, etc."],
                    ["Created by", "extendedProps.created_by_user", "No", "Who created the event"],
                  ].map(([field, path, req, note]) => (
                    <tr key={field} className="border-t border-white/[0.04]">
                      <td className="py-1.5 pr-4 text-white/70">{field}</td>
                      <td className="py-1.5 pr-4 font-mono text-emerald-400/60">{path}</td>
                      <td className="py-1.5 pr-4">{req === "Yes" ? <span className="text-amber-400/60">Yes</span> : <span className="text-white/30">No</span>}</td>
                      <td className="py-1.5 text-white/40">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Step 4 — Test */}
          <section className="space-y-3">
            <h3 className="text-white/70 text-sm font-medium flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.08] text-[11px] text-white/50">4</span>
              Test your connection
            </h3>
            <p className="text-white/50 text-sm leading-relaxed">
              You can test with a single curl command from your terminal. Replace{" "}
              <code className="text-amber-400/70 text-xs">YOUR_SECRET_HERE</code> with the key Jonathan gave you.
              After running it, scroll down to the Received Events table — your test event should appear within seconds.
            </p>
            <div className="rounded-md bg-white/[0.04] border border-white/[0.06] p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-white/30 uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>curl test</span>
                <CopyButton text={CURL_COMMAND} />
              </div>
              <pre className="text-xs text-white/50 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{CURL_COMMAND}</pre>
            </div>
            <div className="rounded-md bg-white/[0.04] border border-white/[0.06] p-3 space-y-1">
              <p className="text-[11px] text-white/30 uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Expected responses</p>
              <div className="text-xs text-white/50 space-y-1.5">
                <div><span className="text-emerald-400/70">200 OK</span> — <code className="text-white/40">{"{ \"received\": 1, \"inserted\": 1, \"skipped\": 0 }"}</code></div>
                <div><span className="text-white/40">200 OK (resend)</span> — <code className="text-white/40">{"{ \"received\": 1, \"inserted\": 0, \"skipped\": 1 }"}</code> — duplicate, already stored</div>
                <div><span className="text-amber-400/60">401</span> — Wrong or missing secret header</div>
                <div><span className="text-amber-400/60">400</span> — Malformed JSON or missing required fields</div>
              </div>
            </div>
          </section>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Events table ─────────────────────────────────────────────────────────────

function ExpandableNotes({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = notes.length > 120
  return (
    <div className="space-y-1">
      <p className="text-white/50 text-xs leading-relaxed whitespace-pre-line">
        {expanded || !isLong ? notes : notes.slice(0, 120) + "…"}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

function EventsTable({ events, isLoading }: { events: ScheduledEvent[]; isLoading: boolean }) {
  return (
    <Card className="card-elevated border-0">
      <CardHeader>
        <div className="flex items-center gap-3">
          <TableIcon size={16} className="text-white/40" />
          <CardTitle
            className="text-white/80"
            style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase" }}
          >
            Received Events
          </CardTitle>
          {events.length > 0 && (
            <span className="text-[11px] text-white/30 ml-auto" style={{ fontFamily: "var(--font-heading)" }}>
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-white/30 text-sm">Loading…</div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-2">
            <p className="text-white/30 text-sm">No events received yet.</p>
            <p className="text-white/20 text-xs">Send a test webhook using the curl command above to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] hover:bg-transparent">
                {["Aircraft", "Title", "Start", "End", "Notes", "Received"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-white/40"
                    style={{ fontFamily: "var(--font-heading)", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase" }}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id} className="border-white/[0.05] hover:bg-white/[0.03] align-top">
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className="text-[11px] text-white/70 border-white/[0.12] bg-white/[0.04] font-mono"
                    >
                      {ev.aircraft_tail}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-white/70 text-sm max-w-[200px]">
                    {ev.title}
                  </TableCell>
                  <TableCell className="py-3 text-white/50 text-xs whitespace-nowrap">
                    {format(new Date(ev.start_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="py-3 text-white/50 text-xs whitespace-nowrap">
                    {format(new Date(ev.end_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="py-3 max-w-[260px]">
                    {ev.notes ? <ExpandableNotes notes={ev.notes} /> : <span className="text-white/20 text-xs">—</span>}
                  </TableCell>
                  <TableCell className="py-3 text-white/30 text-xs whitespace-nowrap">
                    {format(new Date(ev.received_at), "MMM d, h:mm a")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaintenancePlanning() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["scheduled-maintenance-events"],
    queryFn: fetchEvents,
    refetchInterval: 30_000,
  })

  const { data: lastLog } = useQuery({
    queryKey: ["webhook-inbound-log-last"],
    queryFn: fetchLastLog,
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <h1
          className="text-[2.6rem] leading-none text-foreground"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
        >
          MAINTENANCE PLANNING
        </h1>
        <div style={{ height: "1px", background: "var(--color-accent, rgba(255,255,255,0.15))", width: "3.5rem" }} />
        <p
          className="text-sm text-muted-foreground"
          style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}
        >
          Scheduled maintenance events from connected scheduling software
        </p>
      </div>

      <SetupInstructions lastLog={lastLog ?? null} />
      <EventsTable events={events} isLoading={isLoading} />
    </div>
  )
}
