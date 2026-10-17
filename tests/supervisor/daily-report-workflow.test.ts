import { describe, expect, it } from 'vitest'
import {
  canEditDailyReportContent,
  canSaveDailyReport,
  canSendDailyReportToManager,
  canManagerApproveDailyReport,
  parseWorkflowStatus,
} from '@/features/supervisor/lib/daily-report-workflow'

describe('daily-report-workflow', () => {
  it('keeps draft and legacy finalized editable until send', () => {
    expect(canEditDailyReportContent('draft')).toBe(true)
    expect(canEditDailyReportContent('finalized')).toBe(true)
    expect(canEditDailyReportContent('submitted')).toBe(false)
    expect(canEditDailyReportContent('approved')).toBe(false)
  })

  it('allows save and send from open draft', () => {
    expect(canSaveDailyReport('draft')).toBe(true)
    expect(canSendDailyReportToManager('draft')).toBe(true)
    expect(canSendDailyReportToManager('finalized')).toBe(true)
    expect(canSendDailyReportToManager('submitted')).toBe(false)
  })

  it('manager approves only submitted', () => {
    expect(canManagerApproveDailyReport('submitted')).toBe(true)
    expect(canManagerApproveDailyReport('draft')).toBe(false)
  })

  it('parses unknown as draft', () => {
    expect(parseWorkflowStatus(null)).toBe('draft')
    expect(parseWorkflowStatus('submitted')).toBe('submitted')
  })
})
