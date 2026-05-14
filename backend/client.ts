import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  return createClient(
    process.env.BUN_PUBLIC_SUPABASE_URL!,
    process.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
