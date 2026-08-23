import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST multipart: audio file → Persian/English transcript via OpenAI Whisper */
export async function POST(request: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json(
      { error: 'کلید OpenAI تنظیم نشده است (OPENAI_API_KEY).' },
      { status: 500 }
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const file = form.get('audio')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایل صوتی ارسال نشده است.' }, { status: 400 })
    }

    const language = String(form.get('language') ?? 'fa')
    const body = new FormData()
    body.append('file', file, file.name || 'voice.webm')
    body.append('model', 'whisper-1')
    if (language === 'fa' || language === 'en') {
      body.append('language', language === 'fa' ? 'fa' : 'en')
    }
    if (language === 'fa') {
      body.append(
        'prompt',
        'بازرسی کنترل کیفیت سازه. موضوع بررسی اتصالات تیر به ستون. طبقه سوم. آرماتوربندی، قالب‌بندی، بتن‌ریزی، جوشکاری، ستون، تیر، محور.'
      )
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body,
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'تبدیل صدا به متن ناموفق بود.' },
        { status: 502 }
      )
    }

    const text = String(data.text ?? '').trim()
    if (!text) {
      return NextResponse.json({ error: 'متنی از صدا استخراج نشد.' }, { status: 422 })
    }

    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
