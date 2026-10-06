import { describe, expect, it } from 'vitest'
import { analyzeScheduleFromXml } from '@/features/schedule-intelligence/lib'
import { FIXTURE_A_XML } from './fixtures'

describe('riskAnalyzer', () => {
  it('assigns high risk to critical activities', () => {
    const result = analyzeScheduleFromXml(FIXTURE_A_XML)
    const critical = result.schedule.tasks.find((t) => t.name === 'A')!
    expect(critical.riskScore).toBeGreaterThan(40)
    expect(critical.riskReasons.length).toBeGreaterThan(0)
  })

  it('executive summary uses computed values only', () => {
    const result = analyzeScheduleFromXml(FIXTURE_A_XML)
    expect(result.executiveSummary).toContain('۳')
    expect(result.executiveSummary).toContain('۱۰')
  })
})

describe('scheduleQuality', () => {
  it('reports validation counts in KPIs', () => {
    const result = analyzeScheduleFromXml(FIXTURE_A_XML)
    expect(result.kpis.totalLeafTasks).toBe(3)
    expect(result.kpis.dataQualityStatus).toBeDefined()
  })
})
