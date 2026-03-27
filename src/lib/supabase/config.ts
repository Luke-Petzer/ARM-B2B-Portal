// Shared Supabase configuration — imported by all client factory files.
// Never import this directly in application code; use the typed client factories instead.
// NOTE: This file is intentionally NOT server-only — it exports only NEXT_PUBLIC_ vars
// which are safe for browser/middleware use. The service role key lives in admin.ts only.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing required Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}
