'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { HSE_PROJECT, HSE_USERS } from '@/features/hse/lib/mock-data'

const ROLE_LABEL: Record<(typeof HSE_USERS)[number]['role'], string> = {
  employer: 'کارفرما',
  hse_officer: 'مسئول ایمنی و بهداشت',
  technical_admin: 'مدیر فنی',
  supervisor: 'ناظر',
}

export function SettingsPage() {
  const [retentionDays, setRetentionDays] = useState(90)
  const [aiVerification, setAiVerification] = useState(true)
  const [notifyCriticalDefault, setNotifyCriticalDefault] = useState(true)
  const [notifyHighDefault, setNotifyHighDefault] = useState(true)
  const [notifyMediumDefault, setNotifyMediumDefault] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  function save() {
    setSavedNote('تنظیمات سازمان ذخیره شد (فقط نشست محلی)')
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="تنظیمات"
        description="هویت پروژه، نگهداری، تأیید هوش مصنوعی، و جایگاه نقش‌ها برای این ماژول ایمنی."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {savedNote ? (
              <div className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                {savedNote}
              </div>
            ) : null}
            <Button size="sm" onClick={save}>
              <Save className="h-3.5 w-3.5" />
              ذخیره
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="سازمان / پروژه" description="هویت فقط‌خواندنی از رکورد پروژه">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                نام پروژه
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900">{HSE_PROJECT.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                کد پروژه
              </dt>
              <dd className="mt-0.5 font-mono text-slate-900">{HSE_PROJECT.code}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                محل
              </dt>
              <dd className="mt-0.5 text-slate-900">{HSE_PROJECT.location}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="نگهداری و هوش مصنوعی" description="پیش‌فرض‌های عملیاتی قابل ویرایش">
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-600">نگهداری شواهد (روز)</span>
            <Input
              type="number"
              min={7}
              max={365}
              className="h-9 text-sm"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value) || 0)}
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            بافرهای لبه کلیپ‌های کوتاه را نگه می‌دارند؛ نگهداری ابری فریم‌ها، گزارش تصمیم و
            گزارش‌های قابل خروجی را برای بازه انتخاب‌شده پوشش می‌دهد.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={aiVerification}
              onChange={(e) => setAiVerification(e.target.checked)}
            />
            فعال‌سازی تأیید فهرست کوتاه هوش مصنوعی پیش از صف بازبینی انسانی
          </label>
        </Panel>
      </div>

      <Panel title="پیش‌فرض اعلان‌ها" description="هنگام پیوستن کاربر جدید به پروژه اعمال می‌شود">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={notifyCriticalDefault}
              onChange={(e) => setNotifyCriticalDefault(e.target.checked)}
            />
            بحرانی به‌طور پیش‌فرض
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={notifyHighDefault}
              onChange={(e) => setNotifyHighDefault(e.target.checked)}
            />
            بالا به‌طور پیش‌فرض
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={notifyMediumDefault}
              onChange={(e) => setNotifyMediumDefault(e.target.checked)}
            />
            متوسط به‌طور پیش‌فرض
          </label>
        </div>
      </Panel>

      <Panel title="نقش‌ها (جایگزین موقت)" description="فهرست کاربران نگاشت‌شده به نقش‌های ایمنی">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                <th className="pb-2 pl-3 font-semibold">نام</th>
                <th className="pb-2 pl-3 font-semibold">نقش</th>
                <th className="pb-2 font-semibold">ایمیل</th>
              </tr>
            </thead>
            <tbody>
              {HSE_USERS.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pl-3 font-medium text-slate-900">{user.name}</td>
                  <td className="py-2 pl-3 text-slate-700">{ROLE_LABEL[user.role]}</td>
                  <td className="py-2 text-slate-600">{user.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          مجوز نقش‌ها (چه کسی می‌تواند تأیید، ارجاع یا تغییر قوانین کند) در تولید به کنترل دسترسی
          سازمانی سایت‌پایلوت متصل می‌شود. این جدول فهرست جایگزین برای ماژول نمایشی است.
        </p>
      </Panel>
    </div>
  )
}
