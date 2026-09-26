import type { TaskRelationType } from '@/types/schedule'

export type DependencyNetworkTask = {
  id: string
  wbs: string | null
  name: string
  start: string | null
  finish: string | null
  isSummary?: boolean
}

export type DependencyNetworkLink = {
  fromId: string
  toId: string
  relation: TaskRelationType
  lagDays: number
}

export type DependencyNetworkNode = DependencyNetworkTask & {
  isolated: boolean
  predCount: number
  succCount: number
  layer: number
}

export type DependencyNetwork = {
  nodes: DependencyNetworkNode[]
  links: DependencyNetworkLink[]
  isolatedIds: string[]
}

function isLeafTask(task: DependencyNetworkTask, all: DependencyNetworkTask[]): boolean {
  if (task.isSummary) return false
  const wbs = task.wbs?.trim()
  if (!wbs) return true
  const prefix = `${wbs}.`
  return !all.some((other) => other.id !== task.id && (other.wbs ?? '').startsWith(prefix))
}

/** Leaf-only CPM graph. Isolated = no predecessor and no successor. */
export function buildDependencyNetwork(
  tasks: DependencyNetworkTask[],
  links: DependencyNetworkLink[]
): DependencyNetwork {
  const leaves = tasks.filter((task) => isLeafTask(task, tasks))
  const leafIds = new Set(leaves.map((task) => task.id))
  const edges = links.filter((link) => leafIds.has(link.fromId) && leafIds.has(link.toId))

  const predCount = new Map<string, number>()
  const succCount = new Map<string, number>()
  const incoming = new Map<string, string[]>()
  for (const leaf of leaves) {
    predCount.set(leaf.id, 0)
    succCount.set(leaf.id, 0)
    incoming.set(leaf.id, [])
  }
  for (const edge of edges) {
    predCount.set(edge.toId, (predCount.get(edge.toId) ?? 0) + 1)
    succCount.set(edge.fromId, (succCount.get(edge.fromId) ?? 0) + 1)
    incoming.get(edge.toId)?.push(edge.fromId)
  }

  const layer = new Map<string, number>()
  const remaining = new Map(predCount)
  const queue = leaves.filter((leaf) => (remaining.get(leaf.id) ?? 0) === 0).map((leaf) => leaf.id)
  for (const id of queue) layer.set(id, 0)
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.fromId) ?? []
    list.push(edge.toId)
    outgoing.set(edge.fromId, list)
  }
  const processed = new Set<string>()

  function enqueueStuck() {
    const stuck = leaves
      .filter((leaf) => !processed.has(leaf.id) && !queue.includes(leaf.id))
      .sort((a, b) => {
        const ra = remaining.get(a.id) ?? 0
        const rb = remaining.get(b.id) ?? 0
        if (ra !== rb) return ra - rb
        return (a.wbs ?? '').localeCompare(b.wbs ?? '', undefined, { numeric: true })
      })
    const next = stuck[0]
    if (!next) return false
    remaining.set(next.id, 0)
    if (!layer.has(next.id)) layer.set(next.id, 0)
    queue.push(next.id)
    return true
  }

  while (queue.length || enqueueStuck()) {
    const id = queue.shift()
    if (!id || processed.has(id)) continue
    processed.add(id)
    const nextLayer = (layer.get(id) ?? 0) + 1
    for (const succ of outgoing.get(id) ?? []) {
      const left = Math.max(0, (remaining.get(succ) ?? 1) - 1)
      remaining.set(succ, left)
      if (processed.has(succ)) continue
      layer.set(succ, Math.max(layer.get(succ) ?? 0, nextLayer))
      if (left === 0 && !queue.includes(succ)) queue.push(succ)
    }
  }

  const isolatedIds: string[] = []
  const nodes = leaves.map((task) => {
    const preds = predCount.get(task.id) ?? 0
    const succs = succCount.get(task.id) ?? 0
    const isolated = preds === 0 && succs === 0
    if (isolated) isolatedIds.push(task.id)
    return {
      ...task,
      isolated,
      predCount: preds,
      succCount: succs,
      layer: layer.get(task.id) ?? 0,
    }
  })

  return { nodes, links: edges, isolatedIds }
}
