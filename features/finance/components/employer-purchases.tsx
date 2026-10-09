'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { JalaliDatePicker } from '@/features/holidays/components/jalali-date-picker'
import {
  equalShares,
  purchaseCostByTask,
  type EmployerPurchase,
  type PurchaseTaskOption,
} from '@/features/finance/lib/employer-purchases'
import { formatJalaliShort } from '@/shared/lib/time/jalali-month'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { cn } from '@/shared/lib/utils'

type ShareRow = { taskId: string; share: string }

type FormState = {
  purchaseDate: string
  itemName: string
  supplier: string
  quantity: string
  unit: string
  unitPrice: string
  amount: string
  invoiceRef: string
  description: string
  shares: ShareRow[]
}

const emptyForm = (): FormState => ({
  purchaseDate: todayTehranIso(),
  itemName: '',
  supplier: '',
  quantity: '',
  unit: '',
  unitPrice: '',
  amount: '',
  invoiceRef: '',
  description: '',
  shares: [{ taskId: '', share: '100' }],
})

const toNumber = (raw: string): number | null => {
  const t = raw.trim().replace(/,/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const toman = (n: number) => Math.round(n).toLocaleString('en-US')

/** Keeps digits, one dot and the thousands commas while typing an amount. */
const groupDigits = (raw: string) => {
  const t = raw.replace(/[^\d.]/g, '')
  const [int = '', ...rest] = t.split('.')
  const grouped = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return rest.length ? `${grouped}.${rest.join('')}` : grouped
}

const taskLabel = (t: { wbs: string | null; name: string }) => (t.wbs ? `${t.wbs} · ${t.name}` : t.name)

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error || 'خطا در ذخیره')
}

/** Employer purchases: each purchase is shared among one or more schedule activities by percent. */
export function EmployerPurchases({ projectId }: { projectId: string | null }) {
  const [purchases, setPurchases] = useState<EmployerPurchase[]>([])
  const [tasks, setTasks] = useState<PurchaseTaskOption[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    const res = await fetch(`/api/finance/employer-purchases?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
    const json = (await res.json().catch(() => ({}))) as { purchases?: EmployerPurchase[]; tasks?: PurchaseTaskOption[]; error?: string }
    if (!res.ok) throw new Error(json.error || 'بارگذاری خریدها ناموفق بود')
    setPurchases(json.purchases ?? [])
    setTasks(json.tasks ?? [])
  }, [projectId])

  useEffect(() => {
    setPurchases([])
    setTasks([])
    setForm(emptyForm())
    setEditingId(null)
    if (!projectId) return
    setLoading(true)
    setError(null)
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
      .finally(() => setLoading(false))
  }, [projectId, load])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const computedAmount = useMemo(() => {
    const q = toNumber(form.quantity)
    const p = toNumber(form.unitPrice)
    return q != null && p != null ? Math.round(q * p) : null
  }, [form.quantity, form.unitPrice])
  const amount = toNumber(form.amount) ?? computedAmount ?? 0

  const single = form.shares.length === 1
  const shareTotal = single ? 100 : form.shares.reduce((s, r) => s + (toNumber(r.share) ?? 0), 0)
  const sharesValid = Math.abs(shareTotal - 100) <= 0.01
  const chosen = new Set(form.shares.map((r) => r.taskId).filter(Boolean))

  const editShares = (edit: (rows: ShareRow[]) => ShareRow[]) =>
    setForm((f) => {
      const rows = edit(f.shares)
      return { ...f, shares: rows.length === 1 ? [{ ...rows[0]!, share: '100' }] : rows }
    })
  const withEqualShares = (rows: ShareRow[]) => {
    const shares = equalShares(rows.length)
    return rows.map((r, i) => ({ ...r, share: String(shares[i]) }))
  }
  const updateShare = (index: number, patch: Partial<ShareRow>) =>
    editShares((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  const addShareRow = () => editShares((rows) => withEqualShares([...rows, { taskId: '', share: '' }]))
  const splitEqually = () => editShares(withEqualShares)

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا')
    } finally {
      setBusy(null)
    }
  }

  const submit = () =>
    run('form', async () => {
      const body = {
        projectId,
        purchaseDate: form.purchaseDate,
        itemName: form.itemName,
        supplier: form.supplier,
        quantity: toNumber(form.quantity),
        unit: form.unit,
        unitPrice: toNumber(form.unitPrice),
        amount: toNumber(form.amount) ?? computedAmount,
        invoiceRef: form.invoiceRef,
        description: form.description,
        allocations: form.shares.map((r) => ({ taskId: r.taskId, sharePercent: single ? 100 : toNumber(r.share) })),
      }
      await send(editingId ? `/api/finance/employer-purchases/${editingId}` : '/api/finance/employer-purchases', editingId ? 'PATCH' : 'POST', body)
      resetForm()
    })

  const startEdit = (p: EmployerPurchase) => {
    const shares = p.allocations.filter((a) => a.taskId).map((a) => ({ taskId: a.taskId!, share: String(a.sharePercent) }))
    setEditingId(p.id)
    setError(null)
    setForm({
      purchaseDate: p.purchaseDate,
      itemName: p.itemName,
      supplier: p.supplier ?? '',
      quantity: p.quantity == null ? '' : String(p.quantity),
      unit: p.unit ?? '',
      unitPrice: p.unitPrice == null ? '' : groupDigits(String(p.unitPrice)),
      amount: groupDigits(String(p.amount)),
      invoiceRef: p.invoiceRef ?? '',
      description: p.description ?? '',
      shares: shares.length > 0 ? shares : [{ taskId: '', share: '100' }],
    })
  }

  const byTask = useMemo(
    () => [...purchaseCostByTask(purchases).values()].sort((a, b) => b.amount - a.amount),
    [purchases]
  )
  const grandTotal = purchases.reduce((s, p) => s + p.amount, 0)

  if (!projectId) return <p className="text-sm text-muted-foreground">ابتدا یک پروژه انتخاب کنید.</p>

  const canSubmit = !!form.purchaseDate && !!form.itemName.trim() && amount > 0 && form.shares.every((r) => r.taskId) && sharesValid

  return (
    <div className="space-y-4" dir="rtl">
      <p className="text-xs leading-relaxed text-slate-600">
        هر خرید کارفرمایی به یک یا چند آیتم برنامهٔ زمان‌بندی تخصیص داده می‌شود. اگر فقط یک آیتم باشد سهمش 100٪ است؛ با چند آیتم، سهم
        هر کدام را به درصد بنویسید (جمع باید 100٪ شود). همهٔ مبالغ به تومان است.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{editingId ? 'ویرایش خرید کارفرمایی' : 'ثبت خرید کارفرمایی'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) void submit()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="ep-date">تاریخ خرید</Label>
                <JalaliDatePicker id="ep-date" value={form.purchaseDate} onChange={(iso) => set('purchaseDate', iso)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-item">نام کالا</Label>
                <Input id="ep-item" className="h-9" value={form.itemName} onChange={(e) => set('itemName', e.target.value)} placeholder="مثلاً میلگرد 16" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-supplier">فروشنده</Label>
                <Input id="ep-supplier" className="h-9" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-invoice">شماره فاکتور</Label>
                <Input id="ep-invoice" className="h-9" value={form.invoiceRef} onChange={(e) => set('invoiceRef', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-qty">مقدار</Label>
                <Input id="ep-qty" dir="ltr" inputMode="decimal" className="h-9" value={form.quantity} onChange={(e) => set('quantity', e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-unit">واحد</Label>
                <Input id="ep-unit" className="h-9" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="مثلاً تن" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-price">قیمت واحد (تومان)</Label>
                <Input id="ep-price" dir="ltr" inputMode="decimal" className="h-9" value={form.unitPrice} onChange={(e) => set('unitPrice', groupDigits(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-amount">مبلغ کل (تومان)</Label>
                <Input
                  id="ep-amount"
                  dir="ltr"
                  inputMode="decimal"
                  className="h-9"
                  value={form.amount}
                  onChange={(e) => set('amount', groupDigits(e.target.value))}
                  placeholder={computedAmount != null ? toman(computedAmount) : ''}
                />
                {computedAmount != null && !form.amount ? <p className="text-[11px] text-slate-500">مقدار × قیمت واحد</p> : null}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">تخصیص به آیتم‌های برنامه</span>
                <div className="flex gap-2">
                  {!single ? (
                    <Button type="button" size="sm" variant="outline" onClick={splitEqually}>
                      تقسیم مساوی
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={addShareRow} disabled={form.shares.length >= tasks.length}>
                    <Plus className="h-4 w-4" aria-hidden />
                    آیتم دیگر
                  </Button>
                </div>
              </div>
              {form.shares.map((row, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`آیتم برنامه ${index + 1}`}
                    value={row.taskId}
                    onChange={(e) => updateShare(index, { taskId: e.target.value })}
                    className="h-9 min-w-[260px] flex-1 rounded-md border border-input bg-white px-2 text-sm"
                  >
                    <option value="">— انتخاب آیتم برنامه —</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id} disabled={chosen.has(t.id) && t.id !== row.taskId}>
                        {taskLabel(t)}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <Input
                      dir="ltr"
                      inputMode="decimal"
                      aria-label={`سهم آیتم ${index + 1} (درصد)`}
                      className="h-9 w-20 text-center"
                      value={single ? '100' : row.share}
                      disabled={single}
                      onChange={(e) => updateShare(index, { share: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                    <span className="text-sm text-slate-500">٪</span>
                  </div>
                  <span className="w-32 text-start text-xs tabular-nums text-slate-600" dir="ltr">
                    {toman((amount * (single ? 100 : toNumber(row.share) ?? 0)) / 100)}
                  </span>
                  {!single ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label="حذف آیتم"
                      onClick={() => editShares((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              <p className={cn('text-xs font-medium', sharesValid ? 'text-emerald-700' : 'text-red-600')}>
                جمع سهم‌ها: {Math.round(shareTotal * 100) / 100}٪{sharesValid ? '' : ' — باید 100٪ شود'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ep-description">توضیحات</Label>
              <Textarea id="ep-description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy === 'form' || !canSubmit}>
                {busy === 'form' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {editingId ? 'ذخیرهٔ تغییرات' : 'ثبت خرید'}
              </Button>
              {editingId ? (
                <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                  انصراف
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">خریدهای ثبت‌شده</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="بارگذاری" />
          ) : purchases.length === 0 ? (
            <p className="text-sm text-slate-500">هنوز خرید کارفرمایی ثبت نشده است.</p>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">تاریخ</th>
                  <th className="py-2 text-start font-medium">کالا</th>
                  <th className="py-2 text-start font-medium">فروشنده</th>
                  <th className="py-2 text-start font-medium">مقدار</th>
                  <th className="py-2 text-start font-medium">مبلغ (تومان)</th>
                  <th className="py-2 text-start font-medium">تخصیص</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap py-2">{formatJalaliShort(p.purchaseDate)}</td>
                    <td className="py-2 font-medium" title={p.description ?? undefined}>
                      {p.itemName}
                      {p.invoiceRef ? <span className="block text-[11px] font-normal text-slate-500">فاکتور {p.invoiceRef}</span> : null}
                    </td>
                    <td className="py-2">{p.supplier ?? '—'}</td>
                    <td className="whitespace-nowrap py-2">
                      {p.quantity != null ? `${p.quantity.toLocaleString('en-US')} ${p.unit ?? ''}` : '—'}
                      {p.unitPrice != null ? <span className="block text-[11px] text-slate-500">× {toman(p.unitPrice)}</span> : null}
                    </td>
                    <td className="whitespace-nowrap py-2 font-semibold tabular-nums">{toman(p.amount)}</td>
                    <td className="py-2">
                      <ul className="space-y-0.5 text-xs">
                        {p.allocations.map((a, i) => (
                          <li key={i} className={cn(!a.taskId && 'text-red-600')} title={a.taskId ? undefined : 'این آیتم از برنامه حذف شده است'}>
                            {taskLabel({ wbs: a.taskWbs, name: a.taskName })} — {a.sharePercent}٪
                            <span className="text-slate-500"> ({toman((p.amount * a.sharePercent) / 100)})</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(p)} aria-label="ویرایش">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={busy === `delete:${p.id}`}
                          aria-label="حذف"
                          onClick={() => {
                            if (!window.confirm(`خرید «${p.itemName}» حذف شود؟`)) return
                            void run(`delete:${p.id}`, async () => {
                              await send(`/api/finance/employer-purchases/${p.id}?projectId=${encodeURIComponent(projectId)}`, 'DELETE')
                              if (editingId === p.id) resetForm()
                            })
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2" colSpan={4}>
                    جمع خریدها
                  </td>
                  <td className="py-2 tabular-nums">{toman(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {byTask.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">سهم هر آیتم برنامه از خریدهای کارفرمایی</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 text-start font-medium">آیتم برنامه</th>
                  <th className="py-2 text-start font-medium">مبلغ (تومان)</th>
                  <th className="py-2 text-start font-medium">سهم از کل</th>
                </tr>
              </thead>
              <tbody>
                {byTask.map((row) => (
                  <tr key={`${row.wbs}:${row.name}`} className="border-b last:border-0">
                    <td className="py-2">{taskLabel(row)}</td>
                    <td className="py-2 tabular-nums">{toman(row.amount)}</td>
                    <td className="py-2 tabular-nums">{grandTotal > 0 ? `${Math.round((row.amount / grandTotal) * 1000) / 10}٪` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
