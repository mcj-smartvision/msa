import { describe, expect, it } from 'vitest'
import { buildDependencyNetwork } from '@/features/schedule/lib/dependency-network'
import { alignedEdgeRoute, layoutDependencyNetwork } from '@/features/schedule/lib/dependency-network-layout'

describe('dependency network layout', () => {
  it('puts predecessors in a right-hand column and successors to the left', () => {
    const network = buildDependencyNetwork(
      [
        { id: 'a', wbs: '1', name: 'شروع', start: '2026-04-01', finish: '2026-04-10' },
        { id: 'b', wbs: '2', name: 'بعد', start: '2026-05-01', finish: '2026-05-20' },
        { id: 'c', wbs: '9', name: 'جدا', start: '2026-04-02', finish: '2026-04-03' },
      ],
      [{ fromId: 'a', toId: 'b', relation: 'FS', lagDays: 0 }]
    )
    const layout = layoutDependencyNetwork(network)
    const first = layout.boxes.find((box) => box.id === 'a')!
    const second = layout.boxes.find((box) => box.id === 'b')!
    const lone = layout.boxes.find((box) => box.id === 'c')!
    expect(first.x).toBeGreaterThan(second.x)
    expect(first.y).toBe(second.y)
    expect(lone.y).toBeGreaterThan(first.y)
    expect(layout.isolatedBandY).not.toBeNull()
    expect(layout.ticks[0]?.label).toBe('شروع')
  })

  it('draws a straight link when both activities share a row', () => {
    const route = alignedEdgeRoute(
      { x: 800, y: 80, w: 176, h: 74 },
      { x: 200, y: 80, w: 176, h: 74 }
    )
    expect(route.d).toBe('M 800 117 L 376 117')
  })

  it('draws an orthogonal elbow when rows differ', () => {
    const route = alignedEdgeRoute(
      { x: 800, y: 80, w: 176, h: 74 },
      { x: 200, y: 180, w: 176, h: 74 }
    )
    expect(route.d).toContain('L')
    expect(route.d.split('L').length).toBeGreaterThan(2)
  })
})
