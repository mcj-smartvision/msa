import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
mergeParsedDailyReportVoice,
parseDailyReportVoice,
type DailyReportVoiceActivityRef,
type ParsedDailyReportVoice,
} from '@/features/supervisor/lib/parse-daily-report-voice'

const SYSTEM_PROMPT = `You are a construction site daily-report assistant for Persian speech transcripts.
Input is speech-to-text from a site supervisor. Fix ASR mistakes and organize content.

Activities scheduled for today are provided — match spoken progress to them by WBS code or activity name.

Return ONLY JSON:
{
  "summary": string,
  "activities": [
    {
      "activityId": string,
      "wbs": string | null,
      "name": string,
      "percentComplete": number | null,
      "note": string | null
    }
  ],
  "issues": string[],
  "risks": string[],
  "materials": string[],
  "hse": string | null,
  "generalNotes": string | null
}

Rules:
- summary: one short Persian sentence for the day.
- activities: only items from the provided list that the speaker mentioned. percentComplete 0-100 if stated (e.g. "پنجاه درصد", "نیمه کاره" → 50, "تمام شد" → 100).
- issues: problems, delays, blockers (short Persian bullets as strings).
- risks: future delay risks.
- materials: material delivery, shortages, logistics.
- hse: HSE/safety incidents or null.
- generalNotes: other field notes not covered above.
- Do not invent activities not in the list.
- Use formal clear Persian.`

type ApiJson = Partial<ParsedDailyReportVoice> & {
  activities?: Array<{
    activityId?: string
    wbs?: string | null
    name?: string
    percentComplete?: number | null
    note?: string | null
  }>
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    text?: string
    activities?: DailyReportVoiceActivityRef[]
  }

  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'متن خالی است.' }, { status: 400 })

  const activityRefs = Array.isArray(body.activities)
    ? body.activities.filter((a) => a?.id && a?.name)
    : []

  const local = parseDailyReportVoice(text, activityRefs)
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return NextResponse.json(local)

  const activityContext = activityRefs
    .map((a) => `- id=${a.id} wbs=${a.wbs ?? '—'} name=${a.name}`)
    .join('\n')

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Today's activities:\n${activityContext || '(none)'}\n\nTranscript:\n${text}`,
          },
        ],
      }),
    })

    const data = (await response.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[]
    }
    if (!response.ok) return NextResponse.json(local)

    const raw = JSON.parse(String(data.choices?.[0]?.message?.content ?? '{}')) as ApiJson
    const merged = mergeParsedDailyReportVoice(local, {
      ...raw,
      transcript: text,
      activities: raw.activities?.filter((a) => a.activityId),
    })
    return NextResponse.json(merged)
  } catch {
    return NextResponse.json(local)
  }
}
