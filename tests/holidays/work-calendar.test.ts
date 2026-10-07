import { describe, expect, it } from 'vitest'
import type { HolidayRule } from '@/features/holidays/lib/types'
import { addWorkdays, diffWorkdays, holidaysOn, siteWorkCalendar } from '@/features/holidays/lib/work-calendar'
import { forecastSchedule, type ForecastTask } from '@/features/schedule/lib/progress-forecast'

const rule = (type: HolidayRule['type'], startDate: string, endDate: string | null = null, isActive = true): HolidayRule => ({
  type,
  startDate,
  endDate,
  isActive,
})

// 2026-10-02, 10-09 and 10-16 are Fridays; 10-01, 10-08, 10-15, 10-22 Thursdays.
describe('siteWorkCalendar', () => {
  it('takes Fridays and active holidays off', () => {
    const works = siteWorkCalendar([rule('official', '2026-10-05', '2026-10-06'), rule('organizational', '2026-10-07', null, false)])
    expect(works('2026-10-02')).toBe(false)
    expect(works('2026-10-03')).toBe(true)
    expect(works('2026-10-05')).toBe(false)
    expect(works('2026-10-06')).toBe(false)
    expect(works('2026-10-07')).toBe(true)
  })

  it('repeats a weekly holiday on its weekday until its end', () => {
    const weekly = [rule('weekly', '2026-10-01', '2026-10-15')]
    expect(holidaysOn(weekly, '2026-10-08')).toHaveLength(1)
    expect(holidaysOn(weekly, '2026-10-15')).toHaveLength(1)
    expect(holidaysOn(weekly, '2026-10-22')).toHaveLength(0)
    expect(holidaysOn(weekly, '2026-10-07')).toHaveLength(0)
  })

  it('counts and moves working days around days off', () => {
    const works = siteWorkCalendar([rule('official', '2026-10-10')])
    expect(addWorkdays('2026-10-08', 1, works)).toBe('2026-10-11')
    expect(addWorkdays('2026-10-11', -1, works)).toBe('2026-10-08')
    expect(diffWorkdays('2026-10-06', '2026-10-12', works)).toBe(4)
    expect(diffWorkdays('2026-10-12', '2026-10-06', works)).toBe(-4)
  })
})

const task = (id: string, plannedStart: string, plannedFinish: string): ForecastTask => ({
  id,
  wbs: id,
  parentId: null,
  isSummary: false,
  isMilestone: false,
  plannedStart,
  plannedFinish,
  actualStart: null,
  actualFinish: null,
  percent: 0,
})

describe('forecastSchedule on the site calendar', () => {
  const links = [{ predecessorId: 'a', successorId: 'b', type: 'FS' as const, lagDays: 0 }]
  // A: Sat 10-03 … Mon 10-05 (3 working days); B: Tue 10-06 … Thu 10-08 (3 working days).
  const tasks = [task('a', '2026-10-03', '2026-10-05'), task('b', '2026-10-06', '2026-10-08')]

  it('keeps planned dates on schedule, even a start on a Friday', () => {
    const out = forecastSchedule({
      tasks: [task('x', '2026-10-02', '2026-10-08')],
      links: [],
      statusDate: '2026-09-30',
      isWorkday: siteWorkCalendar([]),
    })
    expect(out.get('x')).toEqual({ start: '2026-10-02', finish: '2026-10-08' })
  })

  it('stretches a late activity over Fridays and holidays, and its successor with it', () => {
    // A has not started by Wed 10-07.
    const plain = forecastSchedule({ tasks, links, statusDate: '2026-10-07', isWorkday: siteWorkCalendar([]) })
    expect(plain.get('a')).toEqual({ start: '2026-10-07', finish: '2026-10-10' })
    expect(plain.get('b')).toEqual({ start: '2026-10-11', finish: '2026-10-13' })

    const withHoliday = forecastSchedule({
      tasks,
      links,
      statusDate: '2026-10-07',
      isWorkday: siteWorkCalendar([rule('official', '2026-10-10')]),
    })
    expect(withHoliday.get('a')).toEqual({ start: '2026-10-07', finish: '2026-10-11' })
    expect(withHoliday.get('b')).toEqual({ start: '2026-10-12', finish: '2026-10-14' })
  })
})
