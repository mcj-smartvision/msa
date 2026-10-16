/**
 * @file features/calc-trace/config.ts
 * @purpose برچسب‌های فارسی موشن حساب
 * @safe-to-edit YES
 * @affects کشوی رد محاسبه شاخص‌ها
 * @depends-on nothing
 */

export const CALC_TRACE_COPY = {
  motionAria: (label: string) => `موشن حساب: ${label}`,
  motionTitle: (label: string) => `موشن حساب — ${label}`,
  status: {
    ok: 'سالم',
    warning: 'نیاز به توجه',
    critical: 'بحرانی',
    insufficient: 'داده کافی نیست',
  },
  closeAria: 'بستن موشن حساب',
  title: 'موشن حساب',
  print: 'چاپ',
  metricsAria: 'شاخص‌ها',
  computed: 'محاسبه:',
  formula: 'فرمول',
  inputs: (n: string) => `ورودی‌ها (${n})`,
  noInputs: 'ورودی ثبت‌شده‌ای نیست.',
  colName: 'نام',
  colValue: 'مقدار',
  colSource: 'منبع',
  column: 'ستون:',
  row: 'ردیف:',
  updated: 'به‌روزرسانی:',
  previousTrend: 'دورهٔ قبل و روند',
  previousPeriod: 'دورهٔ قبل:',
  noHistory: 'مقداری از روزهای قبل ثبت نشده است.',
  sparkAria: 'روند مقادیر ثبت‌شده',
} as const
