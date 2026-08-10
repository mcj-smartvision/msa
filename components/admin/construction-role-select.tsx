'use client'

import { CONSTRUCTION_ROLES } from '@/lib/admin/construction-roles'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { getPositionLabel } from '@/lib/i18n/position-labels'
import { useLocale } from '@/components/i18n/locale-provider'
import type { Position } from '@/types/admin'
import { Loader2, Sprout } from 'lucide-react'

interface ConstructionRoleSelectProps {
  positions: Position[]
  value: string
  onChange: (positionId: string) => void
  label?: string
  loading?: boolean
  seeding?: boolean
  seedMessage?: string | null
  onSeed?: () => void | Promise<void>
  messages: {
    siteRole: string
    selectRole: string
    noPositions: string
    seedPositions: string
    seedingPositions: string
    loadingPositions: string
  }
}

export function ConstructionRoleSelect({
  positions,
  value,
  onChange,
  label,
  loading = false,
  seeding = false,
  seedMessage,
  onSeed,
  messages,
}: ConstructionRoleSelectProps) {
  const { locale } = useLocale()
  const activePositions = positions.filter((p) => p.is_active)

  const sortedPositions = [...activePositions].sort((a, b) => {
    const aIdx = CONSTRUCTION_ROLES.findIndex((r) => r.key === a.key)
    const bIdx = CONSTRUCTION_ROLES.findIndex((r) => r.key === b.key)
    if (aIdx === -1 && bIdx === -1) return getPositionLabel(a, locale).localeCompare(getPositionLabel(b, locale))
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })

  const hasPositions = sortedPositions.length > 0
  const hasHseOfficer = sortedPositions.some((p) => p.key === 'hse_officer')

  return (
    <div className="space-y-2">
      <Label>{label ?? messages.siteRole}</Label>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground h-11 px-3 border rounded-md bg-muted/30">
          <Loader2 className="h-4 w-4 animate-spin" />
          {messages.loadingPositions}
        </div>
      ) : (
        <Select
          value={value || undefined}
          onValueChange={onChange}
          disabled={!hasPositions || seeding}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder={messages.selectRole} />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="max-h-[320px]">
            {sortedPositions.map((position) => (
              <SelectItem key={position.id} value={position.id}>
                {getPositionLabel(position, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!loading && (!hasPositions || !hasHseOfficer) && onSeed ? (
        <div className="rounded-lg border border-dashed bg-amber-50/50 p-4 space-y-3">
          <p className="text-sm text-amber-900">
            {hasPositions
              ? 'نقش «مسئول ایمنی» در این پروژه تعریف نشده. نقش‌های پیش‌فرض را به‌روز کنید تا در لیست ظاهر شود.'
              : messages.noPositions}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => onSeed()} disabled={seeding}>
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {messages.seedingPositions}
              </>
            ) : (
              <>
                <Sprout className="h-4 w-4 mr-2" />
                {messages.seedPositions}
              </>
            )}
          </Button>
        </div>
      ) : null}

      {seedMessage ? (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-2 py-1.5">{seedMessage}</p>
      ) : null}
    </div>
  )
}
