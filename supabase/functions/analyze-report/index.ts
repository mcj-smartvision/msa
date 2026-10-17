/**
 * Supabase Edge Function — Liparta 12-section daily site report from Persian transcript.
 * Deploy: supabase functions deploy analyze-report
 * Prefers OPENAI_API_KEY secret. Mirrors app/api/supervisor/analyze-site-report.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `You are Liparta AI Construction Intelligence. Extract LipartaDailyReportData JSON from Persian site transcripts.
Never invent quantities — use null + requires_completion true. Weather: morning/noon/evening + lost_hours.
Equipment: operating_hours, idle_hours, breakdown_hours+cause, operator_name.
Materials: received/consumed/shortages. Visits disclaimer exact:
"ثبت گزارش سرپرست کارگاه - فاقد اثر دستور رسمی کارفرما"
Return ONLY JSON object.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const text = String(body.text ?? '').trim()
    if (!text) {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const key = Deno.env.get('OPENAI_API_KEY')
    if (!key) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY missing', patch: {} }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const existing = body.existing ?? {}
    const activities = Array.isArray(body.activities) ? body.activities : []
    const activityContext = activities
      .map((a: { id?: string; wbs?: string; name?: string }) => `- ${a.wbs ?? ''} ${a.name} (${a.id})`)
      .join('\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Activities:\n${activityContext || '(none)'}\n\nExisting:\n${JSON.stringify(existing)}\n\nTranscript:\n${text}`,
          },
        ],
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'openai failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const patch = JSON.parse(String(data.choices?.[0]?.message?.content ?? '{}'))
    return new Response(JSON.stringify({ patch, ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
