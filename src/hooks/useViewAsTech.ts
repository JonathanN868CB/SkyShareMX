import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/features/auth"
import { mxlms } from "@/lib/supabase-mxlms"

type TechBasic = { id: number; name: string; role: string | null }

export function useViewAsTech() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const isSuperAdmin = profile?.role === "Super Admin"

  const asParam   = searchParams.get("as")
  const viewAsId  = isSuperAdmin && asParam ? parseInt(asParam, 10) : null

  const ownTechId      = profile?.mxlms_technician_id ?? null
  const effectiveTechId = viewAsId ?? ownTechId
  const isViewingOther  = viewAsId !== null && viewAsId !== ownTechId

  const { data: viewingTech = null } = useQuery({
    queryKey: ["view-as-tech", viewAsId],
    queryFn: async (): Promise<TechBasic | null> => {
      const { data } = await mxlms
        .from("technicians")
        .select("id, name, role")
        .eq("id", viewAsId!)
        .single()
      return data as TechBasic | null
    },
    enabled: isViewingOther,
  })

  const { data: allTechs = [] } = useQuery({
    queryKey: ["all-techs-picker"],
    queryFn: async (): Promise<TechBasic[]> => {
      const { data } = await mxlms
        .from("technicians")
        .select("id, name, role")
        .eq("status", "active")
        .order("name")
      return (data ?? []) as TechBasic[]
    },
    enabled: isSuperAdmin,
  })

  return { effectiveTechId, ownTechId, isViewingOther, isSuperAdmin, viewingTech, allTechs }
}
