export type DailyReportVoiceActivityRef = {
  id: string
  wbs: string | null
  name: string
}

export type DailyReportVoiceActivityMatch = {
  activityId: string
  wbs: string | null
  name: string
  percentComplete: number | null
  note: string | null
}

export type ParsedDailyReportVoice = {
  transcript: string
  organizedText: string
  summary: string
  activities: DailyReportVoiceActivityMatch[]
  issues: string[]
  risks: string[]
  materials: string[]
  hse: string | null
  generalNotes: string | null
}

function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * Finds the first percentage spoken within 120 characters after `anchor` (an activity name or WBS code).
 * Prefers a number followed by "درصد"/%, otherwise takes any 1–3 digit number; values over 100 are ignored.
 */
function extractPercentNear(text: string, anchor: string): number | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(anchor.toLowerCase())
  if (idx < 0) return null
  const slice = text.slice(idx, idx + 120)
  const normalized = toLatinDigits(slice)
  const m = normalized.match(/(\d{1,3})\s*(?:درصد|٪|%)/) ?? normalized.match(/(\d{1,3})/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n > 100) return null
  return clampPercent(n)
}

/**
 * An activity counts as mentioned when the transcript contains its WBS code, the first 24 characters
 * of its name, or any single word of its name that is at least 5 letters long.
 */
function matchActivitiesLocally(
  transcript: string,
  refs: DailyReportVoiceActivityRef[]
): DailyReportVoiceActivityMatch[] {
  const out: DailyReportVoiceActivityMatch[] = []
  for (const ref of refs) {
    const nameKey = ref.name.trim().slice(0, 24)
    const wbsKey = ref.wbs?.trim() ?? ''
    const mentioned =
      (wbsKey && transcript.includes(wbsKey)) ||
      (nameKey.length >= 4 && transcript.includes(nameKey)) ||
      ref.name.split(/\s+/).some((w) => w.length >= 5 && transcript.includes(w))
    if (!mentioned) continue
    const pct =
      (wbsKey ? extractPercentNear(transcript, wbsKey) : null) ??
      extractPercentNear(transcript, ref.name) ??
      null
    out.push({
      activityId: ref.id,
      wbs: ref.wbs,
      name: ref.name,
      percentComplete: pct,
      note: null,
    })
  }
  return out
}

/* Keyword-based sentence classifiers: split the transcript into sentences and keep the ones
   containing Persian keywords for issues, risks, materials or safety. */

function splitIssueLines(transcript: string): string[] {
  return transcript
    .split(/[.؛!\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && /مشکل|تأخیر|خراب|کمبود|مانع|توقف|خرابی/i.test(l))
}

function splitRiskLines(transcript: string): string[] {
  return transcript
    .split(/[.؛!\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && /ریسک|خطر|احتمال تأخیر/i.test(l))
}

function splitMaterialLines(transcript: string): string[] {
  return transcript
    .split(/[.؛!\n]+/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 8 &&
        /میلگرد|سیمان|مصالح|تحویل|انبار|بتن|شمش|تیر|ستون|مواد/i.test(l)
    )
}

function extractHse(transcript: string): string | null {
  if (!/hse|ایمنی|حادثه|مصدوم|آتش|سقوط/i.test(transcript)) return null
  const line = transcript
    .split(/[.؛!\n]+/)
    .map((l) => l.trim())
    .find((l) => /hse|ایمنی|حادثه|مصدوم/i.test(l))
  return line ?? 'موضوع HSE در گزارش صوتی ذکر شد.'
}

export function formatDailyReportOrganizedText(parsed: Omit<ParsedDailyReportVoice, 'organizedText'>): string {
  const sections: string[] = []

  if (parsed.summary?.trim()) {
    sections.push('خلاصه روز', parsed.summary.trim())
  }

  if (parsed.activities.length > 0) {
    const lines = parsed.activities.map((a) => {
      const label = a.wbs ? `${a.wbs} ${a.name}` : a.name
      const pct =
        a.percentComplete != null ? ` — ${a.percentComplete}٪` : ''
      const note = a.note?.trim() ? ` (${a.note.trim()})` : ''
      return `• ${label}${pct}${note}`
    })
    sections.push('پیشرفت فعالیت‌ها', ...lines)
  }

  if (parsed.issues.length > 0) {
    sections.push('مشکلات و موانع', ...parsed.issues.map((i) => `• ${i}`))
  }

  if (parsed.risks.length > 0) {
    sections.push('ریسک‌ها و تأخیرهای احتمالی', ...parsed.risks.map((r) => `• ${r}`))
  }

  if (parsed.materials.length > 0) {
    sections.push('منابع و مصالح', ...parsed.materials.map((m) => `• ${m}`))
  }

  if (parsed.hse?.trim()) {
    sections.push('HSE / ایمنی', `• ${parsed.hse.trim()}`)
  }

  if (parsed.generalNotes?.trim()) {
    sections.push('یادداشت میدانی', parsed.generalNotes.trim())
  }

  if (sections.length === 0) {
    return parsed.transcript.trim()
  }

  return sections.join('\n\n')
}

/** Local fallback when OpenAI is unavailable */
export function parseDailyReportVoice(
  transcript: string,
  activityRefs: DailyReportVoiceActivityRef[]
): ParsedDailyReportVoice {
  const text = transcript.trim()
  const activities = matchActivitiesLocally(text, activityRefs)
  const issues = splitIssueLines(text)
  const risks = splitRiskLines(text)
  const materials = splitMaterialLines(text)
  const hse = extractHse(text)

  const summary =
    activities.length > 0
      ? `${activities.length} فعالیت در گزارش صوتی — ${activities
          .filter((a) => a.percentComplete != null)
          .map((a) => `${a.wbs ?? a.name}: ${a.percentComplete}٪`)
          .join('، ') || 'بدون درصد مشخص'}`
      : text.slice(0, 160)

  const base = {
    transcript: text,
    summary,
    activities,
    issues,
    risks,
    materials,
    hse,
    generalNotes: text.length > 0 && activities.length === 0 ? text : null,
  }

  return {
    ...base,
    organizedText: formatDailyReportOrganizedText(base),
  }
}

/**
 * Combines the local keyword parse with the AI parse. AI values win field by field when present;
 * activities are merged by id so local matches the AI missed are kept.
 */
export function mergeParsedDailyReportVoice(
  local: ParsedDailyReportVoice,
  remote: Partial<ParsedDailyReportVoice> & { activities?: Partial<DailyReportVoiceActivityMatch>[] }
): ParsedDailyReportVoice {
  const activityMap = new Map(local.activities.map((a) => [a.activityId, { ...a }]))

  if (Array.isArray(remote.activities)) {
    for (const item of remote.activities) {
      if (!item.activityId) continue
      const prev = activityMap.get(item.activityId)
      activityMap.set(item.activityId, {
        activityId: item.activityId,
        wbs: item.wbs ?? prev?.wbs ?? null,
        name: item.name ?? prev?.name ?? '',
        percentComplete:
          item.percentComplete != null
            ? clampPercent(Number(item.percentComplete))
            : prev?.percentComplete ?? null,
        note: item.note?.trim() || prev?.note || null,
      })
    }
  }

  const merged = {
    transcript: remote.transcript?.trim() || local.transcript,
    summary: remote.summary?.trim() || local.summary,
    activities: Array.from(activityMap.values()),
    issues: remote.issues?.length ? remote.issues : local.issues,
    risks: remote.risks?.length ? remote.risks : local.risks,
    materials: remote.materials?.length ? remote.materials : local.materials,
    hse: remote.hse?.trim() || local.hse,
    generalNotes: remote.generalNotes?.trim() || local.generalNotes,
  }

  return {
    ...merged,
    organizedText: formatDailyReportOrganizedText(merged),
  }
}
