'use client'

import { useEffect, useState } from 'react'
import type { Holiday } from '@/features/holidays/lib/types'

interface HolidaysState {
  holidays: Holiday[]
  canManage: boolean
}

let cache: HolidaysState | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<(state: HolidaysState) => void>()

/** Fetches the holiday list again and hands it to every mounted `useHolidays`. */
export function reloadHolidays(): Promise<void> {
  inflight ??= fetch('/api/holidays', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return
      const json = (await res.json()) as HolidaysState
      cache = { holidays: json.holidays ?? [], canManage: json.canManage === true }
      for (const listener of listeners) listener(cache)
    })
    .catch((err) => console.error('[holidays] load failed', err))
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Organization holidays, loaded once and shared by the header calendar, the holidays tab and the daily ledger. */
export function useHolidays() {
  const [state, setState] = useState<HolidaysState | null>(cache)
  useEffect(() => {
    listeners.add(setState)
    if (cache) setState(cache)
    else void reloadHolidays()
    return () => {
      listeners.delete(setState)
    }
  }, [])
  return { holidays: state?.holidays ?? [], canManage: state?.canManage ?? false, loaded: state != null, reload: reloadHolidays }
}
