import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  return createClient(
    import.meta.env.BUN_PUBLIC_SUPABASE_URL!,
    import.meta.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
