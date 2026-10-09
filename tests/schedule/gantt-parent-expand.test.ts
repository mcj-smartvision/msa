import { describe, expect, it } from 'vitest'
import {
applyGanttDateChange,
expandAncestorsForChild,
rollupAncestorsToChildren,
} from '@/features/schedule/lib/gantt-parent-expand'
import { resolveGanttBarTone } from '@/features/schedule/lib/gantt-tone'

describe('rollupAncestorsToChildren', () => {
  it('expands parent when child grows past parent', () => {
    const map = new Map([
      ['root', { id: 'root', parentId: null, start: '2026-01-01', finish: '2026-01-20', wbs: '1' }],
      [
        'parent',
        { id: 'parent', parentId: 'root', start: '2026-01-05', finish: '2026-01-15', wbs: '1.18' },
      ],
      [
        'child',
        { id: 'child', parentId: 'parent', start: '2026-01-06', finish: '2026-01-10', wbs: '1.18.1' },
      ],
    ])
    map.get('child')!.start = '2026-01-03'
    map.get('child')!.finish = '2026-01-25'
    const updates = rollupAncestorsToChildren(map, 'child')
    expect(updates.map((u) => u.id)).toEqual(['parent', 'root'])
    expect(map.get('parent')).toMatchObject({ start: '2026-01-03', finish: '2026-01-25' })
    expect(map.get('root')).toMatchObject({ start: '2026-01-03', finish: '2026-01-25' })
  })

  it('shrinks parent header when child shortens (and siblings define the span)', () => {
    const map = new Map([
      [
        'parent',
        { id: 'parent', parentId: null, start: '2026-01-01', finish: '2026-01-30', wbs: '1.18' },
      ],
      [
        'a',
        { id: 'a', parentId: 'parent', start: '2026-01-01', finish: '2026-01-05', wbs: '1.18.2' },
      ],
      [
        'b',
        { id: 'b', parentId: 'parent', start: '2026-01-10', finish: '2026-01-20', wbs: '1.18.1' },
      ],
    ])
    // shorten the long child b
    map.get('b')!.finish = '2026-01-12'
    const updates = rollupAncestorsToChildren(map, 'b')
    expect(updates).toHaveLength(1)
    expect(map.get('parent')).toMatchObject({
      start: '2026-01-01',
      finish: '2026-01-12',
    })
  })

  it('parent still covers all siblings after one shrinks', () => {
    const changed = applyGanttDateChange(
      [
        { id: 'p', parentId: null, start: '2026-02-01', finish: '2026-02-28', wbs: '1.18' },
        { id: 'c1', parentId: 'p', start: '2026-02-01', finish: '2026-02-05', wbs: '1.18.2' },
        { id: 'c2', parentId: 'p', start: '2026-02-10', finish: '2026-02-25', wbs: '1.18.1' },
        { id: 'c3', parentId: 'p', start: '2026-02-01', finish: '2026-02-08', wbs: '1.18.3' },
      ],
      'c2',
      '2026-02-10',
      '2026-02-14'
    )
    const parent = changed.find((c) => c.id === 'p')
    expect(parent).toMatchObject({ start: '2026-02-01', finish: '2026-02-14' })
  })
})

describe('expandAncestorsForChild (compat)', () => {
  it('expands via rollup when child moves outside', () => {
    const map = new Map([
      ['root', { id: 'root', parentId: null, start: '2026-01-01', finish: '2026-01-20' }],
      ['parent', { id: 'parent', parentId: 'root', start: '2026-01-05', finish: '2026-01-15' }],
      ['child', { id: 'child', parentId: 'parent', start: '2026-01-06', finish: '2026-01-10' }],
    ])

    const updates = expandAncestorsForChild(map, 'child', '2026-01-03', '2026-01-25')
    expect(updates.map((u) => u.id)).toEqual(['parent', 'root'])
    expect(map.get('parent')).toMatchObject({ start: '2026-01-03', finish: '2026-01-25' })
  })
})

describe('resolveGanttBarTone', () => {
  it('prefers alert severity over float', () => {
    expect(
      resolveGanttBarTone({
        isCritical: false,
        totalFloat: 10,
        alertSeverity: 'fast_consumption',
      })
    ).toBe('fast_consumption')
  })

  it('maps critical float to red tone', () => {
    expect(resolveGanttBarTone({ isCritical: true, totalFloat: 0 })).toBe('critical')
  })

  it('marks finished work completed even when critical or alerted', () => {
    expect(
      resolveGanttBarTone({
        isCritical: true,
        totalFloat: -3,
        alertSeverity: 'negative',
        alertQuadrant: 'urgent',
        percentComplete: 100,
      })
    ).toBe('completed')
    expect(resolveGanttBarTone({ isCritical: true, totalFloat: 0, percentComplete: 99.5 })).toBe(
      'critical'
    )
  })
})
