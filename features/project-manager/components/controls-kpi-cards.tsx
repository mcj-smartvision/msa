'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Info, Loader2, X } from 'lucide-react'
import type { ExplainedKpi } from '@/shared/types/project-controls'
import { DATA_QUALITY_FA, KPI_STATUS_TOKENS } from '@/features/project-controls/lib/explained-metric'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import { spiDivergenceWarning } from '@/features/project-controls/lib/kpis'
import type { ControlsKpiKey, ControlsSnapshotResult } from '@/features/project-controls/server/get-controls-snapshot'
import { cn } from '@/shared/lib/utils'

const CARDS: { key: ControlsKpiKey; label: string; digits: number }[] = [
  { key: 'spi_t', label: 'SPI(t)', digits: 3 },
  { key: 'sv_t', label: 'SV(t)', digits: 2 },
  { key: 'eac_t', label: 'EAC(t)', digits: 2 },
  { key: 'delay_forecast', label: 'تأخیر پیش‌بینی‌شده', digits: 0 },
  { key: 'tcpi_bac', label: 'TCPI (BAC)', digits: 3 },
  { key: 'ppc', label: 'PPC', digits: 1 },
]

export interface ProjectControlsState {
  data: ControlsSnapshotResult | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useProjectControls(projectId: string | null): ProjectControlsState {
  const [data, setData] = useState<ControlsSnapshotResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/project-manager/controls?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'بارگذاری شاخص‌های کنترل پروژه ناموفق بود')
      setData(body as ControlsSnapshotResult)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری شاخص‌های کنترل پروژه ناموفق بود')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}

function KpiCard({ label, kpi, digits, onDetails }: { label: string; kpi: ExplainedKpi; digits: number; onDetails: () => void }) {
  const tone = KPI_STATUS_TOKENS[kpi.status]
  const hasValue = kpi.value != null
  return (
    <div className={cn('flex flex-col rounded-2xl border p-4 shadow-sm', hasValue ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{label}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{kpi.title_fa}</p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', tone.bg, tone.text, tone.border)}>
          {hasValue ? tone.label_fa : DATA_QUALITY_FA[kpi.data_quality]}
        </span>
      </div>

      {hasValue ? (
        <p className={cn('mt-3 text-2xl font-bold tabular-nums', tone.text)}>
          {faNumber(kpi.value as number, digits)}
          <span className="ms-1.5 text-sm font-medium text-slate-500">{kpi.unit}</span>
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-600">{kpi.reason_fa ?? kpi.interpretation_fa}</p>
      )}

      {kpi.data_quality === 'stale' ? <p className="mt-1 text-[11px] text-amber-700">داده‌ها قدیمی‌اند؛ تاریخ مبنا {jalaliDate(kpi.evidence.asOf)}</p> : null}

      <button
        type="button"
        onClick={onDetails}
        className="mt-auto inline-flex items-center gap-1 self-start pt-3 text-xs font-medium text-sky-700 hover:text-sky-900"
        aria-haspopup="dialog"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        جزئیات
      </button>
    </div>
  )
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      {children}
    </div>
  )
}

export function KpiDetails({ label, kpi, onClose }: { label: string; kpi: ExplainedKpi; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tone = KPI_STATUS_TOKENS[kpi.status]
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`جزئیات ${label}`} className="w-full max-w-2xl rounded-2xl bg-white text-start shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <p className="text-base font-bold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">{kpi.title_fa}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm text-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', tone.bg, tone.text, tone.border)}>{tone.label_fa}</span>
            <span className="text-xs text-slate-500">کیفیت داده: {DATA_QUALITY_FA[kpi.data_quality]}</span>
            <span className="text-xs text-slate-500">· تاریخ مبنا {jalaliDate(kpi.evidence.asOf)}</span>
          </div>
          <Row title="فرمول">
            <p dir="ltr" className="rounded-lg bg-sky-50 px-3 py-2 text-left font-mono text-[13px] text-slate-900">{kpi.formula}</p>
          </Row>
          <Row title="جایگذاری">
            <p dir="ltr" className="rounded-lg bg-sky-50 px-3 py-2 text-left font-mono text-[13px] text-slate-900">{kpi.substitution}</p>
          </Row>
          <Row title="تفسیر">
            <p className="leading-6">{kpi.interpretation_fa}</p>
          </Row>
          {kpi.actionable_decision_fa ? (
            <Row title="اقدام پیشنهادی">
              <p className="leading-6">{kpi.actionable_decision_fa}</p>
            </Row>
          ) : null}
          {kpi.reason_fa ? (
            <Row title="علت کمبود داده">
              <p className="leading-6 text-slate-700">{kpi.reason_fa}</p>
            </Row>
          ) : null}
          {kpi.assumptions?.length ? (
            <Row title="فرض‌ها">
              <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-600">
                {kpi.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Row>
          ) : null}
          <Row title="منابع داده">
            <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-600">
              {kpi.evidence.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </Row>
        </div>
      </div>
    </div>
  )
}

/**
 * «زمان‌بندی» card: SPI(t) is the schedule control value, SPI (EVM) is shown smaller beside it.
 * Each has its own details dialog; a divergence note appears when SPI looks fine but SPI(t) does not.
 */
export function ScheduleSpiCard({ state }: { state: ProjectControlsState }) {
  const [open, setOpen] = useState<'spi_t' | 'spi' | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const spiT = state.data?.kpis.spi_t ?? null
  const spi = state.data?.kpis.spi ?? null
  const warning = spiT && spi ? spiDivergenceWarning(spi, spiT) : null
  const tone = spiT ? KPI_STATUS_TOKENS[spiT.status] : KPI_STATUS_TOKENS.gray
  const spiTone = spi ? KPI_STATUS_TOKENS[spi.status] : KPI_STATUS_TOKENS.gray

  return (
    <div className={cn('flex flex-col rounded-xl border p-4 shadow-sm', spiT?.value != null ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">زمان‌بندی — SPI(t)</p>
        {spiT ? (
          <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', tone.bg, tone.text, tone.border)}>
            {spiT.value != null ? tone.label_fa : DATA_QUALITY_FA[spiT.data_quality]}
          </span>
        ) : null}
      </div>

      {!spiT ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {state.error ?? 'در حال محاسبه…'}
        </p>
      ) : spiT.value != null ? (
        <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', tone.text)}>{faNumber(spiT.value, 3)}</p>
      ) : (
        <p className="mt-1.5 text-xs leading-5 text-slate-600">{spiT.reason_fa ?? spiT.interpretation_fa}</p>
      )}

      {spi ? (
        <p className="mt-1 text-xs text-slate-500">
          SPI (EVM):{' '}
          {spi.value != null ? (
            <span className={cn('font-semibold tabular-nums', spiTone.text)}>{faNumber(spi.value, 3)}</span>
          ) : (
            <span>{DATA_QUALITY_FA[spi.data_quality]}</span>
          )}
        </p>
      ) : null}

      {warning ? (
        <p role="note" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-5 text-amber-800">
          {warning}
        </p>
      ) : null}

      {spiT && spi ? (
        <div className="mt-auto flex flex-wrap gap-x-3 pt-2">
          <button type="button" onClick={() => setOpen('spi_t')} aria-haspopup="dialog" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900">
            <Info className="h-3.5 w-3.5" aria-hidden />
            جزئیات SPI(t)
          </button>
          <button type="button" onClick={() => setOpen('spi')} aria-haspopup="dialog" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900">
            <Info className="h-3.5 w-3.5" aria-hidden />
            جزئیات SPI
          </button>
        </div>
      ) : null}

      {open === 'spi_t' && spiT ? <KpiDetails label="SPI(t)" kpi={spiT} onClose={close} /> : null}
      {open === 'spi' && spi ? <KpiDetails label="SPI (EVM)" kpi={spi} onClose={close} /> : null}
    </div>
  )
}

/** Earned Schedule, TCPI and PPC cards on the explainable engine (`/api/project-manager/controls`). */
export function ControlsKpiCards({ state }: { state: ProjectControlsState }) {
  const { data, loading, error } = state
  const [openKey, setOpenKey] = useState<ControlsKpiKey | null>(null)
  const close = useCallback(() => setOpenKey(null), [])
  const open = openKey && data ? CARDS.find((c) => c.key === openKey) : null

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">شاخص‌های کنترل پروژه</h2>
        {data ? <span className="text-xs text-slate-500">تاریخ وضعیت {jalaliDate(data.statusDate)}</span> : null}
      </div>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((card) => (
            <KpiCard key={card.key} label={card.label} kpi={data.kpis[card.key]} digits={card.digits} onDetails={() => setOpenKey(card.key)} />
          ))}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          در حال محاسبهٔ شاخص‌ها…
        </div>
      ) : null}
      {open && data ? <KpiDetails label={open.label} kpi={data.kpis[open.key]} onClose={close} /> : null}
    </section>
  )
}
