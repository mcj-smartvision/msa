'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import {
AlertOctagon,
ArrowUpLeft,
CheckCircle2,
Clock,
Construction,
GitCommit,
HardHat,
Package,
ShieldCheck,
Sparkles,
TrendingDown,
TrendingUp,
TriangleAlert,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber, jalaliDate, relativeTimeFa } from '@/features/manager/lib/format'
import type {
ManagerBlocker,
ManagerBlockerCategory,
ManagerBlockers,
ManagerCriticalDelays,
ManagerDailyDelta,
SectionResult,
} from '@/features/manager/lib/overview-types'
import { InfoHint, SectionBody } from './manager-ui'
import { CriticalFrontsList } from './critical-fronts-list'

const DAY_MS = 86_400_000

function pct(value: number, digits = 2): string {
  return `${faNumber(Math.abs(value), digits)}٪`
}

function signed(value: number, digits = 2): string {
  if (Math.abs(value) < 0.005) return pct(0, digits)
  return `${value < 0 ? '−' : '+'}${pct(value, digits)}`
}

function CardShell({
  className,
  icon,
  title,
  hint,
  badge,
  children,
}: {
  className?: string
  icon: ReactNode
  title: string
  hint: ReactNode
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500">
            {icon}
          </span>
          <h2 className="text-[15px] font-bold leading-snug tracking-tight text-slate-800">{title}</h2>
          <InfoHint label={title}>{hint}</InfoHint>
        </div>
        {badge}
      </header>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------ Daily delta */

function DailyDeltaBody({ data }: { data: ManagerDailyDelta }) {
  const planned = data.plannedPercent
  const actual = data.actualPercent
  const nothingPlanned = data.fulfillmentPercent == null
  const fulfillment = data.fulfillmentPercent ?? 0
  const tone = nothingPlanned
    ? actual > 0
      ? 'good'
      : 'none'
    : fulfillment >= 95
      ? 'good'
      : fulfillment >= 50
        ? 'warn'
        : 'bad'
  const actualColor =
    tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-rose-600' : 'text-slate-400'
  const behind = !nothingPlanned && data.deltaPercent < -0.005
  const staleHours = data.lastProgressAt ? (Date.now() - Date.parse(data.lastProgressAt)) / 3_600_000 : null
  const extra = data.reportedActivities - data.plannedReportedActivities

  return (
    <>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">
            برنامهٔ مصوب امروز
          </dt>
          <dd className="mt-1.5 text-2xl font-black leading-none tracking-tight tabular-nums text-slate-900">{pct(planned)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">پیشرفت واقعی ثبت‌شده</dt>
          <dd className={cn('mt-1.5 text-2xl font-black leading-none tracking-tight tabular-nums', actualColor)}>{pct(actual)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset',
            behind
              ? tone === 'bad'
                ? 'bg-rose-500/10 text-rose-700 ring-rose-600/15'
                : 'bg-amber-500/10 text-amber-700 ring-amber-600/15'
              : 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/15'
          )}
        >
          {behind ? <TrendingDown className="h-3.5 w-3.5" aria-hidden /> : <TrendingUp className="h-3.5 w-3.5" aria-hidden />}
          <span className="sr-only">انحراف روز: </span>
          {signed(data.deltaPercent)}
        </span>
        <span className={cn('text-xs font-semibold', behind ? (tone === 'bad' ? 'text-rose-700' : 'text-amber-700') : 'text-emerald-700')}>
          {nothingPlanned
            ? 'برای امروز سهمی در برنامه تعریف نشده است'
            : behind
              ? 'افت راندمان شیفت'
              : 'مطابق یا جلوتر از برنامهٔ امروز'}
        </span>
      </div>

      {!nothingPlanned ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500">تحقق برنامهٔ امروز</span>
            <span className="font-bold tabular-nums text-slate-800">{pct(fulfillment, 0)}</span>
          </div>
          <div
            className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="تحقق برنامهٔ امروز"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(100, fulfillment))}
          >
            <div
              className={cn(
                'absolute inset-y-0 right-0 rounded-full bg-gradient-to-l transition-[width] duration-500',
                tone === 'good' ? 'from-emerald-300 to-emerald-500' : tone === 'warn' ? 'from-amber-300 to-amber-500' : 'from-rose-300 to-rose-500'
              )}
              style={{ width: `${Math.max(0, Math.min(100, fulfillment))}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        <p className="flex gap-2 rounded-xl bg-slate-50/80 p-3 text-xs leading-6 text-slate-600">
          <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
          <span>
            <strong className="font-semibold text-slate-700">خلاصهٔ سیستم: </strong>
            {data.baselineEnded ? 'دورهٔ برنامهٔ مبنا پیش از امروز به پایان رسیده و برای امروز سهمی تعریف نمی‌کند. ' : ''}
            {data.plannedActivities > 0
              ? `${faNumber(data.plannedReportedActivities)} فعالیت از ${faNumber(data.plannedActivities)} فعالیت برنامه‌ای امروز پیشرفت ثبت کرده‌اند`
              : 'فعالیتی برای امروز زمان‌بندی نشده است'}
            {extra > 0 ? ` و ${faNumber(extra)} فعالیت خارج از برنامهٔ امروز هم پیش رفته‌اند` : ''}
            {data.overdueActivities > 0 ? `؛ ${faNumber(data.overdueActivities)} فعالیت از موعد مبنا گذشته و هنوز ناتمام‌اند` : ''}
            {'؛ '}
            {data.lastProgressAt
              ? staleHours != null && staleHours > 24
                ? `آخرین ثبت پیشرفت ${relativeTimeFa(data.lastProgressAt)} بوده است`
                : `آخرین ثبت پیشرفت ${relativeTimeFa(data.lastProgressAt)}`
              : 'هنوز هیچ پیشرفتی در سامانه ثبت نشده است'}
            {data.lastDailyReport
              ? `. آخرین گزارش روزانه: ${jalaliDate(data.lastDailyReport.date)} (${data.lastDailyReport.approved ? 'تأییدشده' : 'منتظر تأیید'}).`
              : '.'}
          </span>
        </p>
      </div>
    </>
  )
}

export function DailyDeltaCard({
  result,
  loading,
  today,
  className,
}: {
  result: SectionResult<ManagerDailyDelta> | undefined
  loading: boolean
  today: string | null
  className?: string
}) {
  return (
    <CardShell
      className={className}
      icon={<Clock className="h-4 w-4" aria-hidden />}
      title="عملکرد 24 ساعت گذشته"
      hint="«برنامهٔ مصوب امروز» سهم یک روز از برنامهٔ مبنا بر مبنای وزن فیزیکی همهٔ فعالیت‌های برنامه است؛ اگر برنامهٔ مبنا پیش از امروز تمام شده باشد، سهم امروز از تاریخ‌های برنامهٔ به‌روز محاسبه می‌شود. «پیشرفت واقعی» مجموع پیشرفت‌های ثبت‌شده در 24 ساعت گذشته با همان وزن‌هاست. عدد کهربایی یعنی بخشی از برنامهٔ امروز محقق شده و قرمز یعنی کمتر از نیمی از آن."
      badge={
        today ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
            {jalaliDate(today)}
          </span>
        ) : null
      }
    >
      <SectionBody result={result} loading={loading} rows={3}>
        {(data) => <DailyDeltaBody data={data} />}
      </SectionBody>
    </CardShell>
  )
}

/* ----------------------------------------------------- Blockers & delays */

const BLOCKER_ICON: Record<ManagerBlockerCategory, ComponentType<{ className?: string }>> = {
  site: HardHat,
  materials: Package,
  quality: ShieldCheck,
  schedule: GitCommit,
}

const BLOCKER_LABEL: Record<ManagerBlockerCategory, string> = {
  site: 'جبههٔ کاری',
  materials: 'تأمین مصالح',
  quality: 'کیفیت و نظارت',
  schedule: 'برنامه‌ریزی',
}

function ageDays(since: string | null): number | null {
  if (!since) return null
  const t = Date.parse(since.length === 10 ? `${since}T00:00:00` : since)
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / DAY_MS)) : null
}

function BlockerRow({ item }: { item: ManagerBlocker }) {
  const Icon = BLOCKER_ICON[item.category]
  const critical = item.level === 'critical'
  const age = ageDays(item.since)
  return (
    <li
      className={cn(
        'flex gap-3 rounded-xl border p-3',
        critical ? 'border-rose-100 bg-rose-50/60' : 'border-amber-100 bg-amber-50/50'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white',
          critical ? 'text-rose-600' : 'text-amber-600'
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 text-[13px] font-bold leading-6 text-slate-800">
            <span className="font-medium text-slate-500">{BLOCKER_LABEL[item.category]}: </span>
            {item.title}
          </p>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset',
              critical ? 'bg-rose-500/10 text-rose-700 ring-rose-600/15' : 'bg-amber-500/10 text-amber-700 ring-amber-600/15'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', critical ? 'bg-rose-500' : 'bg-amber-500')} aria-hidden />
            {critical ? 'بحرانی' : 'معلق'}
            {age != null && age > 0 ? ` · ${faNumber(age)} روز معوق` : ''}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">
          <span className="text-slate-500">اثر: </span>
          {item.impact}
        </p>
        {item.owner ? (
          <p className="text-[11px] leading-5 text-slate-500">
            مسئول: <span className="font-medium text-slate-700">{item.owner}</span>
          </p>
        ) : null}
      </div>
    </li>
  )
}

function SubHeader({ icon, title, count }: { icon: ReactNode; title: string; count?: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-800">
      {icon}
      <span className="min-w-0 flex-1">{title}</span>
      {count}
    </h3>
  )
}

function CountPill({ value, tone }: { value: number; tone: 'rose' | 'amber' | 'slate' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
        tone === 'rose' ? 'bg-rose-500/10 text-rose-700' : tone === 'amber' ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-500/10 text-slate-600'
      )}
    >
      {faNumber(value)}
    </span>
  )
}

function Calm({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 text-xs leading-6">
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <div>
        <p className="font-semibold text-emerald-800">{title}</p>
        <p className="text-emerald-700/90">{description}</p>
      </div>
    </div>
  )
}

export function BlockersDelaysCard({
  blockers,
  delays,
  loading,
  ganttHref,
  className,
}: {
  blockers: SectionResult<ManagerBlockers> | undefined
  delays: SectionResult<ManagerCriticalDelays> | undefined
  loading: boolean
  ganttHref?: string
  className?: string
}) {
  const blockerCount = blockers?.status === 'ok' ? blockers.data.items.length : null
  return (
    <CardShell
      className={className}
      icon={<Construction className="h-4 w-4" aria-hidden />}
      title="گلوگاه‌های فعال و جبهه‌های بحرانی"
      hint="موانع از دستور کارهای «متوقف» برنامهٔ روزانهٔ کارگاه، کسری انبار، NCRهای بحرانی و هشدارهای باز برنامه‌ریزی جمع می‌شوند. تأخیر هر فعالیت = پایان پیش‌بینی (یا امروز، اگر موعدش گذشته) منهای پایان برنامهٔ مبنا. با شبکهٔ CPM فقط فعالیت‌های ناتمام روی مسیر بحرانی یا با شناوری صفر/منفی و Total Float آن‌ها نمایش داده می‌شود؛ بدون CPM، همهٔ فعالیت‌های عقب از baseline با گزارش دادهٔ ناقص. پیشرفت برنامه = سهم سپری‌شدهٔ بازهٔ مبنا (روز تقویمی). علت/مانع از هشدارهای باز و دستور کارهای متوقف امروز."
      badge={
        ganttHref ? (
          <Link
            href={ganttHref}
            className="group/link inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <span className="hidden sm:inline">مشاهده همه جبهه‌ها (Gantt)</span>
            <span className="sm:hidden">Gantt</span>
            <ArrowUpLeft className="h-3.5 w-3.5 transition-transform group-hover/link:-translate-x-0.5 group-hover/link:-translate-y-0.5" aria-hidden />
          </Link>
        ) : null
      }
    >
      <div className="grid flex-1 gap-5 md:grid-cols-2 md:gap-0 md:divide-x md:divide-x-reverse md:divide-slate-100">
        <div className="md:pl-5">
          <SubHeader
            icon={<AlertOctagon className="h-4 w-4 text-rose-500" aria-hidden />}
            title={blockerCount ? `موانع و توقفات فعال کارگاه (${faNumber(blockerCount)} مورد نیازمند رفع)` : 'موانع و توقفات فعال کارگاه'}
          />
          <SectionBody result={blockers} loading={loading} rows={3}>
            {(data) =>
              data.items.length === 0 ? (
                <Calm
                  title="مانع فعالی ثبت نشده است"
                  description={`بررسی‌شده: ${data.checkedSources.join('، ')}.`}
                />
              ) : (
                <ul className="space-y-2.5">
                  {data.items.slice(0, 4).map((item) => (
                    <BlockerRow key={item.id} item={item} />
                  ))}
                  {data.items.length > 4 ? (
                    <li className="text-xs text-slate-500">و {faNumber(data.items.length - 4)} مورد دیگر</li>
                  ) : null}
                </ul>
              )
            }
          </SectionBody>
        </div>

        <div className="md:pr-5">
          <SubHeader
            icon={<TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden />}
            title={
              delays?.status === 'ok' && delays.data.mode === 'baseline'
                ? 'جبهه‌های تأخیردار نسبت به برنامهٔ مبنا'
                : 'مهم‌ترین جبهه‌های تأخیردار در مسیر بحرانی'
            }
            count={delays?.status === 'ok' && delays.data.total > 0 ? <CountPill value={delays.data.total} tone="rose" /> : undefined}
          />
          <SectionBody result={delays} loading={loading} rows={3}>
            {(data) => <CriticalFrontsList data={data} />}
          </SectionBody>
        </div>
      </div>
    </CardShell>
  )
}
