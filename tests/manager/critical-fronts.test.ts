import { describe, expect, it } from 'vitest'
import { buildCriticalFronts, type BuildCriticalFrontsInput, type CriticalFrontTask } from '@/features/manager/lib/critical-fronts'

const TODAY = '2026-10-03'
const PROJECT = 'p-1'

function task(over: Partial<CriticalFrontTask> & { id: string }): CriticalFrontTask {
  return {
    name: `فعالیت ${over.id}`,
    wbs: over.id,
    isSummary: false,
    isCritical: false,
    totalFloatDays: null,
    baselineStart: '2026-09-01',
    baselineFinish: '2026-09-30',
    currentFinish: null,
    actualFinish: null,
    percent: 0,
    percentFromPackages: false,
    contractor: null,
    ...over,
  }
}

function input(over: Partial<BuildCriticalFrontsInput>): BuildCriticalFrontsInput {
  return {
    projectId: PROJECT,
    today: TODAY,
    tasks: [],
    dependencies: [],
    cpmCalculatedAt: null,
    causes: [],
    causeSources: ['هشدارهای باز برنامه‌ریزی'],
    ...over,
  }
}

describe('critical fronts — CPM mode', () => {
  const tasks = [
    task({ id: 'a', isCritical: true, totalFloatDays: 0, percent: 40, contractor: 'پیمانکار الف' }),
    task({ id: 'b', isCritical: false, totalFloatDays: 12, percent: 10 }),
    task({ id: 'c', isCritical: false, totalFloatDays: -5, percent: 20, baselineFinish: '2026-09-25' }),
    task({ id: 'd', isCritical: true, totalFloatDays: 0, percent: 100 }),
  ]
  const result = buildCriticalFronts(
    input({
      tasks,
      dependencies: [
        { predecessorId: 'a', successorId: 'c' },
        { predecessorId: 'b', successorId: 'c' },
      ],
      cpmCalculatedAt: '2026-10-01T10:00:00Z',
      causes: [
        { taskId: 'a', kind: 'material', source: 'alert', ref: 'alert:1', label_fa: 'سیمان نرسیده', severity: 'critical', since: '2026-10-01' },
      ],
    })
  )

  it('lists only unfinished critical / non-positive-float activities, negative float first', () => {
    expect(result.mode).toBe('cpm')
    expect(result.cpm.status).toBe('ok')
    expect(result.items.map((i) => i.id)).toEqual(['c', 'a'])
    expect(result.items[0]!.importance).toBe('negative_float')
    expect(result.items[0]!.totalFloatDays).toBe(-5)
  })

  it('delay = today − baseline finish when overdue; planned = elapsed share of the baseline window', () => {
    const a = result.items.find((i) => i.id === 'a')!
    expect(a.overdue).toBe(true)
    expect(a.delayDays).toBe(3)
    expect(a.plannedPercent).toBe(100)
    expect(a.percent).toBe(40)
    expect(a.successorCount).toBe(1)
  })

  it('attaches linked causes and data-backed actions with directive payloads', () => {
    const a = result.items.find((i) => i.id === 'a')!
    expect(a.causes).toHaveLength(1)
    expect(a.actions.map((x) => x.kind).sort()).toEqual(['add_crew', 'contractor_review', 'material_supply', 'resequence'])
    const material = a.actions.find((x) => x.kind === 'material_supply')!
    expect(material.recommended).toBe(true)
    expect(material.payload).toMatchObject({
      schema: 'directive.draft/v1',
      source: 'manager.critical_fronts',
      projectId: PROJECT,
      action: 'material_supply',
      task: { id: 'a', wbs: 'a' },
      owner_role: 'Procurement',
      due_date: '2026-10-05',
      evidence: { delayDays: 3, totalFloatDays: 0, plannedPercent: 100, actualPercent: 40, causes: [{ kind: 'material', source: 'alert', ref: 'alert:1' }] },
    })
    expect(a.actions.find((x) => x.kind === 'add_crew')!.recommended).toBe(true)
    expect(a.actions.find((x) => x.kind === 'resequence')!.payload.params).toMatchObject({ successorIds: ['c'], networkAvailable: true })
    expect(a.actions[0]!.recommended).toBe(true)
  })

  it('reports activities without any link', () => {
    if (result.cpm.status !== 'ok') throw new Error('expected cpm')
    expect(result.cpm.unlinkedCount).toBe(1)
    expect(result.cpm.dependencyCount).toBe(2)
  })
})

describe('critical fronts — without CPM', () => {
  it('no dependencies: data_missing names the relationships and the CPM run, lists baseline delays', () => {
    const result = buildCriticalFronts(
      input({
        tasks: [task({ id: 'a', percent: 30 }), task({ id: 'b', baselineFinish: '2026-12-01', percent: 0 })],
        dependencies: [],
      })
    )
    expect(result.mode).toBe('baseline')
    expect(result.cpm.status).toBe('data_missing')
    if (result.cpm.status === 'data_missing') expect(result.cpm.missing.map((m) => m.key)).toEqual(['dependencies', 'cpm_run'])
    expect(result.items.map((i) => i.id)).toEqual(['a'])
    expect(result.items[0]!.importance).toBe('baseline_delay')
    expect(result.items[0]!.totalFloatDays).toBeNull()
    const resequence = result.items[0]!.actions.find((x) => x.kind === 'resequence')!
    expect(resequence.recommended).toBe(false)
    expect(resequence.payload.params).toMatchObject({ networkAvailable: false })
  })

  it('stale float without links is not trusted', () => {
    const result = buildCriticalFronts(input({ tasks: [task({ id: 'a', isCritical: true, totalFloatDays: 0 })], dependencies: [] }))
    expect(result.mode).toBe('baseline')
    if (result.cpm.status === 'data_missing') expect(result.cpm.missing.map((m) => m.key)).toEqual(['dependencies'])
  })

  it('dependency table unreadable', () => {
    const result = buildCriticalFronts(input({ tasks: [task({ id: 'a' })], dependencies: null }))
    if (result.cpm.status !== 'data_missing') throw new Error('expected data_missing')
    expect(result.cpm.missing[0]!.key).toBe('task_dependencies_table')
  })

  it('no fake causes: an activity without a record has an empty cause list', () => {
    const result = buildCriticalFronts(input({ tasks: [task({ id: 'a' })] }))
    expect(result.items[0]!.causes).toEqual([])
    expect(result.items[0]!.actions.find((x) => x.kind === 'material_supply')!.recommended).toBe(false)
  })
})
