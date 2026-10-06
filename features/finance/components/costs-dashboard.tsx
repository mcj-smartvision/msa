'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DollarSign, Loader2, Plus, Trash2 } from 'lucide-react'
import { PageHeader, LoadingBlock, ErrorBlock, SectionCard, EmptyState } from '@/features/admin/components/shared'
import { StatCard } from '@/features/admin/components/stat-card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { MoneyInput, parseMoneyInput } from '@/features/finance/components/money-input'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import {
FINANCIAL_COST_TYPES,
FINANCIAL_COST_TYPE_LABELS,
type FinancialCost,
type FinancialCostType,
} from '@/features/finance/lib/types'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import {
buildCostSummary,
createFinancialCost,
deleteFinancialCost,
fetchFinancialCosts,
} from '@/features/finance/services/costs'
import { cn } from '@/shared/lib/utils'

interface CostsDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  canEdit?: boolean
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function CostsDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  canEdit = false,
}: CostsDashboardProps) {
  const supabase = useSupabase()
  const projectId = useSyncedProjectId(initialProjectId)
  const [rows, setRows] = useState<FinancialCost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [filterType, setFilterType] = useState<FinancialCostType | 'all'>('all')
  const [filterItemCode, setFilterItemCode] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [formDate, setFormDate] = useState(todayInputValue())
  const [formType, setFormType] = useState<FinancialCostType>('materials')
  const [formItemCode, setFormItemCode] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formInvoiceRef, setFormInvoiceRef] = useState('')
  const [showForm, setShowForm] = useState(false)

  const loadData = useCallback(async () => {
    if (!projectId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFinancialCosts(supabase, projectId, {
        type: filterType,
        itemCode: filterItemCode,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      })
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری هزینه‌ها ناموفق بود')
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase, filterType, filterItemCode, filterDateFrom, filterDateTo])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const summary = useMemo(() => buildCostSummary(rows), [rows])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !canEdit) return
    const amount = parseMoneyInput(formAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('مبلغ باید بیشتر از صفر باشد.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createFinancialCost(supabase, {
        projectId,
        date: formDate,
        type: formType,
        itemCode: formItemCode,
        description: formDescription,
        amount,
        invoiceReference: formInvoiceRef,
        createdBy: initialContext.userId,
      })
      setFormAmount('')
      setFormDescription('')
      setFormItemCode('')
      setFormInvoiceRef('')
      setShowForm(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره هزینه ناموفق بود')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit || !confirm('این رکورد هزینه حذف شود؟')) return
    setError(null)
    try {
      await deleteFinancialCost(supabase, id)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف ناموفق بود')
    }
  }

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title="داشبورد هزینه‌ها"
        description="از ادمین بخواهید شما را به‌عنوان حسابدار پروژه روی یک پروژه منصوب کند."
      />
    )
  }

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-8">
      <PageHeader
        title="داشبورد هزینه‌ها"
        description="ثبت و بررسی هزینه‌های واقعی پروژه (AC) — مصالح، نیروی کار، تجهیزات، پیمانکاران، سربار."
      />

      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="جمع AC" value={formatMoney(summary.totalAc)} icon={DollarSign} />
        {FINANCIAL_COST_TYPES.map((type) => (
          <StatCard
            key={type}
            label={FINANCIAL_COST_TYPE_LABELS[type]}
            value={formatMoney(summary.byType[type])}
            icon={DollarSign}
          />
        ))}
      </div>

      <SectionCard
        title="فیلترها"
        action={
          canEdit ? (
            <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4 me-1" />
              {showForm ? 'بستن فرم' : 'افزودن هزینه'}
            </Button>
          ) : null
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4">
          <div className="space-y-2">
            <Label>نوع</Label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FinancialCostType | 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه انواع</SelectItem>
                {FINANCIAL_COST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FINANCIAL_COST_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>کد آیتم</Label>
            <Input
              value={filterItemCode}
              onChange={(e) => setFilterItemCode(e.target.value)}
              placeholder="مثلاً ELEV-01"
            />
          </div>
          <div className="space-y-2">
            <ScheduleDateInput
              label="از تاریخ"
              valueIso={filterDateFrom}
              onChangeIso={setFilterDateFrom}
            />
          </div>
          <div className="space-y-2">
            <ScheduleDateInput
              label="تا تاریخ"
              valueIso={filterDateTo}
              onChangeIso={setFilterDateTo}
            />
          </div>
        </div>

        {showForm && canEdit ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="border-t p-4 space-y-4 bg-muted/20">
            <p className="text-sm font-semibold">رکورد هزینه جدید</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <ScheduleDateInput
                  label="تاریخ"
                  valueIso={formDate}
                  onChangeIso={setFormDate}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>نوع</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as FinancialCostType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCIAL_COST_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FINANCIAL_COST_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>مبلغ</Label>
                <MoneyInput value={formAmount} onChange={setFormAmount} required />
              </div>
              <div className="space-y-2">
                <Label>کد آیتم</Label>
                <Input value={formItemCode} onChange={(e) => setFormItemCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>شماره فاکتور</Label>
                <Input value={formInvoiceRef} onChange={(e) => setFormInvoiceRef(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>شرح</Label>
              <Textarea rows={2} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              ذخیره هزینه
            </Button>
          </form>
        ) : null}
      </SectionCard>

      <SectionCard title="آخرین رکوردهای هزینه">
        {loading ? (
          <LoadingBlock label="در حال بارگذاری هزینه‌ها…" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">هنوز رکورد هزینه‌ای ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-start">
                  <th className="py-2 px-3">تاریخ</th>
                  <th className="py-2 px-3">نوع</th>
                  <th className="py-2 px-3">آیتم</th>
                  <th className="py-2 px-3 text-end">مبلغ</th>
                  <th className="py-2 px-3">شرح</th>
                  <th className="py-2 px-3">فاکتور</th>
                  {canEdit ? <th className="py-2 px-3 w-12" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <FormattedDate value={row.date} />
                    </td>
                    <td className="py-2.5 px-3">{FINANCIAL_COST_TYPE_LABELS[row.type]}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{row.item_code ?? '—'}</td>
                    <td className="py-2.5 px-3 text-end font-medium tabular-nums">
                      {formatMoney(Number(row.amount))}
                    </td>
                    <td className={cn('py-2.5 px-3 max-w-[240px] truncate', !row.description && 'text-muted-foreground')}>
                      {row.description || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{row.invoice_reference ?? '—'}</td>
                    {canEdit ? (
                      <td className="py-2.5 px-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="حذف"
                          onClick={() => void handleDelete(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
