import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// Server-side client using anon key — for Server Components (no auth context)
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    noStoreGlobal
  )
}

// Client with user session — for server components that need auth context
export function createAuthServerClient() {
  const cookieStore = cookies()
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // server components cannot set cookies
      },
    }
  )
}

// Helper: get current user in server components (returns null if not authenticated)
export async function getCurrentUser() {
  const supabase = createAuthServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
