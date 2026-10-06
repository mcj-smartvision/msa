import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { buildReportForDate } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
    const date = request.nextUrl.searchParams.get('date') ?? ''
    if (!projectId || !date) {
      return NextResponse.json(
        { error: 'projectId and date are required', code: 'VALIDATION' },
        { status: 400 }
      )
    }
    const report = await buildReportForDate(supabase, projectId, date)
    const format = request.nextUrl.searchParams.get('format')
    if (format === 'csv') {
      const header = [
        'task_uid',
        'task_name',
        'planned_qty',
        'actual_qty',
        'qty_variance',
        'planned_pd',
        'actual_pd',
        'pd_variance',
        'productivity',
        'status',
      ].join(',')
      const rows = report.lines.map((l) =>
        [
          l.taskUid,
          JSON.stringify(l.taskName),
          l.plannedQuantity,
          l.actualQuantity,
          l.qty_variance,
          l.plannedPersonDays,
          l.actualPersonDays,
          l.pd_variance,
          l.productivity ?? '',
          l.actualStatus ?? '',
        ].join(',')
      )
      return new NextResponse([header, ...rows].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="daily-report-${date}.csv"`,
        },
      })
    }
    return NextResponse.json({ report })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
