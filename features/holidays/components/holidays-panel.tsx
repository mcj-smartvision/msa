'use client'

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { JalaliDatePicker } from '@/features/holidays/components/jalali-date-picker'
import { useHolidays } from '@/features/holidays/hooks/use-holidays'
import { HOLIDAY_TYPE_LABELS, type Holiday, type HolidayInput, type HolidayType } from '@/features/holidays/lib/types'
import { persianWeekday } from '@/features/holidays/lib/work-calendar'
import { formatJalaliShort, PERSIAN_WEEKDAYS, toPersianDigits } from '@/shared/lib/time/jalali-month'
import { cn } from '@/shared/lib/utils'

const EMPTY: HolidayInput = { type: 'official', startDate: '', endDate: null, title: '', description: null, isActive: true }

const dayCount = (h: Pick<Holiday, 'startDate' | 'endDate'>) =>
  h.endDate ? Math.round((Date.parse(`${h.endDate}T00:00:00Z`) - Date.parse(`${h.startDate}T00:00:00Z`)) / 86_400_000) + 1 : 1

function whenLabel(h: Holiday): string {
  if (h.type === 'weekly') {
    const day = PERSIAN_WEEKDAYS[persianWeekday(h.startDate)]
    return `هر ${day} از ${formatJalaliShort(h.startDate)}${h.endDate ? ` تا ${formatJalaliShort(h.endDate)}` : ''}`
  }
  if (!h.endDate || h.endDate === h.startDate) return formatJalaliShort(h.startDate)
  return `${formatJalaliShort(h.startDate)} تا ${formatJalaliShort(h.endDate)} (${toPersianDigits(dayCount(h))} روز)`
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error || 'خطا در ذخیره')
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
      setError(err instanceof Error ? err.message : 'خطا')
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

  return (
    <div className="space-y-4" dir="rtl">
      <p className="text-sm text-slate-600">
        جمعه همیشه تعطیل است. تعطیلی‌هایی که اینجا ثبت می‌شوند در تقویم بالای صفحه قرمز دیده می‌شوند و در پیش‌بینی برنامه و
        درصدهای اجباری گزارش روزانه روز کاری حساب نمی‌شوند. این فهرست برای همهٔ پروژه‌ها یکی است.
      </p>

      {canManage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? 'ویرایش تعطیلی' : 'ثبت تعطیلی'}</CardTitle>
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
                <Label htmlFor="holiday-type">نوع تعطیلی</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as HolidayType)}>
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
                <Label htmlFor="holiday-start">{weekly ? 'از تاریخ (روز هفتهٔ آن تکرار می‌شود)' : 'تاریخ'}</Label>
                <JalaliDatePicker id="holiday-start" value={form.startDate} onChange={(iso) => set('startDate', iso)} holidays={holidays} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holiday-end">{weekly ? 'تا تاریخ (اختیاری)' : 'تاریخ پایان (برای چندروزه)'}</Label>
                <JalaliDatePicker
                  id="holiday-end"
                  value={form.endDate ?? ''}
                  onChange={(iso) => set('endDate', iso || null)}
                  holidays={holidays}
                  placeholder={weekly ? 'بدون پایان' : 'یک‌روزه'}
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holiday-title">عنوان / مناسبت</Label>
                <Input id="holiday-title" className="h-9" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً نوروز" />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="holiday-description">توضیحات</Label>
                <Textarea
                  id="holiday-description"
                  rows={2}
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value || null)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" size="sm" disabled={busy === 'form' || !form.startDate || !form.title.trim()}>
                  {busy === 'form' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {editingId ? 'ذخیرهٔ تغییرات' : 'ثبت تعطیلی'}
                </Button>
                {editingId ? (
                  <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                    انصراف
                  </Button>
                ) : null}
              </div>
            </form>
            {busy === 'form' ? <p className="mt-2 text-xs text-slate-500">ذخیره و به‌روزرسانی پیش‌بینی برنامهٔ پروژه‌ها…</p> : null}
          </CardContent>
        </Card>
      ) : loaded ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          ثبت و ویرایش تعطیلات فقط برای ادمین و مدیر پروژه مجاز است.
        </p>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">تعطیلات ثبت‌شده</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!loaded ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="بارگذاری" />
          ) : sorted.length === 0 ? (
            <p className="text-sm text-slate-500">هنوز تعطیلی ثبت نشده است.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">عنوان</th>
                  <th className="py-2 text-start font-medium">نوع</th>
                  <th className="py-2 text-start font-medium">تاریخ</th>
                  <th className="py-2 text-start font-medium">توضیحات</th>
                  <th className="py-2 text-start font-medium">وضعیت</th>
                  {canManage ? <th className="py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {sorted.map((h) => (
                  <tr key={h.id} className={cn('border-b last:border-0', !h.isActive && 'text-slate-400')}>
                    <td className="py-2 font-medium">{h.title}</td>
                    <td className="py-2">{HOLIDAY_TYPE_LABELS[h.type]}</td>
                    <td className="py-2">{whenLabel(h)}</td>
                    <td className="max-w-[220px] truncate py-2" title={h.description ?? undefined}>
                      {h.description ?? '—'}
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
                          {busy === `toggle:${h.id}` ? '…' : h.isActive ? 'فعال' : 'غیرفعال'}
                        </button>
                      ) : h.isActive ? (
                        'فعال'
                      ) : (
                        'غیرفعال'
                      )}
                    </td>
                    {canManage ? (
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(h)} aria-label="ویرایش">
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            disabled={busy === `delete:${h.id}`}
                            aria-label="حذف"
                            onClick={() => {
                              if (!window.confirm(`تعطیلی «${h.title}» حذف شود؟`)) return
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
