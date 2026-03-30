// Supabase client scoped to the mxlms schema.
// Use this for all My Training / My Journey queries.
// Auth (JWT) flows through normally — RLS still applies via auth.uid().
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl, getSupabaseAnonKey } from "@/shared/lib/env"

export const mxlms = createClient(
  getSupabaseUrl(),
  getSupabaseAnonKey(),
  { db: { schema: "mxlms" } }
)
