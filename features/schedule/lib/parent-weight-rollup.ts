import { wbsDepth } from '@/features/schedule/lib/wbs-utils'

export type WeightRollupNode = {
  id: string
  wbs: string | null
  name: string
  weight: number | null
}

export type ParentWeightExplanation = {
  parentId: string
  parentWbs: string | null
  parentName: string
  sum: number
  children: Array<{
    id: string
    wbs: string | null
    name: string
    weight: number
  }>
  /** Persian explanation of how parent weight was derived */
  text: string
}

export function isDirectChildWbs(parentWbs: string, childWbs: string): boolean {
  const p = parentWbs.trim()
  const c = childWbs.trim()
  if (!p || !c || !c.startsWith(`${p}.`)) return false
  const rest = c.slice(p.length + 1)
  return rest.length > 0 && !rest.includes('.')
}

function directChildrenOf(
  parent: WeightRollupNode,
  all: WeightRollupNode[]
): WeightRollupNode[] {
  const pw = parent.wbs?.trim()
  if (!pw) return []
  return all.filter((n) => n.id !== parent.id && n.wbs && isDirectChildWbs(pw, n.wbs))
}

function asWeight(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(Number(value))) return 0
  const v = Number(value)
  return v > 0 ? v : 0
}

function roundWeight(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Bottom-up: parent weight = sum of direct children's weights.
 * Nested parents use already-rolled child weights.
 */
export function applyParentWeightSum(nodes: WeightRollupNode[]): {
  weights: Record<string, number | null>
  parentIds: Set<string>
  explanations: Map<string, ParentWeightExplanation>
} {
  const weights = new Map<string, number | null>()
  const parentIds = new Set<string>()
  const explanations = new Map<string, ParentWeightExplanation>()

  for (const n of nodes) {
    weights.set(n.id, n.weight == null || !Number.isFinite(Number(n.weight)) ? null : Number(n.weight))
  }

  const byDepthDesc = [...nodes].sort(
    (a, b) => wbsDepth(b.wbs) - wbsDepth(a.wbs) || (a.wbs ?? '').localeCompare(b.wbs ?? '')
  )

  for (const node of byDepthDesc) {
    const children = directChildrenOf(node, nodes)
    if (children.length === 0) continue

    parentIds.add(node.id)

    const childLines = children.map((c) => ({
      id: c.id,
      wbs: c.wbs,
      name: c.name,
      weight: asWeight(weights.get(c.id)),
    }))
    const sum = roundWeight(childLines.reduce((acc, c) => acc + c.weight, 0))
    weights.set(node.id, sum)

    const labeled = childLines
      .map((c) => `${c.wbs ?? '—'}(${c.weight})`)
      .join(' + ')
    const parentLabel = node.wbs?.trim()
      ? `${node.wbs} ${node.name}`
      : node.name
    explanations.set(node.id, {
      parentId: node.id,
      parentWbs: node.wbs,
      parentName: node.name,
      sum,
      children: childLines,
      text: `${parentLabel} = ${labeled || '0'} = ${sum}`,
    })
  }

  const out: Record<string, number | null> = {}
  for (const [id, w] of weights) out[id] = w
  return { weights: out, parentIds, explanations }
}

/** True when `childWbs` is under `parentWbs` at any depth. */
export function isDescendantWbs(parentWbs: string, childWbs: string): boolean {
  const p = parentWbs.trim()
  const c = childWbs.trim()
  return Boolean(p && c && c.startsWith(`${p}.`))
}
