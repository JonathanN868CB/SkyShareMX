// Supabase client scoped to the mxlms schema.
// Use this for all My Training / My Journey queries.
// Shares localStorage auth storage with the main supabase client so auth.uid()
// is set correctly and RLS policies resolve properly.
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl, getSupabaseAnonKey } from "@/shared/lib/env"

export const mxlms = createClient(
  getSupabaseUrl(),
  getSupabaseAnonKey(),
  {
    db: { schema: "mxlms" },
    auth: { storageKey: "sb-xzcrkzvonjyznzxdbpjj-auth-token" },
  }
)
