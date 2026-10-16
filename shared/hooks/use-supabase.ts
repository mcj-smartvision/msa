/**
 * @file shared/hooks/use-supabase.ts
 * @purpose هوک — زیرساخت مشترک سامانه (use-supabase)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/lib/supabase/client
 */

import { createClient } from '@/shared/lib/supabase/client'
import { useMemo } from 'react'

export function useSupabase() {
  return useMemo(() => createClient(), [])
}
