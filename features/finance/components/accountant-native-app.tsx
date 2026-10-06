'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
AlertTriangle,
Banknote,
CircleDollarSign,
DollarSign,
FileText,
LayoutDashboard,
Loader2,
Plus,
Receipt,
TrendingDown,
Wallet,
Warehouse,
} from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { EmptyState, ErrorBlock, LoadingBlock } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { ModalOverlay } from '@/shared/components/common/modal-overlay'
import { MoneyInput, parseMoneyInput, formatMoneyFromNumber } from '@/features/finance/components/money-input'
import { ExpenseManagement } from '@/features/finance/components/expense-management'
import { ContractorPayables } from '@/features/finance/components/contractor-payables'
import { formatRial } from '@/features/finance/lib/format-currency'
import {
FINANCIAL_INVOICE_STATUSES,
type FinancialInvoiceRow,
type FinancialInvoiceStatus,
type VendorBillRow,
} from '@/features/finance/lib/invoice-types'
import {
getAccountantMessages,
getInvoiceStatusLabel,
getVendorStatusLabel,
} from '@/shared/lib/i18n/accountant'
import { writeProjectCookie } from '@/shared/lib/project/project-cookie'
import { cn } from '@/shared/lib/utils'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import { useSupabase } from '@/shared/hooks/use-supabase'
import {
buildFinancialAlerts,
buildInvoiceKpis,
createFinancialInvoice,
fetchFinancialInvoices,
isInvoiceOverdue,
recordInvoicePayment,
updateInvoiceFinancial,
} from '@/features/finance/services/invoices'
import { fetchStockValuation } from '@/features/finance/services/stock-valuation'
import { buildCostSummary, fetchFinancialCosts } from '@/features/finance/services/costs'
import {
FINANCIAL_COST_TYPES,
FINANCIAL_COST_TYPE_LABELS,
type FinancialCost,
} from '@/features/finance/lib/types'
import { fetchVendorBills, buildVendorBillKpis, getUnpaidVendorBills } from '@/features/finance/services/vendor-bills'
import { NativeAppBootstrap } from '@/features/finance/components/native-app-bootstrap'
import { BrandLogo } from '@/shared/components/brand/brand-logo'

type TabId = 'home' | 'invoices' | 'expenses' | 'payables'

interface AccountantNativeAppProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  canEdit?: boolean
}

function StatusPill({
  invoice,
  locale,
}: {
  invoice: FinancialInvoiceRow
  locale: ReturnType<typeof useLocale>['locale']
}) {
  const t = getAccountantMessages(locale)
  const overdue = isInvoiceOverdue(invoice)
  const label = overdue ? t.delayed : getInvoiceStatusLabel(invoice.status, locale)
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
        overdue
          ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/30'
          : invoice.status === 'paid'
            ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30'
            : 'bg-white/10 text-white/90 ring-1 ring-white/15'
      )}
    >
      {label}
    </span>
  )
}

export function AccountantNativeApp({
  initialContext,
  projectOptions,
  initialProjectId,
  canEdit = false,
}: AccountantNativeAppProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getAccountantMessages(locale)
  const isFa = locale === 'fa' || locale === 'ar'

  const [tab, setTab] = useState<TabId>('home')
  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [invoices, setInvoices] = useState<FinancialInvoiceRow[]>([])
  const [costs, setCosts] = useState<FinancialCost[]>([])
  const [vendorBills, setVendorBills] = useState<VendorBillRow[]>([])
  const [stockValuation, setStockValuation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showNewInvoice, setShowNewInvoice] = useState(false)
  const [editInvoice, setEditInvoice] = useState<FinancialInvoiceRow | null>(null)
  const [paymentInvoice, setPaymentInvoice] = useState<FinancialInvoiceRow | null>(null)
  const [formInvoiceNo, setFormInvoiceNo] = useState('')
  const [formPeriodStart, setFormPeriodStart] = useState('')
  const [formPeriodEnd, setFormPeriodEnd] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState<FinancialInvoiceStatus>('draft')
  const [editStatus, setEditStatus] = useState<FinancialInvoiceStatus>('draft')
  const [editApproved, setEditApproved] = useState('')
  const [editPaid, setEditPaid] = useState('')
  const [editRetention, setEditRetention] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')

  useEffect(() => {
    setProjectId(initialProjectId)
  }, [initialProjectId])

  const loadData = useCallback(async () => {
    if (!projectId) {
      setInvoices([])
      setCosts([])
      setVendorBills([])
      setStockValuation(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextInvoices, nextCosts, nextBills, nextStock] = await Promise.all([
        fetchFinancialInvoices(supabase, projectId),
        fetchFinancialCosts(supabase, projectId),
        fetchVendorBills(supabase, projectId),
        fetchStockValuation(supabase, projectId),
      ])
      setInvoices(nextInvoices)
      setCosts(nextCosts)
      setVendorBills(nextBills)
      setStockValuation(nextStock)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase, t.loadError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  const invoiceKpis = useMemo(() => buildInvoiceKpis(invoices), [invoices])
  const costSummary = useMemo(() => buildCostSummary(costs), [costs])
  const vendorKpis = useMemo(() => buildVendorBillKpis(vendorBills), [vendorBills])
  const unpaidBills = useMemo(() => getUnpaidVendorBills(vendorBills), [vendorBills])
  const alerts = useMemo(
    () => buildFinancialAlerts(invoices, vendorKpis.overdueCount, isFa ? 'fa' : 'en'),
    [invoices, vendorKpis.overdueCount, isFa]
  )
  const totalApproved = useMemo(
    () => invoices.reduce((sum, inv) => sum + (inv.approved_amount || 0), 0),
    [invoices]
  )
  const cashGap = costSummary.totalAc - invoiceKpis.totalPaid
  const money = (n: number) => formatRial(n, locale)

  function handleProjectChange(id: string) {
    setProjectId(id)
    writeProjectCookie(id)
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !canEdit) return
    const amount = parseMoneyInput(formAmount)
    if (!formInvoiceNo.trim() || !formPeriodStart || !formPeriodEnd || !Number.isFinite(amount) || amount <= 0) {
      setError(t.saveError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createFinancialInvoice(supabase, {
        projectId,
        invoiceNo: formInvoiceNo,
        periodStart: formPeriodStart,
        periodEnd: formPeriodEnd,
        amount,
        status: formStatus,
        invoiceDate: formPeriodEnd,
        createdBy: initialContext.userId,
      })
      setShowNewInvoice(false)
      setFormInvoiceNo('')
      setFormPeriodStart('')
      setFormPeriodEnd('')
      setFormAmount('')
      setFormStatus('draft')
      setSuccessMessage(t.successSaved)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleEditFinancial(e: React.FormEvent) {
    e.preventDefault()
    if (!editInvoice || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      const approved = parseMoneyInput(editApproved)
      const paid = parseMoneyInput(editPaid)
      const retention = parseMoneyInput(editRetention)
      await updateInvoiceFinancial(supabase, {
        id: editInvoice.id,
        status: editStatus,
        approvedAmount: Number.isFinite(approved) ? approved : undefined,
        paidAmount: Number.isFinite(paid) ? paid : undefined,
        retentionHeld: Number.isFinite(retention) ? retention : undefined,
        dueDate: editDueDate || undefined,
      })
      setEditInvoice(null)
      setSuccessMessage(t.successSaved)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentInvoice || !canEdit) return
    const additional = parseMoneyInput(paymentAmount)
    if (!Number.isFinite(additional) || additional <= 0) {
      setError(t.saveError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await recordInvoicePayment(
        supabase,
        { invoiceId: paymentInvoice.id, additionalPaid: additional },
        paymentInvoice.paid_amount,
        paymentInvoice.approved_amount
      )
      setPaymentInvoice(null)
      setSuccessMessage(t.successPayment)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (projectOptions.length === 0) {
    return (
      <div className="min-h-dvh bg-[#0f131a] p-6 text-white">
        <EmptyState title={t.title} description={t.noProject} />
      </div>
    )
  }

  const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'home', label: isFa ? 'خلاصه' : 'Home', icon: LayoutDashboard },
    { id: 'invoices', label: isFa ? 'صورت‌وضعیت' : 'Invoices', icon: FileText },
    { id: 'expenses', label: isFa ? 'هزینه‌ها' : 'Expenses', icon: Receipt },
    { id: 'payables', label: isFa ? 'بدهی' : 'Payables', icon: Wallet },
  ]

  const showHero = tab === 'home'

  return (
    <div className="accountant-native min-h-dvh bg-[#0b0e14] text-stone-100" dir={dir}>
        <NativeAppBootstrap />

        <header
          className={cn(
            'relative overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))]',
            showHero ? 'pb-6' : 'pb-3'
          )}
        >
          <div className="pointer-events-none absolute inset-0 industrial-gradient opacity-95" />
          <div className="pointer-events-none absolute -start-16 top-0 h-48 w-48 rounded-full bg-[hsl(24_85%_45%/0.35)] blur-3xl" />
          <div className="pointer-events-none absolute -end-10 bottom-0 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center">
                  <BrandLogo size="sm" />
                </div>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">{t.title}</h1>
                {showHero ? (
                  <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-white/65">{t.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {canEdit && (tab === 'home' || tab === 'invoices') ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full bg-[hsl(24_85%_45%)] text-white shadow-lg shadow-orange-900/30 hover:bg-[hsl(24_85%_40%)]"
                      onClick={() => setShowNewInvoice(true)}
                    >
                      <Plus className="me-1 h-4 w-4" />
                      {t.addInvoice}
                    </Button>
                ) : null}
              </div>
            </div>

            <Select value={projectId ?? undefined} onValueChange={handleProjectChange}>
              <SelectTrigger className="h-11 rounded-2xl border-white/15 bg-white/10 text-white backdrop-blur-md">
                <SelectValue placeholder={t.selectProject} />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showHero ? (
              <div className="rounded-3xl border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl">
                <p className="text-xs text-white/60">{t.outstandingReceivables}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-white">
                  {loading ? '…' : money(invoiceKpis.outstandingReceivables)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] text-white/50">{t.totalPaid}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {loading ? '…' : money(invoiceKpis.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] text-white/50">{t.totalAc}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {loading ? '…' : money(costSummary.totalAc)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="relative z-10 -mt-2 space-y-4 rounded-t-[1.75rem] bg-[#0b0e14] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5">
          {successMessage ? (
            <div className="animate-in rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}
          {error && tab !== 'expenses' && tab !== 'payables' ? (
            <ErrorBlock message={error} onRetry={() => void loadData()} />
          ) : null}

          {tab === 'home' ? (
            <div className="space-y-4">
              <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { code: 'ACC-KPI-01', label: t.totalAc, value: costSummary.totalAc, icon: DollarSign },
                  { code: 'ACC-KPI-02', label: t.totalInvoiced, value: invoiceKpis.totalInvoiced, icon: FileText },
                  { code: 'ACC-KPI-03', label: t.approvedAmount, value: totalApproved, icon: CircleDollarSign },
                  { code: 'ACC-KPI-04', label: t.totalPaid, value: invoiceKpis.totalPaid, icon: Banknote },
                  {
                    code: 'ACC-KPI-05',
                    label: t.outstandingReceivables,
                    value: invoiceKpis.outstandingReceivables,
                    icon: CircleDollarSign,
                  },
                  {
                    code: 'ACC-KPI-06',
                    label: isFa ? 'شکاف نقدینگی' : 'Cash Gap',
                    value: cashGap,
                    icon: TrendingDown,
                  },
                  {
                    code: 'ACC-TBL-03',
                    label: t.unpaidVendorBills,
                    value: vendorKpis.unpaidVendorBills,
                    icon: TrendingDown,
                  },
                  {
                    code: 'ACC-TBL-03',
                    label: t.stockValuation,
                    value: stockValuation,
                    icon: Warehouse,
                  },
                ].map((kpi) => (
                    <div className="min-w-[9.5rem] shrink-0 rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.07] to-transparent p-3">
                      <kpi.icon className="h-4 w-4 text-[hsl(24_85%_55%)]" />
                      <p className="mt-2 text-[10px] leading-snug text-white/50">{kpi.label}</p>
                      <p className="mt-1 text-sm font-bold tabular-nums">{loading ? '…' : money(kpi.value)}</p>
                    </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl border-white/15 bg-white/[0.04] text-white"
                    onClick={() => setTab('expenses')}
                  >
                    <Receipt className="me-2 h-4 w-4" />
                    {t.manageExpenses}
                  </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-2xl border-white/15 bg-white/[0.04] text-white"
                  onClick={() => setTab('payables')}
                >
                  <TrendingDown className="me-2 h-4 w-4" />
                  {t.managePayables}
                </Button>
              </div>

                <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold">{t.alertsTitle}</h2>
                  </div>
                  {loading ? (
                    <LoadingBlock />
                  ) : alerts.length === 0 ? (
                    <p className="py-4 text-center text-sm text-white/45">{t.noAlerts}</p>
                  ) : (
                    <ul className="space-y-2">
                      {alerts.map((alert) => (
                        <li
                          key={alert.id}
                          className={cn(
                            'rounded-2xl border px-3 py-2.5',
                            alert.severity === 'danger'
                              ? 'border-red-500/25 bg-red-500/10'
                              : 'border-amber-500/25 bg-amber-500/10'
                          )}
                        >
                          <p className="text-sm font-medium text-white">{alert.title}</p>
                          <p className="mt-0.5 text-xs text-white/55">{alert.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <h2 className="text-sm font-semibold">{t.costsTable}</h2>
                  <p className="mt-1 text-xs text-white/45">{t.costsSummaryHint}</p>
                  {loading ? (
                    <LoadingBlock />
                  ) : costs.length === 0 ? (
                    <p className="py-4 text-center text-sm text-white/45">{t.emptyCosts}</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {FINANCIAL_COST_TYPES.map((type) => (
                        <div
                          key={type}
                          className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5"
                        >
                          <span className="text-sm text-white/65">{FINANCIAL_COST_TYPE_LABELS[type]}</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {money(costSummary.byType[type] ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    className="mt-3 h-11 w-full rounded-full"
                    variant="outline"
                    onClick={() => setTab('expenses')}
                  >
                    {t.openExpenseManagement}
                  </Button>
                </section>

                <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-[hsl(24_85%_55%)]" />
                    <h2 className="text-sm font-semibold">{t.vendorBillsTitle}</h2>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {loading ? '…' : money(stockValuation)}
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">{t.stockValuationHint}</p>
                  <div className="mt-3 space-y-2">
                    {loading ? (
                      <LoadingBlock />
                    ) : unpaidBills.length === 0 ? (
                      <p className="py-4 text-center text-sm text-white/45">{t.emptyVendorBills}</p>
                    ) : (
                      unpaidBills.slice(0, 8).map((bill) => {
                        const remaining = bill.amount - bill.paid_amount
                        const isOverdue =
                          Boolean(bill.due_date) &&
                          new Date(bill.due_date!) < new Date() &&
                          remaining > 0 &&
                          bill.status !== 'Paid' &&
                          bill.status !== 'settled' &&
                          bill.status !== 'cancelled'
                        return (
                          <article
                            key={bill.id}
                            className="rounded-2xl border border-white/8 bg-black/20 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{bill.vendor_name}</p>
                                <p className="mt-0.5 text-[11px] text-white/45">
                                  {bill.due_date ? <FormattedDate value={bill.due_date} /> : '—'}
                                  {isOverdue ? ` · ${t.overdue}` : ''}
                                </p>
                              </div>
                              <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                {getVendorStatusLabel(bill.status, locale)}
                              </Badge>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-white/40">{t.amount}</p>
                                <p className="font-semibold tabular-nums">{money(bill.amount)}</p>
                              </div>
                              <div>
                                <p className="text-white/40">{t.remaining}</p>
                                <p className="font-semibold tabular-nums">{money(remaining)}</p>
                              </div>
                            </div>
                          </article>
                        )
                      })
                    )}
                  </div>
                  <Button
                    type="button"
                    className="mt-3 h-11 w-full rounded-full"
                    variant="outline"
                    onClick={() => setTab('payables')}
                  >
                    {t.managePayables}
                  </Button>
                </section>
            </div>
          ) : null}

          {tab === 'invoices' ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{t.invoicesTable}</h2>
                  <span className="text-xs text-white/45">{invoices.length}</span>
                </div>
                {loading ? (
                  <LoadingBlock />
                ) : invoices.length === 0 ? (
                  <p className="py-10 text-center text-sm text-white/45">{t.emptyInvoices}</p>
                ) : (
                  invoices.map((inv) => (
                    <article
                      key={inv.id}
                      className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-transparent p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-white/55">{inv.invoice_no ?? '—'}</p>
                          <p className="mt-1 text-lg font-bold tabular-nums">{money(inv.total_amount)}</p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {inv.period_start && inv.period_end ? (
                              <>
                                <FormattedDate value={inv.period_start} /> —{' '}
                                <FormattedDate value={inv.period_end} />
                              </>
                            ) : (
                              '—'
                            )}
                          </p>
                        </div>
                        <StatusPill invoice={inv} locale={locale} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-black/25 px-2.5 py-2">
                          <p className="text-white/40">{t.approvedAmount}</p>
                          <p className="mt-0.5 font-semibold tabular-nums">{money(inv.approved_amount)}</p>
                        </div>
                        <div className="rounded-xl bg-black/25 px-2.5 py-2">
                          <p className="text-white/40">{t.paidAmount}</p>
                          <p className="mt-0.5 font-semibold tabular-nums">{money(inv.paid_amount)}</p>
                        </div>
                      </div>
                      {canEdit ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 rounded-full border-white/15 bg-transparent text-white"
                            onClick={() => {
                              setEditInvoice(inv)
                              setEditStatus(inv.status)
                              setEditApproved(
                                inv.approved_amount
                                  ? formatMoneyFromNumber(inv.approved_amount, locale)
                                  : ''
                              )
                              setEditPaid(
                                inv.paid_amount ? formatMoneyFromNumber(inv.paid_amount, locale) : ''
                              )
                              setEditRetention(
                                inv.retention_held
                                  ? formatMoneyFromNumber(inv.retention_held, locale)
                                  : ''
                              )
                              setEditDueDate(inv.due_date ?? '')
                            }}
                          >
                            {t.editFinancial}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 rounded-full bg-[hsl(24_85%_45%)] text-white"
                            onClick={() => {
                              setPaymentInvoice(inv)
                              setPaymentAmount('')
                            }}
                          >
                            {t.recordPayment}
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </section>
          ) : null}

          {tab === 'expenses' ? (
              <div className="accountant-native-embed rounded-3xl border border-white/10 bg-white p-3 text-foreground sm:p-4">
                <ExpenseManagement
                  key={projectId ?? 'no-project'}
                  initialContext={initialContext}
                  projectOptions={projectOptions}
                  initialProjectId={projectId}
                  canEdit={canEdit}
                  embedded
                />
              </div>
          ) : null}

          {tab === 'payables' ? (
            <div className="space-y-4">
                <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-[hsl(24_85%_55%)]" />
                    <h2 className="text-sm font-semibold">{t.stockValuation}</h2>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {loading ? '…' : money(stockValuation)}
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">{t.stockValuationHint}</p>
                </div>
              <div className="accountant-native-embed rounded-3xl border border-white/10 bg-white p-3 text-foreground sm:p-4">
                <ContractorPayables
                  key={projectId ?? 'no-project'}
                  initialContext={initialContext}
                  projectOptions={projectOptions}
                  initialProjectId={projectId}
                  canEdit={canEdit}
                  embedded
                />
              </div>
            </div>
          ) : null}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0e14]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {tabs.map((item) => {
              const active = tab === item.id
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium transition',
                    active ? 'bg-[hsl(24_85%_45%/0.18)] text-[hsl(24_85%_70%)]' : 'text-white/45'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'drop-shadow-[0_0_8px_hsl(24_85%_45%/0.65)]')} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </nav>

        <ModalOverlay open={showNewInvoice} onClose={() => setShowNewInvoice(false)} title={t.newInvoice}>
          <form onSubmit={(e) => void handleCreateInvoice(e)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.invoiceNo}</Label>
              <Input
                required
                value={formInvoiceNo}
                onChange={(e) => setFormInvoiceNo(e.target.value)}
                placeholder="SV-1405-01"
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ScheduleDateInput
                label={t.periodStart}
                valueIso={formPeriodStart}
                onChangeIso={setFormPeriodStart}
                required
              />
              <ScheduleDateInput
                label={t.periodEnd}
                valueIso={formPeriodEnd}
                onChangeIso={setFormPeriodEnd}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t.grossAmount}</Label>
              <MoneyInput value={formAmount} onChange={setFormAmount} required />
            </div>
            <div className="space-y-2">
              <Label>{t.status}</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as FinancialInvoiceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getInvoiceStatusLabel(s, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t.save}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNewInvoice(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        </ModalOverlay>

        <ModalOverlay open={!!editInvoice} onClose={() => setEditInvoice(null)} title={t.editFinancial}>
          {editInvoice ? (
            <form onSubmit={(e) => void handleEditFinancial(e)} className="space-y-4">
              <p className="font-mono text-sm text-muted-foreground">{editInvoice.invoice_no}</p>
              <div className="space-y-2">
                <Label>{t.status}</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as FinancialInvoiceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCIAL_INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getInvoiceStatusLabel(s, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.approvedAmount}</Label>
                  <MoneyInput value={editApproved} onChange={setEditApproved} />
                </div>
                <div className="space-y-2">
                  <Label>{t.paidAmount}</Label>
                  <MoneyInput value={editPaid} onChange={setEditPaid} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.retentionHeld}</Label>
                  <MoneyInput value={editRetention} onChange={setEditRetention} />
                </div>
                <ScheduleDateInput label={t.dueDate} valueIso={editDueDate} onChangeIso={setEditDueDate} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t.save}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditInvoice(null)}>
                  {t.cancel}
                </Button>
              </div>
            </form>
          ) : null}
        </ModalOverlay>

        <ModalOverlay open={!!paymentInvoice} onClose={() => setPaymentInvoice(null)} title={t.recordPayment}>
          {paymentInvoice ? (
            <form onSubmit={(e) => void handleRecordPayment(e)} className="space-y-4">
              <p className="font-mono text-sm text-muted-foreground">{paymentInvoice.invoice_no}</p>
              <p className="text-sm">
                {t.paidAmount}: {money(paymentInvoice.paid_amount)} / {money(paymentInvoice.approved_amount)}
              </p>
              <div className="space-y-2">
                <Label>{t.paymentAmount}</Label>
                <MoneyInput value={paymentAmount} onChange={setPaymentAmount} required />
                <p className="text-xs text-muted-foreground">{t.paymentHint}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t.save}
                </Button>
                <Button type="button" variant="outline" onClick={() => setPaymentInvoice(null)}>
                  {t.cancel}
                </Button>
              </div>
            </form>
          ) : null}
        </ModalOverlay>
    </div>
  )
}
