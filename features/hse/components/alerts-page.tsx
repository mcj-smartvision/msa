'use client'

import { useState } from 'react'
import { BellRing, Save } from 'lucide-react'
import { SeverityBadge } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
HSE_ALERT_LOGS,
HSE_ALERT_ROUTING,
HSE_TELEGRAM_SETTINGS,
} from '@/features/hse/lib/mock-data'
import type { AlertLogEntry, AlertRouting } from '@/features/hse/lib/types'

const CHANNEL_LABEL: Record<AlertLogEntry['channel'], string> = {
  telegram: 'تلگرام',
  email: 'ایمیل',
  webhook: 'فراخوان خودکار وب',
}

const RESULT_LABEL: Record<AlertLogEntry['result'], string> = {
  sent: 'ارسال‌شده',
  queued: 'در صف',
  failed: 'ناموفق',
}

export function AlertsPage() {
  const [telegram, setTelegram] = useState(() => ({ ...HSE_TELEGRAM_SETTINGS }))
  const [routing, setRouting] = useState<AlertRouting[]>(() =>
    HSE_ALERT_ROUTING.map((r) => ({ ...r }))
  )
  const [webhookUrl, setWebhookUrl] = useState('آدرس فراخوان سامانه ایمنی (نمونه)')
  const [emailDigest, setEmailDigest] = useState('ایمنی@نمونه.ایران')
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  function toggleRoute(
    severity: AlertRouting['severity'],
    channel: 'telegram' | 'email' | 'webhook'
  ) {
    setRouting((prev) =>
      prev.map((row) =>
        row.severity === severity ? { ...row, [channel]: !row[channel] } : row
      )
    )
  }

  function saveSettings() {
    setSavedNote('مسیریابی هشدار و تنظیمات کانال ذخیره شد (فقط نشست محلی)')
  }

  function testAlert() {
    setTestMessage(
      `هشدار آزمایشی به گفتگوی تلگرام ${telegram.chatIdMasked} و ایمیل ${emailDigest} در صف قرار گرفت. تحویل را ظرف ۳۰ ثانیه در گفتگوی عملیات تأیید کنید.`
    )
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="هشدارها"
        description="پیکربندی کانال‌ها، مسیریابی بر اساس شدت، و تاریخچه تحویل اخیر."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {savedNote ? (
              <div className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                {savedNote}
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={saveSettings}>
              <Save className="h-3.5 w-3.5" />
              ذخیره تنظیمات
            </Button>
            <Button size="sm" onClick={testAlert}>
              <BellRing className="h-3.5 w-3.5" />
              هشدار آزمایشی
            </Button>
          </div>
        }
      />

      {testMessage ? (
        <div className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {testMessage}
        </div>
      ) : null}

      <Panel
        title="مسیریابی نقش‌ها"
        description="پس از تحلیل و اطمینان، چه کسی چه چیزی دریافت می‌کند."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">مسئول ایمنی</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              همه رخدادهای دوربین برای بازبینی، تأیید، رد و ارجاع.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="font-semibold text-slate-900">سرپرست کارگاه</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              فقط موارد تأییدشده یا بحرانی برای اقدام فوری میدانی.
            </p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3">
            <p className="font-semibold text-slate-900">مدیر پروژه</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              خلاصه هفتگی روندها + فقط بحران‌های خیلی جدی به‌صورت فوری.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="تلگرام" description="کانال اصلی اعلان فوری ناظر">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">ربات پیکربندی‌شده</dt>
              <dd className="font-medium text-slate-900">
                {telegram.botConfigured ? 'بله' : 'خیر'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">شناسه گفتگو</dt>
              <dd className="font-mono text-slate-900">{telegram.chatIdMasked}</dd>
            </div>
          </dl>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {(
              [
                ['notifyCritical', 'اعلان بحرانی'],
                ['notifyHigh', 'اعلان بالا'],
                ['notifyMedium', 'اعلان متوسط'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={telegram[key]}
                  onChange={(e) => setTelegram((t) => ({ ...t, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="وب‌هوک (جایگزین موقت)" description="فراخوان اچ‌تی‌تی‌پی برای سامانه پایش / تیکت">
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-600">آدرس نقطه انتهایی</span>
            <Input
              className="h-9 font-mono text-xs"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            ارسال بستهٔ جسون حادثه برای شدت‌های مسیریابی‌شده. تأیید امضا و سیاست تلاش مجدد در
            اتصال‌دهندهٔ تولید پیکربندی می‌شود.
          </p>
        </Panel>

        <Panel title="ایمیل (جایگزین موقت)" description="خلاصه روزانه و نامه شدت بالا">
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-600">گیرندگان پیش‌فرض</span>
            <Input
              className="h-9 text-sm"
              value={emailDigest}
              onChange={(e) => setEmailDigest(e.target.value)}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            ایمیل به‌طور پیش‌فرض برای شدت متوسط و به‌عنوان مسیر پشتیبان هنگام محدودیت نرخ تلگرام
            استفاده می‌شود. پیوست تصاویر شواهد اختیاری و وابسته به سیاست پروژه است.
          </p>
        </Panel>
      </div>

      <Panel title="مسیریابی شدت" description="فعال/غیرفعال کردن کانال‌ها برای هر باند شدت">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                <th className="pb-2 pl-3 font-semibold">شدت</th>
                <th className="pb-2 pl-3 font-semibold">تلگرام</th>
                <th className="pb-2 pl-3 font-semibold">ایمیل</th>
                <th className="pb-2 font-semibold">وب‌هوک</th>
              </tr>
            </thead>
            <tbody>
              {routing.map((row) => (
                <tr key={row.severity} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pl-3">
                    <SeverityBadge value={row.severity} />
                  </td>
                  {(['telegram', 'email', 'webhook'] as const).map((channel) => (
                    <td key={channel} className="py-2 pl-3 last:pl-0">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={row[channel]}
                          onChange={() => toggleRoute(row.severity, channel)}
                        />
                        {row[channel] ? 'روشن' : 'خاموش'}
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="تاریخچه هشدار" description={`${HSE_ALERT_LOGS.length} تحویل اخیر`}>
        {HSE_ALERT_LOGS.length === 0 ? (
          <EmptyRow>گزارش هشداری نیست.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">زمان</th>
                  <th className="pb-2 pl-3 font-semibold">کانال</th>
                  <th className="pb-2 pl-3 font-semibold">شدت</th>
                  <th className="pb-2 pl-3 font-semibold">حادثه</th>
                  <th className="pb-2 pl-3 font-semibold">مقصد</th>
                  <th className="pb-2 pl-3 font-semibold">نتیجه</th>
                  <th className="pb-2 font-semibold">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {[...HSE_ALERT_LOGS]
                  .sort((a, b) => +new Date(b.at) - +new Date(a.at))
                  .map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="py-2 pl-3 whitespace-nowrap text-xs tabular-nums text-slate-600">
                        {formatDateTime(log.at)}
                      </td>
                      <td className="py-2 pl-3 text-slate-700">{CHANNEL_LABEL[log.channel]}</td>
                      <td className="py-2 pl-3">
                        <SeverityBadge value={log.severity} />
                      </td>
                      <td className="py-2 pl-3 font-mono text-xs text-slate-800">
                        {log.incidentCode}
                      </td>
                      <td className="max-w-[180px] py-2 pl-3 text-xs text-slate-600">
                        {log.target}
                      </td>
                      <td className="py-2 pl-3 text-slate-700">{RESULT_LABEL[log.result]}</td>
                      <td className="max-w-[240px] py-2 text-xs text-slate-600">{log.detail}</td>
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
