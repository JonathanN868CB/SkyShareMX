import { useEffect, useRef, useState } from "react"
import { Link } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { Button } from "@/shared/ui/button"

// ─── Minimal Google API type declarations ────────────────────────────────────
declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initCodeClient(config: {
            client_id: string
            scope: string
            ux_mode: "popup"
            prompt: string
            callback: (response: { code?: string; error?: string }) => void
          }): { requestCode(): void }
        }
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFileId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

async function driveGetFile(
  accessToken: string,
  fileId: string,
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id%2Cname`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; name: string }>
}

async function driveSearch(
  accessToken: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const q = `name = '${name.replace(/'/g, "\\'")}'`
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "5" })
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  const data = await res.json() as { files?: Array<{ id: string; name: string }> }
  return data.files?.[0] ?? null
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "idle"
  | "authorizing"
  | "searching"
  | "confirming"
  | "url_input"
  | "validating"
  | "warned"
  | "saving"
  | "error"

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrainingConnect({ onConnected }: { onConnected: () => void }) {
  const { session, profile } = useAuth()

  const [step, setStep]           = useState<Step>("idle")
  const [errorMsg, setErrorMsg]   = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [autoFoundFile, setAutoFoundFile] = useState<{ id: string; name: string } | null>(null)
  const [foundFile, setFoundFile] = useState<{ id: string; name: string } | null>(null)
  const [urlInput, setUrlInput]   = useState("")

  const gisReady = useRef(false)

  // Load GIS script on mount
  useEffect(() => {
    const src = "https://accounts.google.com/gsi/client"
    if (document.querySelector(`script[src="${src}"]`)) { gisReady.current = true; return }
    const s = document.createElement("script")
    s.src = src
    s.async = true
    s.onload = () => { gisReady.current = true }
    document.body.appendChild(s)
  }, [])

  // ── Expected filename based on logged-in user ─────────────────────────────
  const fullName     = profile?.full_name?.trim() ?? ""
  const expectedName = fullName ? `MX-LMS Training \u2014 ${fullName}` : null

  function nameMatches(fileName: string): boolean {
    if (!expectedName) return true   // can't validate without a name — let it through
    return fileName.trim().toLowerCase().startsWith(expectedName.toLowerCase())
  }

  // ── Step 3: save file ID to Supabase ─────────────────────────────────────
  async function saveFileId(fileId: string) {
    setStep("saving")
    const { error } = await supabase
      .from("profiles")
      .update({ training_sheet_file_id: fileId })
      .eq("id", profile!.id)
    if (error) {
      setStep("error")
      setErrorMsg("Failed to save your training sheet. Please try again.")
      return
    }
    onConnected()
  }

  // ── Step 2: auto-search Drive ─────────────────────────────────────────────
  async function searchDrive(token: string) {
    if (!expectedName) { setStep("url_input"); return }
    setStep("searching")
    try {
      const file = await driveSearch(token, expectedName)
      if (file) {
        setAutoFoundFile(file)
        setFoundFile(file)
        setStep("confirming")
      } else {
        setStep("url_input")
      }
    } catch {
      // Search failed silently — fall back to manual URL input
      setStep("url_input")
    }
  }

  // ── URL input: look up file metadata ─────────────────────────────────────
  async function handleUrlLookup() {
    const fileId = extractFileId(urlInput.trim())
    if (!fileId) {
      setStep("error")
      setErrorMsg("That doesn't look like a valid Google Sheets URL. Please check and try again.")
      return
    }

    setStep("validating")
    try {
      const file = await driveGetFile(accessToken, fileId)
      if (!file) {
        setStep("error")
        setErrorMsg("We couldn't access that file. Make sure the URL is correct and you have access to it.")
        return
      }
      setFoundFile(file)
      if (nameMatches(file.name)) {
        await saveFileId(file.id)
      } else {
        setStep("warned")
      }
    } catch {
      setStep("error")
      setErrorMsg("Something went wrong looking up that file. Please try again.")
    }
  }

  // ── Step 1: OAuth code flow ───────────────────────────────────────────────
  function handleConnect() {
    if (!gisReady.current) {
      setStep("error")
      setErrorMsg("Google sign-in not ready yet — please try again in a moment.")
      return
    }

    setStep("authorizing")
    setErrorMsg("")

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
      scope: [
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
      ].join(" "),
      ux_mode:  "popup",
      prompt:   "consent",
      callback: async (response) => {
        if (response.error || !response.code) {
          setStep("error")
          setErrorMsg("Google authorization was cancelled or failed. Please try again.")
          return
        }

        try {
          const res = await fetch("/.netlify/functions/save-training-auth", {
            method:  "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization:  `Bearer ${session!.access_token}`,
            },
            body: JSON.stringify({ authCode: response.code }),
          })

          const data = await res.json() as { accessToken?: string; error?: string }

          if (!res.ok) {
            const msg = data.error === "no_refresh_token"
              ? "Authorization incomplete. Please revoke SkyShare MX access in your Google account settings, then try again."
              : "Authorization failed. Please try again."
            setStep("error")
            setErrorMsg(msg)
            return
          }

          setAccessToken(data.accessToken!)
          await searchDrive(data.accessToken!)
        } catch {
          setStep("error")
          setErrorMsg("Something went wrong. Please try again.")
        }
      },
    })

    client.requestCode()
  }

  function reset() {
    setStep("idle")
    setErrorMsg("")
    setAutoFoundFile(null)
    setFoundFile(null)
    setUrlInput("")
    setAccessToken("")
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 px-8 text-center">

      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 56, height: 56,
          background: "rgba(212,160,23,0.1)",
          border: "1px solid rgba(212,160,23,0.25)",
        }}
      >
        <Link size={22} style={{ color: "var(--skyshare-gold)" }} />
      </div>

      {/* Heading */}
      <div className="flex flex-col gap-1.5">
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}
        >
          Link your training sheet
        </h2>
        <p className="text-sm max-w-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          Connect the Google Sheet that contains your training assignments.
          You'll only need to do this once.
        </p>
      </div>

      {/* ── Idle / Authorizing / Error ── */}
      {(step === "idle" || step === "authorizing" || step === "error") && (
        <>
          <Button
            onClick={handleConnect}
            disabled={step === "authorizing"}
            style={{
              background: step === "authorizing" ? "rgba(212,160,23,0.4)" : "var(--skyshare-gold)",
              color: "#111",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.08em",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {step === "authorizing" ? "Waiting for Google authorization…" : "Connect your training sheet"}
          </Button>
          {step === "error" && errorMsg && (
            <p className="text-xs max-w-sm" style={{ color: "#e05070" }}>{errorMsg}</p>
          )}
        </>
      )}

      {/* ── Searching ── */}
      {step === "searching" && (
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          Searching your Drive for your training sheet…
        </p>
      )}

      {/* ── Confirming auto-found file ── */}
      {step === "confirming" && foundFile && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div
            className="w-full rounded-lg px-4 py-3 text-left"
            style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <p
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
            >
              Found your training sheet
            </p>
            <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
              {foundFile.name}
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              className="flex-1"
              onClick={() => saveFileId(foundFile.id)}
              style={{
                background: "var(--skyshare-gold)",
                color: "#111",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.08em",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Yes, connect this sheet
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-xs"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onClick={() => setStep("url_input")}
            >
              Use a different file
            </Button>
          </div>
        </div>
      )}

      {/* ── URL input / Validating ── */}
      {(step === "url_input" || step === "validating") && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {autoFoundFile ? (
            <button
              onClick={() => { setFoundFile(autoFoundFile); setStep("confirming") }}
              className="text-xs self-start"
              style={{ color: "var(--skyshare-gold)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Back to suggested file
            </button>
          ) : (
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              We couldn't find your sheet automatically. Paste the Google Sheets URL below.
            </p>
          )}
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            disabled={step === "validating"}
            className="w-full rounded-md px-3 py-2 text-sm bg-transparent"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              color: "hsl(var(--foreground))",
              outline: "none",
            }}
          />
          <Button
            onClick={handleUrlLookup}
            disabled={!urlInput.trim() || step === "validating"}
            style={{
              background: "var(--skyshare-gold)",
              color: "#111",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.08em",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              opacity: !urlInput.trim() || step === "validating" ? 0.4 : 1,
            }}
          >
            {step === "validating" ? "Checking file…" : "Connect this sheet"}
          </Button>
        </div>
      )}

      {/* ── Name mismatch warning ── */}
      {step === "warned" && foundFile && (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <div
            className="w-full rounded-lg px-4 py-3 text-left"
            style={{ background: "rgba(224,80,112,0.08)", border: "1px solid rgba(224,80,112,0.25)" }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "#e05070" }}>
              This doesn't appear to be the correct file. Your file should be named{" "}
              <strong>{expectedName ?? `MX-LMS Training \u2014 [Your Name]`}</strong>, but the selected file is named{" "}
              <strong>{foundFile.name}</strong>. Please check that you have the right spreadsheet before continuing.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              className="flex-1"
              onClick={() => saveFileId(foundFile.id)}
              style={{
                background: "rgba(224,80,112,0.12)",
                color: "#e05070",
                border: "1px solid rgba(224,80,112,0.3)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.08em",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Continue anyway
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-xs"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onClick={reset}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Saving ── */}
      {step === "saving" && (
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Saving…</p>
      )}

      {/* Privacy note */}
      <p
        className="text-[10px] max-w-xs leading-relaxed"
        style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
      >
        SkyShare MX only reads your training sheet.
        No other Drive content is accessible.
      </p>

    </div>
  )
}
