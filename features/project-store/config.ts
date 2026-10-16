/**
 * @file features/project-store/config.ts
 * @purpose برچسب‌های فارسی جدول Store و ارزیابی هفتگی
 * @safe-to-edit YES
 * @affects store-inspector و weekly-evaluation-card
 * @depends-on nothing
 */

export const STORE_INSPECTOR_COPY = {
  yes: 'بله',
  listSep: '، ',
  logLine: (date: string, value: string) => `${date}: ${value}`,
  title: 'جدول مرجع داده‌ها (Store)',
  hint: 'همهٔ صفحه‌ها پیشرفت هر فعالیت را از همین جدول می‌خوانند. ستون‌ها از فهرست مرکزی فیلدها ساخته می‌شوند؛ هر فیلد تازه با یک خط به جدول و خروجی اضافه می‌شود.',
  noProject: 'پروژه‌ای انتخاب نشده است',
  loadFailed: 'داده بارگذاری نشد',
  week: 'هفته',
  ppcWeek: 'PPC هفته',
  ppcValue: (completed: string, committed: string, ppc: string, provisional: boolean) =>
    `${completed} ÷ ${committed} = ${ppc}٪${provisional ? ' (تا این لحظه)' : ''}`,
  searchPh: 'جستجوی WBS یا نام فعالیت',
  activityCount: (n: string) => `${n} فعالیت`,
  truncated: (max: string) => ` · ${max} ردیف اول نمایش داده شده؛ همه در خروجی هستند`,
} as const

export const WEEKLY_EVAL_COPY = {
  otherNoteRequired: 'برای علت «سایر» توضیح لازم است',
  saveFailed: 'ثبت علت ناموفق بود',
  title: (start: string, end: string) => `تعهدات هفتگی (${start} تا ${end})`,
  lockedTitle: 'تعهدات هر هفته شنبه ساعت 00:00 از برنامهٔ پیش‌بینی‌شدهٔ همان لحظه ثابت می‌شوند.',
  locked: 'تعهدات قفل شد',
  committedLead: (n: string) => `${n} فعالیت در این هفته سهم برنامه دارند؛ `,
  provisional: (n: string) =>
    `تا این لحظه ${n} فعالیت سهم هفته را کامل کرده‌اند. ارزیابی پنج‌شنبه ساعت 16:00 باز می‌شود.`,
  closed: (n: string, ppc: string) => `${n} فعالیت سهم هفته را کامل کردند (PPC ${ppc}).`,
  ppcPct: (n: string) => `${n}٪`,
  rncPageTitle: 'علت عدم تحقق',
  missedTitle: (week: string, open: string, total: string) =>
    `هفتهٔ ${week} — ${open} مورد بدون علت از ${total}`,
  rncMissing: 'ثبت علت هنوز فعال نیست؛ مدیر سیستم باید فایل database/108-weekly-commitment-rnc.sql را اجرا کند.',
  rncEmpty: 'فعلاً فعالیتی برای ثبت علت عدم تحقق نیست.',
  notLoaded: 'تعهد هفته هنوز بارگذاری نشده است. پروژه را انتخاب کنید یا کمی صبر کنید.',
  share: (actual: string, target: string) => `${actual} از ${target} واحد سهم هفته`,
  recordedCause: 'علت ثبت‌شده: ',
  causeAria: 'علت عدم تحقق',
  pickCause: 'انتخاب علت…',
  noteRequired: 'توضیح (الزامی)',
  noteOptional: 'توضیح (اختیاری)',
  saving: 'در حال ثبت…',
  saveCause: 'ثبت علت',
} as const
