/**
 * @file features/hse/lib/safety-alert-mocks.ts
 * @purpose دادهٔ نمایشی هشدار ایمنی — جدا از JSX
 * @safe-to-edit YES
 * @affects صفحه هشدار ایمنی و بج سرپرست
 * @depends-on features/hse/lib/types
 */

import type { IncidentStatus, Severity } from '@/features/hse/lib/types'

export type SafetyQueueBucket = 'critical' | 'needs_review' | 'solved'

export type SafetyAlertMockItem = {
  id: string
  code: string
  title: string
  severity: Severity
  status: IncidentStatus
  zoneName: string
  cameraName: string
  contractorName?: string | null
  detectedAt: string
  description: string
  minutesAgo: number
  hasVideo: boolean
  breadcrumb: string[]
  queueBucket: SafetyQueueBucket
}

export const MOCK_SAFETY_ALERTS: SafetyAlertMockItem[] = [
  {
    id: 'inc-003',
    code: 'INC-2026-0809-003',
    title: 'عابر خیلی نزدیک به کامیون بتن در حال دنده عقب',
    severity: 'critical',
    status: 'assigned',
    zoneName: 'راهروی تعامل خودرو',
    cameraName: 'دروازه اسکله بارگیری الف',
    contractorName: 'پیمان بتن نوین',
    detectedAt: '2026-08-09T14:35:00+03:30',
    description:
      'کارگر از راه عابر رنگ‌شده وارد آپرون کامیون شد در حالی که میکسر بتن به سمت دروازه الف دنده عقب می‌رفت. فاصله پیش از توقف به زیر 2 متر رسید.',
    minutesAgo: 25,
    hasVideo: true,
    breadcrumb: ['راهروی تعامل خودرو', 'دروازه اسکله بارگیری الف', 'بتن — هاربرفرم'],
    queueBucket: 'critical',
  },
  {
    id: 'inc-001',
    code: 'INC-2026-0809-001',
    title: 'ورود کارگر به زون سقوط جرثقیل هنگام بلند کردن فولاد',
    severity: 'critical',
    status: 'escalated',
    zoneName: 'محوطه جرثقیل غربی',
    cameraName: 'دوربین تاور غرب — پایه 1',
    contractorName: 'سازه سامیت',
    detectedAt: '2026-08-09T11:08:00+03:30',
    description:
      'فرد هنگام چرخش جرثقیل غربی با تیر، وارد حلقه رنگ‌شده بار شد. ناظر بار رو به جای دیگری بود؛ پیش از نقض، سیگنال توقف دیده نشد.',
    minutesAgo: 78,
    hasVideo: true,
    breadcrumb: ['محوطه جرثقیل غربی', 'حلقه بار زرد', 'بلند کردن فولاد'],
    queueBucket: 'critical',
  },
  {
    id: 'inc-002',
    code: 'INC-2026-0809-002',
    title: 'کار در لبه بدون حفاظ قابل‌رؤیت مهار',
    severity: 'high',
    status: 'confirmed',
    zoneName: 'دال شمال — سطح 5',
    cameraName: 'دوربین عرشه موقت شرقی',
    contractorName: 'سازه سامیت',
    detectedAt: '2026-08-04T22:10:00+03:30',
    description:
      'دو کارگر عرشه موقت را در حدود 1.5 متری لبه دال شمال نصب کردند. برای کارگر پیشرو در بازه 40 ثانیه‌ای مهار یا نقطه لنگر دیده نشد.',
    minutesAgo: 185,
    hasVideo: true,
    breadcrumb: ['دال شمال', 'عرشه موقت شرقی', 'لبه دال — سطح 5'],
    queueBucket: 'needs_review',
  },
  {
    id: 'inc-005',
    code: 'INC-2026-0809-005',
    title: 'ورود به محدوده جرثقیل بدون مجوز',
    severity: 'high',
    status: 'ai_review',
    zoneName: 'محوطه جرثقیل تاور 2',
    cameraName: 'دوربین جرثقیل — پایه جنوب',
    contractorName: 'ماشین‌آلات سنگین پارس',
    detectedAt: '2026-08-08T09:15:00+03:30',
    description:
      'یک نفر بدون کلاه ایمنی و بدون مجوز وارد محدوده عملیات جرثقیل شد. اپراتور جرثقیل هشدار صوتی را فعال کرد و عملیات تا خروج فرد متوقف ماند.',
    minutesAgo: 52,
    hasVideo: false,
    breadcrumb: ['محوطه جرثقیل تاور 2', 'پایه جنوب', 'محدوده عملیات'],
    queueBucket: 'needs_review',
  },
  {
    id: 'inc-006',
    code: 'INC-2026-0809-006',
    title: 'عدم استفاده از کلاه در منطقه بتن‌ریزی',
    severity: 'high',
    status: 'confirmed',
    zoneName: 'طبقه همکف — محور ب',
    cameraName: 'دوربین محور ب',
    contractorName: 'پیمان بتن نوین',
    detectedAt: '2026-08-07T16:20:00+03:30',
    description: 'دو کارگر بدون کلاه ایمنی در محدوده بتن‌ریزی مشغول هدایت شیلنگ بودند.',
    minutesAgo: 120,
    hasVideo: true,
    breadcrumb: ['طبقه همکف', 'محور ب', 'بتن‌ریزی'],
    queueBucket: 'needs_review',
  },
  {
    id: 'inc-009',
    code: 'INC-2026-0807-033',
    title: 'خطر سقوط نزدیک نرده ناقص لبه شمال',
    severity: 'critical',
    status: 'closed',
    zoneName: 'دال شمال',
    cameraName: 'دوربین لبه شمال',
    detectedAt: '2026-08-07T10:00:00+03:30',
    description:
      'نصاب دیوار پرده‌ای کنار بازشدگی پنل لبه کار کرد. مهار پوشیده بود اما بند حدود 35 ثانیه به لنگر وصل نبود.',
    minutesAgo: 2880,
    hasVideo: true,
    breadcrumb: ['دال شمال', 'لبه شمال', 'نرده ناقص'],
    queueBucket: 'solved',
  },
  {
    id: 'inc-011',
    code: 'INC-2026-0808-028',
    title: 'نبود عینک ایمنی هنگام باز کردن قالب',
    severity: 'medium',
    status: 'closed',
    zoneName: 'طبقه 3 — قالب‌بندی',
    cameraName: 'دوربین قالب‌بندی',
    detectedAt: '2026-08-08T11:15:00+03:30',
    description:
      'نجار قالب‌بندی بدون حفاظت چشم مهارها را باز می‌کرد در حالی که آوار از عرشه بالا می‌ریخت.',
    minutesAgo: 4320,
    hasVideo: false,
    breadcrumb: ['طبقه 3', 'قالب‌بندی'],
    queueBucket: 'solved',
  },
  {
    id: 'inc-015',
    code: 'INC-2026-0808-036',
    title: 'نبود کلاه‌ایمنی هنگام تخلیه پاگرد بالابر',
    severity: 'high',
    status: 'closed',
    zoneName: 'رamp بارگیری',
    cameraName: 'دوربین رamp شرقی',
    detectedAt: '2026-08-08T08:30:00+03:30',
    description: 'کارگر بدون کلاه در پاگرد بالابر مصالح را تخلیه می‌کرد.',
    minutesAgo: 5760,
    hasVideo: true,
    breadcrumb: ['رamp بارگیری', 'بالابر مصالح'],
    queueBucket: 'solved',
  },
  {
    id: 'inc-017',
    code: 'INC-2026-0806-052',
    title: 'سیگار در میدان ممنوع — تأییدشده',
    severity: 'medium',
    status: 'closed',
    zoneName: 'میدان کارگاه',
    cameraName: 'دوربین ورودی کارگاه',
    detectedAt: '2026-08-06T14:10:00+03:30',
    description: 'سیگار در زون ممنوع تشخیص داده شد؛ اخطار و اقدام اصلاحی ثبت شد.',
    minutesAgo: 7200,
    hasVideo: false,
    breadcrumb: ['میدان کارگاه', 'ورودی'],
    queueBucket: 'solved',
  },
]

export function countOpenSafetyAlertMocks(): number {
  return MOCK_SAFETY_ALERTS.filter((i) => i.queueBucket !== 'solved').length
}
