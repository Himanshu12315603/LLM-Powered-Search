import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    import.meta.env.BUN_PUBLIC_SUPABASE_URL!,
    import.meta.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
