'use client'

import { MapPinned } from 'lucide-react'
import { RiskBadge } from '@/features/hse/components/badges'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { getCamera, getRule, HSE_ZONES } from '@/features/hse/lib/mock-data'

export function ZonesPage() {
  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="زون‌ها"
        description="مناطق کاری طبقه‌بندی‌شده بر اساس ریسک، متصل به دوربین‌ها و قوانین تشخیص."
      />

      <Panel title="ثبت زون‌ها" description={`${HSE_ZONES.length} زون`}>
        {HSE_ZONES.length === 0 ? (
          <EmptyRow>زونی پیکربندی نشده است.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">زون</th>
                  <th className="pb-2 pl-3 font-semibold">ریسک</th>
                  <th className="pb-2 pl-3 font-semibold">محدوده</th>
                  <th className="pb-2 pl-3 font-semibold">دوربین‌ها</th>
                  <th className="pb-2 pl-3 font-semibold">قوانین</th>
                  <th className="pb-2 font-semibold">یادداشت‌ها</th>
                </tr>
              </thead>
              <tbody>
                {HSE_ZONES.map((zone) => (
                  <tr key={zone.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2.5 pl-3">
                      <p className="font-medium text-slate-900">{zone.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{zone.code}</p>
                    </td>
                    <td className="py-2.5 pl-3">
                      <RiskBadge value={zone.risk} />
                    </td>
                    <td className="py-2.5 pl-3 text-slate-700">{zone.areaLabel}</td>
                    <td className="py-2.5 pl-3">
                      <p className="font-semibold tabular-nums text-slate-900">{zone.cameraIds.length}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {zone.cameraIds.map((id) => getCamera(id)?.code ?? id).join('، ')}
                      </p>
                    </td>
                    <td className="py-2.5 pl-3">
                      <p className="font-semibold tabular-nums text-slate-900">{zone.ruleIds.length}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {zone.ruleIds.map((id) => getRule(id)?.code ?? id).join('، ')}
                      </p>
                    </td>
                    <td className="max-w-[280px] py-2.5 text-xs leading-snug text-slate-600">
                      {zone.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="ویرایشگر زون (جایگزین موقت)"
        description="ترسیم ناحیه مورد نظر چندضلعی به دستگاه لبه متصل می‌شود — هنوز در این پوسته رابط کاربری موجود نیست"
      >
        <div className="rounded border border-slate-300 bg-slate-50 px-4 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded border border-slate-300 bg-white p-2">
              <MapPinned className="h-5 w-5 text-slate-600" />
            </div>
            <div className="min-w-0 space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">ناحیه مورد نظر چندضلعی وابسته به لبه</p>
              <p>
                هندسه زون روی نمای کالیبره‌شده دوربین ترسیم و به گره لبهٔ کارگاه ارسال می‌شود. مرکز کنترل
                فراداده زون (ریسک، دوربین‌های متصل، قوانین) را نگه می‌دارد؛ رأس‌های چندضلعی و ماسک‌های
                فضای پیکسل روی لبه می‌مانند تا اگر پیوند ابری قطع شد، استنتاج ادامه یابد.
              </p>
              <ul className="list-disc space-y-1 pr-5 text-xs text-slate-600">
                <li>
                  نصاب چندضلعی بسته‌ای روی فریم کالیبراسیون ثابت از دوربین انتخاب‌شده رسم یا وارد می‌کند.
                </li>
                <li>
                  به‌روزرسانی ناحیه مورد نظر تا دریافت تأیید همگام‌سازی از لبه، قوانین آن زون با اطمینان کامل
                  از سر گرفته نمی‌شوند.
                </li>
                <li>
                  تا زمان عرضه ویرایشگر، یادداشت‌های موقت ناحیه مورد نظر را در فیلدهای کالیبراسیون هر دوربین
                  ثبت کنید و علامت‌گذاری کارگاهی را با برچسب محدوده بالا هم‌راستا نگه دارید.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
