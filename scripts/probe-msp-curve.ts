import { readFileSync, writeFileSync } from 'fs'
import { parseMspXml } from '../features/schedule/lib/msp-parser'
import { normalizeScheduleWeightPercent } from '../features/schedule/lib/weighted-progress'
import {
  calculatePlannedProjectProgress,
  calculateSCurveActualProgress,
  type DailyReportActivity,
} from '../features/supervisor/lib/daily-report-activities'

const xmlPath =
  process.argv[2] ||
  'c:/Users/Aryan Digitai/Downloads/Telegram Desktop/برنامه زمان بندی کامل.xml'

/** Match app: shift MSP calendar so WBS 1.1 lands on actual project start (1 Ordibehesht 1405). */
const ACTUAL_START = process.argv[3] || '2026-04-21'

const xml = readFileSync(xmlPath, 'utf8')
const parsed = parseMspXml(xml)
const tasks = parsed.tasks
const leaves = tasks.filter((t) => !t.is_summary)

function day(v: string | null | undefined) {
  return v?.slice(0, 10) || ''
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()
  return Math.round(ms / 86_400_000)
}

const anchor =
  leaves.find((t) => t.wbs_code === '1.1') ||
  [...leaves].sort((a, b) => day(a.start_planned).localeCompare(day(b.start_planned)))[0]

const anchorStart = day(anchor?.start_planned)
const delta = anchorStart ? diffDays(anchorStart, ACTUAL_START) : 0

const activities: DailyReportActivity[] = leaves.map((t, i) => {
  const start = day(t.start_planned)
  const finish = day(t.finish_planned)
  const w = normalizeScheduleWeightPercent(t.schedule_weight)
  return {
    id: `schedule:${i}`,
    name: t.name,
    wbs: t.wbs_code,
    kind: 'schedule' as const,
    plannedStartDate: start ? addDays(start, delta) : '',
    plannedFinishDate: finish ? addDays(finish, delta) : null,
    progressWeight: w > 0 ? w : 1,
    plannedDurationDays: 1,
    parentTaskId: `t${i}`,
    baselinePercentComplete: Math.min(100, Math.max(0, Number(t.percent_complete) || 0)),
  }
})

const asOfDates = [
  '2026-04-21',
  '2026-05-15',
  '2026-06-15',
  '2026-07-20',
  '2026-08-15',
  '2026-09-02',
]
const today = '2026-09-02'

const lines: string[] = []
lines.push(`leaves=${leaves.length} actualStart=${ACTUAL_START} deltaDays=${delta}`)
lines.push(
  `withPct=${leaves.filter((t) => Number(t.percent_complete) > 0).length} done100=${leaves.filter((t) => Number(t.percent_complete) >= 100).length}`
)

let wAll = 0
let wDone = 0
for (const a of activities) {
  wAll += a.progressWeight
  if ((a.baselinePercentComplete ?? 0) >= 100) wDone += a.progressWeight
}
lines.push(
  `weightSum=${wAll.toFixed(2)} weightDone100=${wDone.toFixed(2)} maxOverall≈${((wDone / wAll) * 100).toFixed(1)}% if only 100% leaves`
)

for (const asOf of asOfDates) {
  const actual = calculateSCurveActualProgress(activities, [], asOf, today)
  const planned = calculatePlannedProjectProgress(activities, asOf)
  lines.push(`${asOf} actual=${actual.toFixed(2)} planned=${planned.toFixed(2)}`)
}

lines.push('--- first 15 shifted leaves ---')
const sorted = [...activities].sort((a, b) =>
  a.plannedStartDate.localeCompare(b.plannedStartDate)
)
for (const a of sorted.slice(0, 15)) {
  lines.push(
    `${a.plannedStartDate}..${a.plannedFinishDate} pct=${a.baselinePercentComplete} w=${a.progressWeight} ${a.wbs} ${a.name}`
  )
}

writeFileSync('scripts/.msp-curve-probe.txt', lines.join('\n'), 'utf8')
console.log(lines.join('\n'))
