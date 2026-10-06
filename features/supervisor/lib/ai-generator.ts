import type { AiActionType, DailyReportInput, PurchaseRequestPayload } from '@/features/supervisor/lib/types'

/** Stub AI text generator — replace with Edge Function / OpenAI. */
export async function generateAiActionText(
  type: AiActionType,
  payload: Record<string, unknown>,
  locale: 'fa' | 'en' = 'fa'
): Promise<string> {
  const fa = locale === 'fa'

  switch (type) {
    case 'subcontractor_instruction': {
      const activity = String(payload.activity_name ?? (fa ? 'فعالیت' : 'Activity'))
      const wbs = String(payload.wbs_code ?? '').trim()
      const subcontractor = String(payload.subcontractor_name ?? '').trim()
      const instruction = String(payload.instruction ?? payload.notes ?? '').trim()
      const progress = payload.progress_percent != null ? Number(payload.progress_percent) : null
      const planned = String(payload.planned_status ?? '').trim()
      const isCritical = Boolean(payload.is_critical)

      const plannedFa =
        planned === 'shouldStart'
          ? 'باید امروز شروع شود'
          : planned === 'shouldFinish'
            ? 'باید امروز به اتمام برسد'
            : planned === 'shouldContinue'
              ? 'باید امروز ادامه یابد'
              : 'طبق برنامه امروز'

      const plannedEn =
        planned === 'shouldStart'
          ? 'should start today'
          : planned === 'shouldFinish'
            ? 'should finish today'
            : planned === 'shouldContinue'
              ? 'should continue today'
              : 'per today’s plan'

      if (fa) {
        return [
          'موضوع: دستور کار اجرایی',
          '',
          `فعالیت: ${activity}`,
          wbs ? `کد WBS: ${wbs}` : null,
          subcontractor ? `پیمانکار / اجراکننده: ${subcontractor}` : 'پیمانکار / اجراکننده: (نامشخص — در محل مشخص شود)',
          isCritical ? 'اولویت: مسیر بحرانی — تأخیر مجاز نیست' : 'اولویت: عادی',
          planned ? `وضعیت برنامه‌ای امروز: ${plannedFa}` : null,
          progress != null && Number.isFinite(progress)
            ? `پیشرفت فعلی ثبت‌شده: ${Math.round(progress)}٪`
            : null,
          '',
          'متن دستور:',
          instruction ||
            'لطفاً اجرای این فعالیت را مطابق برنامه زمان‌بندی، نقشه‌ها و دستورالعمل‌های ایمنی کارگاه ادامه دهید. هر مانع اجرایی (مصالح، نیرو، دسترسی، کیفیت) فوراً به سرپرست کارگاه گزارش شود.',
          '',
          'الزامات:',
          '۱) رعایت برنامه و کیفیت اجرا',
          '۲) گزارش پیشرفت روزانه به سرپرست کارگاه',
          '۳) رعایت نکات HSE و آماده‌سازی جبهه کار قبل از شروع',
          '',
          'با تشکر',
          'سرپرست کارگاه',
          '',
          '— این متن پیش‌نویس AI است؛ پس از تأیید شما برای مدیر پروژه ارسال می‌شود تا ابلاغ نهایی انجام شود.',
        ]
          .filter((line) => line != null)
          .join('\n')
      }

      return [
        'Subject: Work instruction',
        '',
        `Activity: ${activity}`,
        wbs ? `WBS: ${wbs}` : null,
        subcontractor ? `Subcontractor: ${subcontractor}` : 'Subcontractor: (unspecified — confirm on site)',
        isCritical ? 'Priority: Critical path — delay not acceptable' : 'Priority: Normal',
        planned ? `Today’s plan status: ${plannedEn}` : null,
        progress != null && Number.isFinite(progress)
          ? `Current recorded progress: ${Math.round(progress)}%`
          : null,
        '',
        'Instruction:',
        instruction ||
          'Please execute this activity per the project schedule, drawings, and site HSE rules. Report any blockers (materials, crew, access, quality) to the Site Supervisor immediately.',
        '',
        'Requirements:',
        '1) Follow schedule and quality standards',
        '2) Report daily progress to the Site Supervisor',
        '3) Maintain HSE readiness before starting work',
        '',
        'Regards,',
        'Site Supervisor',
        '',
        '— AI draft; after your approval it is sent to the Project Manager for final release.',
      ]
        .filter((line) => line != null)
        .join('\n')
    }
    case 'purchase_request': {
      const p = payload as unknown as PurchaseRequestPayload
      return fa
        ? [
            'موضوع: درخواست خرید',
            '',
            `ماده / قلم: ${p.material_name}`,
            `مقدار: ${p.quantity} ${p.unit}`,
            `تاریخ نیاز: ${p.needed_date}`,
            `اولویت: ${p.priority}`,
            '',
            'دلیل / توضیحات:',
            p.reason || '—',
            '',
            '— سرپرست کارگاه',
            'پس از تأیید شما → مدیر پروژه → در صورت تأیید → تدارکات',
          ].join('\n')
        : [
            'Subject: Purchase request',
            '',
            `Item: ${p.material_name}`,
            `Qty: ${p.quantity} ${p.unit}`,
            `Needed: ${p.needed_date}`,
            `Priority: ${p.priority}`,
            '',
            p.reason || '—',
            '',
            '— Site Supervisor',
            'After approval → Project Manager → then Procurement',
          ].join('\n')
    }
    case 'pm_comment': {
      const category = String(payload.category ?? 'general')
      const note = String(payload.note ?? '')
      return fa
        ? [
            'موضوع: یادداشت برای مدیر پروژه',
            `دسته: ${category}`,
            '',
            note || '—',
            '',
            '— سرپرست کارگاه',
            'با تأیید، برای مدیر پروژه ارسال/ثبت می‌شود.',
          ].join('\n')
        : [
            'Subject: Note to Project Manager',
            `Category: ${category}`,
            '',
            note || '—',
            '',
            '— Site Supervisor',
          ].join('\n')
    }
    case 'hse_alert': {
      const desc = String(payload.description ?? '')
      const severity = String(payload.severity ?? 'warning')
      return fa
        ? [
            '⚠️ هشدار HSE / کیفیت',
            '',
            `شدت: ${severity}`,
            '',
            desc || '—',
            '',
            'اقدام فوری و پیگیری درخواست می‌شود.',
            '',
            '— سرپرست کارگاه',
            'با تأیید شما برای مدیر پروژه ارسال می‌شود.',
          ].join('\n')
        : [
            '⚠️ HSE / Quality alert',
            '',
            `Severity: ${severity}`,
            '',
            desc || '—',
            '',
            'Immediate follow-up requested.',
            '',
            '— Site Supervisor',
          ].join('\n')
    }
    default:
      return fa ? 'متن پیش‌نویس AI' : 'AI draft text'
  }
}

export async function generateDailyReportSummary(
  input: DailyReportInput,
  locale: 'fa' | 'en' = 'fa'
): Promise<string> {
  const fa = locale === 'fa'
  const activityCount = input.activities.length
  const finished = input.activities.filter((a) => a.actualStatus === 'finished').length
  const issues = input.activities.flatMap((a) => a.issues)
  const note = input.supervisorNote?.trim() ?? ''
  const activityLines = input.activities.map(
    (a, i) =>
      `${i + 1}) ${a.scheduleActivityId.slice(0, 8)}… — ${a.actualStatus} / ${a.actualProgressPercent}% / کیفیت: ${a.qualityStatus}`
  )

  if (fa) {
    return [
      `گزارش روزانه کارگاه — ${input.date} (شیفت ${input.shift})`,
      '',
      `تعداد فعالیت‌های گزارش‌شده: ${activityCount}`,
      `اتمام یافته: ${finished}`,
      issues.length > 0 ? `مسائل ثبت‌شده: ${issues.length}` : 'بدون مسئله ثبت‌شده',
      input.hse.hasIncident ? `⚠️ حادثه HSE: ${input.hse.description ?? '—'}` : 'حادثه HSE: گزارش نشده',
      '',
      'جزئیات فعالیت‌ها:',
      ...activityLines,
      note ? `\nیادداشت سرپرست:\n${note}` : '',
      '',
      '— پیش‌نویس AI؛ با تأیید شما برای مدیر پروژه ارسال می‌شود.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    `Daily Site Report — ${input.date} (${input.shift})`,
    `Activities reported: ${activityCount}`,
    `Completed: ${finished}`,
    issues.length > 0 ? `Issues logged: ${issues.length}` : 'No issues logged',
    input.hse.hasIncident ? `HSE incident: ${input.hse.description ?? '—'}` : '',
    '',
    'Activity details:',
    ...activityLines,
    note ? `Supervisor note: ${note}` : '',
    '',
    '— AI draft; approving sends it to the Project Manager.',
  ]
    .filter(Boolean)
    .join('\n')
}
