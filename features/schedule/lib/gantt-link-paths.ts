import type { TaskRelationType } from '@/shared/types/schedule'
import { explainDependencyLink } from '@/features/schedule/lib/dependency-explain'

export type GanttLinkDto = {
  predecessorId: string
  successorId: string
  type: TaskRelationType
  lagDays: number
}

export type GanttBarAnchor = {
  id: string
  rowIndex: number
  /** Left edge of bar (or milestone x) */
  startX: number
  /** Right edge of bar (or milestone x) */
  finishX: number
  midY: number
  isMilestone?: boolean
}

export type GanttTaskMeta = {
  name: string
  wbs: string | null
}

const STUB = 10

/**
 * Build MSP-style orthogonal link path from predecessor → successor.
 * Arrow tip sits on the successor attachment point.
 */
export function buildGanttLinkPath(
  from: GanttBarAnchor,
  to: GanttBarAnchor,
  type: TaskRelationType
): { d: string; fromX: number; fromY: number; toX: number; toY: number } | null {
  const fromY = from.midY
  const toY = to.midY

  // Attachment sides (MSP)
  let fromX: number
  let toX: number
  switch (type) {
    case 'SS':
      fromX = from.startX
      toX = to.startX
      break
    case 'FF':
      fromX = from.finishX
      toX = to.finishX
      break
    case 'SF':
      fromX = from.startX
      toX = to.finishX
      break
    case 'FS':
    default:
      fromX = from.finishX
      toX = to.startX
      break
  }

  const leaveRight = type === 'FS' || type === 'FF'
  const enterLeft = type === 'FS' || type === 'SS'

  if (Math.abs(fromY - toY) < 1) {
    // Same row (rare) — straight
    return { d: `M ${fromX} ${fromY} L ${toX} ${toY}`, fromX, fromY, toX, toY }
  }

  const exitX = leaveRight ? fromX + STUB : fromX - STUB
  const enterX = enterLeft ? toX - STUB : toX + STUB

  // Preferred: stub → vertical at mid → into target
  const canSimpleMid =
    (leaveRight && enterLeft && exitX <= enterX) ||
    (!leaveRight && !enterLeft && exitX >= enterX) ||
    (leaveRight && !enterLeft && exitX <= enterX) ||
    (!leaveRight && enterLeft && exitX >= enterX)

  let d: string
  if (canSimpleMid && leaveRight && enterLeft && exitX <= enterX) {
    const midX = Math.round((exitX + enterX) / 2)
    d = `M ${fromX} ${fromY} H ${exitX} H ${midX} V ${toY} H ${enterX} H ${toX}`
  } else if (canSimpleMid && !leaveRight && !enterLeft && exitX >= enterX) {
    const midX = Math.round((exitX + enterX) / 2)
    d = `M ${fromX} ${fromY} H ${exitX} H ${midX} V ${toY} H ${enterX} H ${toX}`
  } else {
    // Route around to the right of both bars (MSP when successor starts before pred finish)
    const routeX = Math.max(from.finishX, to.finishX, fromX, toX) + STUB * 2
    if (leaveRight && enterLeft) {
      d = `M ${fromX} ${fromY} H ${routeX} V ${toY} H ${toX}`
    } else if (leaveRight && !enterLeft) {
      d = `M ${fromX} ${fromY} H ${routeX} V ${toY} H ${toX}`
    } else if (!leaveRight && enterLeft) {
      const leftRoute = Math.min(from.startX, to.startX, fromX, toX) - STUB * 2
      d = `M ${fromX} ${fromY} H ${leftRoute} V ${toY} H ${toX}`
    } else {
      d = `M ${fromX} ${fromY} H ${exitX} V ${toY} H ${toX}`
    }
  }

  return { d, fromX, fromY, toX, toY }
}

export type GanttLinkDrawing = {
  key: string
  d: string
  type: TaskRelationType
  lagDays: number
  toX: number
  toY: number
  enterLeft: boolean
  label: string
  tooltip: string
  predecessorId: string
  successorId: string
}

export function buildAllGanttLinkPaths(
  links: GanttLinkDto[],
  anchors: Map<string, GanttBarAnchor>,
  taskMeta?: Map<string, GanttTaskMeta>
): GanttLinkDrawing[] {
  const out: GanttLinkDrawing[] = []

  for (const link of links) {
    const from = anchors.get(link.predecessorId)
    const to = anchors.get(link.successorId)
    if (!from || !to) continue
    const built = buildGanttLinkPath(from, to, link.type)
    if (!built) continue
    const enterLeft = link.type === 'FS' || link.type === 'SS'
    const predMeta = taskMeta?.get(link.predecessorId)
    const succMeta = taskMeta?.get(link.successorId)
    const explained = explainDependencyLink({
      type: link.type,
      lagDays: link.lagDays,
      predecessor: {
        id: link.predecessorId,
        wbs: predMeta?.wbs,
        name: predMeta?.name,
      },
      successor: {
        id: link.successorId,
        wbs: succMeta?.wbs,
        name: succMeta?.name,
      },
    })
    out.push({
      key: `${link.predecessorId}->${link.successorId}:${link.type}`,
      d: built.d,
      type: link.type,
      lagDays: link.lagDays,
      toX: built.toX,
      toY: built.toY,
      enterLeft,
      label: explained.shortLabel,
      tooltip: explained.tooltip,
      predecessorId: link.predecessorId,
      successorId: link.successorId,
    })
  }
  return out
}
