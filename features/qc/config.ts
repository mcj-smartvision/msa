/**
 * @file features/qc/config.ts
 * @purpose برچسب‌های فارسی باقی‌مانده کنترل کیفیت
 * @safe-to-edit YES
 * @affects پنل‌های موتور QC
 * @depends-on nothing
 */

export const QC_COPY = {
  inspectorWhisper:
    'یادداشت بازرس کنترل کیفیت به فارسی. جمله‌های کامل و درست. کلمه‌هایی مثل عدم رعایت استاندارد، قابل قبول نیست، لطفاً اصلاح کنید، فاصله خاموت، قالب‌بندی، جوش، قبول، رد.',
  verdictRejected: 'نتیجه: رد',
  verdictApproved: 'نتیجه: تأیید',
  listSep: '، ',
  rejectPattern: /رد(?:\s*شد)?|قابل\s*قبول\s*نیست|عدم\s*قبول/i,
  approvePattern: /تأیید|تایید|قبول\s*شد/i,
} as const
