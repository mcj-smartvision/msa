'use client'

import { Check, CircleDashed, Clock3, ListChecks, X } from 'lucide-react'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { Badge } from '@/components/ui/badge'
import { CriticalBadge } from '@/components/schedule/task-status-badge'
import { PmMetricHelpButton } from '@/components/project-manager/pm-metric-help-button'
import type { PlanComplianceRow, PlanComplianceSummary } from '@/lib/project-manager/plan-compliance'
import { cn } from '@/lib/utils'

interface PmPlanComplianceTableProps {
  compliance: PlanComplianceSummary
  isFa?: boolean
  isRtl?: boolean
}

const CHECK_META: Record<
  PlanComplianceRow['check'],
  { fa: string; en: string; icon: typeof Check; className: string }
> = {
  done: {
    fa: 'انجام شده',
    en: 'Done',
    icon: Check,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  on_track: {
    fa: 'مطابق برنامه',
    en: 'On track',
    icon: Check,
    className: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  behind: {
    fa: 'عقب از برنامه',
    en: 'Behind',
    icon: X,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  not_started: {
    fa: 'شروع نشده',
    en: 'Not started',
    icon: CircleDashed,
    className: 'bg-amber-100 text-amber-900 border-amber-200',
  },
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'emerald' | 'sky' | 'red' | 'amber' | 'slate'
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    sky: 'bg-sky-50 text-sky-800 border-sky-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }
  return (
    <div className={cn('rounded-xl border px-3 py-2 min-w-[5.5rem]', tones[tone])}>
      <p className="text-[10px] font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
    </div>
  )
}

export function PmPlanComplianceTable({
  compliance,
  isFa = true,
  isRtl,
}: PmPlanComplianceTableProps) {
  if (!compliance.hasSchedule) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">
        {isFa
          ? 'برنامه زمان‌بندی وارد نشده — ابتدا MSP را در بخش زمان‌بندی پروژه بارگذاری کنید.'
          : 'No schedule imported yet — upload MSP in project schedule first.'}
      </div>
    )
  }

  if (!compliance.shouldShowChecklist) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-6 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-amber-950">
          <Clock3 className="h-5 w-5" />
          {isFa ? 'چک‌لیست انطباق هنوز فعال نیست' : 'Compliance checklist not active yet'}
        </div>
        <p className="text-sm text-amber-900/90 leading-relaxed">
          {isFa
            ? 'وقتی تاریخ واقعی شروع پروژه ثبت شود و آن تاریخ قبل از امروز باشد، اینجا جدول تیک‌دار «کارهای تا امروز» نمایش داده می‌شود: چه چیزی انجام شده، چه چیزی مانده، و چه چیزی از برنامه عقب است.'
            : 'Once actual project start is set and is on/before today, a checkmarked “work due by today” table appears here.'}
        </p>
        <p className="text-xs text-amber-800">
          {isFa
            ? 'مسیر: ادمین پروژه → زمان‌بندی → تأیید تاریخ واقعی شروع'
            : 'Path: Project admin → Schedule → Confirm actual start'}
        </p>
      </div>
    )
  }

  const title = isFa ? 'انطباق برنامه تا امروز' : 'Plan compliance through today'
  const subtitle = isFa
    ? 'فعالیت‌هایی که طبق برنامه باید تا امروز شروع یا تمام شده باشند — با تیک وضعیت'
    : 'Activities that should have started or finished by today — with status checks'

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', isRtl && 'text-right')}>
      <div className="border-b bg-gradient-to-l from-orange-50/80 via-card to-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5 text-orange-600" />
              {title}
              <PmMetricHelpButton metricId="plan-compliance" isFa={isFa} />
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isFa ? 'شروع واقعی:' : 'Actual start:'}{' '}
              <FormattedDate value={compliance.actualStart} />
              <span className="mx-2 opacity-40">·</span>
              {isFa ? 'تا تاریخ:' : 'As of:'} <FormattedDate value={compliance.asOfDate} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip label={isFa ? 'مطابق' : 'On track'} value={compliance.onTrack} tone="sky" />
            <StatChip label={isFa ? 'انجام‌شده' : 'Done'} value={compliance.done} tone="emerald" />
            <StatChip label={isFa ? 'عقب' : 'Behind'} value={compliance.behind} tone="red" />
            <StatChip
              label={isFa ? 'شروع‌نشده' : 'Not started'}
              value={compliance.notStarted}
              tone="amber"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background/80 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{isFa ? 'میانگین برنامه' : 'Avg planned'}</p>
            <p className="text-lg font-bold tabular-nums">{compliance.avgPlanned}%</p>
          </div>
          <div className="rounded-xl border bg-background/80 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{isFa ? 'میانگین واقعی' : 'Avg actual'}</p>
            <p className="text-lg font-bold tabular-nums">{compliance.avgActual}%</p>
          </div>
          <div className="rounded-xl border bg-background/80 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{isFa ? 'انحراف' : 'Variance'}</p>
            <p
              className={cn(
                'text-lg font-bold tabular-nums',
                compliance.variance < -5
                  ? 'text-red-600'
                  : compliance.variance > 5
                    ? 'text-emerald-600'
                    : 'text-foreground'
              )}
            >
              {compliance.variance > 0 ? '+' : ''}
              {compliance.variance}%
            </p>
          </div>
        </div>
      </div>

      {compliance.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground px-5 py-8 text-center">
          {isFa
            ? 'تا امروز فعالیتی که باید شروع شده باشد وجود ندارد.'
            : 'No activities were due to have started by today.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="px-3 py-2.5 font-medium text-start w-10">{isFa ? 'وضعیت' : 'Check'}</th>
                <th className="px-3 py-2.5 font-medium text-start">{isFa ? 'WBS' : 'WBS'}</th>
                <th className="px-3 py-2.5 font-medium text-start min-w-[12rem]">
                  {isFa ? 'فعالیت' : 'Activity'}
                </th>
                <th className="px-3 py-2.5 font-medium text-start whitespace-nowrap hidden md:table-cell">
                  {isFa ? 'بازه برنامه' : 'Plan window'}
                </th>
                <th className="px-3 py-2.5 font-medium text-end whitespace-nowrap">
                  {isFa ? 'برنامه' : 'Plan'}
                </th>
                <th className="px-3 py-2.5 font-medium text-end whitespace-nowrap">
                  {isFa ? 'واقعی' : 'Actual'}
                </th>
                <th className="px-3 py-2.5 font-medium text-end whitespace-nowrap hidden sm:table-cell">
                  {isFa ? 'مانده' : 'Left'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {compliance.rows.map((row) => {
                const meta = CHECK_META[row.check]
                const Icon = meta.icon
                const isPastDueIncomplete =
                  Boolean(row.finish) &&
                  compliance.asOfDate > row.finish! &&
                  row.actualPercent < 100
                return (
                  <tr
                    key={row.taskId}
                    className={cn(
                      'hover:bg-muted/25',
                      isPastDueIncomplete &&
                        'bg-orange-100/95 border-s-4 border-s-orange-500 hover:bg-orange-100',
                      !isPastDueIncomplete && row.check === 'behind' && 'bg-red-50/40',
                      !isPastDueIncomplete && row.check === 'done' && 'bg-emerald-50/30'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full border',
                          meta.className
                        )}
                        title={isFa ? meta.fa : meta.en}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-xs">
                      {row.wbs || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium leading-snug">{row.name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {row.isCritical ? <CriticalBadge /> : null}
                        {isPastDueIncomplete ? (
                          <Badge className="text-[10px] bg-orange-200 text-orange-950 border border-orange-400">
                            {isFa ? 'تاریخ گذشته' : 'Past due'}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className={cn('text-[10px]', meta.className)}>
                          {isFa ? meta.fa : meta.en}
                        </Badge>
                        {row.daysLate > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {row.daysLate} {isFa ? 'روز تأخیر' : 'd late'}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      <FormattedDate value={row.start} />
                      <span className="mx-1 opacity-50">→</span>
                      <FormattedDate value={row.finish} />
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{row.plannedPercent}%</td>
                    <td className="px-3 py-2.5 text-end">
                      <span className="font-semibold tabular-nums">{row.actualPercent}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground hidden sm:table-cell">
                      {row.remainingPercent}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
