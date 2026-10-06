'use client'

import { useCallback, useEffect, useState } from 'react'
import {
readScheduleViewDate,
writeScheduleViewDate,
} from '@/features/schedule/lib/view-date-preference'

export function useScheduleViewDate() {
  const [viewDate, setViewDateState] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    setViewDateState(readScheduleViewDate())
  }, [])

  const setViewDate = useCallback((isoDate: string) => {
    setViewDateState(isoDate)
    writeScheduleViewDate(isoDate)
  }, [])

  const resetToToday = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    setViewDate(today)
  }, [setViewDate])

  return { viewDate, setViewDate, resetToToday }
}
