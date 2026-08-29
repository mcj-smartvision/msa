'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  BLOCK_KIND_LABELS_FA,
  DASHBOARD_LABELS_FA,
} from '@/lib/dashboard/resolve-ui-block-visibility'
import type { DashboardUiBlock, Position, PositionUiBlockVisibility } from '@/types/admin'

interface UiBlockVisibilityEditorProps {
  positions: Position[]
  blocks: DashboardUiBlock[]
  assignments: PositionUiBlockVisibility[]
  onSave: (payload: {
    position_id: string
    block_id: string
    is_visible: boolean
    sort_order: number
  }) => Promise<void>
}

export function UiBlockVisibilityEditor({
  positions,
  blocks,
  assignments,
  onSave,
}: UiBlockVisibilityEditorProps) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? '')
  const [dashboardFilter, setDashboardFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const dashboards = useMemo(() => {
    const set = new Set(blocks.map((b) => b.dashboard))
    return [...set].sort()
  }, [blocks])

  const kinds = useMemo(() => {
    const set = new Set(blocks.map((b) => b.kind))
    return [...set].sort()
  }, [blocks])

  const filteredBlocks = useMemo(() => {
    return blocks.filter((block) => {
      if (dashboardFilter !== 'all' && block.dashboard !== dashboardFilter) return false
      if (kindFilter !== 'all' && block.kind !== kindFilter) return false
      return true
    })
  }, [blocks, dashboardFilter, kindFilter])

  const visibilityMap = useMemo(() => {
    const map = new Map<string, PositionUiBlockVisibility>()
    assignments.forEach((item) => {
      map.set(`${item.position_id}:${item.block_id}`, item)
    })
    return map
  }, [assignments])

  async function toggleBlock(block: DashboardUiBlock, checked: boolean) {
    if (!positionId) return
    const key = `${positionId}:${block.id}`
    setLoadingKey(key)
    try {
      await onSave({
        position_id: positionId,
        block_id: block.id,
        is_visible: checked,
        sort_order: block.sort_order,
      })
    } finally {
      setLoadingKey(null)
    }
  }

  function isVisible(block: DashboardUiBlock) {
    const existing = visibilityMap.get(`${positionId}:${block.id}`)
    if (existing) return existing.is_visible
    return block.default_visible
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>کنترل نمایش بلوک‌های UI</CardTitle>
          <p className="text-sm text-muted-foreground">
            جداول، نمودارها، KPI، پنل‌ها و درخواست‌ها — بر اساس سمت (Position)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ui-block-position">سمت</Label>
              <select
                id="ui-block-position"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ui-block-dashboard">داشبورد</Label>
              <select
                id="ui-block-dashboard"
                value={dashboardFilter}
                onChange={(e) => setDashboardFilter(e.target.value)}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="all">همه ({blocks.length})</option>
                {dashboards.map((d) => (
                  <option key={d} value={d}>
                    {DASHBOARD_LABELS_FA[d] ?? d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ui-block-kind">نوع</Label>
              <select
                id="ui-block-kind"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="all">همه انواع</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {BLOCK_KIND_LABELS_FA[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3">
            {filteredBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">بلوکی با این فیلتر یافت نشد.</p>
            ) : (
              filteredBlocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{block.title_fa}</p>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {block.code}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {BLOCK_KIND_LABELS_FA[block.kind] ?? block.kind}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{block.description_fa}</p>
                    <p className="text-xs text-muted-foreground">
                      {DASHBOARD_LABELS_FA[block.dashboard] ?? block.dashboard} · {block.layer}
                    </p>
                  </div>
                  <Checkbox
                    id={`ui-block-${block.id}`}
                    label="نمایش"
                    checked={isVisible(block)}
                    disabled={loadingKey === `${positionId}:${block.id}`}
                    onChange={(e) => toggleBlock(block, e.target.checked)}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ماتریس نمایش</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-right">
                <th className="py-2 ps-4">بلوک</th>
                {positions.map((position) => (
                  <th key={position.id} className="py-2 px-2 whitespace-nowrap">
                    {position.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBlocks.map((block) => (
                <tr key={block.id} className="border-b">
                  <td className="py-2 ps-4">
                    <span className="font-medium">{block.title_fa}</span>
                    <span className="block text-[10px] text-muted-foreground font-mono">
                      {block.code}
                    </span>
                  </td>
                  {positions.map((position) => {
                    const existing = visibilityMap.get(`${position.id}:${block.id}`)
                    const visible = existing ? existing.is_visible : block.default_visible
                    return (
                      <td key={position.id} className="py-2 px-2 text-center">
                        {visible ? '✓' : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
