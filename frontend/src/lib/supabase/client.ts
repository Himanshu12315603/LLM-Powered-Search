import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = import.meta.env.BUN_PUBLIC_SUPABASE_URL || process.env.BUN_PUBLIC_SUPABASE_URL;
  const key = import.meta.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return createBrowserClient(url!, key!);
}
