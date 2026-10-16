/**
 * @file shared/lib/supabase/service.ts
 * @purpose منطق دامنه — زیرساخت مشترک سامانه (service)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on nothing
 */

import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase service role is not configured')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
