'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Download } from 'lucide-react'
import { SeverityBadge, StatusBadge, statusLabel } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import {
getCamera,
getContractor,
getIncidentById,
getRule,
getZone,
} from '@/features/hse/lib/mock-data'
import { HSE_BASE } from '@/features/hse/lib/nav'
import type { DecisionAction, HseIncident } from '@/features/hse/lib/types'

const VERDICT_LABEL: Record<HseIncident['aiVerdict'], string> = {
  likely_violation: 'احتمال تخلف',
  uncertain: 'نامشخص',
  likely_false_positive: 'احتمال مثبت کاذب',
}

const ACTION_LABEL: Record<DecisionAction, string> = {
  ai_verify: 'تأیید هوش مصنوعی',
  acknowledge: 'دریافت',
  confirm: 'تأیید',
  dismiss: 'رد',
  escalate: 'ارجاع',
  assign: 'تخصیص',
  close: 'بستن',
  note: 'یادداشت',
}

const CA_STATUS_LABEL: Record<HseIncident['correctiveActions'][number]['status'], string> = {
  open: 'باز',
  in_progress: 'در حال انجام',
  done: 'انجام‌شده',
}

export function IncidentDetailPage({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const backHref = returnTo?.startsWith('/') ? returnTo : `${HSE_BASE}/incidents`
  const backLabel = returnTo?.includes('site-supervisor')
    ? 'بازگشت به ایمنی و اخطارها'
    : returnTo
      ? 'بازگشت'
      : 'بازگشت'

  const incident = getIncidentById(id)

  if (!incident) {
    return (
      <div className="space-y-4" dir="rtl" lang="fa">
        <HsePageHeader
          title="حادثه یافت نشد"
          description="شناسه درخواست‌شده در مجموعه داده نمایشی نیست."
        />
        <Panel title="رکورد موجود نیست">
          <EmptyRow>
            حادثه‌ای با شناسه <span className="font-mono">{id}</span> وجود ندارد.
          </EmptyRow>
          <div className="mt-2 text-center">
            <Button asChild size="sm" variant="outline">
              <Link href={backHref}>
                <ArrowRight className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    )
  }

  const zone = getZone(incident.zoneId)
  const camera = getCamera(incident.cameraId)
  const rule = getRule(incident.ruleId)
  const contractor = incident.contractorId ? getContractor(incident.contractorId) : null

  function exportReport() {
    const payload = {
      code: incident!.code,
      title: incident!.title,
      severity: incident!.severity,
      status: incident!.status,
      zone: zone?.name,
      camera: camera?.name,
      rule: rule?.name,
      aiSummary: incident!.aiSummary,
      aiVerdict: incident!.aiVerdict,
      decisionLog: incident!.decisionLog,
      correctiveActions: incident!.correctiveActions,
    }
    console.info('[HSE] Export report', payload)
    window.alert(`خروجی گزارش برای ${incident!.code} آماده شد. جزئیات در کنسول مرورگر است.`)
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title={incident.code}
        description={incident.title}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={backHref}>
                <ArrowRight className="h-3.5 w-3.5" />
                {backLabel}
              </Link>
            </Button>
            <Button size="sm" onClick={exportReport}>
              <Download className="h-3.5 w-3.5" />
              خروجی گزارش
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge value={incident.severity} />
        <StatusBadge value={incident.status} />
        <span className="text-xs text-slate-500">
          تشخیص {formatDateTime(incident.detectedAt)} · به‌روزرسانی {formatDateTime(incident.updatedAt)}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="فراداده" description="زمینه این تشخیص">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">زون</dt>
              <dd className="mt-0.5 text-slate-900">{zone?.name ?? incident.zoneId}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">دوربین</dt>
              <dd className="mt-0.5 text-slate-900">
                {camera?.name ?? incident.cameraId}
                {camera ? (
                  <span className="mr-1 font-mono text-[11px] text-slate-500">({camera.code})</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                پیمانکار
              </dt>
              <dd className="mt-0.5 text-slate-900">
                {contractor?.name ?? 'تخصیص‌نشده / تیم کارگاهی'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">مسئول</dt>
              <dd className="mt-0.5 text-slate-900">{incident.assignee ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                اطمینان لبه / دستگاه لبه
              </dt>
              <dd className="mt-0.5 tabular-nums text-slate-900">
                {Math.round(incident.confidence * 100)}٪
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                مثبت کاذب
              </dt>
              <dd className="mt-0.5 text-slate-900">{incident.falsePositive ? 'بله' : 'خیر'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="قانون فعال‌شده" description="سیاست تشخیصی که شلیک کرده است">
          {rule ? (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{rule.code}</span>
                <SeverityBadge value={rule.severity} />
                <span className="text-xs text-slate-500">{rule.category}</span>
              </div>
              <p className="font-semibold text-slate-900">{rule.name}</p>
              <p className="text-slate-700">{rule.description}</p>
              <p className="text-xs text-slate-500">
                آستانه‌ها: اطمینان ≥ {Math.round(rule.confidenceThreshold * 100)}٪ · مدت ≥{' '}
                {rule.durationThresholdSec}ث · دوره خنک‌سازی {rule.cooldownSec}ث
              </p>
            </div>
          ) : (
            <EmptyRow>رکورد قانون موجود نیست.</EmptyRow>
          )}
        </Panel>
      </div>

      <Panel title="فریم‌های شواهد" description="تصاویر بافرشده از بسته لبه">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {incident.evidenceFrames.map((frame) => (
            <div
              key={frame.id}
              className="flex min-h-[140px] flex-col justify-between rounded border border-dashed border-slate-300 bg-slate-100 p-3"
            >
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                  {frame.label}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                  {formatDateTime(frame.timestamp)}
                </p>
              </div>
              <p className="mt-3 text-xs leading-snug text-slate-800">{frame.caption}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="بافر کلیپ" description="کلیپ کوتاه محلی ارجاع‌شده در بسته شواهد">
        <div className="flex h-36 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
          {incident.clipPlaceholder}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="خلاصه و رأی هوش مصنوعی" description="خروجی تأیید فهرست کوتاه">
          <p className="text-sm text-slate-800">{incident.aiSummary}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-slate-200 px-2.5 py-2">
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                رأی
              </dt>
              <dd className="mt-0.5 font-medium tracking-wide text-slate-900">
                {VERDICT_LABEL[incident.aiVerdict]}
              </dd>
            </div>
            <div className="rounded border border-slate-200 px-2.5 py-2">
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                اطمینان هوش مصنوعی
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                {Math.round(incident.aiConfidence * 100)}٪
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="گزارش تصمیم / مسیر حسابرسی" description="اقدامات انسانی و سامانه‌ای به‌ترتیب زمان">
          {incident.decisionLog.length === 0 ? (
            <EmptyRow>تصمیمی ثبت نشده است.</EmptyRow>
          ) : (
            <ol className="relative space-y-0 border-r border-slate-200 pr-4">
              {[...incident.decisionLog]
                .sort((a, b) => +new Date(a.at) - +new Date(b.at))
                .map((entry) => (
                  <li key={entry.id} className="relative pb-3 last:pb-0">
                    <span className="absolute -right-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400" />
                    <p className="text-[11px] tabular-nums text-slate-500">{formatDateTime(entry.at)}</p>
                    <p className="text-sm font-medium text-slate-900">
                      {entry.actor}{' '}
                      <span className="font-normal text-slate-600">
                        · {ACTION_LABEL[entry.action] ?? entry.action}
                      </span>
                    </p>
                    <p className="text-xs text-slate-600">{entry.note}</p>
                  </li>
                ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="اقدامات اصلاحی" description="تعهدات پیگیری مرتبط با این حادثه">
        {incident.correctiveActions.length === 0 ? (
          <EmptyRow>اقدام اصلاحی ثبت نشده است.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">اقدام</th>
                  <th className="pb-2 pl-3 font-semibold">مالک</th>
                  <th className="pb-2 pl-3 font-semibold">مهلت</th>
                  <th className="pb-2 font-semibold">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {incident.correctiveActions.map((ca) => (
                  <tr key={ca.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pl-3 font-medium text-slate-900">{ca.title}</td>
                    <td className="py-2 pl-3 text-slate-700">{ca.owner}</td>
                    <td className="py-2 pl-3 tabular-nums text-slate-700">{ca.dueDate}</td>
                    <td className="py-2 text-slate-700">
                      {CA_STATUS_LABEL[ca.status] ?? statusLabel[ca.status as never] ?? ca.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
