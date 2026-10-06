import { createClient } from '@/shared/lib/supabase/client'
import { useMemo } from 'react'

export function useSupabase() {
  return useMemo(() => createClient(), [])
}
