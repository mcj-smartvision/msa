'use client'

import type { Position } from '@/types/admin'
import { Checkbox } from '@/components/ui/checkbox'

interface PositionMultiSelectProps {
  positions: Position[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyMessage?: string
}

export function PositionMultiSelect({
  positions,
  selectedIds,
  onChange,
  emptyMessage = 'قبل از تخصیص اعضا، ابتدا سمت‌ها را بسازید.',
}: PositionMultiSelectProps) {
  if (positions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  function toggle(positionId: string, checked: boolean) {
    if (checked) {
      onChange(Array.from(new Set([...selectedIds, positionId])))
      return
    }
    onChange(selectedIds.filter((id) => id !== positionId))
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {positions.map((position) => (
        <Checkbox
          key={position.id}
          id={`position-${position.id}`}
          label={`${position.title} (${position.key})`}
          checked={selectedIds.includes(position.id)}
          onChange={(e) => toggle(position.id, e.target.checked)}
        />
      ))}
    </div>
  )
}
