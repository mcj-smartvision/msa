import { isDirectChildWbs } from '@/features/schedule/lib/parent-weight-rollup'
import { wbsDepth } from '@/features/schedule/lib/wbs-utils'

export type DurationRollupNode = {
  id: string
  wbs: string | null
  durationDays: number | null
  isSummary?: boolean
}

/**
 * Parent (summary) duration = sum of direct children's durations (bottom-up).
 * Leaves keep their own duration_days.
 */
export function applyParentDurationSum(nodes: DurationRollupNode[]): {
  durations: Record<string, number | null>
  parentIds: Set<string>
} {
  const durations: Record<string, number | null> = {}
  const parentIds = new Set<string>()

  for (const n of nodes) {
    const d =
      n.durationDays != null && Number.isFinite(Number(n.durationDays))
        ? Number(n.durationDays)
        : null
    durations[n.id] = d
  }

  const sorted = [...nodes].sort(
    (a, b) => wbsDepth(b.wbs) - wbsDepth(a.wbs) || (a.wbs ?? '').localeCompare(b.wbs ?? '', 'en')
  )

  for (const parent of sorted) {
    const pw = parent.wbs?.trim()
    if (!pw) continue
    const children = nodes.filter(
      (c) => c.id !== parent.id && c.wbs && isDirectChildWbs(pw, c.wbs)
    )
    if (children.length === 0) continue
    parentIds.add(parent.id)
    const sum = children.reduce((s, c) => {
      const v = durations[c.id]
      return s + (v != null && Number.isFinite(v) && v > 0 ? v : 0)
    }, 0)
    durations[parent.id] = Math.round(sum * 1000) / 1000
  }

  return { durations, parentIds }
}
