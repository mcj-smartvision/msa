import { wbsDepth } from '@/features/schedule/lib/wbs-utils'
import { isDirectChildWbs } from '@/features/schedule/lib/parent-weight-rollup'

export type UnitPriceRollupNode = {
  id: string
  wbs: string | null
  name: string
  /** Leaf commercial contribution; ignored when node has children. */
  amount: number
}

export type ParentUnitPriceExplanation = {
  parentId: string
  parentWbs: string | null
  parentName: string
  sum: number
  children: Array<{ id: string; wbs: string | null; name: string; amount: number }>
  text: string
}

function asAmount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(Number(value))) return 0
  const v = Number(value)
  return v > 0 ? v : 0
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Leaf commercial line: qty × unit price (falls back to unit price alone). */
export function commercialLineAmount(
  quantity: number | null | undefined,
  unitPrice: number | null | undefined
): number {
  const price = asAmount(unitPrice)
  const qty = asAmount(quantity)
  if (qty > 0 && price > 0) return roundMoney(qty * price)
  if (price > 0) return price
  if (qty > 0) return qty
  return 0
}

/** Strict قیمت کل: always مقدار × قیمت واحد (0 if either side is missing). */
export function quantityTimesUnitPrice(
  quantity: number | null | undefined,
  unitPrice: number | null | undefined
): number {
  return roundMoney(asAmount(quantity) * asAmount(unitPrice))
}

function directChildrenOf(
  parent: UnitPriceRollupNode,
  all: UnitPriceRollupNode[]
): UnitPriceRollupNode[] {
  const pw = parent.wbs?.trim()
  if (!pw) return []
  return all.filter((n) => n.id !== parent.id && n.wbs && isDirectChildWbs(pw, n.wbs))
}

/**
 * Bottom-up: parent unit-price cell = sum of direct children's commercial amounts.
 * Nested parents use already-rolled child totals.
 */
export function applyParentUnitPriceSum(nodes: UnitPriceRollupNode[]): {
  amounts: Record<string, number>
  parentIds: Set<string>
  explanations: Map<string, ParentUnitPriceExplanation>
} {
  const amounts = new Map<string, number>()
  const parentIds = new Set<string>()
  const explanations = new Map<string, ParentUnitPriceExplanation>()

  for (const n of nodes) {
    amounts.set(n.id, asAmount(n.amount))
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
      amount: asAmount(amounts.get(c.id)),
    }))
    const sum = roundMoney(childLines.reduce((acc, c) => acc + c.amount, 0))
    amounts.set(node.id, sum)

    const labeled = childLines
      .map((c) => `${c.wbs ?? '—'}(${c.amount})`)
      .join(' + ')
    const parentLabel = node.wbs?.trim() ? `${node.wbs} ${node.name}` : node.name
    explanations.set(node.id, {
      parentId: node.id,
      parentWbs: node.wbs,
      parentName: node.name,
      sum,
      children: childLines,
      text: `${parentLabel} = ${labeled || '۰'} = ${sum}`,
    })
  }

  const out: Record<string, number> = {}
  for (const [id, value] of amounts) out[id] = value
  return { amounts: out, parentIds, explanations }
}
