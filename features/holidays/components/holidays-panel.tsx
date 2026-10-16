/**
 * @file features/holidays/components/holidays-panel.tsx
 * @purpose کامپوننت UI — تقویم تعطیلات (holidays-panel)
 * @safe-to-edit CAREFUL
 * @affects تقویم تعطیلات
 * @depends-on shared/components/ui/button, shared/components/ui/card, shared/components/ui/input, shared/components/ui/label, shared/components/ui/textarea, shared/components/ui/select, shared/components/ui/skeleton, features/holidays/components/jalali-date-picker, features/holidays/hooks/use-holidays, features/holidays/lib/holiday-form
 */

'use client'

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { JalaliDatePicker } from '@/features/holidays/components/jalali-date-picker'
import { useHolidays } from '@/features/holidays/hooks/use-holidays'
import { END_BEFORE_START_ERROR, isEndBeforeStart, withDefaultEnd } from '@/features/holidays/lib/holiday-form'
import { HOLIDAY_TYPE_LABELS, type Holiday, type HolidayInput, type HolidayType } from '@/features/holidays/lib/types'
import { persianWeekday } from '@/features/holidays/lib/work-calendar'
import { formatJalaliShort, PERSIAN_WEEKDAYS, latinDigits } from '@/shared/lib/time/jalali-month'
import { cn } from '@/shared/lib/utils'
import { HOLIDAYS_COPY as H } from '@/features/holidays/config'

const EMPTY: HolidayInput = { type: 'official', startDate: '', endDate: null, title: '', description: null, isActive: true }

const dayCount = (h: Pick<Holiday, 'startDate' | 'endDate'>) =>
  h.endDate ? Math.round((Date.parse(`${h.endDate}T00:00:00Z`) - Date.parse(`${h.startDate}T00:00:00Z`)) / 86_400_000) + 1 : 1

function whenLabel(h: Holiday): string {
  if (h.type === 'weekly') {
    const day = PERSIAN_WEEKDAYS[persianWeekday(h.startDate)]
    return H.weeklyRange(day, formatJalaliShort(h.startDate), h.endDate ? formatJalaliShort(h.endDate) : undefined)
  }
  if (!h.endDate || h.endDate === h.startDate) return formatJalaliShort(h.startDate)
  return H.rangeDays(formatJalaliShort(h.startDate), formatJalaliShort(h.endDate), latinDigits(dayCount(h)))
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error || H.saveFailed)
}

/** Organization holidays: everyone sees them; admins and project managers add, edit, switch off and delete. */
export function HolidaysPanel() {
  const { holidays, canManage, loaded, reload } = useHolidays()
  const [form, setForm] = useState<HolidayInput>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(() => [...holidays].sort((a, b) => a.startDate.localeCompare(b.startDate)), [holidays])
  const set = <K extends keyof HolidayInput>(key: K, value: HolidayInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : H.error)
    } finally {
      setBusy(null)
    }
  }

  const resetForm = () => {
    setForm(EMPTY)
    setEditingId(null)
  }

  const submit = () =>
    run('form', async () => {
      await send(editingId ? `/api/holidays/${editingId}` : '/api/holidays', editingId ? 'PATCH' : 'POST', form)
      resetForm()
    })

  const startEdit = (h: Holiday) => {
    setEditingId(h.id)
    setForm({ type: h.type, startDate: h.startDate, endDate: h.endDate, title: h.title, description: h.description, isActive: h.isActive })
    setError(null)
  }

  const weekly = form.type === 'weekly'
  const endBeforeStart = isEndBeforeStart(form)

  return (
    <div className="space-y-4" dir="rtl">
      <p className="text-sm text-slate-600">
        {H.intro}
      </p>

      {canManage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? H.editTitle : H.createTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="holiday-type">{H.typeLabel}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => withDefaultEnd({ ...f, type: v as HolidayType }))}>
                  <SelectTrigger id="holiday-type" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(HOLIDAY_TYPE_LABELS) as HolidayType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {HOLIDAY_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holiday-start">{weekly ? H.startWeekly : H.startDate}</Label>
                <JalaliDatePicker
                  id="holiday-start"
                  value={form.startDate}
                  onChange={(iso) => setForm((f) => withDefaultEnd({ ...f, startDate: iso }))}
                  holidays={holidays}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holiday-end">{weekly ? H.endWeekly : H.endMulti}</Label>
                <JalaliDatePicker
                  id="holiday-end"
                  value={form.endDate ?? ''}
                  onChange={(iso) => set('endDate', iso || null)}
                  holidays={holidays}
                  placeholder={weekly ? H.noEnd : H.oneDay}
                  min={form.startDate || undefined}
                  clearable
                />
                {endBeforeStart ? (
                  <p className="text-xs text-red-600" role="alert">
                    {END_BEFORE_START_ERROR}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holiday-title">{H.titleLabel}</Label>
                <Input id="holiday-title" className="h-9" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={H.titlePlaceholder} />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="holiday-description">{H.descriptionLabel}</Label>
                <Textarea
                  id="holiday-description"
                  rows={2}
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value || null)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" size="sm" disabled={busy === 'form' || !form.startDate || !form.title.trim() || endBeforeStart}>
                  {busy === 'form' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {editingId ? H.saveChanges : H.create}
                </Button>
                {editingId ? (
                  <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                    {H.cancel}
                  </Button>
                ) : null}
              </div>
            </form>
            {busy === 'form' ? <p className="mt-2 text-xs text-slate-500">{H.savingHint}</p> : null}
          </CardContent>
        </Card>
      ) : loaded ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {H.manageOnly}
        </p>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{H.listTitle}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!loaded ? (
            <div className="space-y-2" role="status" aria-label={H.loadingAria}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-slate-500">{H.empty}</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">{H.colTitle}</th>
                  <th className="py-2 text-start font-medium">{H.colType}</th>
                  <th className="py-2 text-start font-medium">{H.colDate}</th>
                  <th className="py-2 text-start font-medium">{H.colDescription}</th>
                  <th className="py-2 text-start font-medium">{H.colStatus}</th>
                  {canManage ? <th className="py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => (
                  <tr key={h.id} className={cn('border-b last:border-0', !h.isActive && 'text-slate-400')}>
                    <td className="py-2 font-medium">{h.title.trim() || H.dash}</td>
                    <td className="py-2">{HOLIDAY_TYPE_LABELS[h.type]}</td>
                    <td className="py-2">{whenLabel(h)}</td>
                    <td className="max-w-[220px] truncate py-2" title={h.description ?? undefined}>
                      {h.description ?? H.dash}
                    </td>
                    <td className="py-2">
                      {canManage ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={h.isActive}
                          disabled={busy === `toggle:${h.id}`}
                          onClick={() => run(`toggle:${h.id}`, () => send(`/api/holidays/${h.id}`, 'PATCH', { isActive: !h.isActive }))}
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium',
                            h.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          )}
                        >
                          {busy === `toggle:${h.id}` ? H.ellipsis : h.isActive ? H.active : H.inactive}
                        </button>
                      ) : h.isActive ? H.active : H.inactive}
                    </td>
                    {canManage ? (
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(h)} title={H.edit} aria-label={H.edit}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            disabled={busy === `delete:${h.id}`}
                            title={H.delete}
                            aria-label={H.delete}
                            onClick={() => {
                              if (!window.confirm(H.confirmDelete(h.title))) return
                              void run(`delete:${h.id}`, async () => {
                                await send(`/api/holidays/${h.id}`, 'DELETE')
                                if (editingId === h.id) resetForm()
                              })
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
