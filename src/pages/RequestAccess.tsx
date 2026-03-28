import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { isAllowedEmail } from "@/shared/lib/env"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"
import skyShareLogo from "@/shared/assets/skyshare-logo.png"

export default function RequestAccess() {
  const [params] = useSearchParams()
  const isPending = params.get("status") === "pending"

  const [form, setForm] = useState({ email: "", full_name: "", company: "", reason: "" })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isAllowedEmail(form.email)) {
      setError("Only @skyshare.com email addresses can request access.")
      return
    }

    setLoading(true)
    const { error: dbError } = await supabase.from("access_requests").insert({
      email: form.email.toLowerCase().trim(),
      full_name: form.full_name.trim() || null,
      company: form.company.trim() || null,
      reason: form.reason.trim() || null,
    })

    if (dbError) {
      setLoading(false)
      setError("Something went wrong. Please try again.")
      return
    }

    // Notify admins — fire and forget, don't block the user on email failure
    fetch("/.netlify/functions/send-access-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.toLowerCase().trim(),
        fullName: form.full_name.trim() || null,
        company: form.company.trim() || null,
        reason: form.reason.trim() || null,
      }),
    }).catch(() => { /* silent — DB insert already succeeded */ })

    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <img src={skyShareLogo} alt="SkyShare" className="h-10 w-auto" />
          <h1 className="text-lg font-semibold text-foreground">MX Maintenance Portal</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request Access</CardTitle>
            <CardDescription>
              {isPending
                ? "Your account is pending approval. An admin will activate it shortly."
                : "Submit a request and an admin will review it."}
            </CardDescription>
          </CardHeader>

          {!submitted ? (
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">SkyShare email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@skyshare.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    placeholder="Jane Smith"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reason">Why do you need access?</Label>
                  <Textarea
                    id="reason"
                    placeholder="Brief description of your role and what you'll use this portal for."
                    value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    rows={3}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Submitting…" : "Submit Request"}
                </Button>
              </form>
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your request has been submitted. You&apos;ll receive access once an admin approves it.
              </p>
              <Button variant="outline" className="mt-4 w-full" asChild>
                <a href="/">Back to sign in</a>
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
