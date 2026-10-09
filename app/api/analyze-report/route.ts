import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an expert construction site safety and progress inspector analyzing photos for field supervisors in Iran.

Analyze the construction site photo in detail. Respond ONLY with valid JSON (no markdown) using this exact structure:

{
  "activity_type": "short English label e.g. scaffolding, masonry, rebar, concreting",
  "activity_description_fa": "توضیح فارسی: دقیقاً چه کاری در حال انجام است؟",
  "work_being_performed_fa": "شرح دقیق عملیات جاری به فارسی (2-4 جمله)",
  "workforce_count": number,
  "worker_roles_json": [{"role": "string", "count": number, "activity_fa": "چه کاری می‌کنند"}],
  "equipment_json": [{"name": "string", "visible": boolean, "usage_fa": "کاربرد"}],
  "safety_equipment": {
    "helmets": "yes|no|partial|unknown",
    "harnesses": "yes|no|partial|unknown",
    "high_visibility_vests": "yes|no|partial|unknown",
    "gloves": "yes|no|partial|unknown",
    "safety_boots": "yes|no|partial|unknown",
    "fall_protection": "yes|no|partial|unknown",
    "missing_or_concerns_fa": ["فهرست موارد ایمنی missing یا نگران‌کننده"],
    "overall_safety_rating": "good|moderate|poor|unknown",
    "notes_fa": "توضیح فارسی وضعیت تجهیزات ایمنی"
  },
  "time_of_day": "day|night|dusk|dawn|unknown",
  "time_of_day_fa": "روز|شب|غروب|صبح زود|نامشخص",
  "lighting": {
    "adequate": boolean,
    "level": "excellent|good|fair|poor|unknown",
    "artificial_light_visible": boolean,
    "notes_fa": "آیا نور برای کار کافی است؟ توضیح فارسی"
  },
  "weather_air": {
    "weather_apparent": "clear|cloudy|rainy|foggy|dusty|snowy|unknown",
    "weather_fa": "وضعیت آب و هوا به فارسی",
    "visibility": "excellent|good|fair|poor|unknown",
    "wind_signs_fa": "نشانه‌های باد یا توضیح",
    "air_quality_apparent": "good|moderate|poor|unknown",
    "air_quality_fa": "وضعیت هوا/گردوغبار/دود به فارسی",
    "notes_fa": "توضیح کلی شرایط جوی"
  },
  "risks_observed_fa": ["خطرات یا نکات HSE مشاهده‌شده"],
  "supervisor_summary_fa": "خلاصه 3-5 جمله‌ای برای سرپرست کارگاه به فارسی",
  "confidence_score": number between 0 and 1
}

Be specific based on what is visible. If uncertain, say "unknown" or "نامشخص". Write all _fa fields in Persian.`

export async function POST(request: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured in .env.local' }, { status: 500 })
  }

  const { imageUrl } = await request.json()
  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this construction site image with full HSE and operational detail.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2048,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const aiData = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: aiData.error?.message || 'OpenAI API error' }, { status: 502 })
    }

    const raw = aiData.choices?.[0]?.message?.content
    const parsed = JSON.parse(raw)

    const extended = {
      activity_description_fa: parsed.activity_description_fa,
      work_being_performed_fa: parsed.work_being_performed_fa,
      safety_equipment: parsed.safety_equipment,
      time_of_day: parsed.time_of_day,
      time_of_day_fa: parsed.time_of_day_fa,
      lighting: parsed.lighting,
      weather_air: parsed.weather_air,
      risks_observed_fa: parsed.risks_observed_fa ?? [],
      supervisor_summary_fa: parsed.supervisor_summary_fa,
    }

    return NextResponse.json({
      activity_type: parsed.activity_type,
      workforce_count: parsed.workforce_count,
      worker_roles_json: parsed.worker_roles_json ?? [],
      equipment_json: parsed.equipment_json ?? [],
      confidence_score: parsed.confidence_score,
      extended_analysis_json: extended,
      ai_raw_data: { openai: aiData, parsed },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json({ error: 'AI analysis timed out. Please try again.' }, { status: 504 })
    }
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
