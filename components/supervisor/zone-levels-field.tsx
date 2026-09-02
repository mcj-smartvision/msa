'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ZoneLevelsFieldProps = {
  levels: string[]
  onChange: (levels: string[]) => void
  idPrefix?: string
}

export function ZoneLevelsField({ levels, onChange, idPrefix = 'zone-level' }: ZoneLevelsFieldProps) {
  function updateLevel(index: number, value: string) {
    onChange(levels.map((level, i) => (i === index ? value : level)))
  }

  function addLevel() {
    onChange([...levels, ''])
  }

  function removeLevel(index: number) {
    if (levels.length <= 1) {
      onChange([''])
      return
    }
    onChange(levels.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2" dir="rtl" lang="fa">
      <Label className="text-sm font-medium text-slate-700">تراز زون</Label>
      <div className="space-y-2">
        {levels.map((level, index) => {
          const isLast = index === levels.length - 1
          const canRemove = levels.length > 1 || level.trim().length > 0

          return (
            <div key={`${idPrefix}-${index}`} className="flex flex-wrap items-center gap-2">
              <Input
                id={`${idPrefix}-${index}`}
                value={level}
                onChange={(e) => updateLevel(index, e.target.value)}
                placeholder="مثلاً 0.00 تا 3.0"
                className="h-10 w-[3cm] min-w-[3cm] max-w-[3cm] shrink-0 bg-white"
              />
              {isLast ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 shrink-0 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={addLevel}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  افزودن تراز
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="حذف این تراز"
                className="h-10 w-10 shrink-0 border-rose-200 bg-rose-50/80 text-rose-600 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300"
                onClick={() => removeLevel(index)}
                aria-label="حذف تراز"
                disabled={!canRemove}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function formatZoneLevels(levels?: string[]): string {
  const trimmed = (levels ?? []).map((l) => l.trim()).filter(Boolean)
  if (trimmed.length === 0) return '—'
  return trimmed.join('، ')
}
