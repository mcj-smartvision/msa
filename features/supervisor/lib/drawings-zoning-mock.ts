import type { DrawingDiscipline } from '@/features/technical-office/lib/drawings-shared';
import type { ProjectDrawing } from '@/features/technical-office/lib/drawings-shared';

export type { DrawingDiscipline }

export type PercentPoint = { x: number; y: number }

export type MapAnnotation =
  | { id: string; type: 'pen'; points: PercentPoint[] }
  | { id: string; type: 'text'; position: PercentPoint; text: string }
  | { id: string; type: 'line'; from: PercentPoint; to: PercentPoint }
  | { id: string; type: 'hline'; from: PercentPoint; to: PercentPoint }
  | { id: string; type: 'vline'; from: PercentPoint; to: PercentPoint }

export type MapEditorTool = 'pen' | 'text' | 'line' | 'freeline' | 'zone'

export type ZoneShapeTool = 'rectangle' | 'square' | 'circle' | 'polygon'

export type DefinedZone = {
  id: string
  name: string
  /** کد زون — شناسه کوتاه */
  code: string
  /** مسئول زون (اختیاری) */
  supervisor?: string
  /** پیمانکار مسئول (اختیاری) */
  contractor?: string
  /** تراز‌های زون — مثلاً طبقه 1، طبقه 2 */
  levels?: string[]
  /** توضیحات تکمیلی (اختیاری) */
  description?: string
  color: string
  fillColor: string
  drawingId: string
  drawingTitle: string
  polygon: PercentPoint[]
  activityCount: number
}

export const ZONE_COLOR_PRESETS = [
  { id: 'amber', label: 'نارنجی', fill: 'rgba(245, 158, 11, 0.45)', stroke: '#d97706' },
  { id: 'sky', label: 'آبی', fill: 'rgba(14, 165, 233, 0.4)', stroke: '#0284c7' },
  { id: 'emerald', label: 'سبز', fill: 'rgba(16, 185, 129, 0.4)', stroke: '#059669' },
  { id: 'violet', label: 'بنفش', fill: 'rgba(139, 92, 246, 0.4)', stroke: '#7c3aed' },
  { id: 'rose', label: 'قرمز', fill: 'rgba(244, 63, 94, 0.4)', stroke: '#e11d48' },
  { id: 'teal', label: 'فیروزه‌ای', fill: 'rgba(20, 184, 166, 0.4)', stroke: '#0d9488' },
  { id: 'lime', label: 'لیمویی', fill: 'rgba(132, 204, 22, 0.4)', stroke: '#65a30d' },
  { id: 'pink', label: 'صورتی', fill: 'rgba(236, 72, 153, 0.4)', stroke: '#db2777' },
  { id: 'slate', label: 'خاکستری', fill: 'rgba(100, 116, 139, 0.35)', stroke: '#475569' },
  { id: 'orange', label: 'نارنجی تیره', fill: 'rgba(249, 115, 22, 0.4)', stroke: '#ea580c' },
] as const

export function mockActivityCount(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 997
  return 2 + (hash % 11)
}

export function polygonCentroid(points: PercentPoint[]): PercentPoint {
  if (points.length === 0) return { x: 50, y: 50 }
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

export function snapAxisLineEnd(from: PercentPoint, to: PercentPoint): PercentPoint {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: to.x, y: from.y }
  }
  return { x: from.x, y: to.y }
}

export function pointsToSvgAttr(points: PercentPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

export function rectanglePolygon(from: PercentPoint, to: PercentPoint): PercentPoint[] {
  const minX = Math.min(from.x, to.x)
  const maxX = Math.max(from.x, to.x)
  const minY = Math.min(from.y, to.y)
  const maxY = Math.max(from.y, to.y)
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

export function squarePolygon(from: PercentPoint, to: PercentPoint): PercentPoint[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  const signX = dx >= 0 ? 1 : -1
  const signY = dy >= 0 ? 1 : -1
  const end = { x: from.x + signX * size, y: from.y + signY * size }
  return rectanglePolygon(from, end)
}

export function circlePolygon(
  center: PercentPoint,
  edge: PercentPoint,
  segments = 28
): PercentPoint[] {
  const radius = Math.sqrt((edge.x - center.x) ** 2 + (edge.y - center.y) ** 2)
  if (radius < 0.01) return []
  const points: PercentPoint[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    points.push({
      x: Math.max(0, Math.min(100, center.x + radius * Math.cos(angle))),
      y: Math.max(0, Math.min(100, center.y + radius * Math.sin(angle))),
    })
  }
  return points
}

export function polygonBBoxSize(points: PercentPoint[]): number {
  if (points.length < 2) return 0
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  return Math.max(w, h)
}

/** بستن مسیر قلم برای تبدیل به محدوده زون */
export function closePenPolygon(points: PercentPoint[], minBBox = 0.012): PercentPoint[] | null {
  if (points.length < 3) return null
  const closed = [...points]
  const first = points[0]
  const last = points[points.length - 1]
  const dx = first.x - last.x
  const dy = first.y - last.y
  if (dx * dx + dy * dy > 0.25) closed.push(first)
  if (polygonBBoxSize(closed) < minBBox) return null
  return closed
}

/** رشته‌های اصلی در UI زون‌بندی */
export const EDITOR_DISCIPLINES: DrawingDiscipline[] = [
  'structure',
  'architecture',
  'electrical',
  'mechanical',
]

/** پیش‌فرض: اول نقشه سازه (سازه) */
export function pickStructureDrawing(drawings: ProjectDrawing[]): ProjectDrawing | null {
  const structure = drawings.find((d) => d.discipline === 'structure')
  if (structure) return structure
  const other = drawings.find((d) => d.discipline === 'other')
  if (other) return other
  return drawings[0] ?? null
}

export function drawingsForEditorDiscipline(
  drawings: ProjectDrawing[],
  discipline: DrawingDiscipline
): ProjectDrawing[] {
  return drawings.filter(
    (d) => d.discipline === discipline || (d.discipline === 'other' && discipline === 'structure')
  )
}
