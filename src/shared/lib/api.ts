import { createClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "@/entities/supabase";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/shared/lib/env";

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

const browserStorage = typeof window !== "undefined" ? window.localStorage : undefined;

const authOptions = browserStorage
  ? { storage: browserStorage, persistSession: true, autoRefreshToken: true }
  : { persistSession: true, autoRefreshToken: true };

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: authOptions,
});

export const getSession = async () => supabase.auth.getSession();

export const signInWithPassword = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export type { Database, Tables, TablesInsert, TablesUpdate, Enums };
