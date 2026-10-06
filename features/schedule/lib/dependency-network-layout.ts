import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import type {
DependencyNetwork,
DependencyNetworkLink,
DependencyNetworkNode,
} from '@/features/schedule/lib/dependency-network'
import type { TaskRelationType } from '@/shared/types/schedule'

export const DEP_AXIS_H = 42
export const DEP_NODE_W = 188
export const DEP_NODE_H = 78
export const DEP_PAD_X = 36
export const DEP_PAD_Y = 20
export const DEP_ROW_GAP = 22
export const DEP_COL_GUTTER = 92
export const DEP_ROW_H = DEP_NODE_H + DEP_ROW_GAP

export type LayoutBox = {
  id: string
  x: number
  y: number
  w: number
  h: number
  start: string | null
  finish: string | null
  barX: number
  barW: number
  node: DependencyNetworkNode
}

export type LayoutTick = {
  x: number
  label: string
}

export type LayoutEdge = {
  key: string
  d: string
  label: string
  labelX: number
  labelY: number
  relation: TaskRelationType
  fromId: string
  toId: string
}

export type DependencyNetworkLayout = {
  width: number
  height: number
  boxes: LayoutBox[]
  ticks: LayoutTick[]
  edges: LayoutEdge[]
  isolatedBandY: number | null
}

const RELATION_FA: Record<TaskRelationType, string> = {
  FS: 'بعد از پایان',
  SS: 'هم‌زمان شروع',
  FF: 'هم‌زمان پایان',
  SF: 'شروع به پایان',
}

function sortNodes(a: DependencyNetworkNode, b: DependencyNetworkNode): number {
  return compareWbs(a.wbs, b.wbs) || a.name.localeCompare(b.name, 'fa')
}

function columnX(layer: number, maxLayer: number): number {
  return DEP_PAD_X + (maxLayer - layer) * (DEP_NODE_W + DEP_COL_GUTTER)
}

function rowY(row: number, originY = DEP_AXIS_H + DEP_PAD_Y): number {
  return originY + row * DEP_ROW_H
}

function neighborsOf(
  id: string,
  links: DependencyNetworkLink[],
  side: 'pred' | 'succ'
): string[] {
  return links
    .filter((link) => (side === 'pred' ? link.toId === id : link.fromId === id))
    .map((link) => (side === 'pred' ? link.fromId : link.toId))
}

function barycenter(ids: string[], rowOf: Map<string, number>): number {
  if (ids.length === 0) return Number.POSITIVE_INFINITY
  const rows = ids.map((id) => rowOf.get(id)).filter((row): row is number => row != null)
  if (rows.length === 0) return Number.POSITIVE_INFINITY
  return rows.reduce((sum, row) => sum + row, 0) / rows.length
}

/** Order each layer to keep predecessors and successors on nearby rows. */
export function assignLayerRows(
  nodes: DependencyNetworkNode[],
  links: DependencyNetworkLink[]
): Map<string, number> {
  const layers = new Map<number, DependencyNetworkNode[]>()
  for (const node of nodes) {
    const list = layers.get(node.layer) ?? []
    list.push(node)
    layers.set(node.layer, list)
  }
  const ordered = new Map<number, string[]>()
  for (const [layer, list] of layers) {
    ordered.set(layer, [...list].sort(sortNodes).map((node) => node.id))
  }

  const rowOf = () => {
    const map = new Map<string, number>()
    for (const ids of ordered.values()) {
      ids.forEach((id, index) => map.set(id, index))
    }
    return map
  }

  const layerKeys = [...ordered.keys()].sort((a, b) => a - b)
  for (let pass = 0; pass < 4; pass++) {
    const rows = rowOf()
    const downward = pass % 2 === 0
    const walk = downward ? layerKeys : [...layerKeys].reverse()
    for (const layer of walk) {
      const ids = ordered.get(layer) ?? []
      ids.sort((a, b) => {
        const side = downward ? 'pred' : 'succ'
        const av = barycenter(neighborsOf(a, links, side), rows)
        const bv = barycenter(neighborsOf(b, links, side), rows)
        if (av !== bv) return av - bv
        const na = nodes.find((node) => node.id === a)
        const nb = nodes.find((node) => node.id === b)
        return sortNodes(na!, nb!)
      })
      ordered.set(layer, ids)
    }
  }

  const aligned = new Map<string, number>()
  for (const layer of layerKeys) {
    const ids = ordered.get(layer) ?? []
    const used = new Set<number>()
    for (const id of ids) {
      const preds = neighborsOf(id, links, 'pred').filter((predId) => {
        const pred = nodes.find((node) => node.id === predId)
        return pred != null && pred.layer === layer - 1
      })
      let row = Math.round(barycenter(preds, aligned))
      if (!Number.isFinite(row)) row = aligned.size
      while (used.has(row)) row += 1
      used.add(row)
      aligned.set(id, row)
    }
  }
  return aligned
}

export function alignedEdgeRoute(
  from: Pick<LayoutBox, 'x' | 'y' | 'w' | 'h'>,
  to: Pick<LayoutBox, 'x' | 'y' | 'w' | 'h'>,
  lane = 0
): { d: string; labelX: number; labelY: number } {
  const x1 = from.x
  const y1 = from.y + from.h / 2
  const x2 = to.x + to.w
  const y2 = to.y + to.h / 2
  if (Math.abs(y1 - y2) < 2 && x1 > x2) {
    const mid = (x1 + x2) / 2
    return { d: `M ${x1} ${y1} L ${x2} ${y2}`, labelX: mid, labelY: y1 - 10 }
  }
  const minGap = Math.min(x1, x2)
  const maxGap = Math.max(x1, x2)
  const span = Math.max(24, maxGap - minGap)
  const elbow = minGap + span * 0.45 - lane * 12
  return {
    d: `M ${x1} ${y1} L ${elbow} ${y1} L ${elbow} ${y2} L ${x2} ${y2}`,
    labelX: elbow,
    labelY: (y1 + y2) / 2 - 8,
  }
}

function makeBox(
  node: DependencyNetworkNode,
  x: number,
  y: number
): LayoutBox {
  return {
    id: node.id,
    x,
    y,
    w: DEP_NODE_W,
    h: DEP_NODE_H,
    start: node.start,
    finish: node.finish,
    barX: x,
    barW: DEP_NODE_W,
    node,
  }
}

/** Layered RTL graph: predecessors on the right, successors on the left. Isolated sit below. */
export function layoutDependencyNetwork(network: DependencyNetwork): DependencyNetworkLayout {
  const linked = network.nodes.filter((node) => !node.isolated)
  const isolated = [...network.nodes.filter((node) => node.isolated)].sort(sortNodes)
  const maxLayer = linked.reduce((max, node) => Math.max(max, node.layer), 0)
  const colCount = linked.length ? maxLayer + 1 : 0
  const isoCols = isolated.length ? Math.min(3, isolated.length) : 0
  const width = Math.max(
    720,
    DEP_PAD_X * 2 +
      Math.max(colCount, isoCols) * DEP_NODE_W +
      Math.max(0, Math.max(colCount, isoCols) - 1) * DEP_COL_GUTTER
  )

  const rows = assignLayerRows(linked, network.links)
  const boxes: LayoutBox[] = linked.map((node) =>
    makeBox(node, columnX(node.layer, maxLayer), rowY(rows.get(node.id) ?? 0))
  )

  const linkedBottom = boxes.reduce((max, box) => Math.max(max, box.y + box.h), DEP_AXIS_H)
  const isolatedBandY = isolated.length ? linkedBottom + (linked.length ? 48 : DEP_PAD_Y) : null
  if (isolatedBandY != null) {
    isolated.forEach((node, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = DEP_PAD_X + (2 - col) * (DEP_NODE_W + DEP_COL_GUTTER)
      boxes.push(makeBox(node, x, isolatedBandY + 28 + row * DEP_ROW_H))
    })
  }

  const height = Math.max(
    360,
    boxes.reduce((max, box) => Math.max(max, box.y + box.h), 0) + DEP_PAD_Y
  )

  const ticks: LayoutTick[] = []
  if (linked.length) {
    for (let layer = 0; layer <= maxLayer; layer++) {
      ticks.push({
        x: columnX(layer, maxLayer) + DEP_NODE_W / 2,
        label: layer === 0 ? 'شروع' : `مرحله ${layer + 1}`,
      })
    }
  }

  const byId = new Map(boxes.map((box) => [box.id, box]))
  const laneOf = new Map<string, number>()
  const gutterBuckets = new Map<string, string[]>()
  for (const link of network.links) {
    const from = byId.get(link.fromId)
    const to = byId.get(link.toId)
    if (!from || !to) continue
    const key = `${from.node.layer}->${to.node.layer}`
    const list = gutterBuckets.get(key) ?? []
    const edgeKey = `${link.fromId}->${link.toId}:${link.relation}`
    list.push(edgeKey)
    gutterBuckets.set(key, list)
  }
  for (const list of gutterBuckets.values()) {
    list.forEach((key, index) => laneOf.set(key, index - (list.length - 1) / 2))
  }

  const edges: LayoutEdge[] = network.links.flatMap((link) => {
    const from = byId.get(link.fromId)
    const to = byId.get(link.toId)
    if (!from || !to) return []
    const key = `${link.fromId}->${link.toId}:${link.relation}`
    const route = alignedEdgeRoute(from, to, laneOf.get(key) ?? 0)
    return [
      {
        key,
        d: route.d,
        label: RELATION_FA[link.relation] ?? link.relation,
        labelX: route.labelX,
        labelY: route.labelY,
        relation: link.relation,
        fromId: link.fromId,
        toId: link.toId,
      },
    ]
  })

  return { width, height, boxes, ticks, edges, isolatedBandY }
}
