import { describe, expect, it } from 'vitest'
import { analyzeScheduleFromXml } from '@/features/schedule-intelligence/lib'
import {
FIXTURE_A_XML,
FIXTURE_B_XML,
FIXTURE_C_XML,
FIXTURE_D_XML,
FIXTURE_E_XML,
} from './fixtures'

describe('cpmEngine', () => {
  it('Fixture A: chain duration 10 days, all critical', () => {
    const result = analyzeScheduleFromXml(FIXTURE_A_XML)
    expect(result.cpm.success).toBe(true)
    expect(result.cpm.projectDurationDays).toBe(10)
    expect(result.cpm.criticalUids.length).toBe(3)
  })

  it('Fixture B: duration 8 days, C has float', () => {
    const result = analyzeScheduleFromXml(FIXTURE_B_XML)
    expect(result.cpm.projectDurationDays).toBe(8)
    const c = result.schedule.tasks.find((t) => t.name === 'C')!
    expect(c.totalFloatMinutes).toBe(960) // 2 days * 480
    expect(c.calculatedCritical).toBe(false)
  })

  it('Fixture C: two terminals — max branch is 14 (A→B=14, independent C=7)', () => {
    const result = analyzeScheduleFromXml(FIXTURE_C_XML)
    expect(result.cpm.projectDurationDays).toBe(14)
  })

  it('Fixture D: zero-duration milestone', () => {
    const result = analyzeScheduleFromXml(FIXTURE_D_XML)
    expect(result.cpm.success).toBe(true)
    expect(result.schedule.tasks[0].durationMinutes).toBe(0)
  })

  it('Fixture E: cycle fails CPM', () => {
    const result = analyzeScheduleFromXml(FIXTURE_E_XML)
    expect(result.cpm.success).toBe(false)
    expect(result.hasFatalErrors).toBe(true)
  })

  it('detects source/calculated mismatch when source critical differs', () => {
    const xml = FIXTURE_A_XML.replace(
      '<PercentComplete>0</PercentComplete>',
      '<PercentComplete>0</PercentComplete><Critical>0</Critical>'
    )
    const result = analyzeScheduleFromXml(xml)
    expect(result.kpis.sourceCpmMismatchCount).toBeGreaterThan(0)
  })
})
