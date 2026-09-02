import type { ProjectTask } from '@/types/schedule'
import { compareWbs, wbsDepth } from '@/lib/schedule/wbs-utils'
import type { ScheduleTreeNode, WorkshopPackageNode } from './types'

export function nextChildWbs(parentWbs: string | null, siblingCount: number): string {
  const seg = String(siblingCount + 1)
  if (!parentWbs?.trim()) return seg
  return `${parentWbs}.${seg}`
}

/** Assign hierarchical codes like 2.1.1 under parent schedule WBS 2.1 */
export function assignWbsToPackages(
  parentWbs: string | null,
  packages: WorkshopPackageNode[]
): void {
  packages.forEach((pkg, i) => {
    if (!pkg.wbs) {
      pkg.wbs = nextChildWbs(parentWbs, i)
    }
    if (pkg.children.length > 0) {
      assignWbsToPackages(pkg.wbs, pkg.children)
    }
  })
}

export function enrichScheduleTreeWithWbs(nodes: ScheduleTreeNode[]): ScheduleTreeNode[] {
  for (const node of nodes) {
    assignWbsToPackages(node.wbs, node.packages)
    if (node.children.length > 0) enrichScheduleTreeWithWbs(node.children)
  }
  return nodes
}

/**
 * Flat WBS-ordered schedule list including MSP summary rows (زیرشاخه).
 * Indent depth comes from WBS outline (e.g. 4.2 → depth 1 under 4).
 */
export function buildScheduleHierarchy(
  tasks: ProjectTask[],
  packagesByTask: Map<string, WorkshopPackageNode[]>
): ScheduleTreeNode[] {
  return [...tasks]
    .sort((a, b) => compareWbs(a.wbs_code, b.wbs_code))
    .map((t) => ({
      id: t.id,
      kind: 'schedule' as const,
      mspUid: t.msp_uid,
      taskId: t.id,
      wbs: t.wbs_code?.trim() || null,
      name: t.name,
      depth: wbsDepth(t.wbs_code),
      isSyntheticGroup: Boolean(t.is_summary),
      startDate: t.start_current ?? t.start_planned ?? null,
      finishDate: t.finish_current ?? t.finish_planned ?? null,
      scheduleWeight: t.schedule_weight ?? null,
      percentComplete: Number(t.percent_complete) || 0,
      packages: packagesByTask.get(t.id) ?? [],
      children: [],
    }))
}

export type FlatWorkshopRow =
  | {
      type: 'schedule'
      node: ScheduleTreeNode
      depth: number
      rowNumber: number
      wbs: string
      startDate: string | null
      finishDate: string | null
    }
  | {
      type: 'package'
      pkg: WorkshopPackageNode
      depth: number
      parentScheduleId: string
      rowNumber: number
      wbs: string
      startDate: string | null
      finishDate: string | null
    }

export function flattenWorkshopSchedule(
  nodes: ScheduleTreeNode[],
  expanded: Record<string, boolean>
): FlatWorkshopRow[] {
  const rows: Omit<FlatWorkshopRow, 'rowNumber'>[] = []

  function walkPackages(
    pkgs: WorkshopPackageNode[],
    depth: number,
    parentScheduleId: string,
    startDate: string | null,
    finishDate: string | null
  ) {
    for (const pkg of pkgs) {
      rows.push({
        type: 'package',
        pkg,
        depth,
        parentScheduleId,
        wbs: pkg.wbs ?? '—',
        startDate,
        finishDate,
      })
      if (expanded[`pkg:${pkg.id}`]) {
        walkPackages(pkg.children, depth + 1, parentScheduleId, startDate, finishDate)
      }
    }
  }

  for (const node of nodes) {
    rows.push({
      type: 'schedule',
      node,
      depth: node.depth,
      wbs: node.wbs ?? '—',
      startDate: node.startDate,
      finishDate: node.finishDate,
    })
    if (expanded[node.id]) {
      walkPackages(
        node.packages,
        node.depth + 1,
        node.taskId ?? node.id,
        node.startDate,
        node.finishDate
      )
    }
  }

  return rows.map((r, i) => ({ ...r, rowNumber: i + 1 }))
}

export function collectScheduleTaskNodes(nodes: ScheduleTreeNode[]): ScheduleTreeNode[] {
  const out: ScheduleTreeNode[] = []
  function walk(list: ScheduleTreeNode[]) {
    for (const n of list) {
      if (!n.isSyntheticGroup && n.taskId) out.push(n)
      if (n.children.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export function findScheduleNode(
  nodes: ScheduleTreeNode[],
  id: string
): ScheduleTreeNode | null {
  for (const n of nodes) {
    if (n.id === id || n.taskId === id) return n
    const child = findScheduleNode(n.children, id)
    if (child) return child
  }
  return null
}

export function findPackageInTree(
  nodes: ScheduleTreeNode[],
  pkgId: string
): WorkshopPackageNode | null {
  function walk(pkgs: WorkshopPackageNode[]): WorkshopPackageNode | null {
    for (const p of pkgs) {
      if (p.id === pkgId) return p
      const child = walk(p.children)
      if (child) return child
    }
    return null
  }
  function walkSchedule(list: ScheduleTreeNode[]) {
    for (const n of list) {
      const found = walk(n.packages)
      if (found) return found
      const child = walkSchedule(n.children)
      if (child) return child
    }
    return null
  }
  return walkSchedule(nodes)
}

export function findPackagePath(
  nodes: ScheduleTreeNode[],
  pkgId: string
): { scheduleId: string; packageIds: string[] } | null {
  function walkPkgs(
    pkgs: WorkshopPackageNode[],
    ancestors: string[]
  ): string[] | null {
    for (const p of pkgs) {
      if (p.id === pkgId) return [...ancestors, p.id]
      const child = walkPkgs(p.children, [...ancestors, p.id])
      if (child) return child
    }
    return null
  }

  function walkSchedule(list: ScheduleTreeNode[]): { scheduleId: string; packageIds: string[] } | null {
    for (const n of list) {
      const path = walkPkgs(n.packages, [])
      if (path) return { scheduleId: n.taskId ?? n.id, packageIds: path }
      const child = walkSchedule(n.children)
      if (child) return child
    }
    return null
  }

  return walkSchedule(nodes)
}

export function defaultScheduleExpanded(nodes: ScheduleTreeNode[]): Record<string, boolean> {
  const exp: Record<string, boolean> = {}
  for (const n of nodes) {
    if (n.depth <= 1 || n.packages.length > 0) {
      exp[n.id] = true
    }
    if (n.children.length) {
      for (const child of n.children) {
        if (child.depth <= 1 || child.packages.length > 0) exp[child.id] = true
      }
    }
  }
  return exp
}
