import type {
  AircraftBase,
  AircraftDetailData,
  DataField,
  AvionicsField,
  AvionicsService,
  CMMDocument,
  NavSubscription,
} from "./fleetData"

export interface PrintOptions {
  aircraft: AircraftBase
  detail: AircraftDetailData
  sections: string[]
  includeCredentials: boolean
  generatedBy: string
}

// ─── Credential field detection ───────────────────────────────────────────────
// A field is "credential" if it's explicitly marked sensitive OR is a known
// identity field (Account # / Username). Password is covered by sensitive:true.
const CREDENTIAL_NAMES = new Set(["Username", "Account #"])

function isCredentialField(field: AvionicsField): boolean {
  return field.sensitive === true || CREDENTIAL_NAMES.has(field.name)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s: string | undefined | null): string {
  if (!s) return ""
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function masked(value: string, isCred: boolean, includeCreds: boolean): string {
  if (isCred && !includeCreds) return "••••••••"
  return esc(value) || "—"
}

function fieldStatus(value: string): "enrolled" | "none" | "pending" {
  if (value === "None") return "none"
  if (!value || value === "—") return "pending"
  return "enrolled"
}

function sectionCard(title: string, content: string): string {
  return `<div class="section-card">
  <div class="section-title">${esc(title)}</div>
  <div class="section-body">${content}</div>
</div>`
}

// ─── Field grid (2-column) ────────────────────────────────────────────────────
function fieldGrid(fields: DataField[]): string {
  if (!fields.length) return `<p class="empty-note">No data on file.</p>`

  const items = fields.map(f => {
    const status = fieldStatus(f.value)
    const isLink = !!f.link || f.value.startsWith("http")

    let valueHtml: string
    if (isLink) {
      valueHtml = `<span class="val-link">${esc(f.link ?? f.value)}</span>`
    } else {
      const cls = status === "enrolled" ? "" : status === "none" ? "val-none" : "val-pending"
      const display = status === "none" ? "Not enrolled" : esc(f.value) || "—"
      valueHtml = `<span class="${cls}">${display}</span>`
    }

    let extras = ""
    if (f.account && status === "enrolled") extras += `<div class="field-account">${esc(f.account)}</div>`
    if (f.provider && f.provider !== "—") extras += `<div class="field-meta">Provider: ${esc(f.provider)}</div>`
    if (f.contractNumber && f.contractNumber !== "—") extras += `<div class="field-meta">Contract: ${esc(f.contractNumber)}</div>`
    if (f.expiry && f.expiry !== "—") extras += `<div class="field-meta">Expires: ${esc(f.expiry)}</div>`

    return `<div class="field-item">
  <div class="field-label">${esc(f.label)}</div>
  <div class="field-value">${valueHtml}${extras}</div>
</div>`
  }).join("\n")

  return `<div class="field-grid">${items}</div>`
}

// ─── Identity ─────────────────────────────────────────────────────────────────
function renderIdentity(identity: DataField[]): string {
  return sectionCard("Identity", fieldGrid(identity))
}

// ─── Powerplant & APU ─────────────────────────────────────────────────────────
function renderPowerplant(powerplant: DataField[], apu: DataField[] | null): string {
  const allFields = [...powerplant, ...(apu ?? [])]
  const val = (label: string) => allFields.find(f => f.label === label)?.value ?? "—"

  function nums(prefix: string, src: DataField[]): number[] {
    return [...new Set(
      src
        .map(f => { const m = f.label.match(new RegExp(`^${prefix}\\s+(\\d+)\\b`, "i")); return m ? parseInt(m[1]) : 0 })
        .filter(n => n > 0)
    )].sort((a, b) => a - b)
  }

  const engNums  = nums("Engine",    powerplant)
  const propNums = nums("Propeller", powerplant)
  const apuNums  = apu ? nums("APU", apu) : []

  let content = ""

  if (engNums.length) {
    content += `<div class="sub-section-title">Propulsion</div><div class="pp-grid">`
    for (const n of engNums) {
      const isTwin = engNums.length > 1
      const descriptor = val(`Engine ${n} Descriptor`)
      content += `<div class="pp-unit">
  <div class="pp-unit-label">${isTwin ? `Engine ${n}` : "Engine"}</div>
  <div class="pp-row"><span class="pp-field">Manufacturer</span><span>${esc(val(`Engine ${n} Manufacturer`))}</span></div>
  <div class="pp-row"><span class="pp-field">Model</span><span>${esc(val(`Engine ${n} Model`))}</span></div>
  <div class="pp-row"><span class="pp-field">S/N</span><span>${esc(val(`Engine ${n} S/N`))}</span></div>
  ${descriptor && descriptor !== "—" ? `<div class="pp-row pp-note"><span>${esc(descriptor)}</span></div>` : ""}
</div>`
    }
    content += `</div>`
  }

  if (propNums.length) {
    content += `<div class="sub-section-title">Propeller</div><div class="pp-grid">`
    for (const n of propNums) {
      const isMulti = propNums.length > 1
      const descriptor = val(`Propeller ${n} Descriptor`)
      content += `<div class="pp-unit">
  <div class="pp-unit-label">${isMulti ? `Propeller ${n}` : "Propeller"}</div>
  <div class="pp-row"><span class="pp-field">Manufacturer</span><span>${esc(val(`Propeller ${n} Manufacturer`))}</span></div>
  <div class="pp-row"><span class="pp-field">Blades</span><span>${esc(val(`Propeller ${n} Blades`))}</span></div>
  <div class="pp-row"><span class="pp-field">Model</span><span>${esc(val(`Propeller ${n} Model`))}</span></div>
  <div class="pp-row"><span class="pp-field">S/N</span><span>${esc(val(`Propeller ${n} S/N`))}</span></div>
  ${descriptor && descriptor !== "—" ? `<div class="pp-row pp-note"><span>${esc(descriptor)}</span></div>` : ""}
</div>`
    }
    content += `</div>`
  }

  if (apuNums.length && apu) {
    content += `<div class="sub-section-title">APU</div><div class="pp-grid">`
    for (const n of apuNums) {
      content += `<div class="pp-unit">
  <div class="pp-unit-label">APU ${n}</div>
  <div class="pp-row"><span class="pp-field">Manufacturer</span><span>${esc(val(`APU ${n} Manufacturer`))}</span></div>
  <div class="pp-row"><span class="pp-field">Model</span><span>${esc(val(`APU ${n} Model`))}</span></div>
  <div class="pp-row"><span class="pp-field">S/N</span><span>${esc(val(`APU ${n} S/N`))}</span></div>
</div>`
    }
    content += `</div>`
  }

  return sectionCard("Powerplant & APU", content || `<p class="empty-note">No powerplant data on file.</p>`)
}

// ─── Programs ─────────────────────────────────────────────────────────────────
function renderPrograms(programs: DataField[]): string {
  if (!programs.length) return sectionCard("Programs", `<p class="empty-note">No program data on file.</p>`)

  const groups: Record<string, DataField[]> = {}
  for (const f of programs) {
    const g = f.group ?? "General"
    if (!groups[g]) groups[g] = []
    groups[g].push(f)
  }

  let content = ""
  for (const [groupName, fields] of Object.entries(groups)) {
    content += `<div class="sub-section-title">${esc(groupName)}</div>`
    for (const f of fields) {
      const status = fieldStatus(f.value)
      let meta = ""
      if (status === "enrolled") {
        if (f.provider && f.provider !== "—") meta += `<span>Provider: ${esc(f.provider)}</span>`
        if (f.contractNumber && f.contractNumber !== "—") meta += `<span>Contract: ${esc(f.contractNumber)}</span>`
        if (f.expiry && f.expiry !== "—") meta += `<span>Expires: ${esc(f.expiry)}</span>`
      }
      content += `<div class="program-row">
  <span class="program-name">${esc(f.label)}</span>
  <span class="program-status ${status === "enrolled" ? "status-enrolled" : status === "none" ? "status-none" : "status-pending"}">
    ${status === "none" ? "Not Enrolled" : status === "enrolled" ? esc(f.value) : "—"}
  </span>
  ${meta ? `<div class="program-meta">${meta}</div>` : ""}
</div>`
    }
  }

  return sectionCard("Programs", content)
}

// ─── Avionics & Connectivity ──────────────────────────────────────────────────
function renderAvionics(
  avionics: AvionicsService[],
  navSubs: NavSubscription[],
  includeCredentials: boolean,
): string {
  if (!avionics.length && !navSubs.length) {
    return sectionCard("Avionics & Connectivity", `<p class="empty-note">No avionics data on file.</p>`)
  }

  let content = ""

  for (const svc of avionics) {
    content += `<div class="avionics-service">
  <div class="avionics-service-header">
    <span class="avionics-service-label">${esc(svc.label)}</span>
    <span class="avionics-category">${esc(svc.category)}</span>
  </div>`

    const builtins = svc.fields.filter(f => f.builtin)
    const customs  = svc.fields.filter(f => !f.builtin)

    if (builtins.length) {
      content += `<div class="avionics-field-grid">`
      for (const field of builtins) {
        const isCred = isCredentialField(field)
        const isEmpty = !field.value || field.value === ""
        let display: string
        if (field.type === "boolean") {
          display = field.value === "Yes"
            ? "Yes" + (field.detail ? ` — ${esc(field.detail)}` : "")
            : "No"
        } else {
          display = masked(field.value, isCred, includeCredentials)
        }
        const valueCls = isCred && !includeCredentials ? "val-masked" : isEmpty ? "val-pending" : ""
        content += `<div class="avionics-field">
  <div class="field-label">${esc(field.name)}${isCred && !includeCredentials ? " 🔒" : ""}</div>
  <div class="field-value ${valueCls}">${display}</div>
</div>`
      }
      content += `</div>`
    }

    if (customs.length) {
      content += `<div class="avionics-custom-fields">`
      for (const field of customs) {
        const isCred = isCredentialField(field)
        const isEmpty = !field.value || field.value === ""
        const display = masked(field.value, isCred, includeCredentials)
        const valueCls = isCred && !includeCredentials ? "val-masked" : isEmpty ? "val-pending" : ""
        content += `<div class="avionics-custom-row">
  <span class="custom-field-label">${esc(field.name)}${isCred && !includeCredentials ? " 🔒" : ""}</span>
  <span class="field-value ${valueCls}">${display}</span>
</div>`
      }
      content += `</div>`
    }

    if (svc.notes) {
      content += `<div class="avionics-note">${esc(svc.notes)}</div>`
    }

    content += `</div>`
  }

  // Legacy NavSubscription fallback
  if (!avionics.length && navSubs.length) {
    for (const sub of navSubs) {
      content += `<div class="avionics-service">
  <div class="avionics-service-header">
    <span class="avionics-service-label">${esc(sub.serviceName)}</span>
    <span class="avionics-category">Nav Database</span>
  </div>
  <div class="avionics-field-grid">
    <div class="avionics-field"><div class="field-label">Account 🔒</div><div class="field-value val-masked">${includeCredentials ? esc(sub.account) : "••••••••"}</div></div>
    <div class="avionics-field"><div class="field-label">Username 🔒</div><div class="field-value val-masked">${includeCredentials ? esc(sub.username) : "••••••••"}</div></div>
    <div class="avionics-field"><div class="field-label">Password 🔒</div><div class="field-value val-masked">${includeCredentials ? esc(sub.password) : "••••••••"}</div></div>
    <div class="avionics-field"><div class="field-label">2FA</div><div class="field-value">${sub.twoFactor ? "Yes" + (sub.twoFactorInstructions ? ` — ${esc(sub.twoFactorInstructions)}` : "") : "No"}</div></div>
    <div class="avionics-field"><div class="field-label">Cycle</div><div class="field-value">${sub.cycleDays}-day</div></div>
    ${sub.loginUrl ? `<div class="avionics-field"><div class="field-label">Login URL</div><div class="field-value val-link">${esc(sub.loginUrl)}</div></div>` : ""}
  </div>
</div>`
    }
  }

  if (!includeCredentials) {
    content += `<div class="credential-notice">🔒 Credential fields are redacted. Re-export with "Nav Database Credentials" enabled to include them.</div>`
  }

  return sectionCard("Avionics & Connectivity", content)
}

// ─── Documentation & Manuals ──────────────────────────────────────────────────
function renderDocumentation(documentation: DataField[]): string {
  return sectionCard("Documentation & Manuals", fieldGrid(documentation))
}

// ─── CMM Library ─────────────────────────────────────────────────────────────
function renderCMMs(cmms: CMMDocument[]): string {
  if (!cmms.length) return ""
  const rows = cmms.map(c => `<tr>
  <td>${esc(c.ataChapter)}</td>
  <td>${esc(c.title ?? c.component ?? "—")}</td>
  <td>${esc(c.manufacturer ?? "—")}</td>
  <td>${esc(c.docNumber)}</td>
  <td>${esc(c.revision)}</td>
  <td>${esc(c.revisionDate ?? "—")}</td>
</tr>`).join("\n")

  return sectionCard("CMM Library", `<table class="cmm-table">
  <thead><tr>
    <th>ATA</th><th>Title / Component</th><th>Manufacturer</th><th>Doc #</th><th>Rev</th><th>Rev Date</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`)
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Arial', 'Helvetica Neue', sans-serif;
  background: #c8c6be;
  color: #111018;
  font-size: 12px;
  line-height: 1.55;
}

.page-wrapper { max-width: 900px; margin: 0 auto; padding: 0 32px 48px; }

/* Print toolbar — screen only */
.print-bar {
  position: sticky; top: 0; z-index: 100;
  background: #1a1a2e; color: #fff;
  padding: 10px 32px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; letter-spacing: 0.04em;
}
.print-bar span { color: rgba(255,255,255,0.5); }
.print-btn {
  background: #d4a017; color: #111; border: none;
  padding: 7px 18px; border-radius: 4px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; cursor: pointer;
}
.print-btn:hover { background: #c4901a; }

/* Header stripe */
.header-stripe {
  height: 4px;
  background: linear-gradient(90deg, #c10230 0%, #012e45 100%);
}

/* Document header */
.doc-header {
  padding: 24px 0 18px;
  display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1px solid rgba(212,160,23,0.3);
  margin-bottom: 20px;
}
.brand-wordmark {
  font-family: 'Arial Black', Arial, sans-serif;
  font-size: 13px; font-weight: 900;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: #d4a017; line-height: 1;
}
.brand-subtitle {
  font-size: 8px; letter-spacing: 0.16em;
  text-transform: uppercase; color: #999; margin-top: 3px;
}
.brand-rule { width: 36px; height: 1px; background: #d4a017; margin-top: 7px; }

.doc-title-block { text-align: right; }
.doc-title {
  font-size: 9px; letter-spacing: 0.16em;
  text-transform: uppercase; color: #999; margin-bottom: 4px;
}
.tail-number {
  font-size: 24px; font-weight: 900;
  letter-spacing: 0.12em; color: #012e45; line-height: 1;
}
.aircraft-model { font-size: 10px; color: #555; margin-top: 3px; letter-spacing: 0.04em; }
.generated-meta { font-size: 9px; color: #aaa; margin-top: 6px; letter-spacing: 0.02em; line-height: 1.6; }

/* Section cards */
.section-card {
  background: #fff;
  border-left: 3px solid #d4a017;
  border-radius: 0 6px 6px 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  margin-bottom: 14px;
  overflow: hidden;
  break-inside: avoid;
}
.section-title {
  font-size: 8px; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: #012e45; background: rgba(212,160,23,0.07);
  padding: 8px 14px; border-bottom: 1px solid rgba(212,160,23,0.15);
}
.section-body { padding: 10px 14px 12px; }

/* Field grid */
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.field-item { padding: 7px 10px; border-bottom: 0.5px solid #ebe8e0; }
.field-item:nth-child(odd) { border-right: 0.5px solid #ebe8e0; }
.field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.09em; color: #888; font-weight: 700; margin-bottom: 3px; }
.field-value { font-size: 13px; color: #111018; font-weight: 600; }
.val-pending { color: #bbb; font-family: 'Courier New', monospace; font-weight: 400; }
.val-none { color: #bbb; font-style: italic; font-size: 11px; font-weight: 400; }
.val-link { color: #012e45; font-size: 10px; word-break: break-all; font-weight: 500; }
.val-masked { color: #aaa; letter-spacing: 0.18em; font-family: 'Courier New', monospace; font-size: 11px; font-weight: 400; }
.field-account { font-size: 10px; color: #d4a017; font-family: 'Courier New', monospace; margin-top: 2px; font-weight: 600; }
.field-meta { font-size: 10px; color: #777; margin-top: 2px; font-weight: 500; }

/* Sub-section titles */
.sub-section-title {
  font-size: 7.5px; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: #d4a017;
  padding: 6px 0 4px; border-bottom: 0.5px solid rgba(212,160,23,0.2);
  margin-bottom: 6px; margin-top: 4px;
}

/* Powerplant */
.pp-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.pp-unit {
  flex: 1; min-width: 180px;
  background: #f5f3ee; border: 0.5px solid #dedad0;
  border-radius: 4px; padding: 9px 11px;
}
.pp-unit-label { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #012e45; margin-bottom: 6px; }
.pp-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 0.5px solid #ebe8e0; font-size: 12px; font-weight: 600; color: #111018; }
.pp-field { color: #777; min-width: 90px; font-size: 10px; flex-shrink: 0; font-weight: 700; }
.pp-note { color: #666; font-style: italic; font-size: 10px; justify-content: flex-start; border-bottom: none; font-weight: 400; }

/* Programs */
.program-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; padding: 5px 0; border-bottom: 0.5px solid #ebe8e0; }
.program-name { font-size: 12px; color: #111018; font-weight: 600; flex: 1; min-width: 140px; }
.program-status { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
.status-enrolled { color: #1f6b3a; }
.status-none { color: #bbb; font-style: italic; font-weight: 400; }
.status-pending { color: #d4a017; font-family: 'Courier New', monospace; font-weight: 400; }
.program-meta { font-size: 10px; color: #666; display: flex; gap: 10px; width: 100%; padding-bottom: 2px; font-weight: 500; }

/* Avionics */
.avionics-service { border: 0.5px solid #dedad0; border-radius: 4px; margin-bottom: 8px; overflow: hidden; }
.avionics-service-header {
  display: flex; justify-content: space-between; align-items: center;
  background: #f0ede6; padding: 7px 11px; border-bottom: 0.5px solid #dedad0;
}
.avionics-service-label { font-size: 13px; font-weight: 800; color: #012e45; letter-spacing: 0.03em; }
.avionics-category {
  font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase;
  color: #d4a017; background: rgba(212,160,23,0.12); padding: 2px 7px; border-radius: 2px; font-weight: 700;
}
.avionics-field-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; padding: 5px 8px 8px; }
.avionics-field { padding: 5px 7px; border-bottom: 0.5px solid #ebe8e0; }
.avionics-custom-fields { padding: 4px 12px 8px; }
.avionics-custom-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 0.5px solid #ebe8e0; font-size: 12px; font-weight: 600; }
.custom-field-label { color: #777; font-size: 10px; font-weight: 700; }
.avionics-note { font-size: 9px; color: #888; font-style: italic; padding: 4px 10px 6px; border-top: 0.5px solid #f5f3ee; }
.credential-notice {
  background: rgba(212,160,23,0.06); border: 0.5px solid rgba(212,160,23,0.25);
  border-radius: 3px; padding: 6px 10px; font-size: 9px; color: #d4a017;
  margin-top: 6px; letter-spacing: 0.02em;
}

/* CMM table */
.cmm-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.cmm-table th {
  background: #eeecea; color: #012e45;
  font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 6px 8px; text-align: left; border-bottom: 1px solid #dedad0; font-weight: 800;
}
.cmm-table td { padding: 6px 8px; border-bottom: 0.5px solid #ebe8e0; color: #111018; font-weight: 500; vertical-align: top; }
.cmm-table tr:nth-child(even) td { background: #f8f6f2; }

/* Footer */
.doc-footer {
  margin-top: 24px; padding-top: 10px;
  border-top: 0.5px solid rgba(212,160,23,0.3);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: #888; letter-spacing: 0.04em; font-weight: 500;
}
.footer-sensitive { color: #c10230; font-weight: 700; letter-spacing: 0.06em; }

.empty-note { color: #ccc; font-style: italic; font-size: 10px; padding: 4px 0; }

/* Print overrides */
@media print {
  @page { margin: 0.55in 0.65in; }
  body { background: #fff; font-size: 10px; }
  .print-bar { display: none !important; }
  .section-card { box-shadow: none; break-inside: avoid; }
  .page-wrapper { padding: 0; max-width: 100%; }
  .header-stripe { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .brand-rule { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`

// ─── Main export ──────────────────────────────────────────────────────────────
export function generateAircraftPrintHTML(opts: PrintOptions): string {
  const { aircraft, detail, sections, includeCredentials, generatedBy } = opts

  const has = (id: string) => sections.includes(id)

  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  let body = ""
  if (has("identity"))      body += renderIdentity(detail.identity)
  if (has("powerplant"))    body += renderPowerplant(detail.powerplant, detail.apu)
  if (has("programs"))      body += renderPrograms(detail.programs)
  if (has("avionics"))      body += renderAvionics(detail.avionics, detail.navSubscriptions, includeCredentials)
  if (has("documentation")) body += renderDocumentation(detail.documentation)
  if (has("cmms") && detail.cmms.length) body += renderCMMs(detail.cmms)

  const sensitiveFooter = includeCredentials
    ? `<span class="footer-sensitive">⚠&nbsp; CONTAINS SENSITIVE CREDENTIAL DATA — DISTRIBUTION RESTRICTED</span>`
    : `<span>For internal use only &nbsp;·&nbsp; SkyShare MX</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aircraft Info — ${esc(aircraft.tailNumber)}</title>
<style>${CSS}</style>
</head>
<body>

<div class="print-bar">
  <span>SkyShare MX &nbsp;·&nbsp; Aircraft Information Sheet &nbsp;·&nbsp; ${esc(aircraft.tailNumber)}</span>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>

<div class="header-stripe"></div>

<div class="page-wrapper">

  <div class="doc-header">
    <div>
      <div class="brand-wordmark">SkyShare MX</div>
      <div class="brand-subtitle">Maintenance Portal</div>
      <div class="brand-rule"></div>
    </div>
    <div class="doc-title-block">
      <div class="doc-title">Aircraft Information Sheet</div>
      <div class="tail-number">${esc(aircraft.tailNumber)}</div>
      <div class="aircraft-model">${esc(aircraft.model)} &nbsp;·&nbsp; S/N&nbsp;${esc(aircraft.serialNumber)}</div>
      <div class="generated-meta">
        Generated ${esc(dateStr)} at ${esc(timeStr)}<br>
        ${esc(generatedBy)}
      </div>
    </div>
  </div>

  ${body}

  <div class="doc-footer">
    ${sensitiveFooter}
    <span>${esc(aircraft.tailNumber)} &nbsp;·&nbsp; ${esc(dateStr)}</span>
  </div>

</div>
</body>
</html>`
}
