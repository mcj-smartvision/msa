import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { FINANCIAL_COST_TYPES } from '@/features/finance/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are extracting data from a construction project expense invoice / receipt / bill photo.
Return ONLY a valid JSON object (no markdown) with these keys:
- invoiceNo: string or null (invoice / bill number)
- documentNo: string or null (document number if different)
- supplierName: string or null (vendor / contractor / seller name)
- documentDate: string or null (invoice date as YYYY-MM-DD Gregorian; convert from Jalali if needed)
- amount: number or null (TOTAL in Iranian Rial — plain number, no commas)
- description: string or null (short summary of what was purchased)
- costType: one of "materials","labor","equipment","subcontractor","overhead" (best guess)
- items: array of { description: string, quantity: number, unit: string|null, unitPrice: number|null, amount: number|null }
  (unitPrice and amount must also be in Iranian Rial)

CURRENCY RULE (critical for Iranian invoices):
- If the invoice shows تومان / Toman (common on «فاکتور فروش»), convert every money field to Rial by multiplying by 10.
- If the invoice already shows ریال / Rial, keep the numbers as-is.
- Columns like فی / مبلغ کل on Persian sales invoices are usually Toman unless labeled ریال.
- quantity × unitPrice must equal line amount (after conversion). Sum of line amounts should match total amount.

If a field is unreadable, use null. Prefer Persian text for names/descriptions when the document is Persian.
Example (invoice showed 200,000 تومان unit price → store as Rial):
{"invoiceNo":"4524","documentNo":null,"supplierName":"فروشگاه مصالح","documentDate":"2026-07-09","amount":20000000,"description":"خرید سیمان","costType":"materials","items":[{"description":"سیمان","quantity":10,"unit":"کیسه","unitPrice":2000000,"amount":20000000}]}`

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/,/g, '').replace(/٬/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalize(parsed: Record<string, unknown>) {
  const costTypeRaw = String(parsed.costType ?? '').toLowerCase().trim()
  const costType = (FINANCIAL_COST_TYPES as readonly string[]).includes(costTypeRaw)
    ? costTypeRaw
    : null

  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : []
  const items = itemsRaw
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        description: String(r.description ?? r.name ?? '').trim(),
        quantity: toNum(r.quantity) ?? 1,
        unit: r.unit != null ? String(r.unit).trim() || null : null,
        unitPrice: toNum(r.unitPrice ?? r.unit_price),
        amount: toNum(r.amount),
      }
    })
    .filter((row) => row.description.length > 0)

  return {
    invoiceNo: parsed.invoiceNo != null ? String(parsed.invoiceNo).trim() || null : null,
    documentNo: parsed.documentNo != null ? String(parsed.documentNo).trim() || null : null,
    supplierName: parsed.supplierName != null ? String(parsed.supplierName).trim() || null : null,
    documentDate: parsed.documentDate != null ? String(parsed.documentDate).trim() || null : null,
    amount: toNum(parsed.amount),
    description: parsed.description != null ? String(parsed.description).trim() || null : null,
    costType,
    items,
  }
}

export async function POST(request: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json(
      { error: 'کلید OpenAI در .env.local تنظیم نشده است (OPENAI_API_KEY).' },
      { status: 500 }
    )
  }

  // Require authenticated session
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let imageBase64: string | undefined
  try {
    const body = await request.json()
    imageBase64 = body.imageBase64
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 })
  }

  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract expense / invoice header fields and line items from this image.',
              },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2500,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const aiData = await response.json()
    if (!response.ok) {
      return NextResponse.json(
        { error: aiData.error?.message || 'OpenAI API error' },
        { status: 502 }
      )
    }

    const raw = aiData.choices?.[0]?.message?.content
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    return NextResponse.json(normalize(parsed))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'تحلیل بیش از حد طول کشید. دوباره تلاش کنید.' },
        { status: 504 }
      )
    }
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
