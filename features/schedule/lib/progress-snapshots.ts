import { toGregorian, toJalaali } from 'jalaali-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { todayTehranIso } from '@/shared/lib/time/tehran'

export type JalaliSnapshotMonth = {
  /** Gregorian YYYY-MM-DD of day 1 of this Jalali month */
  snapshotMonth: string
  /** Jalali label, always day 1, e.g. 1405-05-01 */
  jalaliMonth: string
  jy: number
  jm: number
  isLastDay: boolean
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const match = iso.trim().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

function gregorianIso(gy: number, gm: number, gd: number): string {
  return `${gy}-${pad2(gm)}-${pad2(gd)}`
}

/** Jalali month containing `isoDate`, plus whether that date is the last day of the month. */
export function jalaliSnapshotMonth(isoDate: string): JalaliSnapshotMonth | null {
  const parts = isoParts(isoDate)
  if (!parts) return null
  const { jy, jm, jd } = toJalaali(parts.y, parts.m, parts.d)
  const first = toGregorian(jy, jm, 1)
  const next = jm === 12 ? toGregorian(jy + 1, 1, 1) : toGregorian(jy, jm + 1, 1)
  const nextIso = gregorianIso(next.gy, next.gm, next.gd)
  const endUtc = Date.parse(`${nextIso}T12:00:00Z`) - 86_400_000
  const end = new Date(endUtc)
  const lastIso = gregorianIso(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate())
  const today = isoDate.trim().slice(0, 10)

  return {
    snapshotMonth: gregorianIso(first.gy, first.gm, first.gd),
    jalaliMonth: `${jy}-${pad2(jm)}-01`,
    jy,
    jm,
    isLastDay: today === lastIso && jd >= 1,
  }
}

export function todayIso(now = new Date()): string {
  return todayTehranIso(now.getTime())
}

type TaskRow = {
  id: string
  project_id: string
  physical_percent_complete: number | null
  percent_complete: number | null
}

function cumulativePercent(row: TaskRow): number {
  const physical = row.physical_percent_complete
  const pct =
    physical != null && Number.isFinite(Number(physical))
      ? Number(physical)
      : row.percent_complete != null && Number.isFinite(Number(row.percent_complete))
        ? Number(row.percent_complete)
        : 0
  return Math.min(100, Math.max(0, Math.round(pct * 100) / 100))
}

export type CaptureProgressSnapshotsResult = {
  skipped: boolean
  reason?: string
  upserted: number
  snapshotMonth: string | null
  jalaliMonth: string | null
  isMonthEnd: boolean
}

/**
 * Upsert one cumulative physical-% row per activity for the Jalali month of `asOf`.
 * Without `force`, runs only on the last day of that Jalali month.
 */
export async function captureProgressSnapshots(
  supabase: SupabaseClient,
  options?: { projectId?: string; force?: boolean; asOf?: string }
): Promise<CaptureProgressSnapshotsResult> {
  const asOf = options?.asOf ?? todayIso()
  const month = jalaliSnapshotMonth(asOf)
  if (!month) {
    return {
      skipped: true,
      reason: 'تاریخ نامعتبر',
      upserted: 0,
      snapshotMonth: null,
      jalaliMonth: null,
      isMonthEnd: false,
    }
  }

  if (!options?.force && !month.isLastDay) {
    return {
      skipped: true,
      reason: 'فقط آخرین روز ماه شمسی (یا force برای شروع از امروز)',
      upserted: 0,
      snapshotMonth: month.snapshotMonth,
      jalaliMonth: month.jalaliMonth,
      isMonthEnd: false,
    }
  }

  const pageSize = 500
  let from = 0
  let upserted = 0
  const projectIds = new Set<string>()

  for (;;) {
    let query = supabase
      .from('project_tasks')
      .select('id, project_id, physical_percent_complete, percent_complete')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (options?.projectId) query = query.eq('project_id', options.projectId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as TaskRow[]
    if (rows.length === 0) break

    const payload = rows.map((row) => ({
      project_id: row.project_id,
      activity_id: row.id,
      snapshot_month: month.snapshotMonth,
      jalali_month: month.jalaliMonth,
      cumulative_percent: cumulativePercent(row),
      captured_at: new Date().toISOString(),
    }))

    const { error: upsertError } = await supabase
      .from('progress_snapshots')
      .upsert(payload, { onConflict: 'activity_id,snapshot_month' })

    if (upsertError) throw new Error(upsertError.message)
    upserted += payload.length
    for (const row of rows) projectIds.add(row.project_id)
    if (rows.length < pageSize) break
    from += pageSize
  }

  if (upserted > 0) {
    const { persistEarnedWeights } = await import('@/features/schedule/lib/persist-earned-weights')
    for (const id of projectIds) {
      try {
        await persistEarnedWeights(supabase, id)
      } catch {
        /* earned / monthly_project_progress optional until migrations 95 and 96 */
      }
    }
  }

  return {
    skipped: false,
    upserted,
    snapshotMonth: month.snapshotMonth,
    jalaliMonth: month.jalaliMonth,
    isMonthEnd: month.isLastDay,
  }
}
