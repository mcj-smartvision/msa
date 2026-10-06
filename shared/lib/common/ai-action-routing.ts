import type { AiActionType } from '@/features/supervisor/lib/types'
import type { ApprovalItemType } from '@/features/project-manager/lib/types'

export type AiActionRouteKey =
  | AiActionType
  | 'daily_report'
  | 'pm_review_instruction'
  | 'pm_review_purchase'
  | 'pm_review_hse'
  | 'pm_review_report'
  | 'generic'

export interface AiActionRouteCopy {
  /** Primary button label */
  approveSend: string
  /** Short explanation under the draft */
  destinationHint: string
  /** What this action is */
  whatIsThis: string
}

const FA: Record<AiActionRouteKey, AiActionRouteCopy> = {
  subcontractor_instruction: {
    whatIsThis:
      'دستور کار رسمی برای پیمانکار/اجراکنندهٔ همان فعالیت. پس از تأیید شما، برای بررسی و ابلاغ نهایی به مدیر پروژه می‌رود.',
    approveSend: 'تأیید و ارسال به مدیر پروژه',
    destinationHint: 'مقصد بعدی: مدیر پروژه → پس از تأیید او، ابلاغ به پیمانکار/اجرا',
  },
  purchase_request: {
    whatIsThis:
      'درخواست خرید مصالح/اقلام. پس از تأیید شما به مدیر پروژه می‌رود و در صورت تأیید او به تدارکات ارسال می‌شود.',
    approveSend: 'تأیید و ارسال به مدیر پروژه',
    destinationHint: 'مقصد بعدی: مدیر پروژه → سپس تدارکات',
  },
  pm_comment: {
    whatIsThis:
      'یادداشت هماهنگی برای مدیر پروژه (تأخیر، منابع، هماهنگی و …). با تأیید، برای مدیر پروژه ثبت و ارسال می‌شود.',
    approveSend: 'تأیید و ارسال به مدیر پروژه',
    destinationHint: 'مقصد: مدیر پروژه (بایگانی در کارتابل مدیر)',
  },
  hse_alert: {
    whatIsThis:
      'هشدار ایمنی/کیفیت. پس از تأیید شما برای بررسی و اقدام به مدیر پروژه ارسال می‌شود.',
    approveSend: 'تأیید و ارسال به مدیر پروژه',
    destinationHint: 'مقصد بعدی: مدیر پروژه / پیگیری HSE',
  },
  daily_report: {
    whatIsThis:
      'خلاصه گزارش روزانه کارگاه. با تأیید، برای مدیر پروژه ارسال می‌شود تا در مرکز تأیید ببیند.',
    approveSend: 'تأیید و ارسال به مدیر پروژه',
    destinationHint: 'مقصد: مدیر پروژه (مرکز تأیید)',
  },
  pm_review_instruction: {
    whatIsThis: 'دستور کار پیشنهادی سرپرست کارگاه برای ابلاغ به پیمانکار.',
    approveSend: 'تأیید و ارسال به پیمانکار',
    destinationHint: 'پس از تأیید شما، دستور به‌عنوان ابلاغ‌شده برای پیمانکار/اجرا ثبت می‌شود.',
  },
  pm_review_purchase: {
    whatIsThis: 'درخواست خرید تأییدشده توسط سرپرست — نیاز به تأیید مدیر برای ارسال به تدارکات.',
    approveSend: 'تأیید و ارسال به تدارکات',
    destinationHint: 'مقصد بعدی: واحد تدارکات / خرید',
  },
  pm_review_hse: {
    whatIsThis: 'هشدار HSE/کیفیت از کارگاه — تأیید شما آن را رسمی و پیگیری‌پذیر می‌کند.',
    approveSend: 'تأیید و بایگانی هشدار',
    destinationHint: 'پس از تأیید، در سوابق پروژه بایگانی و برای پیگیری HSE قابل مشاهده است.',
  },
  pm_review_report: {
    whatIsThis: 'گزارش روزانه سرپرست کارگاه برای تأیید مدیریتی.',
    approveSend: 'تأیید و بایگانی گزارش',
    destinationHint: 'پس از تأیید، گزارش در سوابق پروژه بایگانی می‌شود.',
  },
  generic: {
    whatIsThis: 'پیش‌نویس تولیدشده توسط AI — قبل از ارسال مقصد را بررسی کنید.',
    approveSend: 'تأیید و ارسال',
    destinationHint: 'مقصد ارسال را از نوع اقدام مشخص کنید.',
  },
}

const EN: Record<AiActionRouteKey, AiActionRouteCopy> = {
  subcontractor_instruction: {
    whatIsThis:
      'Formal work instruction for the subcontractor/crew on this activity. After you approve, it goes to the Project Manager for final release.',
    approveSend: 'Approve & send to Project Manager',
    destinationHint: 'Next: Project Manager → then release to subcontractor',
  },
  purchase_request: {
    whatIsThis:
      'Material purchase request. After you approve it goes to the Project Manager; if approved there, it is forwarded to Procurement.',
    approveSend: 'Approve & send to Project Manager',
    destinationHint: 'Next: Project Manager → then Procurement',
  },
  pm_comment: {
    whatIsThis:
      'Coordination note for the Project Manager. Approving sends/archives it to the PM inbox.',
    approveSend: 'Approve & send to Project Manager',
    destinationHint: 'Destination: Project Manager inbox',
  },
  hse_alert: {
    whatIsThis:
      'Safety/quality alert. After you approve, it is sent to the Project Manager for action.',
    approveSend: 'Approve & send to Project Manager',
    destinationHint: 'Next: Project Manager / HSE follow-up',
  },
  daily_report: {
    whatIsThis:
      'Daily site report summary. Approving sends it to the Project Manager approval center.',
    approveSend: 'Approve & send to Project Manager',
    destinationHint: 'Destination: Project Manager (approval center)',
  },
  pm_review_instruction: {
    whatIsThis: 'Supervisor-proposed work instruction for the subcontractor.',
    approveSend: 'Approve & send to subcontractor',
    destinationHint: 'After approval, the instruction is recorded as released to the subcontractor.',
  },
  pm_review_purchase: {
    whatIsThis: 'Purchase request from site — PM approval forwards it to Procurement.',
    approveSend: 'Approve & send to Procurement',
    destinationHint: 'Next: Procurement / purchasing',
  },
  pm_review_hse: {
    whatIsThis: 'HSE/quality alert from site — your approval makes it official.',
    approveSend: 'Approve & archive alert',
    destinationHint: 'After approval, archived in project records for HSE follow-up.',
  },
  pm_review_report: {
    whatIsThis: 'Site supervisor daily report awaiting managerial confirmation.',
    approveSend: 'Approve & archive report',
    destinationHint: 'After approval, the report is archived in project records.',
  },
  generic: {
    whatIsThis: 'AI-generated draft — check the destination before sending.',
    approveSend: 'Approve & send',
    destinationHint: 'Destination depends on action type.',
  },
}

export function getSupervisorRouteCopy(
  type: AiActionType | 'daily_report',
  locale: 'fa' | 'en' = 'fa'
): AiActionRouteCopy {
  const table = locale === 'fa' ? FA : EN
  return table[type] ?? table.generic
}

export function getPmRouteCopy(
  type: ApprovalItemType,
  locale: 'fa' | 'en' = 'fa'
): AiActionRouteCopy {
  const table = locale === 'fa' ? FA : EN
  switch (type) {
    case 'purchase_request':
      return table.pm_review_purchase
    case 'subcontractor_instruction':
      return table.pm_review_instruction
    case 'hse_alert':
      return table.pm_review_hse
    case 'daily_report':
      return table.pm_review_report
    default:
      return table.generic
  }
}
