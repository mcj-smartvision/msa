'use client'

import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type ZoneInfoFormValues = {
  name: string
  code: string
  supervisor: string
  contractor: string
  description: string
}

type ZoneInfoFormProps = {
  values: ZoneInfoFormValues
  onChange: (patch: Partial<ZoneInfoFormValues>) => void
  supervisorOptions?: string[]
  contractorOptions?: string[]
  optionalOpen?: boolean
  onOptionalOpenChange?: (open: boolean) => void
  className?: string
}

export function ZoneInfoForm({
  values,
  onChange,
  supervisorOptions = [],
  contractorOptions = [],
  optionalOpen = true,
  onOptionalOpenChange,
  className,
}: ZoneInfoFormProps) {
  return (
    <div className={cn('space-y-4', className)} dir="rtl" lang="fa">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="zone-name" className="text-sm font-medium text-slate-700">
            نام زون
          </Label>
          <Input
            id="zone-name"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-10 bg-white"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-code" className="text-sm font-medium text-slate-700">
            کد زون
          </Label>
          <Input
            id="zone-code"
            value={values.code}
            onChange={(e) => onChange({ code: e.target.value })}
            className="h-10 bg-white font-mono"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => onOptionalOpenChange?.(!optionalOpen)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50/60"
          aria-expanded={optionalOpen}
        >
          <span>اطلاعات تکمیلی (اختیاری)</span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', optionalOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {optionalOpen ? (
          <div className="space-y-3 border-t border-slate-100 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="zone-supervisor" className="text-sm font-medium text-slate-700">
                  مسئول زون
                </Label>
                {supervisorOptions.length > 0 ? (
                  <Select
                    value={values.supervisor || undefined}
                    onValueChange={(v) => onChange({ supervisor: v })}
                  >
                    <SelectTrigger id="zone-supervisor" className="h-10 bg-white">
                      <SelectValue placeholder="انتخاب مسئول زون" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisorOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="zone-supervisor"
                    value={values.supervisor}
                    onChange={(e) => onChange({ supervisor: e.target.value })}
                    className="h-10 bg-white"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-contractor" className="text-sm font-medium text-slate-700">
                  پیمانکار مسئول
                </Label>
                {contractorOptions.length > 0 ? (
                  <Select
                    value={values.contractor || undefined}
                    onValueChange={(v) => onChange({ contractor: v })}
                  >
                    <SelectTrigger id="zone-contractor" className="h-10 bg-white">
                      <SelectValue placeholder="انتخاب پیمانکار" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractorOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="zone-contractor"
                    value={values.contractor}
                    onChange={(e) => onChange({ contractor: e.target.value })}
                    className="h-10 bg-white"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zone-description" className="text-sm font-medium text-slate-700">
                توضیحات
              </Label>
              <Textarea
                id="zone-description"
                value={values.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="توضیح کوتاه درباره این زون"
                rows={3}
                className="min-h-[88px] resize-y bg-white text-sm"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
