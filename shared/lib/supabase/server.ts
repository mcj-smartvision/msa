/**
 * @file shared/lib/supabase/server.ts
 * @purpose منطق دامنه — زیرساخت مشترک سامانه (server)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on nothing
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component */ }
        },
      },
    }
  )
}
