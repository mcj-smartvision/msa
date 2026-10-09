'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
Calculator,
Check,
CheckCircle2,
Columns3,
Copy,
Download,
Flame,
Loader2,
Plus,
Rows3,
Trash2,
TrendingUp,
Wallet,
} from 'lucide-react'
import { MonthColumnHeader } from '@/features/finance/components/month-column-header'
import { TOMAN_SCALE } from '@/features/finance/lib/live-workshop-cost'
import {
alignAmountsToScheduleMonths,
parseOverheadMonthLabel,
scheduleMonthsFromTree,
takeAmountsForLabels,
} from '@/features/finance/lib/overhead-schedule-months'
import { cn } from '@/shared/lib/utils'
import type { ScheduleTreeNode } from '@/features/workshop/lib/types'

const JALALI_MONTHS_FA = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

const JALALI_MONTHS_EN = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand',
] as const

export type OverheadCategory = {
  code: string
  titleFa: string
  titleEn: string
  /** Month amounts kept as strings so large digit counts stay exact and size correctly. */
  months: string[]
}

const DEFAULT_MONTH_COUNT = 6

const OVERHEAD_CATEGORIES: OverheadCategory[] = [
  {
    code: '6101',
    titleFa: 'بیمه و تأمین اجتماعی',
    titleEn: 'Insurance & Social Security',
    months: ['15', '15', '16', '16', '18', '18'],
  },
  {
    code: '6102',
    titleFa: 'غذا و تدارکات رفاهی کارگاه',
    titleEn: 'Camp, Catering & Welfare',
    months: ['22', '24', '26', '25', '28', '27'],
  },
  {
    code: '6103',
    titleFa: 'ایاب‌ و ذهاب، سوخت و ترابری',
    titleEn: 'Transportation & Logistics',
    months: ['12', '13', '14', '15', '16', '16'],
  },
  {
    code: '6104',
    titleFa: 'انشعابات و قبوض (آب، برق، گاز، اینترنت)',
    titleEn: 'Site Utilities & Internet',
    months: ['5', '6', '8', '11', '13', '9'],
  },
  {
    code: '6105',
    titleFa: 'اجاره تجهیزات عمومی، کانکس و انبار',
    titleEn: 'Temporary Facilities & Rentals',
    months: ['20', '20', '20', '20', '22', '22'],
  },
  {
    code: '6106',
    titleFa: 'لوازم اداری، مصرفی کارگاه و چاپ نقشه',
    titleEn: 'Site Office Supplies & Prints',
    months: ['3', '4', '3', '5', '4', '3'],
  },
  {
    code: '6107',
    titleFa: 'حقوق پرسنل ستادی و پشتیبانی کارگاه',
    titleEn: 'Site Supervision / Indirect Labor',
    months: ['22', '22', '22', '24', '24', '24'],
  },
  {
    code: '6108',
    titleFa: 'ایمنی، بهداشت و محیط زیست (HSE خرد)',
    titleEn: 'Site HSE & PPE Supplies',
    months: ['1', '2', '1.5', '3', '2', '1'],
  },
]

function defaultMonthLabels(fa: boolean, count = DEFAULT_MONTH_COUNT): string[] {
  const source = fa ? JALALI_MONTHS_FA : JALALI_MONTHS_EN
  return Array.from({ length: count }, (_, i) => source[i % source.length]!)
}

function nextMonthLabel(existing: string[], fa: boolean): string {
  const source = fa ? JALALI_MONTHS_FA : JALALI_MONTHS_EN
  const last = existing[existing.length - 1] ?? ''
  const parsed = parseOverheadMonthLabel(last)
  const idx = parsed ? parsed.jm - 1 : source.findIndex((month) => month === last.trim())
  if (idx < 0) return source[existing.length % source.length]!
  const nextIdx = (idx + 1) % source.length
  const nextName = source[nextIdx]!
  if (parsed?.jy == null) return nextName
  const nextYear = nextIdx === 0 ? parsed.jy + 1 : parsed.jy
  return `${nextName} ${nextYear}`
}

function toMonthString(value: unknown): string {
  if (value == null) return '0'
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
      return String(value)
    }
    return String(value)
  }
  return '0'
}

function monthToNumber(value: string): number {
  const t = value.trim().replace(/,/g, '')
  if (t === '' || t === '.') return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function normalizeMonthOnBlur(raw: string): string {
  const trimmed = raw.trim().replace(/,/g, '')
  if (trimmed === '' || trimmed === '.') return '0'
  if (!/^\d*\.?\d*$/.test(trimmed)) return '0'
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return '0'
  const million = n >= 1000 ? n / TOMAN_SCALE : n
  if (!Number.isInteger(million)) {
    return String(million)
  }
  return String(Math.round(million)).replace(/^0+(?=\d)/, '') || '0'
}

function padMonths(months: Array<string | number> | undefined, count: number): string[] {
  const source = Array.isArray(months) ? months : []
  const next = source.slice(0, count).map((v) => toMonthString(v))
  while (next.length < count) next.push('0')
  return next
}

function sumMonthStrings(values: string[]): number {
  return values.reduce((a, b) => a + monthToNumber(b), 0)
}

/** Input/column width in CSS ch units from displayed toman string. */
function widthFromDigits(text: string, padding = 2): number {
  const visible = text.trim() === '' ? '0' : text
  return Math.max(8, visible.length + padding)
}

function cloneCategories(
  source: OverheadCategory[] = OVERHEAD_CATEGORIES,
  monthCount = DEFAULT_MONTH_COUNT
): OverheadCategory[] {
  return source.map((cat) => ({
    ...cat,
    months: padMonths(cat.months, monthCount),
  }))
}

function storageKey(projectId: string | null | undefined): string {
  return `sitepilot:overhead-matrix:${projectId || 'default'}`
}

export function readStoredOverhead(
  projectId: string | null | undefined,
  fa = true
): { labels: string[]; categories: OverheadCategory[]; savedAt: string | null; customized: boolean } {
  let labels = defaultMonthLabels(fa)
  let categories = cloneCategories(OVERHEAD_CATEGORIES, labels.length)
  let savedAt: string | null = null
  let customized = false
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (raw) {
      const parsed = JSON.parse(raw) as {
        categories?: OverheadCategory[]
        monthLabels?: string[]
        savedAt?: string
        customized?: boolean
      }
      if (Array.isArray(parsed.monthLabels) && parsed.monthLabels.length > 0) {
        labels = parsed.monthLabels.map(String)
      }
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        categories = parsed.categories.map((cat, i) => ({
          code: String(cat.code || `6${100 + i}`),
          titleFa: String(cat.titleFa || cat.titleEn || ''),
          titleEn: String(cat.titleEn || cat.titleFa || ''),
          months: padMonths(Array.isArray(cat.months) ? cat.months : [], labels.length),
        }))
      } else {
        categories = cloneCategories(OVERHEAD_CATEGORIES, labels.length)
      }
      savedAt = parsed.savedAt ?? null
      customized = parsed.customized === true
    }
  } catch {
    /* defaults */
  }
  return { labels, categories, savedAt, customized }
}

export function writeStoredOverhead(
  projectId: string | null | undefined,
  payload: {
    categories: OverheadCategory[]
    monthLabels: string[]
    savedAt: string | null
    customized: boolean
  }
) {
  localStorage.setItem(
    storageKey(projectId),
    JSON.stringify({ ...payload, projectId: projectId ?? null })
  )
  window.dispatchEvent(new Event('sitepilot-overhead-matrix-updated'))
}

/** Month name immediately before or after a labeled column. */
export function suggestedNeighborMonth(label: string, direction: -1 | 1, fa: boolean): string {
  const source = fa ? JALALI_MONTHS_FA : JALALI_MONTHS_EN
  const parsed = parseOverheadMonthLabel(label)
  if (!parsed) return direction > 0 ? nextMonthLabel([label], fa) : source[0]!
  let jm = parsed.jm + direction
  let jy = parsed.jy ?? 1404
  if (jm < 1) {
    jm = 12
    jy -= 1
  } else if (jm > 12) {
    jm = 1
    jy += 1
  }
  return `${source[jm - 1]} ${jy}`
}

export function categoriesWithMonthTotal(
  categories: OverheadCategory[],
  monthIndex: number,
  total: number
): OverheadCategory[] {
  const current = categories.reduce(
    (sum, cat) => sum + monthToNumber(cat.months[monthIndex] ?? '0'),
    0
  )
  if (!(current > 0)) {
    return categories.map((cat, index) => {
      const months = [...cat.months]
      months[monthIndex] = index === 0 ? String(total) : '0'
      return { ...cat, months }
    })
  }
  const scaled = categories.map(
    (cat) => monthToNumber(cat.months[monthIndex] ?? '0') * (total / current)
  )
  const rounded = scaled.map((value) => Math.round(value * 100) / 100)
  const drift = Math.round((total - rounded.reduce((sum, value) => sum + value, 0)) * 100) / 100
  if (drift !== 0) {
    let last = rounded.length - 1
    for (let index = rounded.length - 1; index >= 0; index--) {
      if (scaled[index] !== 0) {
        last = index
        break
      }
    }
    rounded[last] = Math.round(((rounded[last] ?? 0) + drift) * 100) / 100
  }
  return categories.map((cat, index) => {
    const months = [...cat.months]
    months[monthIndex] = String(rounded[index] ?? 0)
    return { ...cat, months }
  })
}

/** Apply a column edit onto the months currently on screen and keep it. */
export function commitDisplayedColumns(
  projectId: string | null | undefined,
  fa: boolean,
  displayedLabels: string[],
  edit:
    | { type: 'insert'; index: number; label: string }
    | { type: 'rename'; index: number; label: string }
    | { type: 'remove'; index: number }
    | { type: 'total'; index: number; total: number }
): { labels: string[]; totals: number[] } {
  const stored = readStoredOverhead(projectId, fa)
  let labels = displayedLabels.length > 0 ? [...displayedLabels] : [...stored.labels]
  let categories = stored.categories
  if (!(stored.customized && labels.join('\n') === stored.labels.join('\n'))) {
    const amounts = takeAmountsForLabels(
      stored.labels,
      categories.map((cat) => cat.months),
      labels
    )
    categories = categories.map((cat, index) => ({
      ...cat,
      months: amounts[index] ?? labels.map(() => '0'),
    }))
  }
  if (edit.type === 'insert') {
    const at = Math.max(0, Math.min(edit.index, labels.length))
    labels = [...labels.slice(0, at), edit.label, ...labels.slice(at)]
    categories = categories.map((cat) => {
      const months = [...cat.months]
      months.splice(at, 0, '0')
      return { ...cat, months }
    })
  } else if (edit.type === 'rename' && labels[edit.index] != null) {
    labels[edit.index] = edit.label
  } else if (edit.type === 'remove' && labels.length > 1) {
    labels = labels.filter((_, index) => index !== edit.index)
    categories = categories.map((cat) => ({
      ...cat,
      months: cat.months.filter((_, index) => index !== edit.index),
    }))
  } else if (edit.type === 'total') {
    categories = categoriesWithMonthTotal(categories, edit.index, edit.total)
  }
  writeStoredOverhead(projectId, {
    categories,
    monthLabels: labels,
    savedAt: stored.savedAt,
    customized: true,
  })
  const totals = labels.map((_, index) =>
    sumMonthStrings(categories.map((cat) => cat.months[index] ?? '0'))
  )
  return { labels, totals }
}

/** Month totals in the same unit as the overhead matrix (million toman). */
export function loadOverheadMonthTotals(
  projectId: string | null | undefined,
  fa = true
): { labels: string[]; totals: number[]; customized: boolean } {
  const stored = readStoredOverhead(projectId, fa)
  const totals = stored.labels.map((_, index) =>
    sumMonthStrings(stored.categories.map((cat) => cat.months[index] ?? '0'))
  )
  return { labels: stored.labels, totals, customized: stored.customized }
}

function formatToman(million: number): string {
  return Math.round(million * TOMAN_SCALE).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })
}

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function nextCode(categories: OverheadCategory[]): string {
  const nums = categories
    .map((c) => Number(c.code))
    .filter((n) => Number.isFinite(n))
  const max = nums.length > 0 ? Math.max(...nums) : 6100
  return String(max + 1)
}

type OverheadCostsMatrixProps = {
  fa?: boolean
  className?: string
  projectId?: string | null
  onMonthTotalsChange?: (next: { labels: string[]; totals: number[] }) => void
}

export function OverheadCostsMatrix({
  fa = true,
  className,
  projectId = null,
  onMonthTotalsChange,
}: OverheadCostsMatrixProps) {
  const [monthLabels, setMonthLabels] = useState(() => defaultMonthLabels(fa))
  const [categories, setCategories] = useState(() =>
    cloneCategories(OVERHEAD_CATEGORIES, DEFAULT_MONTH_COUNT)
  )
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [scheduleReady, setScheduleReady] = useState(false)
  const [editingCell, setEditingCell] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setScheduleReady(false)
    const stored = readStoredOverhead(projectId, fa)
    if (stored.customized) {
      setMonthLabels(stored.labels)
      setCategories(stored.categories)
      setSavedAt(stored.savedAt)
      setDirty(false)
      setScheduleReady(true)
      return
    }

    void (async () => {
      let labels = stored.labels
      let categories = stored.categories
      if (projectId) {
        try {
          const res = await fetch(
            `/api/workshop/schedule-tree?projectId=${encodeURIComponent(projectId)}`,
            { cache: 'no-store' }
          )
          const json = (await res.json()) as { nodes?: ScheduleTreeNode[] }
          if (res.ok) {
            const months = scheduleMonthsFromTree(json.nodes ?? [])
            if (months.length > 0) {
              const aligned = alignAmountsToScheduleMonths(
                labels,
                categories.map((cat) => cat.months),
                months
              )
              labels = aligned.labels
              categories = categories.map((cat, index) => ({
                ...cat,
                months: aligned.amountsByRow[index] ?? months.map(() => '0'),
              }))
            }
          }
        } catch {
          /* keep the stored month columns */
        }
      }
      if (cancelled) return
      setMonthLabels(labels)
      setCategories(categories)
      setSavedAt(stored.savedAt)
      setDirty(false)
      setScheduleReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, fa])

  const rows = useMemo(() => {
    return categories.map((cat) => {
      const months = padMonths(cat.months, monthLabels.length)
      return { ...cat, months, total: sumMonthStrings(months) }
    })
  }, [categories, monthLabels.length])

  const grandTotal = useMemo(() => rows.reduce((a, r) => a + r.total, 0), [rows])
  const monthTotals = useMemo(() => {
    return monthLabels.map((_, i) =>
      sumMonthStrings(rows.map((r) => r.months[i] ?? '0'))
    )
  }, [rows, monthLabels])
  const overallAverage = monthLabels.length > 0 ? grandTotal / monthLabels.length : 0

  useEffect(() => {
    onMonthTotalsChange?.({ labels: monthLabels, totals: monthTotals })
  }, [monthLabels, monthTotals, onMonthTotalsChange])

  const monthColCh = useMemo(() => {
    return monthLabels.map((_, i) => {
      let maxCh = 8
      for (const r of rows) {
        maxCh = Math.max(maxCh, widthFromDigits(formatToman(monthToNumber(r.months[i] ?? '0')), 2))
      }
      maxCh = Math.max(maxCh, widthFromDigits(formatToman(monthTotals[i] ?? 0), 2))
      return maxCh
    })
  }, [monthLabels, monthTotals, rows])

  const totalColCh = useMemo(() => {
    let maxCh = 10
    for (const r of rows) maxCh = Math.max(maxCh, widthFromDigits(formatToman(r.total), 2))
    maxCh = Math.max(maxCh, widthFromDigits(formatToman(grandTotal), 2))
    return maxCh
  }, [grandTotal, rows])

  const maxCategory = useMemo(() => {
    if (rows.length === 0) {
      return {
        code: '',
        titleFa: '—',
        titleEn: '—',
        total: 0,
        pct: 0,
        months: [] as string[],
      }
    }
    const best = rows.reduce((acc, r) => (r.total > acc.total ? r : acc), rows[0]!)
    const pct = grandTotal > 0 ? (best.total / grandTotal) * 100 : 0
    return { ...best, pct }
  }, [rows, grandTotal])

  const maxCell = useMemo(() => {
    let peak = { code: '', monthIndex: 0, value: -Infinity }
    for (const r of rows) {
      r.months.forEach((v, i) => {
        const n = monthToNumber(v)
        if (n > peak.value) peak = { code: r.code, monthIndex: i, value: n }
      })
    }
    return peak
  }, [rows])

  const markDirty = useCallback(() => {
    setDirty(true)
    setMessage(null)
  }, [])

  const persistColumns = useCallback(
    (labels: string[], cats: OverheadCategory[]) => {
      writeStoredOverhead(projectId, {
        categories: cats,
        monthLabels: labels,
        savedAt,
        customized: true,
      })
    },
    [projectId, savedAt]
  )

  const updateMonth = useCallback(
    (code: string, monthIndex: number, raw: string) => {
      // Allow clearing the field while typing; do not force '0' until blur
      if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
      setCategories((prev) => {
        const next = prev.map((cat) => {
          if (cat.code !== code) return cat
          const monthsNext = padMonths(cat.months, monthLabels.length)
          monthsNext[monthIndex] = raw
          return { ...cat, months: monthsNext }
        })
        persistColumns(monthLabels, next)
        return next
      })
    },
    [monthLabels, persistColumns]
  )

  const commitMonth = useCallback(
    (code: string, monthIndex: number, raw: string) => {
      const normalized = normalizeMonthOnBlur(raw)
      setCategories((prev) => {
        let changed = false
        const next = prev.map((cat) => {
          if (cat.code !== code) return cat
          const monthsNext = padMonths(cat.months, monthLabels.length)
          if (monthsNext[monthIndex] === normalized) return cat
          changed = true
          monthsNext[monthIndex] = normalized
          return { ...cat, months: monthsNext }
        })
        if (changed) persistColumns(monthLabels, next)
        return next
      })
    },
    [monthLabels, persistColumns]
  )

  const updateRowMeta = useCallback(
    (code: string, patch: Partial<Pick<OverheadCategory, 'code' | 'titleFa' | 'titleEn'>>) => {
      setCategories((prev) =>
        prev.map((cat) => (cat.code === code ? { ...cat, ...patch } : cat))
      )
      markDirty()
    },
    [markDirty]
  )

  const insertColumnAt = useCallback(
    (index: number, direction: -1 | 1) => {
      const base = monthLabels[index] ?? monthLabels[monthLabels.length - 1] ?? ''
      const label = suggestedNeighborMonth(base, direction, fa)
      const at = direction < 0 ? index : index + 1
      const nextLabels = [...monthLabels.slice(0, at), label, ...monthLabels.slice(at)]
      const nextCats = categories.map((cat) => {
        const months = padMonths(cat.months, monthLabels.length)
        months.splice(at, 0, '0')
        return { ...cat, months }
      })
      setMonthLabels(nextLabels)
      setCategories(nextCats)
      persistColumns(nextLabels, nextCats)
    },
    [categories, fa, monthLabels, persistColumns]
  )

  const renameColumn = useCallback(
    (index: number, label: string) => {
      const nextLabels = monthLabels.map((item, itemIndex) => (itemIndex === index ? label : item))
      setMonthLabels(nextLabels)
      persistColumns(nextLabels, categories)
    },
    [categories, monthLabels, persistColumns]
  )

  const removeColumnAt = useCallback(
    (index: number) => {
      if (monthLabels.length <= 1) return
      const nextLabels = monthLabels.filter((_, itemIndex) => itemIndex !== index)
      const nextCats = categories.map((cat) => ({
        ...cat,
        months: cat.months.filter((_, itemIndex) => itemIndex !== index),
      }))
      setMonthLabels(nextLabels)
      setCategories(nextCats)
      persistColumns(nextLabels, nextCats)
    },
    [categories, monthLabels, persistColumns]
  )

  const addRow = useCallback(() => {
    const code = nextCode(categories)
    setCategories((prev) => [
      ...prev,
      {
        code,
        titleFa: fa ? 'سرفصل جدید' : 'New category',
        titleEn: 'New category',
        months: padMonths([], monthLabels.length),
      },
    ])
    markDirty()
  }, [categories, fa, markDirty, monthLabels.length])

  const removeRow = useCallback(
    (code: string) => {
      setCategories((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.code !== code)))
      markDirty()
    },
    [markDirty]
  )

  function buildCsv(): string {
    const totalLabel =
      monthLabels.length === 6
        ? fa
          ? 'جمع 6 ماهه'
          : '6-mo total'
        : fa
          ? `جمع ${monthLabels.length} ماهه`
          : `${monthLabels.length}-mo total`
    const header = [
      fa ? 'کد سرفصل' : 'Code',
      fa ? 'سرفصل هزینه' : 'Category',
      ...monthLabels,
      totalLabel,
    ]
    const lines = [header.map(escapeCsv).join(',')]
    for (const r of rows) {
      lines.push(
        [r.code, fa ? r.titleFa : r.titleEn, ...r.months.map(String), String(r.total)]
          .map(escapeCsv)
          .join(',')
      )
    }
    lines.push(
      ['', fa ? 'جمع کل ماهانه' : 'Monthly totals', ...monthTotals.map(String), String(grandTotal)]
        .map(escapeCsv)
        .join(',')
    )
    return lines.join('\n')
  }

  function handleExport() {
    const blob = new Blob(['\uFEFF' + buildCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fa
      ? 'ماتریس-هزینه-بالاسری-کارگاه.csv'
      : 'site-overhead-costs-matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildCsv())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  async function handleFinalSubmit() {
    setSaving(true)
    setMessage(null)
    try {
      const stamp = new Date().toISOString()
      writeStoredOverhead(projectId, {
        categories,
        monthLabels,
        savedAt: stamp,
        customized: true,
      })
      setSavedAt(stamp)
      setDirty(false)
      setMessage(fa ? 'ثبت نهایی با موفقیت انجام شد.' : 'Final submit saved successfully.')
    } catch {
      setMessage(fa ? 'ثبت نهایی ناموفق بود.' : 'Final submit failed.')
    } finally {
      setSaving(false)
    }
  }

  const stickyCode =
    'sticky z-20 bg-inherit start-0 border-e border-slate-200'
  const stickyTitle =
    'sticky z-20 bg-inherit start-[3rem] border-e border-slate-200 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.1)]'

  const periodLabel = fa ? 'جمع' : 'Total'

  if (!scheduleReady) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {fa ? 'هماهنگ با برنامه زمان‌بندی…' : 'Matching the schedule…'}
      </p>
    )
  }

  return (
    <div className={cn('space-y-4', className)} dir={fa ? 'rtl' : 'ltr'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={<Wallet className="h-4 w-4" />}
          label={fa ? 'جمع کل هزینه‌ها' : 'Grand total'}
          value={`${formatToman(grandTotal)} تومان`}
          accent="slate"
        />
        <MetricCard
          icon={<Calculator className="h-4 w-4" />}
          label={fa ? 'میانگین ماهانه' : 'Monthly average'}
          value={`${formatToman(overallAverage)} تومان`}
          accent="sky"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label={fa ? 'بیشترین سرفصل' : 'Highest category'}
          value={`${fa ? maxCategory.titleFa : maxCategory.titleEn}`}
          hint={`${formatPct(maxCategory.pct)}%`}
          accent="amber"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">
              {fa
                ? 'جدول ماتریس هزینه‌های بالاسری کارگاه'
                : 'Project Monthly Overhead Costs Matrix'}
            </h3>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {fa
                ? `نمایش به تومان با رقم انگلیسی و کاما · در سلول عدد کوتاه بنویسید؛ 22 یعنی 22,000,000 تومان`
                : `Shown in Toman with English digits. Type 22 in a cell for 22,000,000 Toman`}
            </p>
            {message ? (
              <p className="mt-1 text-[10px] font-medium text-emerald-700">{message}</p>
            ) : savedAt && !dirty ? (
              <p className="mt-1 text-[10px] text-slate-500">
                {fa ? 'آخرین ثبت:' : 'Last submit:'}{' '}
                {new Date(savedAt).toLocaleString(fa ? 'fa-IR-u-nu-latn' : 'en-US')}
              </p>
            ) : dirty ? (
              <p className="mt-1 text-[10px] text-amber-700">
                {fa ? 'تغییرات ذخیره نشده — ثبت نهایی را بزنید.' : 'Unsaved — submit final.'}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Rows3 className="h-3 w-3" />
              <Plus className="h-3 w-3" />
              {fa ? 'ردیف' : 'Row'}
            </button>
            <button
              type="button"
              onClick={() => insertColumnAt(Math.max(monthLabels.length - 1, 0), 1)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Columns3 className="h-3 w-3" />
              <Plus className="h-3 w-3" />
              {fa ? 'ماه بعد' : 'Month'}
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? (fa ? 'کپی شد' : 'Copied') : fa ? 'کپی' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleFinalSubmit()}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {fa ? 'ثبت نهایی' : 'Submit'}
            </button>
          </div>
        </div>

        <div className="isolate max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-max border-separate border-spacing-0 text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th
                  className={cn(
                    stickyCode,
                    'top-0 z-30 w-[3rem] bg-slate-200 px-1 py-1 text-center text-[9px] font-semibold'
                  )}
                >
                  {fa ? 'کد' : 'Code'}
                </th>
                <th
                  className={cn(
                    stickyTitle,
                    'top-0 z-30 w-[10.5rem] max-w-[10.5rem] bg-slate-200 px-1.5 py-1 text-start text-[9px] font-semibold'
                  )}
                >
                  {fa ? 'سرفصل' : 'Category'}
                </th>
                {monthLabels.map((m, i) => (
                  <th
                    key={`month-${i}`}
                    className="sticky top-0 z-10 bg-slate-200 px-0.5 py-1 align-bottom"
                    style={{ minWidth: `max(8.5rem, calc(${monthColCh[i]}ch + 12px))` }}
                  >
                    <MonthColumnHeader
                      label={m}
                      fa={fa}
                      canRemove={monthLabels.length > 1}
                      onChangeLabel={(value) => renameColumn(i, value)}
                      onInsertBefore={() => insertColumnAt(i, -1)}
                      onInsertAfter={() => insertColumnAt(i, 1)}
                      onRemove={() => removeColumnAt(i)}
                    />
                  </th>
                ))}
                <th
                  className="sticky top-0 z-10 bg-slate-200 px-0.5 py-1 align-bottom"
                  style={{ minWidth: `calc(${totalColCh}ch + 12px)` }}
                >
                  <div className="mx-auto flex w-full items-end justify-center">
                    <span
                      className="whitespace-nowrap text-[10px] font-semibold leading-none text-slate-700"
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        height: 'fit-content',
                      }}
                    >
                      {periodLabel}
                    </span>
                  </div>
                </th>
                <th className="sticky top-0 z-10 w-7 bg-slate-200 px-0.5 py-1 text-center text-[9px]">
                  —
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isTop = row.code === maxCategory.code
                const zebra = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                return (
                  <tr
                    key={`${row.code}-${idx}`}
                    className={cn(
                      zebra,
                      'group transition-colors hover:bg-orange-50/50',
                      isTop && 'bg-amber-50/70 hover:bg-amber-50'
                    )}
                  >
                    <td
                      className={cn(
                        stickyCode,
                        zebra,
                        isTop && 'bg-amber-50',
                        'group-hover:bg-orange-50 px-0.5 py-0.5'
                      )}
                    >
                      <input
                        dir="ltr"
                        value={row.code}
                        onChange={(event) =>
                          updateRowMeta(row.code, { code: event.target.value })
                        }
                        className="h-7 w-full rounded border border-slate-200 bg-white px-0.5 text-center font-mono text-[10px] text-slate-700 outline-none focus:border-sky-400"
                      />
                    </td>
                    <td
                      className={cn(
                        stickyTitle,
                        zebra,
                        isTop && 'bg-amber-50',
                        'group-hover:bg-orange-50 w-[10.5rem] max-w-[10.5rem] px-1 py-0.5'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <input
                          value={fa ? row.titleFa : row.titleEn}
                          onChange={(event) =>
                            updateRowMeta(row.code, fa
                              ? { titleFa: event.target.value, titleEn: event.target.value }
                              : { titleEn: event.target.value, titleFa: event.target.value })
                          }
                          className="h-7 min-w-0 flex-1 truncate rounded border border-slate-200 bg-white px-1 text-[10px] font-medium text-slate-800 outline-none focus:border-sky-400"
                          title={fa ? row.titleFa : row.titleEn}
                        />
                        {isTop ? (
                          <Flame className="h-3 w-3 shrink-0 text-amber-600" aria-label={fa ? 'بیشینه' : 'Top'} />
                        ) : null}
                      </div>
                    </td>
                    {row.months.map((v, i) => {
                      const isPeak =
                        row.code === maxCell.code && i === maxCell.monthIndex
                      const text = v ?? '0'
                      const current = monthToNumber(text)
                      const previous =
                        i > 0 ? monthToNumber(row.months[i - 1] ?? '0') : null
                      const roseOverPrev =
                        previous != null && current > previous
                      const cellKey = `${row.code}-${i}`
                      const editing = editingCell === cellKey
                      const display = editing ? text : formatToman(current)
                      const ownCh = widthFromDigits(display, 2)
                      const colCh = Math.max(monthColCh[i] ?? 8, ownCh)
                      return (
                        <td
                          key={`${row.code}-${i}`}
                          className={cn(
                            'px-0.5 py-0.5 text-center',
                            isPeak && 'bg-orange-100/80',
                            roseOverPrev && !isPeak && 'bg-rose-50/90'
                          )}
                          style={{ minWidth: `calc(${colCh}ch + 12px)` }}
                          title={
                            roseOverPrev
                              ? fa
                                ? `افزایش نسبت به ${monthLabels[i - 1]}`
                                : `Higher than ${monthLabels[i - 1]}`
                              : undefined
                          }
                        >
                          <input
                            type="text"
                            inputMode="decimal"
                            dir="ltr"
                            value={display}
                            onChange={(event) =>
                              updateMonth(row.code, i, event.target.value)
                            }
                            onBlur={(event) => {
                              commitMonth(row.code, i, event.target.value)
                              setEditingCell(null)
                            }}
                            onFocus={(event) => {
                              setEditingCell(cellKey)
                              event.currentTarget.select()
                            }}
                            style={{
                              width: `calc(${colCh}ch + 12px)`,
                              minWidth: `calc(${ownCh}ch + 12px)`,
                            }}
                            className={cn(
                              'box-border h-7 rounded border bg-white px-1.5 text-center text-[11px] tabular-nums text-slate-800 outline-none focus:ring-1',
                              roseOverPrev
                                ? 'border-rose-300 bg-rose-50 text-rose-900 focus:border-rose-400 focus:ring-rose-200'
                                : 'border-slate-200 focus:border-orange-400 focus:ring-orange-200',
                              isPeak &&
                                !roseOverPrev &&
                                'border-orange-300 font-semibold text-orange-900'
                            )}
                            aria-label={`${fa ? row.titleFa : row.titleEn} — ${monthLabels[i]}`}
                          />
                        </td>
                      )
                    })}
                    <td
                      className="px-1 py-0.5 text-center text-[11px] font-semibold tabular-nums text-slate-900 whitespace-nowrap"
                      style={{ minWidth: `calc(${totalColCh}ch + 12px)` }}
                      title={String(row.total)}
                    >
                      {formatToman(row.total)}
                    </td>
                    <td className="px-0.5 py-0.5 text-center">
                      <button
                        type="button"
                        disabled={rows.length <= 1}
                        onClick={() => removeRow(row.code)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                        title={fa ? 'حذف ردیف' : 'Remove row'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white">
                <td
                  className={cn(
                    stickyCode,
                    'bg-slate-800 px-1 py-1.5 text-center font-mono text-[9px] text-slate-300'
                  )}
                >
                  —
                </td>
                <td
                  className={cn(
                    stickyTitle,
                    'bg-slate-800 px-1.5 py-1.5 text-start text-[10px] font-semibold'
                  )}
                >
                  {fa ? 'جمع کل ماهانه' : 'Monthly totals'}
                </td>
                {monthTotals.map((v, i) => (
                  <td
                    key={`ft-${i}`}
                    className="px-0.5 py-1.5 text-center text-[11px] font-semibold tabular-nums whitespace-nowrap"
                    style={{ minWidth: `calc(${monthColCh[i]}ch + 12px)` }}
                  >
                    {formatToman(v)}
                  </td>
                ))}
                <td
                  className="px-1 py-1.5 text-center text-[11px] font-bold tabular-nums text-orange-300 whitespace-nowrap"
                  style={{ minWidth: `calc(${totalColCh}ch + 12px)` }}
                >
                  {formatToman(grandTotal)}
                </td>
                <td className="bg-slate-800" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  accent: 'slate' | 'sky' | 'amber'
}) {
  const iconWrap =
    accent === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : accent === 'sky'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-slate-100 text-slate-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-slate-500">{label}</p>
        <span className={cn('rounded-lg p-1.5', iconWrap)}>{icon}</span>
      </div>
      <p className="mt-1.5 text-sm font-bold leading-snug tracking-tight text-slate-900 line-clamp-2">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] font-semibold tabular-nums text-amber-700">{hint}</p>
      ) : null}
    </div>
  )
}
