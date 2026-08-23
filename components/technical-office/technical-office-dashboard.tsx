'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/components/i18n/locale-provider'
import { getTechnicalOfficeMessages } from '@/lib/i18n/technical-office'
import type { DashboardUserContext } from '@/types/dashboard'
import { PageHeader } from '@/components/admin/shared'
import { ProjectDrawingsPanel } from '@/components/technical-office/project-drawings-panel'

type PackageRow = {
  id: string
  name: string
  task_uid: number
  wbs: string | null
  category: string | null
  location_text: string | null
  planned_qty: number | null
  uom_text: string | null
  crew_text: string | null
  payment_flag: string
  payment_flag_reason: string | null
  ops_status: string
  pm_risk_acknowledged: boolean
}

export function TechnicalOfficeDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
}: {
  initialContext: DashboardUserContext
  projectOptions: Array<{ id: string; name: string }>
  initialProjectId: string | null
}) {
  const { locale } = useLocale()
  const t = getTechnicalOfficeMessages(locale)
  const [projectId, setProjectId] = useState(initialProjectId ?? projectOptions[0]?.id ?? '')
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: '',
    locationText: '',
    plannedQty: '',
    uomText: '',
    crewText: '',
    paymentFlag: 'NotForPayment',
    reason: '',
  })

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? null,
    [packages, selectedId]
  )

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/site-ops/operational-tasks?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.tasks ?? []) as PackageRow[]
        setPackages(list)
        if (list[0]) {
          setSelectedId(list[0].id)
          hydrate(list[0])
        }
      })
  }, [projectId])

  function hydrate(pkg: PackageRow) {
    setForm({
      category: pkg.category ?? '',
      locationText: pkg.location_text ?? '',
      plannedQty: pkg.planned_qty != null ? String(pkg.planned_qty) : '',
      uomText: pkg.uom_text ?? '',
      crewText: pkg.crew_text ?? '',
      paymentFlag: pkg.payment_flag ?? 'NotForPayment',
      reason: pkg.payment_flag_reason ?? '',
    })
  }

  async function saveEnrich() {
    if (!selectedId) return
    setMessage(null)
    const res = await fetch(`/api/site-ops/packages/${selectedId}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: form.category,
        locationText: form.locationText,
        plannedQty: form.plannedQty === '' ? null : Number(form.plannedQty),
        uomText: form.uomText,
        crewText: form.crewText,
        opsStatus: 'Ready',
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || t.error)
      return
    }
    setMessage(t.saved)
    setPackages((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...data.package } : p)))
  }

  async function saveFlag() {
    if (!selectedId) return
    setMessage(null)
    const res = await fetch(`/api/site-ops/packages/${selectedId}/payment-flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag: form.paymentFlag, reason: form.reason }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || t.error)
      return
    }
    setMessage(t.saved)
    setPackages((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...data.package } : p)))
  }

  const riskPackages = packages.filter(
    (p) => p.payment_flag === 'NeedsChangeReview' || p.payment_flag === 'QuantityIncomplete'
  )

  const dir = locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <div className="mx-auto max-w-6xl space-y-8" dir={dir}>
      <PageHeader title={t.title} description={t.subtitle} />
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
        {t.polesExample}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          پروژه
          <select
            className="mt-1 block min-w-[220px] rounded-lg border px-3 py-2"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Link
          href={`/site-ops?projectId=${projectId}`}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {t.openSiteOps}
        </Link>
        <Link
          href={`/site-ops/exceptions?projectId=${projectId}`}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {t.exceptions}
        </Link>
      </div>

      <ProjectDrawingsPanel
        projectId={projectId}
        canUpload
        fa={locale === 'fa' || locale === 'ar'}
      />

      {packages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.seedHint}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border bg-white p-3 space-y-1 max-h-[560px] overflow-auto">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.packages}
            </p>
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => {
                  setSelectedId(pkg.id)
                  hydrate(pkg)
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-start text-sm ${
                  selectedId === pkg.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-medium truncate">{pkg.name}</div>
                <div className={`text-xs mt-0.5 ${selectedId === pkg.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {pkg.payment_flag} · {pkg.ops_status}
                </div>
              </button>
            ))}
          </aside>

          {selected && (
            <section className="rounded-2xl border bg-white p-5 space-y-5">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  UID {selected.task_uid} · WBS {selected.wbs ?? '—'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.category} value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
                <Field label={t.location} value={form.locationText} onChange={(v) => setForm((f) => ({ ...f, locationText: v }))} />
                <Field label={t.quantity} value={form.plannedQty} onChange={(v) => setForm((f) => ({ ...f, plannedQty: v }))} />
                <Field label={t.uom} value={form.uomText} onChange={(v) => setForm((f) => ({ ...f, uomText: v }))} />
                <Field label={t.crew} value={form.crewText} onChange={(v) => setForm((f) => ({ ...f, crewText: v }))} className="sm:col-span-2" />
              </div>
              <button type="button" onClick={() => void saveEnrich()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                {t.enrich}
              </button>

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium">{t.paymentFlag}</h3>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={form.paymentFlag}
                  onChange={(e) => setForm((f) => ({ ...f, paymentFlag: e.target.value }))}
                >
                  <option value="NotForPayment">{t.flagNotForPayment}</option>
                  <option value="PaymentReady">{t.flagPaymentReady}</option>
                  <option value="QuantityIncomplete">{t.flagQtyIncomplete}</option>
                  <option value="NeedsChangeReview">{t.flagNeedsReview}</option>
                </select>
                <Field label={t.reason} value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} />
                <button type="button" onClick={() => void saveFlag()} className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {t.paymentFlag}
                </button>
              </div>
              {message && <p className="text-sm">{message}</p>}
            </section>
          )}
        </div>
      )}

      {riskPackages.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
          <h3 className="font-semibold">{t.exceptions}</h3>
          <ul className="space-y-2 text-sm">
            {riskPackages.map((p) => (
              <li key={p.id} className="rounded-xl bg-white border px-3 py-2">
                <span className="font-medium">{p.name}</span>
                <span className="ms-2 text-amber-800">{p.payment_flag}</span>
                {p.payment_flag_reason ? (
                  <p className="text-muted-foreground mt-1">{p.payment_flag_reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <label className={`text-sm block ${className}`}>
      {label}
      <input
        className="mt-1 block w-full rounded-lg border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
