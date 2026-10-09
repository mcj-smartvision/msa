import type { ActionableMetric, RagStatus, TcpiPpcInput } from '@/shared/types/project-controls'

function fmt(value: number, digits = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

function finite(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------------ TCPI */

export const TCPI_FORMULA = 'TCPI_BAC = (BAC − EV) ÷ (BAC − AC)'

/** TCPI ≤ 1.05 healthy, ≤ 1.15 warning, above that critical. */
export function ragFromTcpi(tcpi: number | null): RagStatus {
  if (tcpi == null || !Number.isFinite(tcpi) || tcpi > 1.15) return 'CRITICAL'
  if (tcpi > 1.05) return 'WARNING'
  return 'HEALTHY'
}

const TCPI_TEXT: Record<RagStatus, { interpretation: string; action: string }> = {
  HEALTHY: {
    interpretation: 'راندمان هزینه لازم برای کار باقیمانده واقع‌بینانه و در محدوده بودجه مصوب است.',
    action: 'اقدام خاصی لازم نیست؛ پایش عادی هزینه‌ها ادامه یابد.',
  },
  WARNING: {
    interpretation: 'برای تکمیل در سقف بودجه، بهره‌وری هزینه‌ای تیم اجرایی باید افزایش یابد.',
    action: 'هشدار به مدیران اجرایی جهت پایش دقیق هزینه‌های هفتگی.',
  },
  CRITICAL: {
    interpretation: 'هدف بودجه با ساختار فعلی غیرقابل دستیابی است!',
    action:
      'قرمز: هدف بودجه غیرقابل دستیابی است؛ ضرورت تشکیل جلسه فوری با کارفرما جهت اخذ الحاقیه/تعدیل یا بازنگری در محدوده (Scope).',
  },
}

export function computeTcpi(input: Pick<TcpiPpcInput, 'bac' | 'ev' | 'ac'>): ActionableMetric {
  const bac = finite(input.bac)
  const ev = finite(input.ev)
  const ac = finite(input.ac)
  const base = {
    key: 'tcpi_bac',
    code: 'KPI-04',
    label_fa: 'شاخص عملکرد لازم برای تکمیل در سقف بودجه (TCPI-BAC)',
    unit: 'ضریب',
    formula: TCPI_FORMULA,
  }

  if (bac == null || ev == null || ac == null || bac <= 0 || ev < 0 || ac < 0) {
    return {
      ...base,
      value: null,
      substitution: `BAC = ${bac ?? '—'} · EV = ${ev ?? '—'} · AC = ${ac ?? '—'} ⇒ ورودی نامعتبر`,
      interpretation_fa: 'ورودی‌های BAC، EV یا AC معتبر نیستند (BAC باید مثبت و EV و AC نامنفی باشند).',
      actionable_decision_fa: 'اصلاح بودجهٔ مبنا و داده‌های ارزش کسب‌شده و هزینهٔ واقعی در سامانه.',
      rag: 'CRITICAL',
      debug: { bac, ev, ac, case: 'invalid_input' },
    }
  }

  if (ev >= bac) {
    return {
      ...base,
      value: 0,
      substitution: `EV = ${fmt(ev)} ≥ BAC = ${fmt(bac)} ⇒ TCPI_BAC = 0`,
      interpretation_fa: 'کار پروژه کامل شده و کار باقی‌مانده‌ای برای تأمین وجود ندارد.',
      actionable_decision_fa: 'اقدامی لازم نیست؛ بستن حساب‌های پروژه و تسویه.',
      rag: 'HEALTHY',
      debug: { bac, ev, ac, case: 'work_complete' },
    }
  }

  const remainingWork = bac - ev
  const remainingBudget = bac - ac
  if (remainingBudget <= 0) {
    return {
      ...base,
      value: null,
      substitution: `TCPI_BAC = (${fmt(bac)} − ${fmt(ev)}) ÷ (${fmt(bac)} − ${fmt(ac)}) = ${fmt(remainingWork)} ÷ ${fmt(remainingBudget)} ⇒ ∞`,
      interpretation_fa: 'بودجهٔ مصوب تمام شده در حالی که هنوز کار باقی مانده است؛ تکمیل در سقف بودجه ممکن نیست.',
      actionable_decision_fa: TCPI_TEXT.CRITICAL.action,
      rag: 'CRITICAL',
      debug: { bac, ev, ac, remainingWork, remainingBudget, case: 'budget_exhausted' },
    }
  }

  const tcpi = remainingWork / remainingBudget
  const rag = ragFromTcpi(tcpi)
  return {
    ...base,
    value: round(tcpi, 3),
    substitution: `TCPI_BAC = (${fmt(bac)} − ${fmt(ev)}) ÷ (${fmt(bac)} − ${fmt(ac)}) = ${fmt(remainingWork)} ÷ ${fmt(remainingBudget)} = ${fmt(tcpi, 3)}`,
    interpretation_fa: TCPI_TEXT[rag].interpretation,
    actionable_decision_fa: TCPI_TEXT[rag].action,
    rag,
    debug: { bac, ev, ac, remainingWork, remainingBudget, case: 'computed' },
  }
}

/* ------------------------------------------------------------------- PPC */

export const PPC_FORMULA = 'PPC = (Completed Activities ÷ Planned Committed Activities) × 100'

/** PPC ≥ 85 healthy, ≥ 70 warning, below that critical. */
export function ragFromPpc(ppc: number): RagStatus {
  if (ppc >= 85) return 'HEALTHY'
  if (ppc >= 70) return 'WARNING'
  return 'CRITICAL'
}

const PPC_TEXT: Record<RagStatus, { interpretation: string; action: string }> = {
  HEALTHY: {
    interpretation: 'انضباط و تعهدپذیری اکیپ‌های اجرایی در سطح مطلوب و پایدار قرار دارد.',
    action: 'اقدام خاصی لازم نیست؛ برنامه‌ریزی هفتگی با همین روال ادامه یابد.',
  },
  WARNING: {
    interpretation: 'بخشی از تعهدات هفتگی کارگاه محقق نشده و نیاز به بررسی موانع (Constraints) دارد.',
    action: 'بررسی علت عدم تحقق فعالیت‌ها در جلسه هفتگی Last Planner.',
  },
  CRITICAL: {
    interpretation: 'قابلیت اطمینان برنامه هفتگی به شدت پایین است.',
    action:
      'قرمز: عدم انضباط سرپرستان کارگاه یا قطعی تدارکات انبار؛ توقف تعهدات جدید تا رفع گلوگاه‌ها و آزادسازی جبهه‌های کاری.',
  },
}

export function computePpc(plannedInput: number, completedInput: number): ActionableMetric {
  const base = {
    key: 'ppc',
    code: 'KPI-05',
    label_fa: 'درصد تحقق برنامهٔ هفتگی (PPC)',
    unit: 'درصد',
    formula: PPC_FORMULA,
  }
  const warnings: string[] = []
  const planned = finite(plannedInput) ?? 0
  let completed = finite(completedInput) ?? 0
  if (completed < 0) {
    warnings.push('تعداد فعالیت‌های تکمیل‌شده منفی بود و صفر در نظر گرفته شد.')
    completed = 0
  }

  if (planned <= 0) {
    warnings.push('هیچ فعالیت متعهدی در برنامهٔ هفتگی ثبت نشده است.')
    return {
      ...base,
      value: 0,
      substitution: `Planned = ${planned} ≤ 0 ⇒ PPC = 0`,
      interpretation_fa: 'برنامهٔ هفتگی متعهد (WWP) ثبت نشده و قابلیت اطمینان برنامه قابل اندازه‌گیری نیست.',
      actionable_decision_fa: 'ثبت برنامهٔ هفتگی متعهد (WWP) توسط سرپرستان کارگاه پیش از شروع هفته.',
      rag: 'CRITICAL',
      debug: { planned, completed, warnings, case: 'no_plan' },
    }
  }

  if (completed > planned) {
    warnings.push('تعداد تکمیل‌شده بیشتر از تعداد متعهد بود؛ PPC روی 100٪ محدود شد.')
  }
  const raw = (completed / planned) * 100
  const ppc = Math.min(100, Math.max(0, raw))
  const rag = ragFromPpc(ppc)
  return {
    ...base,
    value: round(ppc, 1),
    substitution: `PPC = (${completed} ÷ ${planned}) × 100 = ${fmt(raw, 1)}${raw > 100 ? ' ⇒ 100.0' : ''}`,
    interpretation_fa: PPC_TEXT[rag].interpretation,
    actionable_decision_fa: PPC_TEXT[rag].action,
    rag,
    debug: { planned, completed, warnings, case: 'computed' },
  }
}

export function computeTcpiPpc(input: TcpiPpcInput): { tcpi: ActionableMetric; ppc: ActionableMetric } {
  return {
    tcpi: computeTcpi(input),
    ppc: computePpc(input.leanWeeklyPlanned, input.leanWeeklyCompleted),
  }
}
