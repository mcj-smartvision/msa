'use client'

import {
createContext,
useCallback,
useContext,
useEffect,
useState,
type ReactNode,
} from 'react'
import {
readScheduleCalendar,
SCHEDULE_CALENDAR_KEY,
writeScheduleCalendar,
type ScheduleCalendar,
} from '@/features/schedule/lib/calendar-preference'

interface ScheduleCalendarContextValue {
  calendar: ScheduleCalendar
  setCalendar: (next: ScheduleCalendar) => void
  /** False until client localStorage has been read (avoid hydration mismatch). */
  ready: boolean
}

const ScheduleCalendarContext = createContext<ScheduleCalendarContextValue | null>(null)

export function ScheduleCalendarProvider({ children }: { children: ReactNode }) {
  const [calendar, setCalendarState] = useState<ScheduleCalendar>('jalali')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setCalendarState(readScheduleCalendar())
    setReady(true)

    function onStorage(event: StorageEvent) {
      if (event.key === SCHEDULE_CALENDAR_KEY) {
        setCalendarState(readScheduleCalendar())
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setCalendar = useCallback((next: ScheduleCalendar) => {
    setCalendarState(next)
    writeScheduleCalendar(next)
  }, [])

  return (
    <ScheduleCalendarContext.Provider value={{ calendar, setCalendar, ready }}>
      {children}
    </ScheduleCalendarContext.Provider>
  )
}

export function useScheduleCalendarContext() {
  const ctx = useContext(ScheduleCalendarContext)
  if (!ctx) {
    throw new Error('useScheduleCalendar must be used within ScheduleCalendarProvider')
  }
  return ctx
}
