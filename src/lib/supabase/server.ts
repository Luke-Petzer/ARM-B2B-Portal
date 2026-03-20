// Server-side Supabase client — safe for Server Components, Server Actions, and Route Handlers.
// Uses the anon key + the current user's session cookie (managed by @supabase/ssr).
// RLS is enforced on all queries made with this client.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { supabaseUrl, supabaseAnonKey } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll called from a Server Component — cookies are read-only here.
          // Session refresh happens in middleware; this is safe to ignore.
        }
      },
    },
  });
}
