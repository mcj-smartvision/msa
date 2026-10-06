import { describe, expect, it } from 'vitest'
import {
applyDateChangeWithSuccessorCascade,
successorStartFromLink,
} from '@/features/schedule/lib/cascade-successors'

describe('successorStartFromLink', () => {
  it('FS places successor on predecessor finish day', () => {
    expect(successorStartFromLink('2026-01-01', '2026-01-06', 2, 'FS', 0)).toBe('2026-01-06')
  })

  it('FS with lag', () => {
    expect(successorStartFromLink('2026-01-01', '2026-01-06', 2, 'FS', 2)).toBe('2026-01-08')
  })
})

describe('applyDateChangeWithSuccessorCascade', () => {
  const tasks = [
    { id: 'A', parentId: null, start: '2026-01-01', finish: '2026-01-06', wbs: '1.1' },
    { id: 'B', parentId: null, start: '2026-01-06', finish: '2026-01-08', wbs: '1.2' },
    { id: 'C', parentId: null, start: '2026-01-08', finish: '2026-01-13', wbs: '1.3' },
    { id: 'D', parentId: null, start: '2026-01-08', finish: '2026-01-15', wbs: '1.4' },
  ]
  const deps = [
    { predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'B', successorId: 'C', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'B', successorId: 'D', type: 'FS' as const, lagDays: 0 },
  ]

  it('lengthening A pushes B, C, D later', () => {
    // A was 5d (01→06); now 8d (01→09)
    const changed = applyDateChangeWithSuccessorCascade(
      tasks,
      'A',
      '2026-01-01',
      '2026-01-09',
      deps
    )
    const byId = Object.fromEntries(changed.map((r) => [r.id, r]))
    expect(byId.A).toMatchObject({ start: '2026-01-01', finish: '2026-01-09' })
    expect(byId.B).toMatchObject({ start: '2026-01-09', finish: '2026-01-11' })
    expect(byId.C).toMatchObject({ start: '2026-01-11', finish: '2026-01-16' })
    expect(byId.D).toMatchObject({ start: '2026-01-11', finish: '2026-01-18' })
  })

  it('shortening A pulls successors earlier', () => {
    const changed = applyDateChangeWithSuccessorCascade(
      tasks,
      'A',
      '2026-01-01',
      '2026-01-04',
      deps
    )
    const byId = Object.fromEntries(changed.map((r) => [r.id, r]))
    expect(byId.B).toMatchObject({ start: '2026-01-04', finish: '2026-01-06' })
    expect(byId.C).toMatchObject({ start: '2026-01-06', finish: '2026-01-11' })
    expect(byId.D).toMatchObject({ start: '2026-01-06', finish: '2026-01-13' })
  })

  it('rolls up parent after cascading children', () => {
    const withParent = [
      {
        id: 'P',
        parentId: null,
        start: '2026-01-01',
        finish: '2026-01-15',
        wbs: '1',
        isSummary: true,
      },
      {
        id: 'A',
        parentId: 'P',
        start: '2026-01-01',
        finish: '2026-01-06',
        wbs: '1.1',
      },
      {
        id: 'B',
        parentId: 'P',
        start: '2026-01-06',
        finish: '2026-01-08',
        wbs: '1.2',
      },
    ]
    const changed = applyDateChangeWithSuccessorCascade(
      withParent,
      'A',
      '2026-01-01',
      '2026-01-10',
      [{ predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 }]
    )
    const parent = changed.find((c) => c.id === 'P')
    expect(parent).toMatchObject({ start: '2026-01-01', finish: '2026-01-12' })
  })

  it('without deps, shifts later tasks by finish delta', () => {
    const loose = [
      { id: 'A', parentId: null, start: '2026-01-01', finish: '2026-01-05', wbs: '1.1' },
      { id: 'B', parentId: null, start: '2026-01-05', finish: '2026-01-08', wbs: '1.2' },
      { id: 'C', parentId: null, start: '2026-01-10', finish: '2026-01-12', wbs: '1.3' },
    ]
    const changed = applyDateChangeWithSuccessorCascade(
      loose,
      'A',
      '2026-01-01',
      '2026-01-08',
      []
    )
    const byId = Object.fromEntries(changed.map((r) => [r.id, r]))
    expect(byId.B).toMatchObject({ start: '2026-01-08', finish: '2026-01-11' })
    expect(byId.C).toMatchObject({ start: '2026-01-13', finish: '2026-01-15' })
  })
})
