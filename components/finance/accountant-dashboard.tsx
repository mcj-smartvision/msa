'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Receipt,
  TrendingDown,
  Warehouse,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { ScheduleDateInput } from '@/components/schedule/schedule-date-input'
import {
  PageHeader,
  LoadingBlock,
  ErrorBlock,
  SectionCard,
  EmptyState,
} from '@/components/admin/shared'
import { StatCard } from '@/components/admin/stat-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import {
  UiBlockCustomizePanel,
  UiBlockGuard,
  UiBlockVisibilityProvider,
} from '@/components/dashboard/ui-block-visibility'
import { formatRial } from '@/lib/finance/format-currency'
import {
  MoneyInput,
  parseMoneyInput,
  formatMoneyFromNumber,
} from '@/components/finance/money-input'
import {
  FINANCIAL_INVOICE_STATUSES,
  type FinancialInvoiceRow,
  type FinancialInvoiceStatus,
  type VendorBillRow,
} from '@/lib/finance/invoice-types'
import {
  getAccountantMessages,
  getInvoiceStatusLabel,
  getVendorStatusLabel,
} from '@/lib/i18n/accountant'
import { cn } from '@/lib/utils'
import type { DashboardUserContext } from '@/types/dashboard'
import { useSupabase } from '@/hooks/useSupabase'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'
import {
  buildFinancialAlerts,
  buildInvoiceKpis,
  createFinancialInvoice,
  fetchFinancialInvoices,
  isInvoiceOverdue,
  recordInvoicePayment,
  updateInvoiceFinancial,
} from '@/utils/finance/invoices'
import { fetchStockValuation } from '@/utils/finance/stock-valuation'
import { buildCostSummary, fetchFinancialCosts } from '@/utils/finance/costs'
import {
  FINANCIAL_COST_TYPES,
  FINANCIAL_COST_TYPE_LABELS,
  type FinancialCost,
} from '@/lib/finance/types'
import {
  buildVendorBillKpis,
  fetchVendorBills,
  getUnpaidVendorBills,
} from '@/utils/finance/vendor-bills'

interface AccountantDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  canEdit?: boolean
  visibleBlockCodes?: string[]
}

function InvoiceStatusBadge({
  invoice,
  locale,
}: {
  invoice: FinancialInvoiceRow
  locale: ReturnType<typeof useLocale>['locale']
}) {
  const overdue = isInvoiceOverdue(invoice)
  const label = overdue
    ? getAccountantMessages(locale).delayed
    : getInvoiceStatusLabel(invoice.status, locale)

  const variantClass = overdue
    ? 'bg-red-100 text-red-800 border-red-200'
    : invoice.status === 'paid'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : invoice.status === 'under_review'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : invoice.status === 'approved'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : invoice.status === 'submitted'
            ? 'bg-sky-100 text-sky-800 border-sky-200'
            : 'bg-muted text-muted-foreground border-border'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variantClass
      )}
    >
      {label}
    </span>
  )
}

export function AccountantDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  canEdit = false,
  visibleBlockCodes = [],
}: AccountantDashboardProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getAccountantMessages(locale)
  const isRtl = dir === 'rtl'
  const isFa = locale === 'fa' || locale === 'ar'

  const projectId = useSyncedProjectId(initialProjectId)
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
    const timer = setTimeout(() => setSuccessMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const invoiceKpis = useMemo(() => buildInvoiceKpis(invoices), [invoices])
  const costSummary = useMemo(() => buildCostSummary(costs), [costs])
  const vendorKpis = useMemo(() => buildVendorBillKpis(vendorBills), [vendorBills])
  const unpaidBills = useMemo(() => getUnpaidVendorBills(vendorBills), [vendorBills])
  const alerts = useMemo(
    () =>
      buildFinancialAlerts(invoices, vendorKpis.overdueCount, isFa ? 'fa' : 'en'),
    [invoices, vendorKpis.overdueCount, isFa]
  )

  function openEditModal(inv: FinancialInvoiceRow) {
    setEditInvoice(inv)
    setEditStatus(inv.status)
    setEditApproved(
      inv.approved_amount ? formatMoneyFromNumber(inv.approved_amount, locale) : ''
    )
    setEditPaid(inv.paid_amount ? formatMoneyFromNumber(inv.paid_amount, locale) : '')
    setEditRetention(
      inv.retention_held ? formatMoneyFromNumber(inv.retention_held, locale) : ''
    )
    setEditDueDate(inv.due_date ?? '')
  }

  function openPaymentModal(inv: FinancialInvoiceRow) {
    setPaymentInvoice(inv)
    setPaymentAmount('')
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
    return <EmptyState title={t.title} description={t.noProject} />
  }

  const money = (n: number) => formatRial(n, locale)

  return (
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={initialContext.isSystemAdmin}
      dashboard="accountant"
      projectId={projectId}
    >
      <div className="space-y-8" dir={dir}>
        <UiBlockCustomizePanel />

        <PageHeader
          title={t.title}
          description={t.description}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <UiBlockGuard code="ACC-ACT-01">
                <Button type="button" variant="outline" asChild>
                  <Link href="/finance/expenses">
                    <Receipt className="h-4 w-4 me-1" />
                    {t.manageExpenses}
                  </Link>
                </Button>
              </UiBlockGuard>
              <Button type="button" variant="outline" asChild>
                <Link href="/finance/payables">
                  <TrendingDown className="h-4 w-4 me-1" />
                  {t.managePayables}
                </Link>
              </Button>
              {canEdit ? (
                <UiBlockGuard code="ACC-ACT-02">
                  <Button type="button" onClick={() => setShowNewInvoice(true)}>
                    <Plus className="h-4 w-4 me-1" />
                    {t.addInvoice}
                  </Button>
                </UiBlockGuard>
              ) : null}
            </div>
          }
        />

        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}

        {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

        {/* ─── SECTION 1: KPIs ─── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <UiBlockGuard code="ACC-KPI-01">
            <StatCard
              label={t.totalAc}
              value={loading ? '…' : money(costSummary.totalAc)}
              icon={DollarSign}
            />
          </UiBlockGuard>
          <UiBlockGuard code="ACC-KPI-02">
            <StatCard
              label={t.totalInvoiced}
              value={loading ? '…' : money(invoiceKpis.totalInvoiced)}
              icon={FileText}
            />
          </UiBlockGuard>
          <UiBlockGuard code="ACC-KPI-03">
            <StatCard
              label={t.totalPaid}
              value={loading ? '…' : money(invoiceKpis.totalPaid)}
              icon={Banknote}
              trendType="up"
            />
          </UiBlockGuard>
          <UiBlockGuard code="ACC-KPI-04">
            <StatCard
              label={t.outstandingReceivables}
              value={loading ? '…' : money(invoiceKpis.outstandingReceivables)}
              icon={CircleDollarSign}
              trendType="warning"
            />
          </UiBlockGuard>
          <UiBlockGuard code="ACC-KPI-05">
            <StatCard
              label={t.unpaidVendorBills}
              value={loading ? '…' : money(vendorKpis.unpaidVendorBills)}
              icon={TrendingDown}
              trendType="down"
            />
          </UiBlockGuard>
        </div>

        {/* ─── SECTION 2: Alerts ─── */}
        <UiBlockGuard code="ACC-PNL-01">
          <SectionCard title={t.alertsTitle}>
            {loading ? (
              <LoadingBlock label={t.saving} />
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t.noAlerts}</p>
            ) : (
              <ul className="divide-y">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex gap-3 px-4 py-3 items-start">
                    <AlertTriangle
                      className={cn(
                        'h-5 w-5 shrink-0 mt-0.5',
                        alert.severity === 'danger' ? 'text-red-600' : 'text-amber-600'
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </UiBlockGuard>

        {/* ─── Cost summary only (micro expenses live in /finance/expenses) ─── */}
        <UiBlockGuard code="ACC-TBL-01">
          <SectionCard title={t.costsTable}>
            {loading ? (
              <LoadingBlock />
            ) : (
              <div className="p-4 space-y-4">
                <p className="text-sm text-muted-foreground">{t.costsSummaryHint}</p>
                {costs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t.emptyCosts}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {FINANCIAL_COST_TYPES.map((type) => (
                      <div
                        key={type}
                        className="rounded-lg border bg-muted/20 px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-muted-foreground">
                          {FINANCIAL_COST_TYPE_LABELS[type]}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {money(costSummary.byType[type] ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">{t.costsByType}</p>
                    <p className="text-lg font-bold tabular-nums">{money(costSummary.totalAc)}</p>
                  </div>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/finance/expenses">{t.openExpenseManagement}</Link>
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </UiBlockGuard>

        {/* ─── SECTION 3: Client Invoices ─── */}
        <UiBlockGuard code="ACC-TBL-02">
          <SectionCard title={t.invoicesTable}>
            {loading ? (
              <LoadingBlock />
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t.emptyInvoices}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={cn('w-full text-sm', isRtl && 'text-right')}>
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 px-3">{t.invoiceNo}</th>
                      <th className="py-2 px-3">{t.period}</th>
                      <th className="py-2 px-3 text-end">{t.amount}</th>
                      <th className="py-2 px-3 text-end">{t.approvedAmount}</th>
                      <th className="py-2 px-3 text-end">{t.paidAmount}</th>
                      <th className="py-2 px-3">{t.status}</th>
                      {canEdit ? <th className="py-2 px-3 w-48" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-xs">{inv.invoice_no ?? '—'}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                          {inv.period_start && inv.period_end ? (
                            <>
                              <FormattedDate value={inv.period_start} /> —{' '}
                              <FormattedDate value={inv.period_end} />
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-end tabular-nums font-medium">
                          {money(inv.total_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-end tabular-nums">
                          {money(inv.approved_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-end tabular-nums">
                          {money(inv.paid_amount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <InvoiceStatusBadge invoice={inv} locale={locale} />
                        </td>
                        {canEdit ? (
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(inv)}
                              >
                                {t.editFinancial}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => openPaymentModal(inv)}
                              >
                                {t.recordPayment}
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </UiBlockGuard>

        {/* ─── SECTION 4: Vendor Bills & Stock ─── */}
        <UiBlockGuard code="ACC-TBL-03">
          <SectionCard title={t.vendorBillsTitle}>
            <div className="grid gap-4 lg:grid-cols-3 p-4">
              <Card className="lg:col-span-1 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-primary" />
                    {t.stockValuation}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.stockValuationHint}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">
                    {loading ? '…' : money(stockValuation)}
                  </p>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 overflow-x-auto">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {t.vendorBillsTable}
                  </p>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href="/finance/payables">{t.managePayables}</Link>
                  </Button>
                </div>
                {loading ? (
                  <LoadingBlock />
                ) : unpaidBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">{t.emptyVendorBills}</p>
                ) : (
                  <table className={cn('w-full text-sm', isRtl && 'text-right')}>
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 px-3">{t.vendor}</th>
                        <th className="py-2 px-3 text-end">{t.amount}</th>
                        <th className="py-2 px-3 text-end">{t.remaining}</th>
                        <th className="py-2 px-3">{t.dueDate}</th>
                        <th className="py-2 px-3">{t.status}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {unpaidBills.slice(0, 8).map((bill) => {
                        const remaining = bill.amount - bill.paid_amount
                        const isOverdue =
                          Boolean(bill.due_date) &&
                          new Date(bill.due_date!) < new Date() &&
                          remaining > 0 &&
                          bill.status !== 'Paid' &&
                          bill.status !== 'settled' &&
                          bill.status !== 'cancelled'
                        return (
                          <tr key={bill.id} className="hover:bg-muted/30">
                            <td className="py-2.5 px-3">{bill.vendor_name}</td>
                            <td className="py-2.5 px-3 text-end tabular-nums">{money(bill.amount)}</td>
                            <td className="py-2.5 px-3 text-end tabular-nums font-medium">
                              {money(remaining)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {bill.due_date ? (
                                <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                                  <FormattedDate value={bill.due_date} />
                                  {isOverdue ? ` (${t.overdue})` : ''}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                {getVendorStatusLabel(bill.status, locale)}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </SectionCard>
        </UiBlockGuard>

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
                {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                {t.save}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNewInvoice(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        </ModalOverlay>

        {/* Edit financial status modal */}
        <ModalOverlay
          open={!!editInvoice}
          onClose={() => setEditInvoice(null)}
          title={t.editFinancial}
        >
          {editInvoice ? (
            <form onSubmit={(e) => void handleEditFinancial(e)} className="space-y-4">
              <p className="text-sm text-muted-foreground font-mono">{editInvoice.invoice_no}</p>
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
                <ScheduleDateInput
                  label={t.dueDate}
                  valueIso={editDueDate}
                  onChangeIso={setEditDueDate}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                  {t.save}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditInvoice(null)}>
                  {t.cancel}
                </Button>
              </div>
            </form>
          ) : null}
        </ModalOverlay>

        {/* Record payment modal */}
        <ModalOverlay
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          title={t.recordPayment}
        >
          {paymentInvoice ? (
            <form onSubmit={(e) => void handleRecordPayment(e)} className="space-y-4">
              <p className="text-sm text-muted-foreground font-mono">{paymentInvoice.invoice_no}</p>
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
                  {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
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
    </UiBlockVisibilityProvider>
  )
}
