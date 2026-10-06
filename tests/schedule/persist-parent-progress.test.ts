import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { persistParentProgressRollup } from '@/features/schedule/lib/persist-parent-progress'

type Row = {
  id: string
  wbs_code: string
  name: string
  schedule_weight: number | null
  percent_complete: number
  physical_percent_complete: number | null
}

function fakeClient(rows: Row[]) {
  const writes: Array<{ id: string; patch: Record<string, unknown> }> = []
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: rows, error: null }) }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => ({
          eq: async () => {
            writes.push({ id, patch })
            return { error: null }
          },
        }),
      }),
    }),
  }
  return { client: client as unknown as SupabaseClient, writes }
}

const row = (id: string, wbs: string, weight: number | null, pct: number): Row => ({
  id,
  wbs_code: wbs,
  name: id,
  schedule_weight: weight,
  percent_complete: pct,
  physical_percent_complete: pct,
})

describe('persistParentProgressRollup', () => {
  it('rewrites a stale heading from its weighted children', async () => {
    const { client, writes } = fakeClient([
      row('h', '4', 23, 99),
      row('a', '4.1', 5, 100),
      row('b', '4.2', 7, 100),
      row('c', '4.3', 5, 100),
      row('d', '4.4', 6, 100),
    ])
    expect(await persistParentProgressRollup(client, 'p')).toBe(1)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ id: 'h', patch: { percent_complete: 100, physical_percent_complete: 100 } })
  })

  it('rolls nested headings bottom-up and skips headings already correct', async () => {
    const { client, writes } = fakeClient([
      row('root', '1', null, 0),
      row('mid', '1.1', null, 50),
      row('x', '1.1.1', 1, 100),
      row('y', '1.1.2', 3, 0),
      row('z', '1.2', 4, 100),
    ])
    await persistParentProgressRollup(client, 'p')
    const byId = Object.fromEntries(writes.map((w) => [w.id, w.patch.percent_complete]))
    // mid = (100×1 + 0×3) / 4 = 25; root = (25×4 + 100×4) / 8 ≈ 63
    expect(byId).toEqual({ mid: 25, root: 63 })
  })
})
