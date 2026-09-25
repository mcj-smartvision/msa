/**
 * Generates data/demo-financial-seed.json — realistic test data for
 * project_progress_cost + financial_invoices with ACC-* UI block mapping.
 *
 * Usage: node scripts/generate-financial-test-data.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../data/demo-financial-seed.json')

const PROJECT_ID = 'demo-project-1'
const START = new Date('2025-03-01')

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x.toISOString().slice(0, 10)
}

function sCurve(t) {
  if (t <= 0) return 0
  if (t >= 1) return 100
  const k = 6
  const x = (t - 0.5) * k
  return Math.round((100 / (1 + Math.exp(-x))) * 100) / 100
}

const TASKS = [
  {
    task_uid: 'A-001',
    task_name: 'Excavation & earthworks',
    wbs: '1.1.1',
    startDay: 0,
    duration: 25,
    budget: 450_000_000,
    varianceBias: -8,
    costOverrun: 1.06,
  },
  {
    task_uid: 'A-002',
    task_name: 'Footing concrete',
    wbs: '1.1.2',
    startDay: 18,
    duration: 20,
    budget: 820_000_000,
    varianceBias: 0,
    costOverrun: 1.0,
  },
  {
    task_uid: 'A-003',
    task_name: 'Column rebar installation',
    wbs: '1.2.1',
    startDay: 35,
    duration: 22,
    budget: 620_000_000,
    varianceBias: 5,
    costOverrun: 0.97,
  },
  {
    task_uid: 'A-004',
    task_name: 'Column concrete pour',
    wbs: '1.2.2',
    startDay: 48,
    duration: 24,
    budget: 980_000_000,
    varianceBias: -12,
    costOverrun: 1.08,
  },
  {
    task_uid: 'A-005',
    task_name: 'Ground floor slab',
    wbs: '1.3.1',
    startDay: 58,
    duration: 28,
    budget: 1_450_000_000,
    varianceBias: -6,
    costOverrun: 1.04,
  },
  {
    task_uid: 'A-006',
    task_name: 'Basement waterproofing',
    wbs: '1.1.3',
    startDay: 10,
    duration: 18,
    budget: 380_000_000,
    varianceBias: 2,
    costOverrun: 0.99,
  },
  {
    task_uid: 'A-007',
    task_name: 'Level 1 formwork',
    wbs: '1.3.2',
    startDay: 72,
    duration: 35,
    budget: 720_000_000,
    varianceBias: -3,
    costOverrun: 1.02,
  },
  {
    task_uid: 'A-008',
    task_name: 'Level 1 slab concrete',
    wbs: '1.3.3',
    startDay: 95,
    duration: 22,
    budget: 1_120_000_000,
    varianceBias: -5,
    costOverrun: 1.03,
  },
]

function buildProgressCost() {
  const rows = []
  for (const task of TASKS) {
    let prevPlanned = 0
    let prevActual = 0
    for (let d = task.startDay; d < task.startDay + task.duration && d < 120; d += 1) {
      const dayInTask = d - task.startDay
      const t = dayInTask / task.duration
      const planned = sCurve(t)
      let actual = planned + task.varianceBias * Math.sin(t * Math.PI)
      if (d % 7 === 3) actual = planned
      actual = Math.max(0, Math.min(100, Math.round(actual * 100) / 100))
      const progress_variance = Math.round((actual - planned) * 100) / 100

      let status = 'InProgress'
      if (planned === 0 && actual === 0) status = 'NotStarted'
      else if (planned >= 100 && actual >= 100) status = 'Completed'
      else if (progress_variance < -10) status = 'Delayed'
      else if (actual < 100) status = 'InProgress'

      const planned_cost_cum = Math.round((task.budget * planned) / 100)
      const actual_cost_cum = Math.max(
        prevActual,
        Math.round((task.budget * actual * task.costOverrun) / 100)
      )
      const cost_variance = actual_cost_cum - planned_cost_cum

      rows.push({
        project_id: PROJECT_ID,
        date: addDays(START, d),
        task_uid: task.task_uid,
        task_name: task.task_name,
        wbs: task.wbs,
        planned_percent_complete: planned,
        actual_percent_complete: actual,
        status,
        progress_variance,
        planned_cost_cum,
        actual_cost_cum,
        cost_variance,
      })
      prevPlanned = planned_cost_cum
      prevActual = actual_cost_cum
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.task_uid.localeCompare(b.task_uid))
}

function costDeltaInPeriod(rows, start, end) {
  const byTask = new Map()
  for (const r of rows) {
    if (!byTask.has(r.task_uid)) byTask.set(r.task_uid, { before: 0, after: 0 })
    const o = byTask.get(r.task_uid)
    if (r.date < start) o.before = r.actual_cost_cum
    if (r.date <= end) o.after = r.actual_cost_cum
  }
  let delta = 0
  for (const o of byTask.values()) delta += Math.max(0, o.after - o.before)
  return delta
}

function buildInvoices(progressRows) {
  const periods = [
    { no: 'SV-001', start: '2025-03-01', end: '2025-03-31', invDate: '2025-04-05', status: 'paid', approvedPct: 0.98, paidPct: 0.98 },
    { no: 'SV-002', start: '2025-04-01', end: '2025-04-30', invDate: '2025-05-06', status: 'paid', approvedPct: 0.97, paidPct: 0.95 },
    { no: 'SV-003', start: '2025-05-01', end: '2025-05-31', invDate: '2025-06-04', status: 'approved', approvedPct: 0.94, paidPct: 0.72 },
    { no: 'SV-004', start: '2025-06-01', end: '2025-06-15', invDate: '2025-06-20', status: 'under_review', approvedPct: 0, paidPct: 0 },
    { no: 'SV-005', start: '2025-06-16', end: '2025-06-30', invDate: '2025-07-03', status: 'sent', approvedPct: 0, paidPct: 0 },
    { no: 'SV-006', start: '2025-07-01', end: '2025-07-15', invDate: '2025-07-18', status: 'draft', approvedPct: 0, paidPct: 0 },
  ]

  return periods.map((p) => {
    const periodDelta = costDeltaInPeriod(progressRows, p.start, p.end)
    const amount = Math.round(periodDelta * 0.96)
    const approved_amount = Math.round(amount * p.approvedPct)
    const paid_amount = Math.round(approved_amount * p.paidPct)
    return {
      project_id: PROJECT_ID,
      invoice_no: p.no,
      invoice_date: p.invDate,
      period_start: p.start,
      period_end: p.end,
      total_amount: amount,
      amount,
      approved_amount,
      paid_amount,
      work_done_amount: Math.round(amount * 0.85),
      materials_on_site_amount: Math.round(amount * 0.1),
      adjustments_amount: Math.round(amount * 0.05),
      status: p.status,
    }
  })
}

const project_progress_cost = buildProgressCost()
const financial_invoices = buildInvoices(project_progress_cost)

const payload = {
  _meta: {
    project_id: PROJECT_ID,
    generated_at: new Date().toISOString(),
    notes: 'Engineering layer (project_progress_cost) separate from financial layer (financial_invoices)',
  },
  project_progress_cost,
  financial_invoices,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8')
console.log(`Wrote ${project_progress_cost.length} progress rows + ${financial_invoices.length} invoices → ${OUT}`)
