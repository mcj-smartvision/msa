/**
 * @file app/api/supervisor/analyze-site-report/route.ts
 * @purpose استخراج JSON دوازده‌بخشی از رونوشت صوت سرپرست
 * @safe-to-edit CAREFUL
 * @affects تب گزارش روزانه ساختاریافته
 * @depends-on shared/lib/supabase/server, features/site-report/lib/*
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { SITE_REPORT_ANALYZE_SYSTEM_PROMPT } from '@/features/site-report/lib/analyze-prompt'
import { emptyLipartaDailyReport } from '@/features/site-report/lib/empty-report'
import { coerceSiteReport, mergeLipartaDailyReport } from '@/features/site-report/lib/merge-report'
import { stampRequiresCompletion } from '@/features/site-report/lib/validate-report'
import type { LipartaDailyReportData, SiteReportActivityRef } from '@/features/site-report/lib/types'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    text?: string
    existing?: LipartaDailyReportData | null
    activities?: SiteReportActivityRef[]
    header?: Partial<LipartaDailyReportData['header']>
  }

  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'متن خالی است.' }, { status: 400 })

  const existing =
    body.existing && typeof body.existing === 'object'
      ? coerceSiteReport(body.existing, body.header)
      : emptyLipartaDailyReport(body.header)

  const activityRefs = Array.isArray(body.activities)
    ? body.activities.filter((a) => a?.id && a?.name)
    : []
  const activityContext = activityRefs
    .map((a) => `- id=${a.id} wbs=${a.wbs ?? '—'} name=${a.name}`)
    .join('\n')

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json({
      report: stampRequiresCompletion(existing),
      warning: 'OPENAI_API_KEY تنظیم نشده — دادهٔ قبلی بدون تغییر برگشت.',
    })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SITE_REPORT_ANALYZE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Schedule activities for matching:\n${activityContext || '(none)'}\n\nExisting JSON (do not wipe with nulls conceptually — return a patch):\n${JSON.stringify(existing)}\n\nNew transcript:\n${text}`,
          },
        ],
      }),
    })

    const data = (await response.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[]
      error?: { message?: string }
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'تحلیل OpenAI ناموفق بود', report: existing },
        { status: 502 }
      )
    }

    const raw = JSON.parse(String(data.choices?.[0]?.message?.content ?? '{}')) as Partial<LipartaDailyReportData>
    const merged = stampRequiresCompletion(mergeLipartaDailyReport(existing, raw))
    return NextResponse.json({ report: merged, ok: true })
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'تحلیل ناموفق بود'
    const message =
      /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(raw)
        ? 'اتصال به OpenAI برقرار نشد. اینترنت، VPN یا OPENAI_API_KEY را بررسی کنید.'
        : raw
    return NextResponse.json({ error: message, report: existing }, { status: 500 })
  }
}
