import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { DisplayLabel } from "../types"

type LabelAction =
  | { recordSourceId: string; action: "save"; label: DisplayLabel }
  | { recordSourceId: string; action: "generate" }

async function callLabelFn(args: LabelAction): Promise<{ ok: boolean; label?: DisplayLabel }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const resp = await fetch("/.netlify/functions/records-vault-label", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(args),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "")
    throw new Error(`Label function failed: ${resp.status} ${txt}`)
  }
  return resp.json()
}

export function useLabelMutation(aircraftId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: callLabelFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-sources", aircraftId] })
    },
  })
}
