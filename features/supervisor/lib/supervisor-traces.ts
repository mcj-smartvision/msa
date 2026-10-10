import { makeTrace, traceInput, v, warnProgressGap } from '@/features/calc-trace/lib/build'
import { CALC_TRACE_HISTORY_LIMIT, type CalcTrace } from '@/features/calc-trace/lib/types'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import type { ParentRollupExplanation } from '@/features/schedule/lib/parent-progress-rollup'
import type { ProgressLedgerRow } from './progress-ledger'
import type { ReportedDayProgress } from './weekly-activity-progress'

const HISTORY_NOTE = 'روند از گزارش‌های روزانهٔ ثبت‌شدهٔ سرپرست ساخته می‌شود (حداکثر 12 گزارش آخر).'

function source(activityId: string) {
  const isPackage = activityId.startsWith('package:')
  return {
    table: isPackage ? 'package_progress_updates' : 'task_progress_updates',
    rowId: activityId.replace(/^(package|schedule):/, ''),
  }
}

const rowTitle = (row: ProgressLedgerRow) => `${row.wbs ? `${row.wbs} ` : ''}${row.name}`

/** Physical progress of one activity: its latest cumulative report (or the schedule baseline). */
export function activityProgressTrace(input: {
  row: ProgressLedgerRow & { activityId: string }
  days: ReportedDayProgress[]
  baseline: number
  plannedToday: number | null
  unsavedDrafts: number
}): CalcTrace {
  const { row, days } = input
  const last = days.at(-1) ?? null
  const result = last?.cumulative ?? input.baseline
  const src = source(row.activityId)
  const trace = makeTrace({
    metric: `supervisor.activity:${row.activityId}`,
    label: `پیشرفت فیزیکی — ${rowTitle(row)}`,
    result,
    unit: 'percent',
    formula: 'پیشرفت فعالیت = درصد تجمعی آخرین گزارش روزانه (بدون گزارش: درصد مبنای برنامه)',
    formulaHuman: last
      ? `آخرین گزارش ${jalaliDate(last.date)} = ${v(last.cumulative, 'percent')}${last.daily != null ? ` (پیشرفت همان روز ${v(last.daily, 'percent')})` : ''}`
      : `هنوز گزارشی ثبت نشده؛ درصد مبنای برنامه = ${v(input.baseline, 'percent')}`,
    inputs: [
      traceInput('baseline', 'درصد مبنا (پیش از اولین گزارش)', input.baseline, 'percent', {
        table: 'project_tasks / workshop_packages',
        rowId: src.rowId,
        column: 'percent_complete (مبنا)',
      }),
      traceInput('stored', 'درصد ذخیره‌شده در برنامه (MSP)', row.schedulePercent, 'percent', {
        table: 'project_tasks',
        rowId: src.rowId,
        column: 'percent_complete',
      }),
      traceInput('planned', 'پیشرفت اجباری طبق برنامه تا امروز', input.plannedToday, 'percent', {
        table: null,
        note: 'روزهای کاری بازهٔ فعالیت (بدون جمعه و تعطیلات)',
      }),
      traceInput('weight', 'وزن فعالیت در برنامه', row.scheduleWeight, 'weight', { table: 'project_tasks', rowId: src.rowId, column: 'physical_weight' }),
      ...days
        .slice(-6)
        .reverse()
        .map((d, i) =>
          traceInput(
            `report-${i}`,
            `گزارش ${jalaliDate(d.date)}${d.daily != null ? ` (روزانه ${faNumber(d.daily, 1)}٪)` : ''}`,
            d.cumulative,
            'percent',
            { table: src.table, rowId: src.rowId, column: 'percent_complete' },
            d.date
          )
        ),
    ],
    warnings: [
      warnProgressGap(row.schedulePercent, last ? last.cumulative : null),
      input.unsavedDrafts ? `${faNumber(input.unsavedDrafts)} تغییر ذخیره‌نشده در این ردیف هست؛ عدد بالا با همان تغییرها حساب شده.` : null,
    ],
  })
  const history = days.slice(-CALC_TRACE_HISTORY_LIMIT).map((d) => ({ result: d.cumulative, computedAt: d.date }))
  trace.history = history
  trace.previousPeriod = history.length >= 2 ? history[history.length - 2]! : null
  trace.historyNote = HISTORY_NOTE
  return trace
}

/** Heading row: Σ(weight × child%) ÷ Σ(weight) of its direct schedule children (the rollup's own explanation). */
export function weightRollupTrace(row: ProgressLedgerRow, explanation: ParentRollupExplanation): CalcTrace {
  const weighted = explanation.children.filter((c) => c.weight != null && c.weight > 0)
  const totalWeight = weighted.reduce((s, c) => s + (c.weight ?? 0), 0)
  const unweighted = explanation.children.length - weighted.length
  const trace = makeTrace({
    metric: `supervisor.weights:${row.key}`,
    label: `وزن‌دهی و پیشرفت وزنی — ${rowTitle(row)}`,
    result: explanation.percent,
    unit: 'percent',
    formula: explanation.usedEqualWeights
      ? 'پیشرفت سرشاخه = میانگین ساده پیشرفت زیرشاخه‌ها (هیچ زیرشاخه‌ای وزن ندارد)'
      : 'پیشرفت سرشاخه = Σ(پیشرفتᵢ × وزنᵢ) ÷ Σوزنᵢ   (زیرشاخه‌های مستقیم وزن‌دار)',
    formulaHuman: explanation.text,
    inputs: explanation.children.map((c, i) =>
      traceInput(
        `child-${i}`,
        `${c.wbs ? `${c.wbs} ` : ''}${c.name} — وزن ${c.weight == null ? '—' : faNumber(c.weight, 2)}${totalWeight > 0 && c.weight ? ` (سهم ${faNumber((c.weight / totalWeight) * 100, 1)}٪)` : ''}`,
        c.percent,
        'percent',
        { table: 'project_tasks', rowId: c.id, column: 'physical_weight / percent_complete' }
      )
    ),
    warnings: [
      explanation.usedEqualWeights
        ? 'هیچ زیرشاخه‌ای وزن ندارد؛ میانگین ساده جایگزین وزن شده است.'
        : unweighted > 0
          ? `${faNumber(unweighted)} زیرشاخه وزن ندارد و در پیشرفت سرشاخه اثری ندارد.`
          : null,
      totalWeight > 0 && row.scheduleWeight != null && Math.abs(totalWeight - row.scheduleWeight) > 0.05
        ? `جمع وزن زیرشاخه‌ها (${faNumber(totalWeight, 2)}) با وزن خود سرشاخه (${faNumber(row.scheduleWeight, 2)}) برابر نیست.`
        : null,
    ],
  })
  trace.historyNote = 'برای پیشرفت سرشاخه تاریخچه نگه داشته نمی‌شود؛ روند هر زیرشاخه را در ردیف خودش ببینید.'
  return trace
}
