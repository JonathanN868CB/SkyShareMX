import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/entities/supabase"
import { getSupabaseUrl, getSupabaseAnonKey } from "@/shared/lib/env"

export const supabase = createClient<Database>(
  getSupabaseUrl(),
  getSupabaseAnonKey()
)
