import { weightedProgressPercent } from '@/lib/schedule/weighted-progress'
import { wbsDepth } from '@/lib/schedule/wbs-utils'

export type ProgressRollupNode = {
  id: string
  wbs: string | null
  name: string
  weight: number | null
  percent: number
}

export type ParentRollupChildLine = {
  id: string
  wbs: string | null
  name: string
  weight: number | null
  percent: number
  /** weight × percent contribution to numerator when weight > 0 */
  product: number | null
}

export type ParentRollupExplanation = {
  parentId: string
  parentWbs: string | null
  parentName: string
  percent: number
  usedEqualWeights: boolean
  children: ParentRollupChildLine[]
  /** Human-readable Persian explanation */
  text: string
}

function isDirectChildWbs(parentWbs: string, childWbs: string): boolean {
  const p = parentWbs.trim()
  const c = childWbs.trim()
  if (!p || !c || !c.startsWith(`${p}.`)) return false
  const rest = c.slice(p.length + 1)
  return rest.length > 0 && !rest.includes('.')
}

function directChildrenOf(
  parent: ProgressRollupNode,
  all: ProgressRollupNode[]
): ProgressRollupNode[] {
  const pw = parent.wbs?.trim()
  if (!pw) return []
  return all.filter((n) => n.id !== parent.id && n.wbs && isDirectChildWbs(pw, n.wbs))
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
}

function buildExplanation(
  parent: ProgressRollupNode,
  children: ProgressRollupNode[],
  childPercents: Map<string, number>,
  rolled: number,
  usedEqualWeights: boolean
): ParentRollupExplanation {
  const lines: ParentRollupChildLine[] = children.map((c) => {
    const pct = childPercents.get(c.id) ?? clampPct(c.percent)
    const w = c.weight != null && c.weight > 0 ? c.weight : null
    return {
      id: c.id,
      wbs: c.wbs,
      name: c.name,
      weight: w,
      percent: pct,
      product: w != null ? w * pct : null,
    }
  })

  const withWeight = lines.filter((l) => l.weight != null && l.product != null)
  let text: string
  if (usedEqualWeights) {
    const parts = lines.map(
      (l) => `${l.wbs ?? '—'} ${l.name}: ${l.percent}%`
    )
    text = [
      `درصد «${parent.name}» از میانگین ساده زیرشاخه‌ها (چون وزن معتبری ندارند):`,
      ...parts.map((p) => `• ${p}`),
      `نتیجه: ${rolled}%`,
    ].join('\n')
  } else {
    const num = withWeight.map((l) => `${l.weight}×${l.percent}`).join(' + ')
    const den = withWeight.map((l) => String(l.weight)).join(' + ')
    const parts = withWeight.map(
      (l) =>
        `${l.wbs ?? '—'} ${l.name}: وزن ${l.weight}% × پیشرفت ${l.percent}% = ${l.product}`
    )
    const skipped = lines.filter((l) => l.weight == null)
    text = [
      `درصد «${parent.wbs ? parent.wbs + ' — ' : ''}${parent.name}» از میانگین وزنی زیرشاخه‌ها:`,
      ...parts.map((p) => `• ${p}`),
      skipped.length
        ? `• بدون وزن (حذف از محاسبه): ${skipped.map((s) => s.wbs ?? s.name).join('، ')}`
        : null,
      `فرمول: (${num}) / (${den}) = ${rolled}%`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  return {
    parentId: parent.id,
    parentWbs: parent.wbs,
    parentName: parent.name,
    percent: rolled,
    usedEqualWeights,
    children: lines,
    text,
  }
}

/**
 * Bottom-up: parent % = Σ(childWeight × child%) / Σ(childWeight).
 * Children without weight are skipped; if none have weight, equal average is used.
 * Returns percent for every node (leaves unchanged) + explanations for parents.
 */
export function applyWeightedParentRollup(nodes: ProgressRollupNode[]): {
  percents: Record<string, number>
  parentIds: Set<string>
  explanations: Map<string, ParentRollupExplanation>
} {
  const percents = new Map<string, number>()
  const parentIds = new Set<string>()
  const explanations = new Map<string, ParentRollupExplanation>()

  for (const n of nodes) {
    percents.set(n.id, clampPct(n.percent))
  }

  const byDepthDesc = [...nodes].sort(
    (a, b) => wbsDepth(b.wbs) - wbsDepth(a.wbs) || (a.wbs ?? '').localeCompare(b.wbs ?? '')
  )

  for (const node of byDepthDesc) {
    const children = directChildrenOf(node, nodes)
    if (children.length === 0) continue

    parentIds.add(node.id)

    const childStates = children.map((c) => ({
      ...c,
      percent: percents.get(c.id) ?? clampPct(c.percent),
    }))

    const withWeight = childStates.filter((c) => c.weight != null && c.weight > 0)
    const usedEqual = withWeight.length === 0
    const rolled = usedEqual
      ? weightedProgressPercent(
          childStates.map((c) => ({ progress: c.percent, weight: 1 })),
          1,
          0
        )
      : weightedProgressPercent(
          withWeight.map((c) => ({ progress: c.percent, weight: c.weight })),
          1,
          0
        )

    percents.set(node.id, rolled)
    explanations.set(
      node.id,
      buildExplanation(node, children, percents, rolled, usedEqual)
    )
  }

  const out: Record<string, number> = {}
  for (const [id, pct] of percents) out[id] = pct
  return { percents: out, parentIds, explanations }
}
