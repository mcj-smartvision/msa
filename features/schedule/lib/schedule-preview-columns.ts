/** Schedule preview table columns — MSP import map + CPM fields */

import type { ProjectTask } from '@/shared/types/schedule'

export type SchedulePreviewColKey =
  | 'uid'
  | 'wbs'
  | 'outline_number'
  | 'outline_level'
  | 'name'
  | 'contractor'
  | 'quantity'
  | 'uom'
  | 'unit_price'
  | 'is_summary'
  | 'is_milestone'
  | 'obs_code'
  | 'cbs_code'
  | 'duration_days'
  | 'remaining_duration_days'
  | 'planned_start'
  | 'planned_finish'
  | 'constraint_type'
  | 'constraint_date'
  | 'deadline'
  | 'baseline_start'
  | 'baseline_finish'
  | 'baseline_duration_days'
  | 'baseline_cost'
  | 'baseline_work_hours'
  | 'percent_complete'
  | 'physical_percent_complete'
  | 'actual_start'
  | 'actual_finish'
  | 'work_hours'
  | 'cost'
  | 'physical_weight'
  | 'notes'
  | 'flag'
  | 'priority'
  | 'is_manual_scheduled'
  | 'has_split'
  | 'is_recurring_master'
  | 'predecessors'
  | 'status'
  | 'is_critical'
  | 'total_float_days'
  | 'free_float_days'

export type SchedulePreviewColumn = {
  key: SchedulePreviewColKey
  label: string
  help: string
  defaultWidth: number
  minWidth: number
  /** Lower = shown earlier (after sticky identity cols). */
  priority: number
  /** Always visible even if empty. */
  alwaysShow?: boolean
  align?: 'left' | 'center' | 'right'
  sticky?: 'wbs' | 'name'
  /** Never show in the preview table (data still imported). */
  hidden?: boolean
}

/**
 * Core identity first, then schedule ops, then CPM, then MSP extras.
 * Empty non-alwaysShow columns are deferred / hidden.
 */
export const SCHEDULE_PREVIEW_COLUMNS: SchedulePreviewColumn[] = [
  {
    key: 'wbs',
    label: 'WBS',
    help: 'کد ساختار شکست کار؛ ترتیب و سطح سلسله‌مراتبی فعالیت را مشخص می‌کند.',
    defaultWidth: 56,
    minWidth: 44,
    priority: 1,
    alwaysShow: true,
    align: 'left',
    sticky: 'wbs',
  },
  {
    key: 'name',
    label: 'فعالیت',
    help: 'نام فعالیت (Name) همان‌طور که در برنامه MSP ثبت شده.',
    defaultWidth: 180,
    minWidth: 100,
    priority: 2,
    alwaysShow: true,
    align: 'left',
    sticky: 'name',
  },
  {
    key: 'contractor',
    label: 'پیمانکار',
    help: 'پیمانکار نهایی فعالیت؛ مقدار کم‌رنگ و علامت وراثت یعنی از نزدیک‌ترین سرشاخه گرفته شده است.',
    defaultWidth: 130,
    minWidth: 100,
    priority: 3,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'quantity',
    label: 'مقدار',
    help: 'مقدار/متراژ زیرشاخه یا آیتم تجاری ثبت‌شده در ویرایش برنامه.',
    defaultWidth: 72,
    minWidth: 56,
    priority: 4,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'uom',
    label: 'واحد',
    help: 'واحد اندازه‌گیری مقدار.',
    defaultWidth: 56,
    minWidth: 44,
    priority: 5,
    alwaysShow: true,
    align: 'center',
  },
  {
    key: 'unit_price',
    label: 'قیمت واحد',
    help: 'قیمت واحد ثبت‌شده در ویرایش برنامه؛ با صورت‌وضعیت همگام است.',
    defaultWidth: 88,
    minWidth: 64,
    priority: 6,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'planned_start',
    label: 'شروع',
    help: 'تاریخ شروع برنامه‌ای (Start) از فایل یا برنامه.',
    defaultWidth: 78,
    minWidth: 60,
    priority: 10,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'planned_finish',
    label: 'پایان',
    help: 'تاریخ پایان برنامه‌ای (Finish) از فایل یا برنامه.',
    defaultWidth: 78,
    minWidth: 60,
    priority: 11,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'duration_days',
    label: 'مدت',
    help: 'مدت برنامه‌ای بر حسب روز. برای سرشاخه = جمع مدت فرزندان مستقیم.',
    defaultWidth: 44,
    minWidth: 36,
    priority: 12,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'predecessors',
    label: 'پیش‌نیاز',
    help: 'روابط وابستگی (FS/SS/FF/SF) و تأخیر با فعالیت‌های قبلی.',
    defaultWidth: 100,
    minWidth: 64,
    priority: 13,
    alwaysShow: true,
    align: 'left',
  },
  {
    key: 'physical_weight',
    label: 'وزن',
    help: 'وزن فیزیکی فعالیت (Number1). برای سرشاخه = جمع وزن فرزندان مستقیم.',
    defaultWidth: 52,
    minWidth: 40,
    priority: 14,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'percent_complete',
    label: '%فیزیکی',
    help: 'پیشرفت فیزیکی ثبت‌شده توسط سرپرست کارگاه (گزارش روزانه) — در ویرایش و ارسال برنامه یکسان است.',
    defaultWidth: 56,
    minWidth: 44,
    priority: 15,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'status',
    label: 'وضعیت',
    help: 'وضعیت اجرایی نسبت به تاریخ مبنا: شروع‌نشده، در جریان، انجام‌شده یا تأخیری.',
    defaultWidth: 80,
    minWidth: 64,
    priority: 16,
    alwaysShow: true,
    align: 'center',
  },
  {
    key: 'is_critical',
    label: 'بحرانی',
    help: 'روی مسیر بحرانی است (شناوری کل ≈ 0) — توسط موتور CPM سیستم محاسبه می‌شود.',
    defaultWidth: 52,
    minWidth: 40,
    priority: 17,
    alwaysShow: true,
    align: 'center',
  },
  {
    key: 'total_float_days',
    label: 'شناوری',
    help: 'شناوری کل (روز): چقدر می‌توان بدون تأخیر پروژه جابه‌جا شد. محاسبه CPM سیستم.',
    defaultWidth: 52,
    minWidth: 40,
    priority: 18,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'free_float_days',
    label: 'آزاد',
    help: 'شناوری آزاد (روز): چقدر می‌توان بدون تأخیر جانشین‌ها جابه‌جا شد.',
    defaultWidth: 44,
    minWidth: 36,
    priority: 19,
    alwaysShow: true,
    align: 'right',
  },
  {
    key: 'is_summary',
    label: 'سرشاخه',
    help: 'اگر بله باشد این ردیف Summary است و خودش کار اجرایی نیست؛ جمع‌بندی فرزندان است.',
    defaultWidth: 52,
    minWidth: 40,
    priority: 30,
    align: 'center',
    hidden: true,
  },
  {
    key: 'is_milestone',
    label: 'مایلستون',
    help: 'نقطه عطف با مدت صفر (یا پرچم Milestone در MSP).',
    defaultWidth: 56,
    minWidth: 44,
    priority: 31,
    align: 'center',
  },
  {
    key: 'remaining_duration_days',
    label: 'باقی',
    help: 'مدت باقیمانده تا اتمام (Remaining Duration).',
    defaultWidth: 44,
    minWidth: 36,
    priority: 40,
    align: 'right',
  },
  {
    key: 'actual_start',
    label: 'شروع واقعی',
    help: 'تاریخ شروع واقعی ثبت‌شده برای فعالیت.',
    defaultWidth: 78,
    minWidth: 60,
    priority: 42,
    align: 'right',
  },
  {
    key: 'actual_finish',
    label: 'پایان واقعی',
    help: 'تاریخ پایان واقعی ثبت‌شده برای فعالیت.',
    defaultWidth: 78,
    minWidth: 60,
    priority: 43,
    align: 'right',
  },
  {
    key: 'uid',
    label: 'UID',
    help: 'شناسه یکتای فعالیت در فایل MS Project (معادل UID).',
    defaultWidth: 48,
    minWidth: 36,
    priority: 50,
    align: 'right',
  },
  {
    key: 'outline_number',
    label: 'Outline#',
    help: 'شماره Outline در MSP (معمولاً مشابه WBS).',
    defaultWidth: 56,
    minWidth: 40,
    priority: 51,
    align: 'right',
  },
  {
    key: 'outline_level',
    label: 'Lvl',
    help: 'سطح Outline؛ عدد بالاتر یعنی عمیق‌تر در درخت WBS.',
    defaultWidth: 36,
    minWidth: 28,
    priority: 52,
    align: 'center',
  },
  {
    key: 'obs_code',
    label: 'OBS',
    help: 'کد سازمانی / مسئول (از فیلد سفارشی Text1 در MSP).',
    defaultWidth: 48,
    minWidth: 36,
    priority: 60,
    align: 'right',
  },
  {
    key: 'cbs_code',
    label: 'CBS',
    help: 'کد هزینه / ساختار هزینه (از فیلد سفارشی Text2 در MSP).',
    defaultWidth: 48,
    minWidth: 36,
    priority: 61,
    align: 'right',
  },
  {
    key: 'constraint_type',
    label: 'قید',
    help: 'نوع قید زمانی MSP مثل ASAP، SNET، MFO و …',
    defaultWidth: 48,
    minWidth: 36,
    priority: 62,
    align: 'center',
  },
  {
    key: 'constraint_date',
    label: 'تاریخ قید',
    help: 'تاریخ مرتبط با قید زمانی فعالیت.',
    defaultWidth: 72,
    minWidth: 56,
    priority: 63,
    align: 'right',
  },
  {
    key: 'deadline',
    label: 'مهلت',
    help: 'مهلت (Deadline) تعریف‌شده در MSP؛ دیرکرد نسبت به آن هشدار می‌دهد.',
    defaultWidth: 72,
    minWidth: 56,
    priority: 64,
    align: 'right',
  },
  {
    key: 'baseline_start',
    label: 'BL شروع',
    help: 'شروع خط‌پایه؛ فقط اگر در فایل Baseline ذخیره شده باشد.',
    defaultWidth: 72,
    minWidth: 56,
    priority: 70,
    align: 'right',
  },
  {
    key: 'baseline_finish',
    label: 'BL پایان',
    help: 'پایان خط‌پایه؛ فقط اگر در فایل Baseline ذخیره شده باشد.',
    defaultWidth: 72,
    minWidth: 56,
    priority: 71,
    align: 'right',
  },
  {
    key: 'baseline_duration_days',
    label: 'BL مدت',
    help: 'مدت خط‌پایه بر حسب روز.',
    defaultWidth: 48,
    minWidth: 36,
    priority: 72,
    align: 'right',
  },
  {
    key: 'baseline_cost',
    label: 'BL هزینه',
    help: 'هزینه خط‌پایه فعالیت.',
    defaultWidth: 56,
    minWidth: 40,
    priority: 73,
    align: 'right',
  },
  {
    key: 'baseline_work_hours',
    label: 'BL کار',
    help: 'حجم کار خط‌پایه بر حسب ساعت.',
    defaultWidth: 48,
    minWidth: 36,
    priority: 74,
    align: 'right',
  },
  {
    key: 'work_hours',
    label: 'کار',
    help: 'حجم کار برنامه‌ای بر حسب ساعت (Work).',
    defaultWidth: 44,
    minWidth: 32,
    priority: 80,
    align: 'right',
  },
  {
    key: 'cost',
    label: 'هزینه',
    help: 'هزینه کل فعالیت (Cost) از فایل MSP.',
    defaultWidth: 52,
    minWidth: 40,
    priority: 81,
    align: 'right',
  },
  {
    key: 'notes',
    label: 'یادداشت',
    help: 'یادداشت / Notes پیوست‌شده به فعالیت در MSP.',
    defaultWidth: 80,
    minWidth: 48,
    priority: 90,
    align: 'left',
  },
  {
    key: 'flag',
    label: 'پرچم',
    help: 'پرچم سفارشی Flag1 در MSP (علامت‌گذاری دلخواه).',
    defaultWidth: 40,
    minWidth: 32,
    priority: 91,
    align: 'center',
  },
  {
    key: 'priority',
    label: 'اولویت',
    help: 'اولویت فعالیت در MSP (معمولاً 0 تا 1000؛ پیش‌فرض 500).',
    defaultWidth: 44,
    minWidth: 32,
    priority: 92,
    align: 'right',
  },
  {
    key: 'is_manual_scheduled',
    label: 'دستی',
    help: 'اگر بله باشد فعالیت Manually Scheduled است و تاریخ‌ها دستی قفل شده‌اند.',
    defaultWidth: 40,
    minWidth: 32,
    priority: 93,
    align: 'center',
  },
  {
    key: 'has_split',
    label: 'شکاف',
    help: 'فعالیت شکافته‌شده (Split) با چند بازه زمانی جداگانه.',
    defaultWidth: 40,
    minWidth: 32,
    priority: 94,
    align: 'center',
  },
  {
    key: 'is_recurring_master',
    label: 'تکرار',
    help: 'فعالیت مادر Recurring؛ از جمع وزن/پیشرفت پروژه مستثنی می‌شود.',
    defaultWidth: 40,
    minWidth: 32,
    priority: 95,
    align: 'center',
  },
]

const COL_BY_KEY = new Map(SCHEDULE_PREVIEW_COLUMNS.map((c) => [c.key, c]))

export function getSchedulePreviewColumn(key: SchedulePreviewColKey): SchedulePreviewColumn {
  return COL_BY_KEY.get(key)!
}

function hasText(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim())
}

function hasNum(v: number | null | undefined, opts?: { ignoreZero?: boolean; ignoreDefault?: number }): boolean {
  if (v == null || !Number.isFinite(Number(v))) return false
  const n = Number(v)
  if (opts?.ignoreZero && n === 0) return false
  if (opts?.ignoreDefault != null && n === opts.ignoreDefault) return false
  return true
}

/** Whether the dataset has meaningful values for this column. */
export function scheduleColumnHasData(
  key: SchedulePreviewColKey,
  tasks: ProjectTask[],
  predecessorLabels: Record<string, string>
): boolean {
  if (tasks.length === 0) return false
  switch (key) {
    case 'wbs':
      return tasks.some((t) => hasText(t.wbs_code))
    case 'name':
      return tasks.some((t) => hasText(t.name))
    case 'uid':
      return tasks.some((t) => hasText(t.external_id) || t.msp_uid != null)
    case 'outline_number':
      return tasks.some((t) => hasText(t.outline_number) && t.outline_number !== t.wbs_code)
    case 'outline_level':
      return tasks.some((t) => t.outline_level != null)
    case 'is_summary':
      return tasks.some((t) => Boolean(t.is_summary))
    case 'is_milestone':
      return tasks.some((t) => Boolean(t.is_milestone))
    case 'obs_code':
      return tasks.some((t) => hasText(t.obs_code))
    case 'cbs_code':
      return tasks.some((t) => hasText(t.cbs_code))
    case 'duration_days':
      return tasks.some((t) => hasNum(t.duration_days))
    case 'remaining_duration_days':
      return tasks.some((t) => hasNum(t.remaining_duration_days))
    case 'planned_start':
      return tasks.some((t) => hasText(t.start_planned) || hasText(t.start_current))
    case 'planned_finish':
      return tasks.some((t) => hasText(t.finish_planned) || hasText(t.finish_current))
    case 'constraint_type':
      return tasks.some((t) => hasText(t.constraint_type) && t.constraint_type !== 'ASAP')
    case 'constraint_date':
      return tasks.some((t) => hasText(t.constraint_date))
    case 'deadline':
      return tasks.some((t) => hasText(t.deadline))
    case 'baseline_start':
      return tasks.some((t) => hasText(t.baseline_start))
    case 'baseline_finish':
      return tasks.some((t) => hasText(t.baseline_finish))
    case 'baseline_duration_days':
      return tasks.some((t) => hasNum(t.baseline_duration_days))
    case 'baseline_cost':
      return tasks.some((t) => hasNum(t.baseline_cost, { ignoreZero: true }))
    case 'baseline_work_hours':
      return tasks.some((t) => hasNum(t.baseline_work_hours, { ignoreZero: true }))
    case 'percent_complete':
      return true
    case 'physical_percent_complete':
      // Merged into percent_complete (supervisor physical progress)
      return false
    case 'actual_start':
      return tasks.some((t) => hasText(t.actual_start))
    case 'actual_finish':
      return tasks.some((t) => hasText(t.actual_finish))
    case 'work_hours':
      return tasks.some((t) => hasNum(t.work_hours, { ignoreZero: true }))
    case 'cost':
      return tasks.some((t) => hasNum(t.cost, { ignoreZero: true }))
    case 'physical_weight':
      return tasks.some(
        (t) => hasNum(t.physical_weight) || hasNum(t.schedule_weight)
      )
    case 'notes':
      return tasks.some((t) => hasText(t.notes))
    case 'flag':
      return tasks.some((t) => Boolean(t.flag))
    case 'priority':
      return tasks.some((t) => hasNum(t.priority, { ignoreDefault: 500 }))
    case 'is_manual_scheduled':
      return tasks.some((t) => Boolean(t.is_manual_scheduled))
    case 'has_split':
      return tasks.some((t) => Boolean(t.has_split))
    case 'is_recurring_master':
      return tasks.some((t) => Boolean(t.is_recurring_master))
    case 'predecessors':
      return Object.values(predecessorLabels).some((v) => hasText(v) && v !== '—')
    case 'status':
      return true
    case 'is_critical':
      return tasks.some((t) => Boolean(t.is_critical))
    case 'total_float_days':
      return tasks.some((t) => t.total_float_days != null)
    case 'free_float_days':
      return tasks.some((t) => t.free_float_days != null)
    case 'contractor':
      return tasks.some((t) => Boolean(t.resolved_subcontractor_id))
    case 'quantity':
      return tasks.some((t) => hasNum(t.schedule_quantity))
    case 'uom':
      return tasks.some((t) => hasText(t.schedule_uom))
    case 'unit_price':
      return tasks.some((t) => hasNum(t.unit_price))
    default:
      return false
  }
}

/**
 * All columns visible; filled ones first (after sticky WBS/name), then by priority.
 */
export function resolveVisibleScheduleColumns(
  tasks: ProjectTask[],
  predecessorLabels: Record<string, string>
): SchedulePreviewColumn[] {
  const withMeta = SCHEDULE_PREVIEW_COLUMNS.filter((col) => !col.hidden).map((col) => ({
    col,
    filled: scheduleColumnHasData(col.key, tasks, predecessorLabels),
  }))

  withMeta.sort((a, b) => {
    const coreRank = (key: SchedulePreviewColKey) =>
      key === 'wbs'
        ? 0
        : key === 'name'
          ? 1
          : key === 'contractor'
            ? 2
            : key === 'quantity'
              ? 3
              : key === 'uom'
                ? 4
                : key === 'unit_price'
                  ? 5
                  : 10
    const aCore = coreRank(a.col.key)
    const bCore = coreRank(b.col.key)
    if (aCore !== bCore) return aCore - bCore
    if (!a.col.sticky && !b.col.sticky) {
      if (a.filled !== b.filled) return a.filled ? -1 : 1
    }
    return a.col.priority - b.col.priority
  })

  return withMeta.map((x) => x.col)
}

export const SCHEDULE_PREVIEW_WIDTHS_KEY = 'msa.schedule-preview.col-widths.v3'

const CHAR_PX = 7.2

function measureTextWidth(text: string, min: number, max: number, pad = 10): number {
  const w = Math.ceil(String(text).length * CHAR_PX) + pad
  return Math.max(min, Math.min(max, w))
}

/**
 * Auto-fit each column to content (compact — suited for vertical headers).
 */
export function fitScheduleColumnWidths(
  columns: SchedulePreviewColumn[],
  tasks: ProjectTask[],
  predecessorLabels: Record<string, string>
): Record<SchedulePreviewColKey, number> {
  const out = defaultSchedulePreviewWidths()

  for (const col of columns) {
    let contentMax = 1
    const bump = (s: string) => {
      contentMax = Math.max(contentMax, String(s).length)
    }

    switch (col.key) {
      case 'wbs':
        for (const t of tasks) bump(t.wbs_code ?? '—')
        out.wbs = measureTextWidth('x'.repeat(contentMax), 36, 72, 12)
        break
      case 'name':
        for (const t of tasks) bump(t.name || '—')
        out.name = measureTextWidth('x'.repeat(Math.min(contentMax, 28)), 120, 220, 16)
        break
      case 'contractor':
        out.contractor = 120
        break
      case 'predecessors':
        for (const t of tasks) bump(predecessorLabels[t.id] ?? '—')
        out.predecessors = measureTextWidth('x'.repeat(Math.min(contentMax, 18)), 44, 110, 8)
        break
      case 'status':
        out.status = 78
        break
      case 'is_critical':
        out.is_critical = 36
        break
      case 'planned_start':
      case 'planned_finish':
      case 'constraint_date':
      case 'deadline':
      case 'baseline_start':
      case 'baseline_finish':
      case 'actual_start':
      case 'actual_finish':
        out[col.key] = 52
        break
      case 'notes':
        for (const t of tasks) {
          if (t.notes) bump(t.notes.slice(0, 16))
        }
        out.notes = measureTextWidth('x'.repeat(Math.min(contentMax, 12)), 32, 80, 6)
        break
      case 'obs_code':
      case 'cbs_code':
        for (const t of tasks) bump((col.key === 'obs_code' ? t.obs_code : t.cbs_code) ?? '—')
        out[col.key] = measureTextWidth('x'.repeat(Math.min(contentMax, 10)), 28, 64, 6)
        break
      case 'uid':
        for (const t of tasks) bump(String(t.external_id ?? t.msp_uid ?? '—'))
        out.uid = measureTextWidth('x'.repeat(contentMax), 28, 48, 6)
        break
      case 'outline_number':
        for (const t of tasks) bump(t.outline_number ?? '—')
        out.outline_number = measureTextWidth('x'.repeat(contentMax), 28, 56, 6)
        break
      default:
        // Compact numeric / yes-no columns (vertical header)
        out[col.key] = Math.max(col.minWidth, 28)
        break
    }

    // Floor for vertical-header columns (except name/status)
    if (col.key !== 'name' && col.key !== 'status' && col.key !== 'predecessors') {
      out[col.key] = Math.max(26, Math.min(out[col.key], col.key.includes('start') || col.key.includes('finish') || col.key === 'deadline' || col.key === 'constraint_date' ? 56 : out[col.key]))
    }
  }

  return out
}

export function defaultSchedulePreviewWidths(): Record<SchedulePreviewColKey, number> {
  const out = {} as Record<SchedulePreviewColKey, number>
  for (const c of SCHEDULE_PREVIEW_COLUMNS) {
    // Compact defaults for vertical headers
    if (c.key === 'name') out[c.key] = 160
    else if (c.key === 'wbs') out[c.key] = 40
    else if (c.key === 'contractor') out[c.key] = 120
    else if (c.key === 'status') out[c.key] = 78
    else if (c.key === 'predecessors') out[c.key] = 72
    else if (
      c.key.includes('start') ||
      c.key.includes('finish') ||
      c.key === 'deadline' ||
      c.key === 'constraint_date'
    ) {
      out[c.key] = 52
    } else out[c.key] = Math.max(28, Math.min(c.defaultWidth, 36))
  }
  return out
}

export function loadSchedulePreviewWidths(): Record<SchedulePreviewColKey, number> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SCHEDULE_PREVIEW_WIDTHS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, number>
    const base = defaultSchedulePreviewWidths()
    let any = false
    for (const c of SCHEDULE_PREVIEW_COLUMNS) {
      const w = parsed[c.key]
      if (typeof w === 'number' && Number.isFinite(w)) {
        base[c.key] = Math.max(22, Math.min(400, Math.round(w)))
        any = true
      }
    }
    return any ? base : null
  } catch {
    return null
  }
}

export function stickyOffsetsFromOrder(
  visible: SchedulePreviewColumn[],
  widths: Record<SchedulePreviewColKey, number>
): { wbs: number; name: number } {
  let wbs = 0
  let name = 0
  let acc = 0
  for (const col of visible) {
    if (col.sticky === 'wbs') wbs = acc
    if (col.sticky === 'name') name = acc
    acc += widths[col.key] ?? 0
  }
  return { wbs, name }
}

/** If table is narrower than viewport, grow columns proportionally (name gets a bit more). */
export function expandWidthsToFill(
  visible: SchedulePreviewColumn[],
  widths: Record<SchedulePreviewColKey, number>,
  containerWidth: number
): Record<SchedulePreviewColKey, number> {
  if (containerWidth <= 0) return widths
  const sum = visible.reduce((s, c) => s + widths[c.key], 0)
  if (sum <= 0 || sum >= containerWidth) return widths
  const extra = containerWidth - sum
  const next = { ...widths }
  const nameShare = Math.floor(extra * 0.45)
  const rest = extra - nameShare
  if (visible.some((c) => c.key === 'name')) {
    next.name = widths.name + nameShare
  }
  const others = visible.filter((c) => c.key !== 'name')
  if (others.length === 0) {
    if (visible.some((c) => c.key === 'name')) next.name = widths.name + extra
    return next
  }
  let distributed = 0
  others.forEach((c, i) => {
    const add =
      i === others.length - 1
        ? rest - distributed
        : Math.floor(rest / others.length)
    next[c.key] = widths[c.key] + add
    distributed += add
  })
  return next
}
