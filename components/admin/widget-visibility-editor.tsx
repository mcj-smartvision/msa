'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { DashboardWidget, Position, PositionDashboardWidget } from '@/types/admin'

interface WidgetVisibilityEditorProps {
  positions: Position[]
  widgets: DashboardWidget[]
  assignments: PositionDashboardWidget[]
  onSave: (payload: { position_id: string; widget_id: string; is_visible: boolean; sort_order: number }) => Promise<void>
}

export function WidgetVisibilityEditor({
  positions,
  widgets,
  assignments,
  onSave,
}: WidgetVisibilityEditorProps) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? '')
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const visibilityMap = useMemo(() => {
    const map = new Map<string, PositionDashboardWidget>()
    assignments.forEach((item) => {
      map.set(`${item.position_id}:${item.widget_id}`, item)
    })
    return map
  }, [assignments])

  async function toggleWidget(widget: DashboardWidget, checked: boolean) {
    if (!positionId) return
    const key = `${positionId}:${widget.id}`
    setLoadingKey(key)
    try {
      await onSave({
        position_id: positionId,
        widget_id: widget.id,
        is_visible: checked,
        sort_order: widget.sort_order,
      })
    } finally {
      setLoadingKey(null)
    }
  }

  function isVisible(widget: DashboardWidget) {
    const existing = visibilityMap.get(`${positionId}:${widget.id}`)
    if (existing) return existing.is_visible
    return widget.default_visible
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>نمایش ویجت بر اساس سمت</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="widget-position">سمت</Label>
            <select
              id="widget-position"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {positions.map((position) => (
                <option key={position.id} value={position.id}>{position.title}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3">
            {widgets.map((widget) => (
              <div key={widget.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{widget.title}</p>
                  <p className="text-sm text-muted-foreground">{widget.description}</p>
                </div>
                <Checkbox
                  id={`widget-${widget.id}`}
                  label="قابل‌نمایش"
                  checked={isVisible(widget)}
                  disabled={loadingKey === `${positionId}:${widget.id}`}
                  onChange={(e) => toggleWidget(widget, e.target.checked)}
                />
              </div>
            ))}
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
              <tr className="border-b text-left">
                <th className="py-2 pr-4">ویجت</th>
                {positions.map((position) => (
                  <th key={position.id} className="py-2 px-2 whitespace-nowrap">{position.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {widgets.map((widget) => (
                <tr key={widget.id} className="border-b">
                  <td className="py-2 pr-4 font-medium">{widget.title}</td>
                  {positions.map((position) => {
                    const existing = visibilityMap.get(`${position.id}:${widget.id}`)
                    const visible = existing ? existing.is_visible : widget.default_visible
                    return (
                      <td key={position.id} className="py-2 px-2 text-center">
                        {visible ? 'بله' : 'خیر'}
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
