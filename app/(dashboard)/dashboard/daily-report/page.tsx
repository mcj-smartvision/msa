/**
 * @file app/(dashboard)/dashboard/daily-report/page.tsx
 * @purpose مسیر موقت فرم گزارش روزانه ساختاریافته (SDR) — تا تکمیل گام ۳
 * @safe-to-edit YES
 * @affects /dashboard/daily-report
 * @depends-on nothing
 */

export default function DailyReportStubPage() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16 text-center" dir="rtl" lang="fa">
      <h1 className="text-xl font-bold text-slate-900">گزارش روزانه سرپرست</h1>
      <p className="text-sm leading-6 text-slate-600">
        مسیر آماده است. فرم کامل در گام ۳ ساخته می‌شود. پنل فعلی سرپرست کارگاه تغییر نکرده است.
      </p>
      <a
        href="/dashboard/site-supervisor"
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        بازگشت به داشبورد سرپرست
      </a>
    </div>
  )
}
