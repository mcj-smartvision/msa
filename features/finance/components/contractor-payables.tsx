'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Plus, Wallet } from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import {
PageHeader,
LoadingBlock,
ErrorBlock,
SectionCard,
EmptyState,
} from '@/features/admin/components/shared'
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
import { ModalOverlay } from '@/shared/components/common/modal-overlay'
import {
MoneyInput,
parseMoneyInput,
formatMoneyFromNumber,
} from '@/features/finance/components/money-input'
import { formatRial } from '@/features/finance/lib/format-currency'
import {
PAYABLE_STATUSES,
PAYABLE_TYPES,
PAYMENT_METHODS,
remainingOf,
type PayableType,
type PaymentMethod,
type VendorBillRow,
} from '@/features/finance/lib/payable-types'
import {
getPayableMessages,
getPayableStatusLabel,
getPayableTypeLabel,
getPaymentMethodLabel,
} from '@/shared/lib/i18n/payables'
import { cn } from '@/shared/lib/utils'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import {
buildPayableSummary,
cancelContractorPayable,
createContractorPayable,
fetchContractorPayables,
recordPayablePayment,
} from '@/features/finance/services/payables'

interface ContractorPayablesProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  canEdit?: boolean
  /** Hide desktop chrome when shown inside the mobile accountant shell. */
  embedded?: boolean
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function StatusBadge({ status, locale }: { status: string; locale: ReturnType<typeof useLocale>['locale'] }) {
  const label = getPayableStatusLabel(status, locale)
  const cls =
    status === 'settled' || status === 'Paid'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : status === 'overdue'
        ? 'bg-red-100 text-red-800 border-red-200'
        : status === 'partial' || status === 'PartiallyPaid'
          ? 'bg-amber-100 text-amber-900 border-amber-200'
          : status === 'cancelled'
            ? 'bg-muted text-muted-foreground border-border'
            : status === 'check_issued'
              ? 'bg-violet-100 text-violet-800 border-violet-200'
              : 'bg-sky-100 text-sky-800 border-sky-200'

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', cls)}>
      {label}
    </span>
  )
}

export function ContractorPayables({
  initialContext,
  projectOptions,
  initialProjectId,
  canEdit = false,
  embedded = false,
}: ContractorPayablesProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getPayableMessages(locale)
  const isRtl = dir === 'rtl'
  const isFa = locale === 'fa' || locale === 'ar'
  const money = (n: number) => formatRial(n, isFa ? 'fa' : 'en')

  const projectId = useSyncedProjectId(initialProjectId)
  const [rows, setRows] = useState<VendorBillRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [payBill, setPayBill] = useState<VendorBillRow | null>(null)

  const [formContractor, setFormContractor] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDue, setFormDue] = useState('')
  const [formBillDate, setFormBillDate] = useState(todayDate)
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<PayableType>('payable')

  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayDate)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const loadData = useCallback(async () => {
    if (!projectId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchContractorPayables(supabase, projectId, {
        status: filterStatus,
        search,
      })
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase, filterStatus, search, t.loadError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(timer)
  }, [success])

  const summary = useMemo(() => buildPayableSummary(rows), [rows])

  function resetForm() {
    setFormContractor('')
    setFormAmount('')
    setFormDue('')
    setFormBillDate(todayDate())
    setFormDescription('')
    setFormType('payable')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !canEdit) return
    const amount = parseMoneyInput(formAmount)
    if (!formContractor.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(t.saveError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Recognized liability without payment → open payable (expense may already exist separately)
      await createContractorPayable(supabase, {
        projectId,
        contractorName: formContractor,
        amount,
        paidAmount: 0,
        dueDate: formDue || null,
        billDate: formBillDate,
        description: formDescription,
        payableType: formType,
        createdBy: initialContext.userId,
      })
      setShowForm(false)
      resetForm()
      setSuccess(t.successSaved)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payBill || !projectId || !canEdit) return
    const amount = parseMoneyInput(payAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t.saveError)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await recordPayablePayment(supabase, {
        vendorBillId: payBill.id,
        projectId,
        amount,
        paymentDate: payDate,
        method: payMethod,
        reference: payRef,
        notes: payNotes,
        createdBy: initialContext.userId,
      })
      setPayBill(null)
      setPayAmount('')
      setPayRef('')
      setPayNotes('')
      setSuccess(t.successPayment)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(bill: VendorBillRow) {
    if (!canEdit || !confirm(isFa ? 'این بدهی لغو شود؟' : 'Cancel this payable?')) return
    setSaving(true)
    try {
      await cancelContractorPayable(supabase, bill.id, initialContext.userId)
      setSuccess(t.successSaved)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (!projectId) {
    return (
      <div className={cn('space-y-6', !embedded && 'p-4 sm:p-6')} dir={dir}>
        {!embedded ? <PageHeader title={t.title} description={t.pageDescription} /> : null}
        <EmptyState title={t.noProject} description={t.noProject} />
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', !embedded && 'p-4 sm:p-6', embedded && 'space-y-4')} dir={dir}>
      <PageHeader
        title={t.title}
        description={embedded ? undefined : t.pageDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            {!embedded ? (
              <>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard/accountant">{t.backToDashboard}</Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/finance/expenses">{t.manageExpenses}</Link>
                </Button>
              </>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(true)
                }}
              >
                <Plus className="h-4 w-4 me-1" />
                {t.addPayable}
              </Button>
            ) : null}
          </div>
        }
      />

      <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        {t.ruleHint}
      </p>

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}
      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.totalRecognized} value={loading ? '…' : money(summary.totalRecognized)} icon={Wallet} />
        <StatCard
          label={t.totalOpen}
          value={loading ? '…' : money(summary.totalOpen)}
          icon={Wallet}
          trendType="warning"
        />
        <StatCard label={t.totalPaid} value={loading ? '…' : money(summary.totalPaid)} icon={Wallet} trendType="up" />
        <StatCard
          label={t.overdueAmount}
          value={loading ? '…' : `${money(summary.overdueAmount)} (${summary.overdueCount})`}
          icon={AlertTriangle}
          trendType="down"
        />
      </div>

      <SectionCard title={t.tableTitle}>
        <div className="grid gap-3 sm:grid-cols-2 p-4 border-b">
          <div className="space-y-1.5">
            <Label>{t.status}</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStatuses}</SelectItem>
                {PAYABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getPayableStatusLabel(s, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.search}</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <LoadingBlock label={t.saving} />
        ) : rows.length === 0 ? (
          <EmptyState title={t.empty} description={t.ruleHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full text-sm', isRtl && 'text-right')}>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-3">{t.contractor}</th>
                  <th className="py-2 px-3 text-end">{t.amount}</th>
                  <th className="py-2 px-3 text-end">{t.paidAmount}</th>
                  <th className="py-2 px-3 text-end">{t.remaining}</th>
                  <th className="py-2 px-3">{t.dueDate}</th>
                  <th className="py-2 px-3">{t.status}</th>
                  <th className="py-2 px-3">{t.description}</th>
                  <th className="py-2 px-3">{t.relatedDoc}</th>
                  {canEdit ? <th className="py-2 px-3">{t.actions}</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((bill) => {
                  const rem = remainingOf(bill)
                  return (
                    <tr key={bill.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium">{bill.vendor_name}</td>
                      <td className="py-2.5 px-3 text-end tabular-nums">{money(bill.amount)}</td>
                      <td className="py-2.5 px-3 text-end tabular-nums">{money(bill.paid_amount)}</td>
                      <td className="py-2.5 px-3 text-end tabular-nums font-semibold">{money(rem)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {bill.due_date ? <FormattedDate value={bill.due_date} /> : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={bill.status} locale={locale} />
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate">
                        {bill.description || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {bill.related_document_id
                          ? bill.related_document_id.slice(0, 8)
                          : '—'}
                      </td>
                      {canEdit ? (
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {rem > 0 && bill.status !== 'cancelled' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPayBill(bill)
                                  setPayAmount(formatMoneyFromNumber(rem, locale))
                                  setPayDate(todayDate())
                                  setPayMethod('cash')
                                  setPayRef('')
                                  setPayNotes('')
                                }}
                              >
                                {t.recordPayment}
                              </Button>
                            ) : null}
                            {bill.status !== 'cancelled' && bill.status !== 'settled' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-red-700"
                                onClick={() => void handleCancel(bill)}
                              >
                                {t.cancelPayable}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ModalOverlay open={showForm} onClose={() => setShowForm(false)} title={t.formTitle}>
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.contractor}</Label>
            <Input
              required
              value={formContractor}
              onChange={(e) => setFormContractor(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.amount}</Label>
              <MoneyInput value={formAmount} onChange={setFormAmount} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t.type}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as PayableType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYABLE_TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {getPayableTypeLabel(tp, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <ScheduleDateInput
                label={t.billDate}
                valueIso={formBillDate}
                onChangeIso={setFormBillDate}
                required
              />
            </div>
            <div className="space-y-1.5">
              <ScheduleDateInput
                label={t.dueDate}
                valueIso={formDue}
                onChangeIso={setFormDue}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.description}</Label>
            <Textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {t.save}
            </Button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(payBill)}
        onClose={() => setPayBill(null)}
        title={t.paymentTitle}
      >
        {payBill ? (
          <form onSubmit={(e) => void handlePayment(e)} className="space-y-4">
            <p className="text-sm">
              <span className="font-medium">{payBill.vendor_name}</span>
              {' — '}
              {t.remaining}: {money(remainingOf(payBill))}
            </p>
            <div className="space-y-1.5">
              <Label>{t.paymentAmount}</Label>
              <MoneyInput value={payAmount} onChange={setPayAmount} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <ScheduleDateInput
                  label={t.paymentDate}
                  valueIso={payDate}
                  onChangeIso={setPayDate}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.paymentMethod}</Label>
                <Select
                  value={payMethod}
                  onValueChange={(v) => setPayMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {getPaymentMethodLabel(m, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.reference}</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.notes}</Label>
              <Textarea rows={2} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPayBill(null)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                {t.recordPayment}
              </Button>
            </div>
          </form>
        ) : null}
      </ModalOverlay>
    </div>
  )
}
