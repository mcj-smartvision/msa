/**
 * @file features/holidays/config.ts
 * @purpose برچسب‌های فارسی تقویم تعطیلات
 * @safe-to-edit YES
 * @affects پنل تعطیلات و انتخابگر تاریخ جلالی
 * @depends-on nothing
 */

export const HOLIDAYS_COPY = {
  intro:
    'جمعه همیشه تعطیل است. تعطیلی‌هایی که اینجا ثبت می‌شوند در تقویم بالای صفحه قرمز دیده می‌شوند و در پیش‌بینی برنامه و درصدهای اجباری گزارش روزانه روز کاری حساب نمی‌شوند. این فهرست برای همهٔ پروژه‌ها یکی است.',
  weeklyRange: (day: string, start: string, end?: string) =>
    end ? `هر ${day} از ${start} تا ${end}` : `هر ${day} از ${start}`,
  rangeDays: (start: string, end: string, days: string) => `${start} تا ${end} (${days} روز)`,
  saveFailed: 'خطا در ذخیره',
  error: 'خطا',
  editTitle: 'ویرایش تعطیلی',
  createTitle: 'ثبت تعطیلی',
  typeLabel: 'نوع تعطیلی',
  startWeekly: 'از تاریخ (روز هفتهٔ آن تکرار می‌شود)',
  startDate: 'تاریخ',
  endWeekly: 'تا تاریخ (اختیاری)',
  endMulti: 'تاریخ پایان (برای چندروزه)',
  noEnd: 'بدون پایان',
  oneDay: 'یک‌روزه',
  titleLabel: 'عنوان / مناسبت',
  titlePlaceholder: 'مثلاً نوروز',
  descriptionLabel: 'توضیحات',
  saveChanges: 'ذخیرهٔ تغییرات',
  create: 'ثبت تعطیلی',
  cancel: 'انصراف',
  savingHint: 'ذخیره و به‌روزرسانی پیش‌بینی برنامهٔ پروژه‌ها…',
  manageOnly: 'ثبت و ویرایش تعطیلات فقط برای ادمین و مدیر پروژه مجاز است.',
  listTitle: 'تعطیلات ثبت‌شده',
  loadingAria: 'در حال بارگذاری',
  empty: 'هنوز تعطیلی ثبت نشده است.',
  colTitle: 'عنوان',
  colType: 'نوع',
  colDate: 'تاریخ',
  colDescription: 'توضیحات',
  colStatus: 'وضعیت',
  active: 'فعال',
  inactive: 'غیرفعال',
  edit: 'ویرایش',
  delete: 'حذف',
  dash: '—',
  ellipsis: '…',
  confirmDelete: (title: string) => `تعطیلی «${title}» حذف شود؟`,
  pickDate: 'انتخاب تاریخ',
  clearDate: 'پاک کردن تاریخ',
  prevMonth: 'ماه قبل',
  nextMonth: 'ماه بعد',
  weekdayInitials: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const,
  listSep: '، ',
  today: 'امروز',
  recordedHoliday: 'تعطیل ثبت‌شده',
  friday: 'جمعه',
} as const

export const JALALI_PICKER_COPY = {
  placeholder: HOLIDAYS_COPY.pickDate,
  clearDate: HOLIDAYS_COPY.clearDate,
} as const

export const JALALI_GRID_COPY = {
  weekdayInitials: HOLIDAYS_COPY.weekdayInitials,
  prevMonth: HOLIDAYS_COPY.prevMonth,
  nextMonth: HOLIDAYS_COPY.nextMonth,
  listSep: HOLIDAYS_COPY.listSep,
  today: HOLIDAYS_COPY.today,
  recordedHoliday: HOLIDAYS_COPY.recordedHoliday,
  friday: HOLIDAYS_COPY.friday,
} as const
