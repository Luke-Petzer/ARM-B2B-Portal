// Browser-safe Supabase client — for use in Client Components only.
// Uses the anon key. Supabase Auth session cookies are read automatically
// by createBrowserClient, so RLS policies evaluate against the logged-in user.
// NEVER import the service-role admin client in browser code.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { supabaseUrl, supabaseAnonKey } from "./config";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
