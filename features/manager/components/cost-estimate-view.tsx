'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Coins,
  Info,
  LineChart as LineChartIcon,
  Receipt,
  Save,
  Settings2,
  ShieldCheck,
  Sigma,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { MoneyInput, formatMoneyFromNumber, parseMoneyInput } from '@/features/finance/components/money-input'
import { JalaliDatePicker } from '@/features/holidays/components/jalali-date-picker'
import type { ManagerOverview } from '@/features/manager/lib/overview-types'
import type { CostEstimateOverview } from '@/features/manager/lib/load-cost-estimate'
import {
  TARGET_MARGIN_WARNING_PERCENT,
  buildBac,
  estimateTargets,
  plannedDurationMonths,
  validateEstimate,
  type CostEstimateSettings,
  type EstimateTargets,
  type TargetLevel,
  type EstimateAlert,
  type EstimateAlertLevel,
  type EstimateField,
  type EstimateIssue,
  type EstimateStatus,
  type IndexValue,
} from '@/features/manager/lib/cost-estimate'
import { faNumber, faPercent, jalaliDate, jalaliDateTime } from '@/features/manager/lib/format'
import { EmptyNote, LoadingRows, SectionBody, SectionCard, Spinner } from './manager-ui'
import { ManagerProgressChart } from './manager-progress-chart'
import { CalcTraceProvider, CalcTraceTrigger } from '@/features/calc-trace/components/calc-trace'

const STATUS_META: Record<EstimateStatus, { label: string; className: string }> = {
  missing: { label: 'نیازمند تکمیل تنظیمات', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  incomplete: { label: 'برآورد ناقص', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  draft: { label: 'پیش‌نویس (تأییدنشده)', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  approved: { label: 'برآورد مصوب', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
}

const LEVEL_META: Record<EstimateAlertLevel, { label: string; bar: string; badge: string; icon: ReactNode }> = {
  critical: {
    label: 'بحرانی',
    bar: 'border-r-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    icon: <AlertOctagon className="h-4 w-4 text-rose-600" aria-hidden />,
  },
  warning: {
    label: 'نیازمند بررسی',
    bar: 'border-r-amber-400',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />,
  },
  info: {
    label: 'اطلاع‌رسانی',
    bar: 'border-r-sky-400',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    icon: <Info className="h-4 w-4 text-sky-600" aria-hidden />,
  },
}

function toman(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : faNumber(Math.round(value))
}

/* ------------------------------------------------------------------ Data */

function useCostEstimate(projectId: string | null) {
  const [data, setData] = useState<CostEstimateOverview | null>(null)
  const [loading, setLoading] = useState(Boolean(projectId))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/manager/cost-estimate?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'بارگذاری برآورد ناموفق بود')
      setData(body as CostEstimateOverview)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری برآورد ناموفق بود')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  return { data, setData, loading, error, reload: load }
}

/* ------------------------------------------------------------- Headline */

function Figure({
  label,
  value,
  hint,
  tone = 'slate',
  metrics,
}: {
  label: string
  value: string
  hint: string
  tone?: 'slate' | 'orange' | 'emerald' | 'sky' | 'rose'
  metrics?: string[]
}) {
  const tones = {
    slate: 'border-slate-200',
    orange: 'border-orange-200',
    emerald: 'border-emerald-200',
    sky: 'border-sky-200',
    rose: 'border-rose-200',
  }
  return (
    <div className={cn('group rounded-2xl border bg-white p-4 shadow-sm', tones[tone])}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {metrics ? <CalcTraceTrigger metrics={metrics} /> : null}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p>
    </div>
  )
}

function Headline({ data }: { data: CostEstimateOverview }) {
  const meta = STATUS_META[data.status]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold text-slate-900">برآورد اولیه و کنترل هزینه</h1>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', meta.className)}>{meta.label}</span>
        {data.record?.approvedAt ? (
          <span className="text-xs text-slate-500">تأیید {jalaliDateTime(data.record.approvedAt)}</span>
        ) : null}
        <span className="ms-auto text-xs text-slate-500">همهٔ مبالغ به {data.currency} · تاریخ وضعیت {jalaliDate(data.today)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Figure label="ارزش قرارداد با کارفرما" value={toman(data.settings.contractValue)} hint="درآمد قراردادی؛ مبنای سود و زیان، نه بودجهٔ هزینه" tone="sky" />
        <Figure
          label="حاشیهٔ سود هدف"
          value={data.record && data.targets.marginPercent != null ? faPercent(data.targets.marginPercent) : '—'}
          hint={
            data.record && data.targets.targetProfit != null
              ? `سود هدف ${toman(data.targets.targetProfit)} = قرارداد − BAC کل`
              : 'با ثبت ارزش قرارداد و برآورد محاسبه می‌شود'
          }
          metrics={['estimate.target_profit_pct', 'estimate.overhead_burn_rate']}
          tone={!data.record ? 'slate' : data.targets.level === 'critical' ? 'rose' : data.targets.level === 'warning' ? 'orange' : data.targets.level === 'ok' ? 'emerald' : 'slate'}
        />
        <Figure
          label="BAC کل (بودجهٔ هزینهٔ داخلی)"
          metrics={['estimate.bac_total']}
          value={data.record ? toman(data.bac.bacTotal) : '—'}
          hint={data.record ? `BAC پایه ${toman(data.bac.bacBase)} + ذخیرهٔ ریسک ${toman(data.bac.riskReserve)}` : 'برآورد هنوز ذخیره نشده است'}
          tone="orange"
        />
        <Figure metrics={['estimate.cpi', 'estimate.cv']} label="هزینهٔ واقعی تا امروز (AC)" value={toman(data.actual.total)} hint="بالاسری + کارکرد پیمانکاران + خرید کارفرمایی" />
        <Figure label="ارزش کسب‌شده (EV)" value={toman(data.evm.ev.value)} hint={data.evm.ev.value == null ? data.evm.ev.reason ?? '' : 'BAC پایه × پیشرفت تأییدشده'} tone="emerald" />
        <Figure
          label="برآورد هزینهٔ تکمیل (EAC)"
          metrics={['estimate.eac', 'estimate.etc']}
          value={toman(data.evm.eac.value)}
          hint={data.evm.eac.value == null ? data.evm.eac.reason ?? '' : 'AC + (BAC پایه − EV) ÷ CPI'}
          tone={data.evm.vac.value != null && data.evm.vac.value < 0 ? 'rose' : 'slate'}
        />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Alerts */

function AlertItem({ alert }: { alert: EstimateAlert }) {
  const [open, setOpen] = useState(false)
  const meta = LEVEL_META[alert.level]
  return (
    <li className={cn('rounded-xl border border-slate-100 border-r-4 bg-white p-3.5', meta.bar)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{meta.icon}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{alert.title}</p>
            <span className={cn('rounded-full px-2 py-px text-[10px] font-semibold ring-1', meta.badge)}>{meta.label}</span>
          </div>
          <p className="text-xs leading-6 text-slate-600">
            <span className="font-semibold text-slate-700">علت: </span>
            {alert.cause}
          </p>
          <p className="text-xs leading-6 text-slate-600 tabular-nums">
            <span className="font-semibold text-slate-700">مبنای عددی: </span>
            {alert.basis}
          </p>
          <p className="text-xs leading-6 text-slate-600">
            <span className="font-semibold text-slate-700">اقدام پیشنهادی: </span>
            {alert.action}
          </p>
          {alert.items?.length ? (
            <div>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {open ? 'بستن فهرست' : `نمایش ${faNumber(alert.items.length)} مورد`}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
              </button>
              {open ? (
                <ul className="mt-1.5 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3">
                  {alert.items.map((item, index) => (
                    <li key={index} className="flex flex-wrap justify-between gap-2 py-1.5 text-[11px] text-slate-700">
                      <span>{item.label}</span>
                      {item.detail ? <span className="tabular-nums text-slate-500">{item.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function AlertsSection({ alerts }: { alerts: EstimateAlert[] }) {
  return (
    <SectionCard
      title="هشدارهای هزینه و زمان"
      action={<CalcTraceTrigger metrics={['estimate.ppc', 'estimate.progress_gap']} />}
      icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
      hint="آبی: اطلاع‌رسانی، زرد: نیازمند بررسی، قرمز: بحرانی. آستانه‌ها در یک جا (ESTIMATE_ALERT_THRESHOLDS) تعریف شده‌اند."
    >
      {alerts.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">هشدار فعالی وجود ندارد.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/* ------------------------------------------------------------ Settings */

interface FormState {
  contractValue: string
  plannedStart: string
  plannedFinish: string
  monthlyOverhead: string
  overheadInWbs: boolean
  monthlyPersonnel: string
  personnelInWbs: boolean
  plannedEmployerPurchases: string
  purchasesInWbs: boolean
  otherFixedCosts: string
  riskMode: 'percent' | 'amount'
  riskValue: string
  notes: string
}

const moneyText = (n: number | null) => (n == null ? '' : formatMoneyFromNumber(n, 'fa'))
const moneyValue = (s: string) => {
  const n = parseMoneyInput(s)
  return Number.isFinite(n) ? n : null
}

function toForm(s: CostEstimateSettings): FormState {
  return {
    contractValue: moneyText(s.contractValue),
    plannedStart: s.plannedStart ?? '',
    plannedFinish: s.plannedFinish ?? '',
    monthlyOverhead: moneyText(s.monthlyOverhead),
    overheadInWbs: s.overheadInWbs,
    monthlyPersonnel: moneyText(s.monthlyPersonnel),
    personnelInWbs: s.personnelInWbs,
    plannedEmployerPurchases: moneyText(s.plannedEmployerPurchases),
    purchasesInWbs: s.purchasesInWbs,
    otherFixedCosts: moneyText(s.otherFixedCosts),
    riskMode: s.riskMode,
    riskValue: s.riskValue == null ? '' : s.riskMode === 'amount' ? moneyText(s.riskValue) : String(s.riskValue),
    notes: s.notes ?? '',
  }
}

function fromForm(f: FormState): Record<EstimateField, unknown> {
  const risk = f.riskMode === 'amount' ? moneyValue(f.riskValue) : f.riskValue.trim() === '' ? null : Number(f.riskValue.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
  return {
    contractValue: moneyValue(f.contractValue),
    plannedStart: f.plannedStart || null,
    plannedFinish: f.plannedFinish || null,
    monthlyOverhead: moneyValue(f.monthlyOverhead),
    overheadInWbs: f.overheadInWbs,
    monthlyPersonnel: moneyValue(f.monthlyPersonnel),
    personnelInWbs: f.personnelInWbs,
    plannedEmployerPurchases: moneyValue(f.plannedEmployerPurchases),
    purchasesInWbs: f.purchasesInWbs,
    otherFixedCosts: moneyValue(f.otherFixedCosts),
    riskMode: f.riskMode,
    riskValue: risk,
    notes: f.notes,
  }
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-rose-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-5 text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

function InWbsToggle({ id, checked, onChange, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-[hsl(var(--primary))]"
      />
      در بودجهٔ ردیف‌های WBS منظور شده است (دوباره به BAC اضافه نشود)
    </label>
  )
}

function IssuesList({ issues }: { issues: EstimateIssue[] }) {
  if (!issues.length) return null
  return (
    <ul className="space-y-1.5">
      {issues.map((issue, index) => (
        <li
          key={index}
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-6',
            issue.level === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'
          )}
        >
          {issue.level === 'warning' ? <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : <Info className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />}
          {issue.message}
        </li>
      ))}
    </ul>
  )
}

function SettingsSection({
  data,
  projectId,
  onSaved,
}: {
  data: CostEstimateOverview
  projectId: string
  onSaved: (next: CostEstimateOverview) => void
}) {
  const [form, setForm] = useState<FormState>(() => toForm(data.settings))
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EstimateField, string>>>({})
  const [saving, setSaving] = useState<'draft' | 'approve' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [pendingIssues, setPendingIssues] = useState<EstimateIssue[] | null>(null)

  useEffect(() => {
    setForm(toForm(data.settings))
  }, [data.settings])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const disabled = !data.canEdit || saving != null
  const months = plannedDurationMonths(form.plannedStart || null, form.plannedFinish || null)
  const warnings = data.issues.filter((i) => i.level === 'warning')
  const preview = useMemo(() => {
    const checked = validateEstimate(fromForm(form))
    if (checked.ok === false) return null
    const bac = buildBac(checked.value, data.direct)
    return { bac, targets: estimateTargets(checked.value, bac), contractValue: checked.value.contractValue }
  }, [form, data.direct])

  const save = async (approve: boolean) => {
    setSaving(approve ? 'approve' : 'draft')
    setMessage(null)
    setFieldErrors({})
    try {
      const response = await fetch('/api/manager/cost-estimate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, settings: fromForm(form), approve, acknowledgeWarnings: approve && acknowledged }),
      })
      const body = await response.json().catch(() => null)
      if (response.status === 400 && body?.fieldErrors) {
        setFieldErrors(body.fieldErrors)
        throw new Error(body.error)
      }
      if (response.status === 409) {
        setPendingIssues(body?.issues ?? [])
        throw new Error(body?.error ?? 'پیش از تأیید، هشدارها را بررسی کنید')
      }
      if (!response.ok) throw new Error(body?.error || 'ذخیره ناموفق بود')
      setPendingIssues(null)
      setAcknowledged(false)
      onSaved(body as CostEstimateOverview)
      setMessage({ tone: 'ok', text: approve ? 'برآورد ذخیره و تأیید شد.' : 'تنظیمات ذخیره شد (تأییدنشده).' })
    } catch (saveError) {
      setMessage({ tone: 'error', text: saveError instanceof Error ? saveError.message : 'ذخیره ناموفق بود' })
    } finally {
      setSaving(null)
    }
  }

  const shownIssues = pendingIssues ?? warnings

  return (
    <SectionCard
      title="تنظیمات مالی و برآورد اولیه"
      icon={<Settings2 className="h-4 w-4" aria-hidden />}
      hint="ارزش قرارداد درآمد پروژه است و جدا از بودجهٔ هزینهٔ داخلی (BAC) نگه داشته می‌شود. هزینهٔ مستقیم از ردیف‌های WBS خوانده می‌شود و دستی وارد نمی‌شود."
    >
      {data.tableMissing ? (
        <EmptyNote title="جدول برآورد هنوز ساخته نشده است" description="فایل database/106-project-cost-estimates.sql را یک بار در Supabase اجرا کنید." />
      ) : null}
      {!data.canEdit && !data.tableMissing ? (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">فقط مدیر پروژه می‌تواند این تنظیمات را تغییر دهد.</p>
      ) : null}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void save(false)
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field id="ce-contract" label={`ارزش قرارداد با کارفرما (${data.currency})`} hint="درآمد قراردادی؛ در BAC جمع نمی‌شود" error={fieldErrors.contractValue}>
            <MoneyInput id="ce-contract" value={form.contractValue} onChange={(v) => set('contractValue', v)} disabled={disabled} />
          </Field>
          <Field id="ce-start" label="تاریخ شروع مصوب" error={fieldErrors.plannedStart}>
            <JalaliDatePicker id="ce-start" value={form.plannedStart} onChange={(v) => set('plannedStart', v)} disabled={disabled} />
          </Field>
          <Field
            id="ce-finish"
            label="تاریخ پایان مصوب"
            hint={months != null ? `مدت برنامه‌ای: ${faNumber(months, 2)} ماه شمسی` : 'پایان باید بعد از شروع باشد'}
            error={fieldErrors.plannedFinish}
          >
            <JalaliDatePicker id="ce-finish" value={form.plannedFinish} onChange={(v) => set('plannedFinish', v)} min={form.plannedStart || undefined} disabled={disabled} />
          </Field>
          <Field id="ce-overhead" label={`بالاسری ماهانه (${data.currency})`} hint="× مدت برنامه‌ای = بالاسری کل برنامه‌ای" error={fieldErrors.monthlyOverhead}>
            <MoneyInput id="ce-overhead" value={form.monthlyOverhead} onChange={(v) => set('monthlyOverhead', v)} disabled={disabled} />
            <InWbsToggle id="ce-overhead-wbs" checked={form.overheadInWbs} onChange={(v) => set('overheadInWbs', v)} disabled={disabled} />
          </Field>
          <Field id="ce-personnel" label={`هزینهٔ ماهانهٔ پرسنل (${data.currency})`} hint="فقط اگر در WBS یا بالاسری منظور نشده است" error={fieldErrors.monthlyPersonnel}>
            <MoneyInput id="ce-personnel" value={form.monthlyPersonnel} onChange={(v) => set('monthlyPersonnel', v)} disabled={disabled} />
            <InWbsToggle id="ce-personnel-wbs" checked={form.personnelInWbs} onChange={(v) => set('personnelInWbs', v)} disabled={disabled} />
          </Field>
          <Field id="ce-purchases" label={`خریدهای برنامه‌ریزی‌شدهٔ کارفرمایی (${data.currency})`} error={fieldErrors.plannedEmployerPurchases}>
            <MoneyInput id="ce-purchases" value={form.plannedEmployerPurchases} onChange={(v) => set('plannedEmployerPurchases', v)} disabled={disabled} />
            <InWbsToggle id="ce-purchases-wbs" checked={form.purchasesInWbs} onChange={(v) => set('purchasesInWbs', v)} disabled={disabled} />
          </Field>
          <Field id="ce-other" label={`سایر هزینه‌های ثابت (${data.currency})`} hint="مثلاً بیمه، مجوزها، تجهیز و برچیدن کارگاه" error={fieldErrors.otherFixedCosts}>
            <MoneyInput id="ce-other" value={form.otherFixedCosts} onChange={(v) => set('otherFixedCosts', v)} disabled={disabled} />
          </Field>
          <Field id="ce-risk" label="ذخیرهٔ ریسک" hint="در BAC کل هست، ولی تا هزینه‌ای ثبت نشود جزو AC نیست" error={fieldErrors.riskValue}>
            <div className="flex gap-2">
              <select
                aria-label="نوع ذخیرهٔ ریسک"
                value={form.riskMode}
                disabled={disabled}
                onChange={(e) => set('riskMode', e.target.value === 'amount' ? 'amount' : 'percent')}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <option value="percent">درصد از BAC پایه</option>
                <option value="amount">مبلغ ثابت</option>
              </select>
              {form.riskMode === 'amount' ? (
                <MoneyInput id="ce-risk" value={form.riskValue} onChange={(v) => set('riskValue', v)} disabled={disabled} />
              ) : (
                <input
                  id="ce-risk"
                  inputMode="decimal"
                  dir="ltr"
                  value={form.riskValue}
                  disabled={disabled}
                  onChange={(e) => set('riskValue', e.target.value)}
                  placeholder="0 تا 100"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                />
              )}
            </div>
          </Field>
          <Field id="ce-notes" label="یادداشت">
            <textarea
              id="ce-notes"
              rows={2}
              value={form.notes}
              disabled={disabled}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </Field>
        </div>

        {preview ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">
              پیش‌نمایش با مقادیر فرم — BAC کل {toman(preview.bac.bacTotal)} {data.currency}
            </p>
            <TargetsPanel targets={preview.targets} bacTotal={preview.bac.bacTotal} contractValue={preview.contractValue} currency={data.currency} />
          </div>
        ) : null}

        <IssuesList issues={shownIssues} />

        {data.canEdit ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <Button type="submit" variant="outline" disabled={disabled}>
              {saving === 'draft' ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
              ذخیره (بدون تأیید)
            </Button>
            <Button type="button" disabled={disabled || (shownIssues.some((i) => i.level === 'warning') && !acknowledged)} onClick={() => void save(true)}>
              {saving === 'approve' ? <Spinner /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              ذخیره و تأیید برآورد
            </Button>
            {shownIssues.some((i) => i.level === 'warning') ? (
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-[hsl(var(--primary))]"
                />
                هشدارهای بالا را دیدم و برآورد را با همین داده تأیید می‌کنم
              </label>
            ) : null}
            {message ? (
              <p role="status" className={cn('text-xs', message.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700')}>
                {message.text}
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </SectionCard>
  )
}

/* ----------------------------------------------------------------- BAC */

function BacSection({ data }: { data: CostEstimateOverview }) {
  const [showRows, setShowRows] = useState(false)
  const { bac, direct } = data
  return (
    <SectionCard
      title="اجزای BAC و منبع هر مبلغ"
      action={<CalcTraceTrigger metrics={['estimate.bac_total']} />}
      icon={<Sigma className="h-4 w-4" aria-hidden />}
      hint="BAC پایه = هزینهٔ مستقیم WBS + بالاسری برنامه‌ای + پرسنل خارج از WBS + خریدهای برنامه‌ریزی‌شده + سایر هزینه‌های ثابت. BAC کل = BAC پایه + ذخیرهٔ ریسک."
    >
      {!data.record ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          پیش‌نمایش با داده‌های فعلی؛ برآورد هنوز ذخیره نشده و شاخص‌های EVM بر این عدد تکیه نمی‌کنند.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="py-2 text-right font-semibold">جزء</th>
              <th className="py-2 text-right font-semibold">مبلغ ({data.currency})</th>
              <th className="py-2 text-right font-semibold">وضعیت</th>
              <th className="py-2 text-right font-semibold">محاسبه و منبع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {bac.components.map((c) => (
              <tr key={c.key} className={cn(!c.included && 'text-slate-400')}>
                <td className="py-2.5 font-medium">{c.label}</td>
                <td className="py-2.5 tabular-nums">{c.amount == null ? 'وارد نشده' : toman(c.amount)}</td>
                <td className="py-2.5 text-xs">
                  {c.included ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">در BAC</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{c.note ? 'جمع نمی‌شود' : 'وارد نشده'}</span>
                  )}
                </td>
                <td className="py-2.5 text-xs leading-5 text-slate-500">
                  {c.formula} · {c.source}
                  {c.note ? <span className="block text-amber-700">{c.note}</span> : null}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/70 font-semibold">
              <td className="py-2.5">BAC پایه</td>
              <td className="py-2.5 tabular-nums">{toman(bac.bacBase)}</td>
              <td colSpan={2} className="py-2.5 text-xs font-normal text-slate-500">
                مبنای PV، EV و EAC
              </td>
            </tr>
            <tr>
              <td className="py-2.5">ذخیرهٔ ریسک</td>
              <td className="py-2.5 tabular-nums">{toman(bac.riskReserve)}</td>
              <td colSpan={2} className="py-2.5 text-xs text-slate-500">
                {bac.riskFormula} · تا ثبت هزینهٔ واقعی جزو AC نیست
              </td>
            </tr>
            <tr className="bg-orange-50/60 font-bold">
              <td className="py-2.5">BAC کل</td>
              <td className="py-2.5 tabular-nums">{toman(bac.bacTotal)}</td>
              <td colSpan={2} className="py-2.5 text-xs font-normal text-slate-500">
                جدا از ارزش قرارداد ({toman(data.settings.contractValue)})
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowRows((v) => !v)}
          aria-expanded={showRows}
          className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {showRows ? 'بستن ریز هزینهٔ مستقیم' : `ریز هزینهٔ مستقیم: ${faNumber(direct.rows.length)} ردیف WBS`}
          {direct.missingRows.length ? ` · ${faNumber(direct.missingRows.length)} ردیف بدون بودجه` : ''}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showRows && 'rotate-180')} aria-hidden />
        </button>
        {showRows ? (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold">WBS</th>
                  <th className="px-3 py-2 text-right font-semibold">فعالیت</th>
                  <th className="px-3 py-2 text-right font-semibold">مقدار</th>
                  <th className="px-3 py-2 text-right font-semibold">قیمت واحد</th>
                  <th className="px-3 py-2 text-right font-semibold">بودجه ({data.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {direct.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5 tabular-nums" dir="ltr">{r.wbs ?? '—'}</td>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.quantity ? faNumber(r.quantity, 2) : '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.unitPrice ? toman(r.unitPrice) : '—'}</td>
                    <td className="px-3 py-1.5 font-semibold tabular-nums">{toman(r.budget)}</td>
                  </tr>
                ))}
                {direct.missingRows.map((r) => (
                  <tr key={`m-${r.id}`} className="bg-amber-50/50 text-amber-900">
                    <td className="px-3 py-1.5 tabular-nums" dir="ltr">{r.wbs ?? '—'}</td>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td colSpan={3} className="px-3 py-1.5">بدون بودجه یا قیمت (وزن {faPercent(r.weight)})</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={4} className="px-3 py-2">جمع هزینهٔ مستقیم</td>
                  <td className="px-3 py-2 tabular-nums">{toman(direct.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}

/* -------------------------------------------------------------- Targets */

const TARGET_TONE: Record<TargetLevel, string> = {
  ok: 'border-emerald-200 bg-emerald-50/60',
  warning: 'border-amber-200 bg-amber-50/70',
  critical: 'border-rose-200 bg-rose-50/70',
  none: 'border-slate-200 bg-slate-50/60',
}

/** Target profit, margin and burn rates with the BAC-vs-contract validation. */
function TargetsPanel({ targets, bacTotal, contractValue, currency }: { targets: EstimateTargets; bacTotal: number; contractValue: number | null; currency: string }) {
  const cell = (label: string, value: string, hint: string) => (
    <div className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{hint}</p>
    </div>
  )
  return (
    <div className={cn('space-y-3 rounded-2xl border p-3', TARGET_TONE[targets.level])}>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {cell('سود هدف', toman(targets.targetProfit), `قرارداد ${toman(contractValue)} − BAC کل ${toman(bacTotal)}`)}
        {cell('حاشیهٔ سود', targets.marginPercent == null ? '—' : faPercent(targets.marginPercent), 'سود هدف ÷ مبلغ قرارداد × 100')}
        {cell('نرخ سوختن کل', targets.burnRateMonthly == null ? '—' : `${toman(targets.burnRateMonthly)} / ماه`, `BAC کل ÷ مدت برنامه‌ای (${currency})`)}
        {cell(
          'نرخ سوختن بالاسری',
          targets.overheadPerDay == null ? '—' : `${toman(targets.overheadPerDay)} / روز`,
          targets.durationDays == null ? 'تاریخ‌های مصوب کامل نیست' : `بالاسری کل ÷ ${faNumber(targets.durationDays)} روز`
        )}
      </div>
      {targets.messages.length ? (
        <ul className="space-y-1">
          {targets.messages.map((m) => (
            <li
              key={m.text}
              role="alert"
              className={cn(
                'flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-6',
                m.level === 'critical' ? 'bg-rose-100/70 text-rose-800' : 'bg-amber-100/70 text-amber-900'
              )}
            >
              {m.level === 'critical' ? <AlertOctagon className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />}
              {m.text}
            </li>
          ))}
        </ul>
      ) : targets.level === 'none' ? (
        <p className="text-xs text-slate-600">برای سود هدف و حاشیه، مبلغ قرارداد و اجزای BAC را وارد کنید.</p>
      ) : null}
    </div>
  )
}

function TargetsSection({ data }: { data: CostEstimateOverview }) {
  return (
    <SectionCard
      title="سود هدف و نرخ سوختن"
      icon={<Coins className="h-4 w-4" aria-hidden />}
      action={<CalcTraceTrigger metrics={['estimate.target_profit_pct', 'estimate.overhead_burn_rate', 'estimate.bac_total']} />}
      hint={`سود هدف = مبلغ قرارداد − BAC کل؛ حاشیه = سود ÷ قرارداد. قرمز: BAC کل بیشتر از قرارداد یا حاشیهٔ منفی؛ زرد: حاشیه کمتر از ${TARGET_MARGIN_WARNING_PERCENT}٪.`}
    >
      {!data.record ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">پیش‌نمایش با داده‌های فعلی؛ برآورد هنوز ذخیره نشده است.</p>
      ) : null}
      <TargetsPanel targets={data.targets} bacTotal={data.bac.bacTotal} contractValue={data.settings.contractValue} currency={data.currency} />
    </SectionCard>
  )
}

/* ----------------------------------------------------------------- EVM */

function IndexCard({ label, value, formula, format }: { label: string; value: IndexValue; formula: string; format: 'money' | 'ratio' | 'days' | 'months' }) {
  const text =
    value.value == null
      ? 'داده کافی نیست'
      : format === 'money'
        ? toman(value.value)
        : format === 'ratio'
          ? faNumber(value.value, 2)
          : `${faNumber(value.value, format === 'months' ? 1 : 0)} ${format === 'days' ? 'روز' : 'ماه'}`
  const negative = value.value != null && format === 'money' && value.value < 0
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={cn('mt-1 text-base font-bold tabular-nums', value.value == null ? 'text-slate-400' : negative ? 'text-rose-700' : 'text-slate-900')}>{text}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-slate-500" dir="auto">
        {value.value == null ? value.reason : formula}
      </p>
    </div>
  )
}

function EvmSection({ data }: { data: CostEstimateOverview }) {
  const { evm, progress } = data
  return (
    <SectionCard
      title="شاخص‌های هزینه و ارزش کسب‌شده"
      action={<CalcTraceTrigger metrics={['estimate.cpi', 'estimate.eac', 'estimate.etc', 'estimate.cv', 'estimate.sv']} />}
      icon={<Coins className="h-4 w-4" aria-hidden />}
      hint="PV و EV با وزن برنامه‌ای فعالیت‌ها (همان مبنای پیشرفت تجمعی) و BAC پایه حساب می‌شوند. ذخیرهٔ ریسک در PV/EV نیست. هر نسبت با مخرج صفر «داده کافی نیست» نشان داده می‌شود."
    >
      <p className="mb-3 text-xs text-slate-500 tabular-nums">
        پیشرفت برنامه‌ای {progress.plannedPercent == null ? '—' : faPercent(progress.plannedPercent)} · پیشرفت تأییدشده {progress.earnedPercent == null ? '—' : faPercent(progress.earnedPercent)}
      </p>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <IndexCard label="PV (ارزش برنامه‌ای)" value={evm.pv} formula="BAC پایه × پیشرفت برنامه‌ای" format="money" />
        <IndexCard label="EV (ارزش کسب‌شده)" value={evm.ev} formula="BAC پایه × پیشرفت تأییدشده" format="money" />
        <IndexCard label="AC (هزینهٔ واقعی)" value={{ value: evm.ac }} formula="بالاسری + پیمانکاران + خرید کارفرمایی" format="money" />
        <IndexCard label="CV (انحراف هزینه)" value={evm.cv} formula="EV − AC" format="money" />
        <IndexCard label="SV (انحراف زمانی)" value={evm.sv} formula="EV − PV" format="money" />
        <IndexCard label="CPI" value={evm.cpi} formula="EV ÷ AC" format="ratio" />
        <IndexCard label="SPI" value={evm.spi} formula="EV ÷ PV" format="ratio" />
        <IndexCard label="EAC (برآورد تکمیل)" value={evm.eac} formula="AC + (BAC پایه − EV) ÷ CPI" format="money" />
        <IndexCard label="ETC (هزینهٔ باقی‌مانده)" value={evm.etc} formula="EAC − AC" format="money" />
        <IndexCard label="VAC (انحراف از BAC کل)" value={evm.vac} formula="BAC کل − EAC" format="money" />
        <IndexCard label="حاشیهٔ قراردادی پیش‌بینی" value={evm.margin} formula="ارزش قرارداد − EAC" format="money" />
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">{evm.eacFormula}</p>
    </SectionCard>
  )
}

function ScheduleSection({ data }: { data: CostEstimateOverview }) {
  const s = data.schedule
  const approvedFinish = data.settings.plannedFinish
  return (
    <SectionCard action={<CalcTraceTrigger metrics={['estimate.spi_t']} />} title="پیش‌بینی زمان (Earned Schedule)" icon={<CalendarClock className="h-4 w-4" aria-hidden />} hint={s.basis}>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <IndexCard label="SPI(t)" value={s.spiT} formula="ES ÷ AT" format="ratio" />
        <IndexCard label="مدت برنامه (PD)" value={s.plannedDurationMonths} formula="منحنی PV مبنا" format="months" />
        <IndexCard label="مدت پیش‌بینی (EAC(t))" value={s.eacMonths} formula="PD ÷ SPI(t)" format="months" />
        <IndexCard label="تأخیر پیش‌بینی‌شده" value={s.delayDays} formula="(EAC(t) − PD) × 30.44" format="days" />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="inline text-slate-500">پایان مبنای برنامه: </dt>
          <dd className="inline tabular-nums">{jalaliDate(s.baselineFinish)}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">پایان مصوب (تنظیمات): </dt>
          <dd className="inline tabular-nums">{jalaliDate(approvedFinish)}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">پایان پیش‌بینی‌شده با SPI(t): </dt>
          <dd className="inline tabular-nums">{s.forecastFinish ? jalaliDate(s.forecastFinish) : 'داده کافی نیست'}</dd>
        </div>
      </dl>
    </SectionCard>
  )
}

function ActualSection({ data }: { data: CostEstimateOverview }) {
  return (
    <SectionCard
      title="هزینهٔ واقعی (AC) و منابع آن"
      icon={<Receipt className="h-4 w-4" aria-hidden />}
      hint="همان مدل تب «هزینه تا این لحظه» حسابداری. هر خرید فقط یک بار شمرده می‌شود."
    >
      <ul className="divide-y divide-slate-50 text-sm">
        {data.actual.parts.map((p) => (
          <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-slate-800">{p.label}</span>
              <span className="block text-[11px] text-slate-500">{p.source}</span>
            </span>
            <span className="font-semibold tabular-nums">{toman(p.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between py-2 font-bold">
          <span>AC تا امروز</span>
          <span className="tabular-nums">{toman(data.actual.total)}</span>
        </li>
      </ul>
      {data.actual.excluded.some((e) => e.count > 0) ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600">فقط برای مرجع (در AC جمع نمی‌شود)</p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-slate-500">
            {data.actual.excluded
              .filter((e) => e.count > 0)
              .map((e) => (
                <li key={e.label}>
                  {e.label}: {faNumber(e.count)} مورد، {toman(e.amount)} {data.currency} — {e.reason}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  )
}

/* ---------------------------------------------------------------- View */

export function CostEstimateView({
  projectId,
  overview,
  loading: overviewLoading,
}: {
  projectId: string | null
  overview: ManagerOverview | null
  loading: boolean
}) {
  const { data, setData, loading, error, reload } = useCostEstimate(projectId)
  const settingsKey = useMemo(() => (data ? `${data.projectId}:${data.record?.updatedAt ?? 'new'}` : ''), [data])

  if (!projectId) return <EmptyNote title="پروژه‌ای انتخاب نشده است" />
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <span>{error}</span>
        <button type="button" onClick={() => void reload()} className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold hover:bg-rose-100">
          تلاش دوباره
        </button>
      </div>
    )
  }
  if (!data) return <LoadingRows rows={6} />

  return (
    <CalcTraceProvider traces={data.traces}>
    <div className="space-y-6">
      <Headline data={data} />
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Spinner className="h-3.5 w-3.5" /> در حال به‌روزرسانی…
        </p>
      ) : null}
      <AlertsSection alerts={data.alerts} />
      <SettingsSection key={settingsKey} data={data} projectId={projectId} onSaved={setData} />
      <BacSection data={data} />
      <TargetsSection data={data} />
      <EvmSection data={data} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ScheduleSection data={data} />
        <ActualSection data={data} />
      </div>
      <SectionCard
        title="روند پیشرفت"
        icon={<LineChartIcon className="h-4 w-4" aria-hidden />}
        hint="همان منحنی S داشبورد: برنامه (PV)، پیشرفت ثبت‌شده و ارزش کسب‌شده به درصد تجمعی."
      >
        <SectionBody result={overview?.progress} loading={overviewLoading} rows={4}>
          {(curve) => <ManagerProgressChart curve={curve} />}
        </SectionBody>
      </SectionCard>
    </div>
    </CalcTraceProvider>
  )
}
