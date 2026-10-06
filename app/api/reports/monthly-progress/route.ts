import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * GET /api/reports/monthly-progress?projectId=
 * Reads precomputed monthly_project_progress only. Does not calculate.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    if (!projectId) {
      return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)

    const full = await supabase
      .from('monthly_project_progress')
      .select(
        'month, planned_weight, earned_weight, planned_cumulative, earned_cumulative, monthly_overhead_cost, planned_overhead, actual_overhead'
      )
      .eq('project_id', projectId)
      .order('month', { ascending: true })

    const fallback =
      full.error && /column .* does not exist|schema cache/i.test(full.error.message)
        ? await supabase
            .from('monthly_project_progress')
            .select('month, planned_weight, earned_weight, planned_cumulative, earned_cumulative')
            .eq('project_id', projectId)
            .order('month', { ascending: true })
        : null

    const data = fallback ? fallback.data : full.data
    const error = fallback ? fallback.error : full.error
    if (error) throw new Error(error.message)

    const rows = (data ?? []).map((row) => {
      const record = row as {
        month: string
        planned_weight: unknown
        earned_weight: unknown
        planned_cumulative: unknown
        earned_cumulative: unknown
        monthly_overhead_cost?: unknown
        planned_overhead?: unknown
        actual_overhead?: unknown
      }
      const plannedOverhead = num(record.planned_overhead)
      const actualOverhead = num(record.actual_overhead)
      return {
        month: String(record.month).slice(0, 10),
        plannedWeight: num(record.planned_weight) ?? 0,
        earnedWeight: num(record.earned_weight),
        plannedCumulative: num(record.planned_cumulative) ?? 0,
        earnedCumulative: num(record.earned_cumulative),
        monthlyOverheadCost: num(record.monthly_overhead_cost),
        plannedOverhead,
        actualOverhead,
        overheadVariance:
          plannedOverhead == null || actualOverhead == null
            ? null
            : Math.round((actualOverhead - plannedOverhead) * 10000) / 10000,
      }
    })

    return NextResponse.json({ projectId, rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const missing = /monthly_project_progress|schema cache|does not exist/i.test(message)
    if (missing) {
      return NextResponse.json(
        {
          error:
            'جدول monthly_project_progress هنوز ساخته نشده. فایل database/96-monthly-project-progress.sql را در Supabase اجرا کنید.',
        },
        { status: 503 }
      )
    }
    return workshopErrorResponse(error)
  }
}
