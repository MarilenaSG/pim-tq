import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const noStoreGlobal = {
  global: {
    fetch: (url: RequestInfo | URL, options?: RequestInit) =>
      fetch(url, { ...options, cache: 'no-store' }),
  },
}

// Server-side client using service role key — only for API routes
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    noStoreGlobal
  )
}

// Server-side client using anon key — for Server Components
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    noStoreGlobal
  )
}
