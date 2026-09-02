import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isQcActivityType, qcActivityAiGuide, QC_ACTIVITY_TYPES } from '@/lib/qc-engine/activity-types'
import {
  formatSpeechSummary,
  mergeParsedSpeech,
  parseRequestSpeech,
  consolidateInspectionItems,
  type ParsedQcRequestSpeech,
  type QcSpeechItem,
} from '@/lib/qc-engine/parse-request-speech'

const ACTIVITY_UNION = QC_ACTIVITY_TYPES.map((key) => `"${key}"`).join(' | ')

const SYSTEM_PROMPT = `You are a QC assistant for a Persian construction site.
The input is a speech-to-text transcript. It may contain wrong words, filler, and ASR mistakes.

1) Correct construction terms (اتصالات، تیر، ستون، طبقه، آرماتوربندی، قالب‌بندی، بتن‌ریزی، جوشکاری، نما، نازک‌کاری، عایق‌بندی، بادبندی).
2) Delete greetings, filler, and extra words.
3) Classify into inspection item(s). Default to ONE item when the speaker describes a single inspection request.
4) Choose activityType from the spoken trade. Examples: نما → facade, نازک‌کاری → finishing, عایق‌بندی → insulation, بازرسی جوش → welding, بادبندی → bracing.
5) Do NOT copy the raw transcript into topic.

activityType MUST be one of:
${qcActivityAiGuide()}

Return ONLY JSON:
{
  "items": [
    {
      "topic": string | null,
      "floor": string | null,
      "activityType": ${ACTIVITY_UNION} | null,
      "elementType": string | null,
      "discipline": string | null,
      "code": string | null,
      "gridX": string | null,
      "gridY": string | null,
      "gridFrom": string | null,
      "gridTo": string | null
    }
  ]
}

Rules — single vs multiple items (IMPORTANT):
- ONE spoken request → ONE item, even if a future activity is mentioned only as deadline/context.
  Example: "بازرسی آرماتور سقف طبقه سوم قبل از بتن‌ریزی؛ بتن‌ریزی در تاریخ ۱۷ شهریور" → ONE item only (activityType: rebar, topic about rebar inspection before pour). Do NOT add a second item for بتن‌ریزی.
- Split into multiple items ONLY when the speaker clearly asks for separate inspections:
  • numbered list (۱) ... ۲) ...)
  • explicit separators: همچنین، مورد بعدی، درخواست دیگر
  • genuinely different work at different floors WITHOUT a range (e.g. آرماتور طبقه سوم و قالب‌بندی طبقه پنجم)
- "طبقه سوم و چهارم" with the SAME subject → one item per floor (two items), not one merged item.
- Never merge several floors into one object when floors are explicitly listed as separate.
- topic = the spoken inspection subject, short Persian. Example: "بازرسی آرماتور سقف قبل از بتن‌ریزی". Do NOT put only the trade name in topic if a more specific subject was spoken.
- floor = Persian floor name: همکف، اول، دوم، سوم، چهارم، بام. Prefer "سوم" not "3".
- elementType = ستون or تیر or دیوار or سقف if mentioned
- discipline = سازه or معماری or برق or مکانیک if mentioned
- null if unknown. Do not invent.`

type SpeechApiJson = Partial<ParsedQcRequestSpeech> & { items?: Partial<QcSpeechItem>[] }

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { text?: string }
  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'متن خالی است.' }, { status: 400 })

  const local = parseRequestSpeech(text)
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return NextResponse.json(local)

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
          { role: 'user', content: text },
        ],
      }),
    })
    const data = (await response.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[]
    }
    if (!response.ok) return NextResponse.json(local)
    const raw = JSON.parse(String(data.choices?.[0]?.message?.content ?? '{}')) as SpeechApiJson
    const items = Array.isArray(raw.items)
      ? raw.items.map((item) => ({
          ...item,
          activityType: item.activityType && isQcActivityType(item.activityType) ? item.activityType : null,
        }))
      : undefined
    const activityType = raw.activityType && isQcActivityType(raw.activityType) ? raw.activityType : null
    const merged = mergeParsedSpeech(local, { ...raw, activityType, items, transcript: text })
    merged.items = consolidateInspectionItems(merged.items, text)
    merged.summary = formatSpeechSummary(merged)
    return NextResponse.json(merged)
  } catch {
    return NextResponse.json(local)
  }
}
