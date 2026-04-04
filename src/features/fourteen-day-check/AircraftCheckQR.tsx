// AircraftCheckQR — QR code modal for a permanent 14-day check URL.
// Printable: shows tail number + QR + URL below. No auth required for the link itself.

import { useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { X, Printer, Copy, Check } from "lucide-react"
import { useState } from "react"

type Props = {
  registration: string
  encodedToken: string
  onClose: () => void
}

export function AircraftCheckQR({ registration, encodedToken, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const checkUrl = `${window.location.origin}/check/${encodedToken}`

  function handleCopy() {
    navigator.clipboard.writeText(checkUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handlePrint() {
    const content = printRef.current
    if (!content) return
    const win = window.open("", "_blank", "width=500,height=600")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>14-Day Check — ${registration}</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: 'Helvetica Neue', Arial, sans-serif;
              background: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 20px;
            }
            .label {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.25em;
              text-transform: uppercase;
              color: #888;
            }
            .tail {
              font-size: 32px;
              font-weight: 900;
              letter-spacing: 0.15em;
              color: #111;
            }
            .url {
              font-size: 10px;
              color: #555;
              font-family: monospace;
              word-break: break-all;
              text-align: center;
              max-width: 280px;
            }
            .divider {
              width: 40px;
              height: 2px;
              background: #c0992a;
            }
          </style>
        </head>
        <body>
          <div class="label">SkyShare MX · 14-Day Check</div>
          <div class="tail">${registration}</div>
          <div class="divider"></div>
          ${content.querySelector("svg")?.outerHTML ?? ""}
          <div class="url">${checkUrl}</div>
          <div class="label">Scan to submit check</div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  return (
    <>
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative rounded-xl overflow-hidden w-full max-w-sm"
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header stripe */}
          <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <p
                className="text-[10px] font-bold tracking-[0.25em] uppercase"
                style={{ color: "rgba(212,160,23,0.7)" }}
              >
                14-Day Check
              </p>
              <p
                className="text-lg font-bold tracking-widest mt-0.5"
                style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
              >
                {registration}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR code */}
          <div ref={printRef} className="flex flex-col items-center px-6 py-7 gap-5">
            <div
              className="p-4 rounded-xl"
              style={{ background: "#fff" }}
            >
              <QRCodeSVG
                value={checkUrl}
                size={200}
                level="M"
                includeMargin={false}
                fgColor="#111111"
                bgColor="#ffffff"
              />
            </div>

            {/* URL */}
            <div className="w-full space-y-1.5">
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase text-center"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Permanent Link
              </p>
              <div
                className="rounded-md px-3 py-2 flex items-center gap-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span
                  className="flex-1 text-xs truncate font-mono"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {checkUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 p-1 rounded transition-colors"
                  style={{ color: copied ? "#4ade80" : "rgba(255,255,255,0.4)" }}
                  title="Copy link"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div
            className="flex gap-3 px-5 pb-5"
          >
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: "rgba(212,160,23,0.12)",
                border: "1px solid rgba(212,160,23,0.3)",
                color: "#d4a017",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.22)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.12)")}
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      />
    </>
  )
}
