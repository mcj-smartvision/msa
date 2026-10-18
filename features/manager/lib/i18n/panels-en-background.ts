/**
 * @file features/manager/lib/i18n/panels-en-background.ts
 * @purpose English BACKGROUND_COPY overlay
 * @safe-to-edit YES
 * @affects manager background page
 * @depends-on nothing
 */

export const BACKGROUND_EN = {
  httpError: (status: number) => `Error ${status}`,
  network: 'Network error',
  basis: {
    technical_office_cost: 'Technical-office plan “cost” column; BAC = sum of leaf activity costs',
    contract_value: 'Contract amount (BAC) spread by activity weight',
    weighted_project_budget: 'Project budget spread by activity weight',
    none: 'No budget recorded — PV and EV use weights',
  },
  pkg: 'Package',
  loadFailed: 'Failed to load data',
  conventionsTitle: 'Calculation conventions',
  conventions: [
    [
      'Official % source',
      'Physical progress % stored on the schedule (project_tasks and package schedule_fields).',
    ],
    [
      'Plan (PV)',
      'Always from the frozen baseline; if baseline is empty, planned dates. Current dates do not affect the plan.',
    ],
    [
      'Day counting',
      'Calendar days, both ends inclusive: day 1 of a 10-day window = 10%, finish day = 100%. Before start 0, after finish 100.',
    ],
    ['Time zone', 'Asia/Tehran (UTC+03:30) for “today”, week start (Saturday) and Jalali month.'],
    [
      'Progress weight',
      'Schedule weight (schedule_weight) of each leaf activity; ΣW is the average denominator. Cumulative progress, PV%, EV% and SPI all use this basis; budget is only for cost (CPI and TCPI).',
    ],
    [
      'Package weights',
      'Package weight is absolute (% of project) and sibling packages must sum to the parent weight; mismatches scale to the parent and are logged in Data Quality.',
    ],
    ['Rounding', 'Calculations run unrounded; values are rounded only for display.'],
  ] as const,
  cumulativeTitle: 'Cumulative progress (manager card)',
  wpNote: 'w = activity schedule weight · p = physical progress %',
  cols: {
    activity: 'Activity',
    weight: 'Weight',
    physical: 'Physical %',
    wxp: 'Weight × %',
  },
  total: 'Total',
  calc: 'Calculation',
  result: 'Result',
  cardValue: 'Dashboard card value',
  dqError: (parent: string) => `Data-quality error${parent}: `,
  parentQuote: (label: string) => ` (“${label}”)`,
  weightsOk:
    'Weight check: package weights under each parent match the parent, and all leaves sum to 100.',
  evmTitle: 'PV, EV and SPI',
  progressBasis: (byWeight: boolean) =>
    `Progress basis: ${byWeight ? 'schedule weight (MSP)' : 'budget (no activity has weight)'} · cost budget basis: `,
  asOf: (date: string) => ` · as of ${date}`,
  evmNote:
    'SPI and cumulative progress both use normalized schedule weights; budget is only for cost (CPI and TCPI) · days count both ends · Start and Finish are baseline dates',
  budget: 'Budget',
  startBase: 'Baseline start',
  finishBase: 'Baseline finish',
  planPct: 'Plan %',
  wPlan: 'Weight × plan %',
  physicalPct: 'Physical %',
  wPhysical: 'Weight × physical %',
  pvPct: 'PV% (plan)',
  evPct: 'EV% (earned)',
  spiFormula: 'SPI = EV% ÷ PV%',
  cpiFormula: 'CPI = monetary EV ÷ AC',
  bac: 'BAC',
  notRecorded: 'Not recorded',
  ac: 'AC (actual cost)',
  forecastTitle: 'Delay and finish forecast',
  forecastNote:
    'AT is days elapsed from baseline start and ES is the day the weighted baseline PV curve reaches today’s EV%; the first forecast assumes remaining work at plan speed, the second at actual speed so far (SPI(t))',
  evToday: 'EV% today',
  lagDays: 'Lag (days)',
  baselineFinish: 'Baseline finish',
  forecastPlan: 'Finish forecast (at plan speed)',
  forecastTrend: 'Finish forecast (at current trend)',
  baselineStart: (date: string) => `Baseline start: ${date}`,
  planEnded: 'Baseline window has ended; consider a re-baseline',
  evmMissing: 'EVM metrics unavailable',
  periodUnit: 'Period unit',
  month: 'month',
  week: 'week',
  day: 'day',
  esTitle: 'Time-based metrics (Earned Schedule)',
  inputs: (start: string, finish: string, asOf: string, ev: string, points: string) =>
    `Inputs: baseline start ${start} · baseline finish ${finish} · status date ${asOf} · EV = ${ev} · curve points ${points}`,
  undefined: 'Undefined',
  autoAction: 'Automatic management action: ',
  dataQuality: (dq: string, date: string, sources: string) =>
    `Data quality: ${dq} · evidence date ${date} · source: ${sources}`,
  tcpiNote: 'BAC = approved baseline budget · EV = cumulative earned value · AC = cumulative actual cost',
  weeklyFailed: (msg: string) => `Failed to read weekly plan: ${msg}`,
  tcpiPpc: 'TCPI and PPC (action-oriented metrics)',
  dailyTitle: 'Last 24 hours performance',
  dailyNote: 'Plan = weighted cumulative plan on baseline · Δp = progress recorded in the last 24 hours',
  windowStart: 'Window start',
  plannedToday: 'Approved plan for today',
  baselineEnded: 'Baseline window has ended',
  recorded24: 'Recorded in 24 hours',
  fulfillment: 'Fulfillment %',
  dailyMeta: (planned: string, reported: string, total: string, overdue: string) =>
    `Activities with plan today: ${planned} · reported of those: ${reported} · total reported: ${total} · past baseline finish: ${overdue}`,
  unavailable: 'No data available',
  pkgWeights: 'Work-package weights',
  pkgIntro:
    'Package weights are “absolute”: same unit as the parent activity weight, and sibling packages must sum exactly to the parent. A package without weight shares the parent’s remainder equally with weightless siblings. If the sum does not match, weights scale to the parent and a data-quality error is logged; calculation continues. Each package’s plan (PV) comes from the parent activity baseline.',
  pkgCols: {
    parent: 'Parent activity',
    parentW: 'Parent weight',
    pkg: 'Package',
    recorded: 'Recorded weight',
    physical: 'Package physical %',
    effective: 'Effective weight in calc',
  },
  noWeight: 'No weight',
  pkgSum: (sum: string, parent: string, status: string) =>
    `Package weight sum ${sum} vs parent weight ${parent} · ${status}`,
  compatible: 'Compatible',
  browser: (date: string) => `Report saved in this browser (${date})`,
  pkgReports: 'Package reports in this browser',
  schedulePct: 'Schedule plan %',
  supervisorTitle: 'Progress in the site-supervisor inbox',
  supervisorNote:
    'Only MSP leaf activities are counted; packages are not separate rows · p = used % (column below)',
  supervisorIntro: (n: string) =>
    `“Used %” comes from a report saved for the activity in this browser if present, otherwise the schedule plan % (rounded). So this figure can differ across browsers. Reports saved in this browser: ${n}.`,
  usedPct: 'Used %',
  source: 'Source',
  weightTotal: 'Weight total',
  supervisorProgress: 'Supervisor progress (this browser)',
  managerProgress: 'Manager cumulative progress',
  diff: 'Difference',
  units: (n: string) => `${n} points`,
  diffNote: 'Cause: different package counts, weight totals and browser-saved reports',
  back: 'Back to dashboard',
  pageTitle: 'Calculation background — every dashboard figure with live project data',
  noProject: 'No project selected',
  evmSection: 'Cumulative progress and EVM',
  pkgSupervisor: 'Package weights and supervisor progress',
}
