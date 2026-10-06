import type { TaskRelationType } from '@/shared/types/schedule'

export type DependencyEndpoint = {
  id?: string
  wbs?: string | null
  name?: string | null
}

const RELATION_FA: Record<
  TaskRelationType,
  {
    code: string
    title: string
    /** Short direction for the arrow tip */
    arrowHint: string
    /** Build one clear sentence with both activity labels */
    story: (fromLabel: string, toLabel: string, lag: string) => string
  }
> = {
  FS: {
    code: 'FS',
    title: 'پایان ← شروع (Finish-to-Start)',
    arrowHint: 'فلش از پایان فعالیت اول به شروع فعالیت دوم می‌رود',
    story: (fromLabel, toLabel, lag) =>
      `تا «${fromLabel}» تمام نشود، «${toLabel}» نمی‌تواند شروع شود${lag}.`,
  },
  SS: {
    code: 'SS',
    title: 'شروع ← شروع (Start-to-Start)',
    arrowHint: 'فلش از شروع فعالیت اول به شروع فعالیت دوم می‌رود',
    story: (fromLabel, toLabel, lag) =>
      `شروع «${toLabel}» به شروع «${fromLabel}» وابسته است${lag}.`,
  },
  FF: {
    code: 'FF',
    title: 'پایان ← پایان (Finish-to-Finish)',
    arrowHint: 'فلش از پایان فعالیت اول به پایان فعالیت دوم می‌رود',
    story: (fromLabel, toLabel, lag) =>
      `پایان «${toLabel}» نباید زودتر از پایان «${fromLabel}» باشد${lag}.`,
  },
  SF: {
    code: 'SF',
    title: 'شروع ← پایان (Start-to-Finish)',
    arrowHint: 'فلش از شروع فعالیت اول به پایان فعالیت دوم می‌رود',
    story: (fromLabel, toLabel, lag) =>
      `پایان «${toLabel}» به شروع «${fromLabel}» وابسته است${lag}.`,
  },
}

function formatEndpoint(ep?: DependencyEndpoint | null): string {
  const wbs = ep?.wbs?.trim()
  const name = ep?.name?.trim()
  if (wbs && name) return `${wbs} — ${name}`
  if (name) return name
  if (wbs) return wbs
  return 'فعالیت نامشخص'
}

function shortName(ep?: DependencyEndpoint | null): string {
  return ep?.name?.trim() || ep?.wbs?.trim() || 'این فعالیت'
}

function lagPhrase(lagDays: number): string {
  if (!Number.isFinite(lagDays) || lagDays === 0) return ''
  if (lagDays > 0) return ` (با ${lagDays} روز تأخیر)`
  return ` (با ${Math.abs(lagDays)} روز تقدم)`
}

function lagSentence(lagDays: number): string {
  if (!Number.isFinite(lagDays) || lagDays === 0) {
    return 'بدون تأخیر یا تقدم زمانی (lag = 0).'
  }
  if (lagDays > 0) {
    return `با ${lagDays} روز تأخیر (lag): بعد از شرط پیوند، ${lagDays} روز صبر می‌شود.`
  }
  return `با ${Math.abs(lagDays)} روز تقدم (lead): شرط پیوند ${Math.abs(lagDays)} روز زودتر اعمال می‌شود.`
}

/**
 * Full Persian explanation for one dependency link (tooltip / title).
 * Written so the user sees both activity names without tracing Gantt rows.
 */
export function explainDependencyLink(input: {
  type: TaskRelationType | string
  lagDays?: number
  predecessor?: DependencyEndpoint | null
  successor?: DependencyEndpoint | null
}): { shortLabel: string; tooltip: string } {
  const type = (['FS', 'SS', 'FF', 'SF'].includes(String(input.type))
    ? input.type
    : 'FS') as TaskRelationType
  const lagDays = Number(input.lagDays) || 0
  const info = RELATION_FA[type]
  const fromFull = formatEndpoint(input.predecessor)
  const toFull = formatEndpoint(input.successor)
  const fromShort = shortName(input.predecessor)
  const toShort = shortName(input.successor)
  const lagCode =
    lagDays === 0 ? '' : lagDays > 0 ? `+${lagDays}d` : `${lagDays}d`
  const shortLabel = `${info.code}${lagCode}`

  const tooltip = [
    'این فلش وابستگی یعنی چه؟',
    '────────────────',
    '',
    'از این فعالیت (مبدأ فلش / کار قبلی):',
    `  ${fromFull}`,
    '',
    'به فعالیت بعدی (مقصد فلش / کار بعدی):',
    `  ${toFull}`,
    '',
    'نتیجه برای برنامه:',
    `  ${info.story(fromShort, toShort, lagPhrase(lagDays))}`,
    '',
    `جهت فلش: ${info.arrowHint}`,
    `نوع پیوند: ${info.title}`,
    `کد: ${shortLabel}`,
    `زمان‌بندی: ${lagSentence(lagDays)}`,
  ].join('\n')

  return { shortLabel, tooltip }
}
