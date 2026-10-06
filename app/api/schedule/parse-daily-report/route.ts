import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { parseDailyReportText } from '@/features/schedule/lib/ai-parser'

/**
 * POST /api/schedule/parse-daily-report
 * Body: { daily_report_id?: string, raw_text?: string }
 *
 * Parses supervisor daily report into structured JSON (ai_parsed).
 * OpenAI integration will replace the stub in lib/schedule/ai-parser.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const reportId = body.daily_report_id as string | undefined
    let rawText = body.raw_text as string | undefined

    if (reportId) {
      const { data: report, error } = await supabase
        .from('daily_reports')
        .select('id, raw_text, project_id')
        .eq('id', reportId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

      rawText = report.raw_text
    }

    if (!rawText?.trim()) {
      return NextResponse.json({ error: 'raw_text or daily_report_id is required' }, { status: 400 })
    }

    const aiParsed = await parseDailyReportText(rawText)

    if (reportId) {
      const { error: updateError } = await supabase
        .from('daily_reports')
        .update({ ai_parsed: aiParsed })
        .eq('id', reportId)

      if (updateError) throw new Error(updateError.message)
    }

    return NextResponse.json({ ai_parsed: aiParsed, report_id: reportId ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
