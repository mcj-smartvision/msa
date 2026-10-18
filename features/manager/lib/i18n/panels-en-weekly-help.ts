/**
 * @file features/manager/lib/i18n/panels-en-weekly-help.ts
 * @purpose English WEEKLY_HELP_COPY overlay
 * @safe-to-edit YES
 * @affects manager weekly commitments help
 * @depends-on nothing
 */

export const WEEKLY_HELP_EN = {
  noNumbers: 'No numbers to show yet.',
  noData: 'No data yet.',
  noWeek: 'No week yet.',
  what: 'What is this metric?',
  why: 'Why does it matter?',
  now: 'Current numbers',
  colorsWhat: 'What do the colors mean?',
  colors: 'Colors',
  sources: 'Where does the data come from?',
  phaseOne: 'How is it calculated now (phase 1)?',
  limits: 'Phase-1 limits and next phase',
  note: 'Important note',
  together: 'How should we read SPI and SPI(t) together?',
  lockWhat: 'What is a lock (constraint)?',
  status: 'Current status',
  trendWhat: 'What does this chart show?',
  weekNumbers: 'Numbers for each week',
  boxWhat: 'What does this box show?',
  rncWhat: 'What is this box?',
  phaseIntro:
    'In the main method, supervisors promise each week which work they will complete. Until weekly-commitment entry exists, each week’s commitments are taken from the schedule — we assume the site is committed to exactly following the plan.',
  phaseIntroBefore:
    'In the main method, supervisors promise each week which work they will complete. Until weekly-commitment entry exists, each week’s commitments are taken from ',
  sameSchedule: 'the same schedule',
  phaseIntroAfter: '; we assume the site is committed to exactly following the plan.',
  phaseLeads: {
    week: 'Week:',
    commits: 'Week commitments:',
    lock: 'Saturday lock:',
    share: 'Week share (required %):',
    actual: 'Week actual:',
    score: 'Score (0/1):',
    weight: 'Weight:',
    current: 'Current week:',
  },
  phaseBodies: {
    week: ' Saturday to Thursday. Friday and recorded holidays are not workdays. Each week is scored Thursday at 16:00.',
    commits:
      ' Every schedule activity that has a plan share in this week. Workshop sub-items with separate daily-report % are each a separate commitment — the same list the supervisor sees in “record daily report”. Activities already at 100% have no commitment.',
    lock: ' Each week’s commitments freeze Saturday 00:00 from the activity’s forecast window at that moment. If the forecast window moves mid-week, it affects the next week.',
    shareBefore: ' Planned progress across the window is spread evenly over workdays:',
    shareFormula: 'Week share = planned % by Thursday end − planned % before Saturday',
    shareAfter: 'capped by remaining work (100 − cumulative % before Saturday).',
    actual:
      ' Cumulative % recorded by Thursday end minus cumulative % before Saturday — the sum of daily progress the supervisor recorded this week. A report after Thursday does not count for that week’s score. An activity never reported keeps the % stored on the schedule.',
    score: ' 1 if week actual ≥ week share, else 0. No partial credit; any shortfall needs an RNC cause.',
    weight:
      ' Every activity gets one score, large or small. PPC measures “promise reliability”, not work volume; SPI measures volume.',
    current: ' Not scored until Thursday 16:00; the figure is “to date” and uses today’s progress.',
  },
  ppcFormula: 'PPC = scored activities ÷ total week commitments × 100',
  sourcesItems: [
    'Plan dates: each activity’s forecast window from the latest project schedule and technical-office workshop sub-items. Unlike PPC, SPI and the S-curve compare to the baseline.',
    'Auto forecast: after each daily report, finished activities get actual dates; in-progress work finishes remaining duration from today at plan speed (duration × (1 − % done)); unstarted work shifts via predecessors (FS/SS/FF/SF with lags). The approved technical-office plan and baseline are not changed.',
    'Actual %: site-supervisor daily report (“record daily report” and “daily-report background” on the supervisor dashboard).',
    'For a correct figure, the supervisor must record cumulative activity % by Thursday end; late reports credit the next week.',
    'Non-completion cause (RNC): from Thursday 16:00, for each incomplete commitment the supervisor records a cause, aggregated under “non-completion causes”.',
  ] as const,
  ppcWhat:
    'PPC (Percent Plan Complete) is the main Last Planner System metric in lean construction. It asks: of the work promised for a week, what % was actually finished on time?',
  lastPlanner: 'Last Planner',
  leading: 'It is a leading indicator:',
  leadingBody:
    ' SPI and SPI(t) say how far behind the project is to date (looking back). PPC warns earlier: several low weeks in a row usually mean SPI will drop a few weeks later.',
  trust:
    'It shows planning reliability: when PPC is high, you can plan the next work (materials, crew, next contractor) with confidence.',
  where: 'It shows where the problem is: the late-activity list says exactly which promises failed this week.',
  weekLabel: 'Week',
  weekCurrent: 'Current week',
  weekN: (n: string) => `Week ${n}`,
  weekRange: (label: string, start: string, end: string) => `${label} (${start} to ${end})`,
  weekStatus: 'Week status',
  weekOpen: 'Open; figure is to date',
  weekClosed: 'Closed; figure is final',
  commitCount: 'Commitment count (week schedule activities)',
  shareDone: 'Completed their week share',
  behind: 'Behind plan',
  prevPpc: 'Previous week PPC',
  avgWeeks: (n: string) => `Average of last ${n} closed weeks`,
  target: 'Target',
  ppcEq: (done: string, planned: string, pct: string) => `${done} ÷ ${planned} = ${pct}`,
  example: 'Example from this week:',
  exampleBody: (name: string, target: string, actual: string, ok: boolean) =>
    ` “${name}” week share is ${target} and recorded progress this week is ${actual}; so it ${ok ? 'scores' : 'does not score'}.`,
  green: (t: string) => `Green (“on target”): ${t} or more; planning is reliable.`,
  yellow: (low: string, t: string) =>
    `Amber (“below target”): between ${low} and ${t}; review why activities slipped.`,
  red: (low: string) =>
    `Red (“low”): below ${low}; the plan is out of step with site reality and later weeks are not trustworthy.`,
  limitItems: [
    'Commitments come from the schedule, not from the site’s own promise — so PPC currently shows “schedule adherence” more than Last Planner commitment.',
    'Non-completion causes (materials, crew, drawings, …) are not recorded yet, so the root-cause box is empty.',
    'Later, supervisors will enter their own weekly commitment list (only ready, unlocked work) and record a cause for each unfinished item.',
  ] as const,
  spiWhat:
    'SPI (Schedule Performance Index) comes from earned-value management (EVM). It compares work actually done to date with work that should have been done by today on the baseline.',
  evm: 'Earned value management',
  spiFormula: 'SPI = EV ÷ PV',
  spiBullets: [
    'EV (earned value): weighted sum of actual % across activities — how much of the whole project is really done.',
    'PV (planned value): weighted sum of the % that should have been done by today on the baseline.',
    'Each activity’s weight is its schedule weight.',
  ] as const,
  spiWhy:
    'It says how far ahead or behind the project is in work volume. SPI = 1 means exactly on plan; 0.87 means 87 of every 100 planned work units are done; above 1 means ahead of plan.',
  volume: 'Work volume',
  evNow: 'EV (work done of the whole project)',
  pvNow: 'PV (work planned to today)',
  meaning: 'Meaning',
  meaningN: (n: string) => `Of every 100 planned work units, ${n} were completed`,
  spiColors: [
    'Green: 1 or more (on or ahead of plan).',
    'Amber: 0.9 to 1 (slightly behind).',
    'Red: below 0.9 (behind plan).',
  ] as const,
  spiNote:
    'Near project end SPI always drifts toward 1, even if the project finishes late, because both earned and planned work hit 100%. In the last months trust SPI(t) more. The small chart under the card shows the SPI trend from recorded S-curve points to today.',
  spitWhat:
    'SPI(t) is the time-based schedule index from Earned Schedule. Instead of work volume, it uses time.',
  earnedSchedule: 'Earned Schedule',
  time: 'Time',
  spitFormula: 'SPI(t) = ES ÷ AT',
  esDef: (u: string) =>
    `ES (earned time): which ${u} from project start today’s progress should have been reached on the baseline.`,
  atDef: (u: string) => `AT (actual time): how many ${u} have really elapsed from project start.`,
  spitWhy: (u: string) =>
    `It says directly how many ${u} the project is behind or ahead and, unlike SPI, stays reliable to the end. You can also forecast finish: if the trend continues, duration ≈ “planned duration ÷ SPI(t)”.`,
  esNow: (u: string) => `ES (which plan ${u} current progress equals)`,
  esVal: (u: string, n: string) => `${u} ${n}`,
  atNow: (u: string) => `AT (${u}s elapsed from start)`,
  atVal: (n: string, u: string) => `${n} ${u}`,
  gap: 'Gap vs plan',
  spitBehind: (n: string, u: string) => `About ${n} ${u} behind plan`,
  onOrAhead: 'On or ahead of plan',
  spitColors: ['Green: 1 or more.', 'Amber: 0.9 to 1.', 'Red: below 0.9.'] as const,
  spitTogether:
    'SPI measures work volume and SPI(t) measures time. If they diverge, trust SPI(t) more. PPC beside them explains “why”: several low PPC weeks means weekly promises are failing and SPI / SPI(t) will soon drop.',
  lockBody:
    'In Last Planner, a “lock” is anything that prevents starting work: materials not arrived, incomplete drawings or tech info, no free crew, no equipment, missing permit/approval, or unfinished predecessor work. Work is “ready” when all locks are cleared.',
  lockWhy:
    'If look-ahead locks for the next few weeks are seen and cleared early, work is ready on time and PPC stays high. Counting locks by type shows which unit (procurement, technical office, HR, …) must act first.',
  lockStatus:
    'Lock recording is not built yet, so this box has no numbers. When it is, each future-week activity will store lock type, expected clearance date, status and critical-path impact, and this box will show locked work counts.',
  trendBody: (target: string) =>
    `Each PPC column is a week. Solid columns are closed weeks (final). The light dashed column is the current week before Thursday, to date. The horizontal dashed line is the target (${target}). At most the last 10 closed weeks are shown.`,
  trendNote:
    'Trend matters more than one week: one bad week may be noise, but several weeks below target means the plan is out of step with site reality.',
  weekScore: (done: string, planned: string, ppc: string) => `${done} of ${planned} · ${ppc}`,
  listIntro: (which: string) =>
    `All activities that should have progressed in ${which} per the plan. Each tile is one activity:`,
  currentWeek: 'Current week',
  lastClosed: 'Last closed week',
  greenTick: 'Green with check:',
  greenTickBody:
    ' This week’s recorded progress met the week share (scored). The number beside it is “week actual / week share”.',
  redLabel: 'Red:',
  redBody:
    ' Still short of the week share. “X% of Y% plan” means X progress points were recorded this week and the week share is Y. The red bar shows how much of the share was done.',
  sorted: 'Late items come first and the later they are, the higher they sit — so the first tiles are what to chase.',
  nowCount: (planned: string, done: string, behind: string) =>
    `There are ${planned} activities this week; ${done} completed their week share and ${behind} are behind.`,
  rncBody:
    'RNC (Reasons for Non-Completion) records a root cause for each item not finished in the week: materials, crew, equipment, permit/approval, drawings & tech info, predecessor work, weather, site access, payment, QC rework or other. The pie chart shows each cause’s share over the last 4 weeks.',
  rncWhy:
    'Most unfinished work usually comes from two or three repeating causes. Seeing them tells the PM which problem to fix first so PPC rises.',
  rncStatus:
    'In phase 1 commitments come from the schedule and there is nowhere to record non-completion causes, so this box is empty. Cause entry arrives with weekly commitment entry later.',
}
