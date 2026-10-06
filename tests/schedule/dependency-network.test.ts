import { describe, expect, it } from 'vitest'
import { buildDependencyNetwork } from '@/features/schedule/lib/dependency-network'

describe('buildDependencyNetwork', () => {
  it('keeps only leaves and marks activities with no links as isolated', () => {
    const network = buildDependencyNetwork(
      [
        { id: 'p', wbs: '4', name: 'فونداسیون', start: '2026-04-01', finish: '2026-06-01', isSummary: true },
        { id: 'a', wbs: '4.1', name: 'آرماتور', start: '2026-04-01', finish: '2026-04-20' },
        { id: 'b', wbs: '4.2', name: 'قالب', start: '2026-04-21', finish: '2026-05-10' },
        { id: 'c', wbs: '8', name: 'نما', start: '2026-06-01', finish: '2026-07-01' },
      ],
      [{ fromId: 'a', toId: 'b', relation: 'FS', lagDays: 0 }]
    )
    expect(network.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'c'])
    expect(network.isolatedIds).toEqual(['c'])
    expect(network.nodes.find((node) => node.id === 'b')?.layer).toBe(1)
  })

  it('keeps a long chain in order even when two activities point at each other', () => {
    const network = buildDependencyNetwork(
      [
        { id: 'a', wbs: '1', name: 'شروع', start: '2026-04-01', finish: '2026-04-10' },
        { id: 'b', wbs: '4.2', name: 'قالب', start: '2026-04-11', finish: '2026-04-20' },
        { id: 'c', wbs: '4.3', name: 'روغن', start: '2026-04-12', finish: '2026-04-13' },
        { id: 'd', wbs: '5', name: 'ستون', start: '2026-04-21', finish: '2026-05-01' },
      ],
      [
        { fromId: 'a', toId: 'b', relation: 'FS', lagDays: 0 },
        { fromId: 'b', toId: 'c', relation: 'SS', lagDays: 0 },
        { fromId: 'c', toId: 'b', relation: 'FS', lagDays: 0 },
        { fromId: 'b', toId: 'd', relation: 'FS', lagDays: 0 },
      ]
    )
    const layer = Object.fromEntries(network.nodes.map((node) => [node.id, node.layer]))
    expect(layer.a).toBe(0)
    expect(layer.b).toBe(1)
    expect(layer.c).toBeGreaterThan(layer.b)
    expect(layer.d).toBeGreaterThan(layer.b)
  })
})
