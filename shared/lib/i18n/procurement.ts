import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import type { AiDraftLabels } from '@/shared/lib/common/ai-types'

const EN = {
  title: 'Procurement Dashboard',
  description: 'Manage purchase requests, RFQs, and delivery tracking.',
  pendingRequests: 'Pending Requests',
  activeRfqs: 'Active RFQs',
  inTransit: 'In Transit',
  delayed: 'Delayed',
  receivedWeek: 'Received (week)',
  incomingRequests: 'Incoming Requests (PM Approved)',
  noRequests: 'No approved purchase requests yet.',
  material: 'Material',
  quantity: 'Quantity',
  neededDate: 'Needed Date',
  priority: 'Priority',
  status: 'Status',
  actions: 'Actions',
  startSourcing: 'Start Sourcing',
  sendRfq: 'Send RFQ',
  issuePo: 'Issue PO',
  markReceived: 'Mark Received',
  viewText: 'View Request',
  selectProject: 'Project',
  loadError: 'Failed to load procurement data.',
  saving: 'Saving…',
  formalRequest: 'Formal Request Text',
  draftByAi: 'AI Draft',
  confirmed: 'Confirmed',
  approveSend: 'Approve & Forward',
  editText: 'Edit',
  reject: 'Reject',
  close: 'Close',
  statusPending: 'Pending',
  statusSourcing: 'Sourcing',
  statusRfq: 'RFQ Sent',
  statusPo: 'PO Issued',
  statusTransit: 'In Transit',
  statusReceived: 'Received',
}

export type ProcurementMessages = typeof EN

const FA = {
  title: 'داشبورد تدارکات',
  description: 'مدیریت درخواست خرید، استعلام و پیگیری تحویل.',
  pendingRequests: 'در انتظار',
  activeRfqs: 'RFQ فعال',
  inTransit: 'در راه',
  delayed: 'تأخیر',
  receivedWeek: 'تحویل‌شده (هفته)',
  incomingRequests: 'درخواست‌های تأییدشده PM',
  noRequests: 'هنوز درخواست خرید تأییدشده‌ای نیست.',
  material: 'ماده',
  quantity: 'مقدار',
  neededDate: 'تاریخ نیاز',
  priority: 'اولویت',
  status: 'وضعیت',
  actions: 'عملیات',
  startSourcing: 'شروع تأمین',
  sendRfq: 'ارسال RFQ',
  issuePo: 'صدور PO',
  markReceived: 'ثبت تحویل',
  viewText: 'مشاهده متن',
  selectProject: 'پروژه',
  loadError: 'بارگذاری داده تدارکات ناموفق بود.',
  saving: 'در حال ذخیره…',
  formalRequest: 'متن رسمی درخواست',
  draftByAi: 'پیش‌نویس AI',
  confirmed: 'تأیید شده',
  approveSend: 'تأیید و ارسال',
  editText: 'ویرایش',
  reject: 'رد',
  close: 'بستن',
  statusPending: 'در انتظار',
  statusSourcing: 'در حال تأمین',
  statusRfq: 'RFQ ارسال شد',
  statusPo: 'PO صادر شد',
  statusTransit: 'در راه',
  statusReceived: 'تحویل شد',
} as const satisfies Record<keyof typeof EN, string>

export function getProcurementMessages(locale: FormLocale): typeof EN {
  if (locale === 'fa' || locale === 'ar') return FA as typeof EN
  return EN
}

export function procurementAiLabels(t: ProcurementMessages): AiDraftLabels {
  return {
    draftByAi: t.draftByAi,
    confirmed: t.confirmed,
    approveSend: t.approveSend,
    editText: t.editText,
    reject: t.reject,
    saving: t.saving,
  }
}

export const STATUS_LABELS: Record<string, keyof ProcurementMessages> = {
  pending: 'statusPending',
  sourcing: 'statusSourcing',
  rfq_sent: 'statusRfq',
  po_issued: 'statusPo',
  in_transit: 'statusTransit',
  received: 'statusReceived',
}
