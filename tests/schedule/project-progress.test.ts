import { describe, expect, it } from 'vitest'
import {
appendProgressHistoryEntry,
buildActivityProgressInputs,
computeOverallProjectProgress,
computeOverallProjectProgressFromHistory,
latestProgressFromHistory,
rollupHierarchicalProgress,
type ActivityProgressHistoryRecord,
type WbsProgressNode,
} from '@/features/schedule/lib/project-progress'

describe('computeOverallProjectProgress', () => {
  it('normalizes when weights do not sum to 100', () => {
    const overall = computeOverallProjectProgress([
      { id: 'a', weight: 6, progress: 50 },
      { id: 'b', weight: 4, progress: 100 },
    ])
    expect(overall).toBe(70)
  })

  it('uses latest history per activity, not zero when today has no update', () => {
    const history: ActivityProgressHistoryRecord[] = [
      { activityId: 'a', date: '2026-01-01', progress: 40 },
      { activityId: 'a', date: '2026-01-05', progress: 60 },
    ]
    expect(latestProgressFromHistory('a', history, '2026-01-10')).toBe(60)
    expect(latestProgressFromHistory('a', history, '2026-01-03')).toBe(40)
    expect(latestProgressFromHistory('a', history, '2025-12-31')).toBe(0)
  })
})

describe('rollupHierarchicalProgress', () => {
  it('rolls parent from weighted children', () => {
    const nodes: WbsProgressNode[] = [
      { id: 'parent', parentId: null, weight: 10 },
      { id: 'c1', parentId: 'parent', weight: 30, isLeaf: true },
      { id: 'c2', parentId: 'parent', weight: 70, isLeaf: true },
    ]
    const rolled = rollupHierarchicalProgress(nodes, { c1: 50, c2: 80 })
    expect(rolled.get('c1')).toBe(50)
    expect(rolled.get('c2')).toBe(80)
    expect(rolled.get('parent')).toBe(71)
  })
})

describe('computeOverallProjectProgressFromHistory', () => {
  const nodes: WbsProgressNode[] = [
    { id: '1.4.1', parentId: null, weight: 6, isLeaf: true },
    { id: '1.6.1.1', parentId: null, weight: 4, isLeaf: true },
  ]

  it('computes from leaf weights and history', () => {
    const history: ActivityProgressHistoryRecord[] = [
      { activityId: '1.4.1', date: '2026-01-10', progress: 50 },
    ]
    const overall = computeOverallProjectProgressFromHistory(nodes, history, '2026-01-10')
    expect(overall).toBe(30)
  })
})

describe('appendProgressHistoryEntry', () => {
  it('upserts same activity+date', () => {
    let history: ActivityProgressHistoryRecord[] = []
    history = appendProgressHistoryEntry(history, {
      activityId: 'a',
      date: '2026-01-01',
      progress: 25,
    })
    history = appendProgressHistoryEntry(history, {
      activityId: 'a',
      date: '2026-01-01',
      progress: 30,
    })
    expect(history).toHaveLength(1)
    expect(history[0].progress).toBe(30)
  })
})

describe('buildActivityProgressInputs', () => {
  it('maps history to inputs', () => {
    const inputs = buildActivityProgressInputs(
      [{ id: 'x', weight: 10 }],
      [{ activityId: 'x', date: '2026-02-01', progress: 55 }],
      '2026-02-15'
    )
    expect(inputs[0].progress).toBe(55)
  })
})
