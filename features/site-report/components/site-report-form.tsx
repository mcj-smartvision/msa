/**
 * @file features/site-report/components/site-report-form.tsx
 * @purpose فرم ۱۲بخشی قابل پر کردن دستی (+ صوت اختیاری) و پیش‌نمایش چاپ
 * @safe-to-edit CAREFUL
 * @affects تب ثبت گزارش روزانه
 * @depends-on features/site-report/*, shared/components/ui/*, shared/components/common/voice-to-text-button
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { CrewProgressEditor } from '@/features/site-report/components/crew-progress-editor'
import { DelaysEditor, QcEditor, VisitsEditor } from '@/features/site-report/components/event-rows-editor'
import { EquipmentEditor } from '@/features/site-report/components/equipment-editor'
import { HseEditor, SpecialItemsEditor } from '@/features/site-report/components/hse-special-editor'
import { MaterialsEditor } from '@/features/site-report/components/materials-editor'
import { PrintableDailyReport } from '@/features/site-report/components/printable-daily-report'
import { WorkSummaryEditor } from '@/features/site-report/components/work-summary-editor'
import { SITE_REPORT_COPY, SITE_REPORT_SECTION_LABELS } from '@/features/site-report/config'
import { emptyLipartaDailyReport } from '@/features/site-report/lib/empty-report'
import { optionalText } from '@/features/site-report/lib/lines'
import { stampRequiresCompletion } from '@/features/site-report/lib/validate-report'
import { siteReportWeatherFromPayload } from '@/features/site-report/lib/weather-from-site'
import type {
  LipartaDailyReportData,
  SiteReportActivityRef,
  SiteReportAttachedPhoto,
  SiteReportSectionId,
} from '@/features/site-report/lib/types'
import type { WeatherPayload } from '@/features/weather/lib/types'

const COLLAPSE_ORDER: SiteReportSectionId[] = [
  'weather',
  'crews_and_progress',
  'staff_headcount',
  'equipment',
  'materials',
  'work_summary',
  'quality_control',
  'site_visits_and_directives',
  'hse',
  'delays_and_blockers',
  'special_project_items',
  'tomorrow_plan',
  'attached_photos',
  'free_notes',
]

function Collapsible({
  id,
  open,
  onToggle,
  badge,
  children,
}: {
  id: SiteReportSectionId
  open: boolean
  onToggle: () => void
  badge?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm font-semibold text-slate-800 hover:bg-slate-50"
        onClick={onToggle}
      >
        <span>{SITE_REPORT_SECTION_LABELS[id]}</span>
        <span className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              {badge}
            </span>
          ) : null}
          <span className="text-slate-400">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open ? <div className="space-y-2 border-t border-slate-100 px-3 py-3">{children}</div> : null}
    </div>
  )
}

export function SiteReportForm({
  projectName,
  reportNo,
  supervisorName,
  dateShamsi,
  activities,
  liveWeather,
  initial,
  photos,
  onChange,
  onPersist,
}: {
  projectName: string
  reportNo?: string
  supervisorName?: string
  dateShamsi?: string
  activities: SiteReportActivityRef[]
  liveWeather?: WeatherPayload | null
  initial?: LipartaDailyReportData | null
  /** Live uploaded photos for A4 preview */
  photos?: SiteReportAttachedPhoto[]
  onChange?: (report: LipartaDailyReportData) => void
  onPersist?: (report: LipartaDailyReportData) => Promise<void>
}) {
  const [report, setReport] = useState<LipartaDailyReportData>(() =>
    initial ??
      emptyLipartaDailyReport({
        project_name: projectName,
        report_no: reportNo ?? '',
        supervisor_name: supervisorName ?? '',
        date_shamsi: dateShamsi ?? '',
      })
  )
  const [openId, setOpenId] = useState<SiteReportSectionId | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [persistBusy, setPersistBusy] = useState(false)
  const weatherSeeded = useRef(false)
  const hydrated = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const update = useCallback((next: LipartaDailyReportData) => {
    const stamped = stampRequiresCompletion(next)
    setReport(stamped)
    onChangeRef.current?.(stamped)
  }, [])

  /** Sync parent once on mount so ثبت always sees the latest form JSON. */
  useEffect(() => {
    onChangeRef.current?.(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount sync only
  }, [])

  function openPreview() {
    setShowPrint(true)
  }

  function handlePrintA4() {
    setShowPrint(true)
    window.setTimeout(() => {
      window.print()
    }, 200)
  }

  useEffect(() => {
    if (!initial || hydrated.current) return
    hydrated.current = true
    weatherSeeded.current = true
    update(initial)
  }, [initial, update])

  useEffect(() => {
    if (!liveWeather || weatherSeeded.current) return
    const hasManual =
      Boolean(report.weather.condition?.trim()) ||
      report.weather.min_temp_c != null ||
      report.weather.max_temp_c != null
    if (hasManual && initial?.weather) {
      weatherSeeded.current = true
      return
    }
    const seeded = siteReportWeatherFromPayload(liveWeather)
    weatherSeeded.current = true
    update({ ...report, weather: { ...report.weather, ...seeded } })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when live weather arrives
  }, [liveWeather])

  async function analyzeTranscript(text: string) {
    setBusy(true)
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/supervisor/analyze-site-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          existing: report,
          activities,
          header: report.header,
        }),
      })
      const data = (await res.json()) as {
        report?: LipartaDailyReportData
        error?: string
        warning?: string
      }
      if (!res.ok) throw new Error(data.error || SITE_REPORT_COPY.analyzeFailed)
      if (data.report) {
        update(data.report)
        setOkMsg(data.warning || SITE_REPORT_COPY.mergeOk)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : SITE_REPORT_COPY.analyzeFailed)
    } finally {
      setBusy(false)
    }
  }

  const incompleteCrews = report.crews_and_progress.filter((c) => c.requires_completion).length

  return (
    <div className="space-y-3" dir="rtl" lang="fa">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{SITE_REPORT_COPY.title}</h3>
          <p className="text-[11px] text-slate-500">{SITE_REPORT_COPY.mandatoryHint}</p>
          <p className="text-[11px] text-slate-500">{SITE_REPORT_COPY.voiceOptionalHint}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <VoiceToTextButton
            size="sm"
            disabled={busy}
            prompt="گزارش روزانه کارگاه را بگو…"
            onTranscript={(text) => void analyzeTranscript(text)}
          />
          <Button type="button" size="sm" variant="outline" onClick={openPreview}>
            {SITE_REPORT_COPY.printPreview}
          </Button>
          <Button type="button" size="sm" onClick={handlePrintA4}>
            <Printer className="h-4 w-4 ml-1" aria-hidden />
            {SITE_REPORT_COPY.printCta}
          </Button>
        </div>
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {SITE_REPORT_COPY.voiceBusy}
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      {okMsg ? <p className="text-xs text-emerald-700">{okMsg}</p> : null}

      {COLLAPSE_ORDER.map((id) => (
        <Collapsible
          key={id}
          id={id}
          open={openId === id}
          onToggle={() => setOpenId((cur) => (cur === id ? null : id))}
          badge={
            id === 'crews_and_progress' && incompleteCrews > 0
              ? SITE_REPORT_COPY.needsCompletion
              : null
          }
        >
          {id === 'weather' ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">{SITE_REPORT_COPY.weatherFromSiteHint}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherLocation}</Label>
                  <Input
                    value={report.weather.location_name ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: { ...report.weather, location_name: optionalText(e.target.value) },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherCondition}</Label>
                  <Input
                    value={report.weather.condition ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: { ...report.weather, condition: optionalText(e.target.value) },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherMinTemp}</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={report.weather.min_temp_c ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: {
                          ...report.weather,
                          min_temp_c: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherMaxTemp}</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={report.weather.max_temp_c ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: {
                          ...report.weather,
                          max_temp_c: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherLostHours}</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={report.weather.lost_hours ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: {
                          ...report.weather,
                          lost_hours: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherImpact}</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={report.weather.impact_level}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: {
                          ...report.weather,
                          impact_level: e.target.value as LipartaDailyReportData['weather']['impact_level'],
                        },
                      })
                    }
                  >
                    <option value="بدون اثر">بدون اثر</option>
                    <option value="کاهش بازده">کاهش بازده</option>
                    <option value="توقف کامل">توقف کامل</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px]">{SITE_REPORT_COPY.weatherNotes}</Label>
                  <Input
                    value={report.weather.notes ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        weather: { ...report.weather, notes: optionalText(e.target.value) },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          {id === 'crews_and_progress' ? (
            <CrewProgressEditor
              rows={report.crews_and_progress}
              onChange={(crews_and_progress) => update({ ...report, crews_and_progress })}
            />
          ) : null}

          {id === 'staff_headcount' ? (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {(
                [
                  ['client_staff', 'کارفرما'],
                  ['consultant_staff', 'مشاور'],
                  ['contractor_staff', 'پیمانکار'],
                  ['site_hq_staff', 'ستاد کارگاه'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-[11px]">{label}</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    value={report.staff_headcount[key] ?? ''}
                    onChange={(e) =>
                      update({
                        ...report,
                        staff_headcount: {
                          ...report.staff_headcount,
                          [key]: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          {id === 'equipment' ? (
            <EquipmentEditor
              rows={report.equipment}
              onChange={(equipment) => update({ ...report, equipment })}
            />
          ) : null}

          {id === 'materials' ? (
            <MaterialsEditor
              value={report.materials}
              onChange={(materials) => update({ ...report, materials })}
            />
          ) : null}

          {id === 'work_summary' ? (
            <WorkSummaryEditor
              value={report.work_summary}
              onChange={(work_summary) => update({ ...report, work_summary })}
            />
          ) : null}

          {id === 'quality_control' ? (
            <QcEditor
              rows={report.quality_control}
              onChange={(quality_control) => update({ ...report, quality_control })}
            />
          ) : null}

          {id === 'site_visits_and_directives' ? (
            <VisitsEditor
              rows={report.site_visits_and_directives}
              onChange={(site_visits_and_directives) =>
                update({ ...report, site_visits_and_directives })
              }
            />
          ) : null}

          {id === 'hse' ? (
            <HseEditor value={report.hse} onChange={(hse) => update({ ...report, hse })} />
          ) : null}

          {id === 'delays_and_blockers' ? (
            <DelaysEditor
              rows={report.delays_and_blockers}
              onChange={(delays_and_blockers) => update({ ...report, delays_and_blockers })}
            />
          ) : null}

          {id === 'special_project_items' ? (
            <SpecialItemsEditor
              value={report.special_project_items}
              onChange={(special_project_items) => update({ ...report, special_project_items })}
            />
          ) : null}

          {id === 'tomorrow_plan' ? (
            <div className="space-y-2">
              <Label className="text-[11px]">{SITE_REPORT_COPY.tomorrowActivities}</Label>
              <Textarea
                rows={3}
                value={report.tomorrow_plan.planned_activities.join('\n')}
                onChange={(e) =>
                  update({
                    ...report,
                    tomorrow_plan: {
                      ...report.tomorrow_plan,
                      planned_activities: e.target.value.split('\n'),
                    },
                  })
                }
              />
              <Label className="text-[11px]">{SITE_REPORT_COPY.tomorrowMaterials}</Label>
              <Input
                value={report.tomorrow_plan.required_materials ?? ''}
                onChange={(e) =>
                  update({
                    ...report,
                    tomorrow_plan: {
                      ...report.tomorrow_plan,
                      required_materials: optionalText(e.target.value),
                    },
                  })
                }
              />
              <Label className="text-[11px]">{SITE_REPORT_COPY.tomorrowManpower}</Label>
              <Input
                value={report.tomorrow_plan.required_manpower_and_equipment ?? ''}
                onChange={(e) =>
                  update({
                    ...report,
                    tomorrow_plan: {
                      ...report.tomorrow_plan,
                      required_manpower_and_equipment: optionalText(e.target.value),
                    },
                  })
                }
              />
            </div>
          ) : null}

          {id === 'attached_photos' ? (
            <p className="text-xs text-slate-500">{SITE_REPORT_COPY.photosHint}</p>
          ) : null}

          {id === 'free_notes' ? (
            <Textarea
              rows={3}
              value={report.free_notes ?? ''}
              onChange={(e) => update({ ...report, free_notes: optionalText(e.target.value) })}
            />
          ) : null}
        </Collapsible>
      ))}

      {onPersist ? (
        <Button
          type="button"
          className="w-full"
          disabled={persistBusy}
          onClick={() => {
            setPersistBusy(true)
            void onPersist(report).finally(() => setPersistBusy(false))
          }}
        >
          {persistBusy ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
          {SITE_REPORT_COPY.saveStructured}
        </Button>
      ) : null}

      {showPrint ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6 print:static print:inset-auto print:bg-transparent print:p-0"
          role="dialog"
          aria-modal="true"
          aria-label={SITE_REPORT_COPY.printPreview}
          onClick={() => setShowPrint(false)}
        >
          <div
            className="my-4 w-full max-w-[220mm] rounded-xl border border-slate-300 bg-white shadow-xl print:my-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 print:hidden">
              <p className="text-sm font-semibold text-slate-800">{SITE_REPORT_COPY.printPreview}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handlePrintA4}>
                  <Printer className="h-4 w-4 ml-1" aria-hidden />
                  {SITE_REPORT_COPY.printCta}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowPrint(false)}>
                  {SITE_REPORT_COPY.printClose}
                </Button>
              </div>
            </div>
            <div id="site-report-print-root" className="max-h-[80vh] overflow-auto print:max-h-none">
              <PrintableDailyReport report={report} previewMode photos={photos} />
            </div>
          </div>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 12mm; }
              body * { visibility: hidden !important; }
              #site-report-print-root, #site-report-print-root * { visibility: visible !important; }
              #site-report-print-root {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
            }
          `,
        }}
      />
    </div>
  )
}
