import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_FA_PROMPT =
  'متن فارسی محاوره‌ای کارگاه ساختمانی. نقطه‌گذاری درست. کلمه‌هایی مثل عدم رعایت استاندارد، قابل قبول نیست، لطفاً اصلاح کنید، خاموت، قالب‌بندی، جوش، ستون، تیر.'

async function openaiTranscribe(input: {
  apiKey: string
  file: File
  model: string
  language: string
  prompt: string
}) {
  const body = new FormData()
  body.append('file', input.file, input.file.name || 'voice.webm')
  body.append('model', input.model)
  if (input.language === 'fa' || input.language === 'en') {
    body.append('language', input.language === 'fa' ? 'fa' : 'en')
  }
  if (input.prompt.trim()) body.append('prompt', input.prompt.trim())
  return fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body,
  })
}

/** POST multipart: audio file → Persian/English transcript */
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
    const prompt =
      String(form.get('prompt') ?? '').trim() || (language === 'fa' ? DEFAULT_FA_PROMPT : '')

    let response = await openaiTranscribe({
      apiKey: openaiKey,
      file,
      model: 'gpt-4o-transcribe',
      language,
      prompt,
    })
    if (!response.ok) {
      response = await openaiTranscribe({
        apiKey: openaiKey,
        file,
        model: 'whisper-1',
        language,
        prompt,
      })
    }

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
