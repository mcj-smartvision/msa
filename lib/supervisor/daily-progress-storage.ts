import type { DailyProgressEntry } from '@/lib/supervisor/daily-report-activities'

const STORAGE_PREFIX = 'sitepilot-daily-progress:'
const STORAGE_VERSION = 2

export type ProjectDailyProgressState = {
  version?: number
  entries: DailyProgressEntry[]
  notesByDate: Record<string, string>
}

const EMPTY: ProjectDailyProgressState = { version: STORAGE_VERSION, entries: [], notesByDate: {} }

function isLegacyMockActivityId(id: string): boolean {
  return /^sp-\d+$/i.test(id)
}

function sanitizeEntries(entries: DailyProgressEntry[]): DailyProgressEntry[] {
  return entries.filter((e) => !isLegacyMockActivityId(e.activityId))
}

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`
}

export function readProjectDailyProgress(projectId: string): ProjectDailyProgressState {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) {
      return EMPTY
    }
    const parsed = JSON.parse(raw) as Partial<ProjectDailyProgressState>
    const entries = sanitizeEntries(Array.isArray(parsed.entries) ? parsed.entries : [])
    const notesByDate =
      parsed.notesByDate && typeof parsed.notesByDate === 'object' ? parsed.notesByDate : {}

    const version = parsed.version ?? 1
    if (version < STORAGE_VERSION) {
      const migrated = { version: STORAGE_VERSION, entries, notesByDate }
      writeProjectDailyProgress(projectId, migrated)
      return migrated
    }

    return {
      version: STORAGE_VERSION,
      entries,
      notesByDate,
    }
  } catch {
    return EMPTY
  }
}

export function writeProjectDailyProgress(projectId: string, state: ProjectDailyProgressState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      storageKey(projectId),
      JSON.stringify({
        version: STORAGE_VERSION,
        entries: sanitizeEntries(state.entries),
        notesByDate: state.notesByDate,
      })
    )
  } catch {
    /* quota */
  }
}

export function upsertDailyEntries(
  existing: DailyProgressEntry[],
  newEntries: DailyProgressEntry[]
): DailyProgressEntry[] {
  const now = new Date().toISOString()
  const map = new Map<string, DailyProgressEntry>()
  for (const e of existing) {
    map.set(`${e.activityId}@${e.reportDate}`, e)
  }
  for (const e of newEntries) {
    map.set(`${e.activityId}@${e.reportDate}`, {
      ...e,
      savedAt: e.savedAt ?? now,
    })
  }
  return [...map.values()].sort((a, b) =>
    a.reportDate.localeCompare(b.reportDate) || a.activityId.localeCompare(b.activityId)
  )
}
