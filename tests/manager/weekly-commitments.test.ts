import { describe, expect, it } from 'vitest'
import {
  buildWeeklyCommitments,
  indexHistoryFromCurve,
  indexTone,
  ppcTone,
  type WwpCommitmentRow,
  type WwpWeekRow,
} from '@/lib/manager/weekly-commitments'
import type { ManagerCurvePoint } from '@/lib/manager/overview-types'

const week = (n: number, planned: number, completed: number): WwpWeekRow => {
  const start = new Date(Date.UTC(2026, 6, 4 + 7 * n)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(2026, 6, 10 + 7 * n)).toISOString().slice(0, 10)
  return { wwpId: `w${n}`, weekNumber: n, start, end, planned, completed }
}

const commitment = (wwpId: string, description: string, isCompleted: boolean, extra: Partial<WwpCommitmentRow> = {}): WwpCommitmentRow => ({
  wwpId,
  description,
  wbs: null,
  isCompleted,
  rootCause: isCompleted ? null : 'materials',
  rootCauseNote: null,
  plannedOutput: null,
  actualOutput: null,
  sortOrder: 0,
  ...extra,
})

describe('buildWeeklyCommitments', () => {
  it('computes PPC per week, the previous week, the 4-week average and keeps the last 10 weeks', () => {
    const rows = Array.from({ length: 12 }, (_, i) => week(i + 1, 20, 8 + i))
    const data = buildWeeklyCommitments(rows, [])
    expect(data.weeks).toHaveLength(10)
    expect(data.weeks[0]!.weekNumber).toBe(3)
    expect(data.current!.ppc).toBeCloseTo(95, 6)
    expect(data.previousPpc).toBeCloseTo(90, 6)
    // last 4 weeks: completed 16+17+18+19 = 70 of 80
    expect(data.average4).toBeCloseTo(87.5, 6)
  })

  it('counts a partly done commitment as not completed and sorts unfinished first', () => {
    const rows = [week(1, 3, 1)]
    const commitments = [
      commitment('w1', 'done', true, { sortOrder: 0 }),
      commitment('w1', 'half', false, { plannedOutput: 10, actualOutput: 6, rootCause: 'crew', sortOrder: 1 }),
      commitment('w1', 'none', false, { rootCause: 'permit_approval', sortOrder: 2 }),
    ]
    const data = buildWeeklyCommitments(rows, commitments)
    expect(data.current!.ppc).toBeCloseTo(100 / 3, 6)
    expect(data.current!.commitments.map((c) => c.description)).toEqual(['none', 'half', 'done'])
    expect(data.current!.commitments[1]!.progressPercent).toBeCloseTo(60, 6)
    expect(data.current!.commitments[0]!.progressPercent).toBeNull()
    expect(data.current!.commitments[0]!.rootCauseLabel).toBe('مجوز / تأییدیه')
  })

  it('builds RNC only from missed commitments of the last 4 closed weeks', () => {
    const rows = [week(1, 2, 0), week(2, 2, 1), week(3, 2, 1), week(4, 2, 1), week(5, 2, 1)]
    const commitments = [
      commitment('w1', 'old', false, { rootCause: 'weather' }),
      commitment('w2', 'a', false, { rootCause: 'materials' }),
      commitment('w3', 'b', false, { rootCause: 'materials' }),
      commitment('w4', 'c', false, { rootCause: 'crew' }),
      commitment('w5', 'd', false, { rootCause: 'equipment' }),
      commitment('w5', 'e', true),
    ]
    const { rnc } = buildWeeklyCommitments(rows, commitments)
    expect(rnc.weeks).toBe(4)
    expect(rnc.total).toBe(4)
    expect(rnc.causes.map((c) => [c.key, c.count])).toEqual([
      ['materials', 2],
      ['crew', 1],
      ['equipment', 1],
    ])
    expect(rnc.causes[0]!.share).toBeCloseTo(50, 6)
    expect(rnc.top3Share).toBeCloseTo(100, 6)
  })

  it('returns no current week when nothing is closed', () => {
    const data = buildWeeklyCommitments([], [])
    expect(data.current).toBeNull()
    expect(data.average4).toBeNull()
    expect(data.rnc.top3Share).toBeNull()
  })
})

describe('tones', () => {
  it('uses the design thresholds', () => {
    expect(ppcTone(80)).toBe('good')
    expect(ppcTone(70)).toBe('warn')
    expect(ppcTone(59)).toBe('bad')
    expect(indexTone(1)).toBe('good')
    expect(indexTone(0.9)).toBe('warn')
    expect(indexTone(0.89)).toBe('bad')
  })
})

describe('indexHistoryFromCurve', () => {
  const point = (date: string, planned: number, earned: number | null, kind: ManagerCurvePoint['kind'] = 'month'): ManagerCurvePoint => ({
    date,
    isToday: false,
    kind,
    planned,
    earned,
    actual: null,
    forecast: null,
  })

  it('derives SPI = earned ÷ planned and SPI(t) = ES ÷ AT for past points only', () => {
    // Linear plan: 0 → 100 over 10 weeks starting 2026-01-03.
    const pvCurve = Array.from({ length: 11 }, (_, k) => ({ periodIndex: k, cumulativePV: k * 10 }))
    const h = indexHistoryFromCurve({
      points: [point('2026-01-31', 40, 20), point('2026-02-28', 80, 40), point('2026-03-20', 100, 60, 'today')],
      pvCurve,
      projectStart: '2026-01-03',
      plannedDuration: 10,
      daysPerUnit: 7,
      today: '2026-03-20',
    })
    expect(h.spi).toEqual([0.5, 0.5])
    // 2026-01-31 is 4 weeks in, EV 20 ⇒ ES 2 ⇒ 0.5; 2026-02-28 is 8 weeks in, EV 40 ⇒ ES 4 ⇒ 0.5
    expect(h.spiT[0]).toBeCloseTo(0.5, 6)
    expect(h.spiT[1]).toBeCloseTo(0.5, 6)
  })

  it('skips SPI(t) without a PV curve', () => {
    const h = indexHistoryFromCurve({
      points: [point('2026-01-31', 40, 20)],
      pvCurve: null,
      projectStart: '2026-01-03',
      plannedDuration: 10,
      daysPerUnit: 7,
      today: '2026-03-20',
    })
    expect(h.spiT).toEqual([])
    expect(h.spi).toEqual([0.5])
  })
})
