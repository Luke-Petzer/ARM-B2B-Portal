// Service-role Supabase client — SERVER ONLY.
// Bypasses Row Level Security entirely. Use ONLY for:
//   - Admin-provisioned operations (creating buyer profiles)
//   - Buyer login verification (reading profiles by account number)
//   - Background/webhook handlers that run outside a user session
// NEVER import this in Client Components or expose it to the browser.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { supabaseUrl } from "./config";

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceRoleKey) {
  throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
}

export const adminClient = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      // Disable auto-refresh — service role tokens don't expire in the same way.
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
