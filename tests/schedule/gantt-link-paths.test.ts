import { describe, expect, it } from 'vitest'
import { buildGanttLinkPath, type GanttBarAnchor } from '@/features/schedule/lib/gantt-link-paths'

const a = (partial: Partial<GanttBarAnchor> & Pick<GanttBarAnchor, 'id' | 'rowIndex'>): GanttBarAnchor => ({
  startX: 0,
  finishX: 100,
  midY: partial.rowIndex * 32 + 16,
  ...partial,
})

describe('buildGanttLinkPath', () => {
  it('draws FS elbow from pred finish to succ start', () => {
    const from = a({ id: 'A', rowIndex: 0, startX: 0, finishX: 100 })
    const to = a({ id: 'B', rowIndex: 2, startX: 140, finishX: 200 })
    const path = buildGanttLinkPath(from, to, 'FS')
    expect(path).not.toBeNull()
    expect(path!.d.startsWith('M 100 ')).toBe(true)
    expect(path!.d.includes('V 80')).toBe(true)
    expect(path!.toX).toBe(140)
  })

  it('routes around when successor starts before predecessor finishes', () => {
    const from = a({ id: 'A', rowIndex: 0, startX: 0, finishX: 200 })
    const to = a({ id: 'B', rowIndex: 1, startX: 50, finishX: 120 })
    const path = buildGanttLinkPath(from, to, 'FS')
    expect(path).not.toBeNull()
    expect(path!.d.includes('H ')).toBe(true)
  })
})
