import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatLoginDisplay } from '@/lib/auth/login-identifier'

const FIELDS = new Set(['username', 'full_name', 'phone', 'contact_email', 'other'])

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    field_key?: string
    requested_value?: string
    note?: string
  }

  const fieldKey = String(body.field_key ?? '').trim()
  const requestedValue = String(body.requested_value ?? '').trim()
  const note = String(body.note ?? '').trim()

  if (!FIELDS.has(fieldKey) || !requestedValue) {
    return NextResponse.json({ error: 'field_key and requested_value are required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, contact_email, email')
    .eq('id', user.id)
    .maybeSingle()

  const currentByField: Record<string, string> = {
    username: formatLoginDisplay(profile?.email || user.email || ''),
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    contact_email: profile?.contact_email ?? '',
    other: '',
  }

  const { error } = await supabase.from('account_change_requests').insert({
    user_id: user.id,
    field_key: fieldKey,
    current_value: currentByField[fieldKey] || null,
    requested_value: requestedValue,
    note: note || null,
    status: 'pending',
  })

  if (error) {
    if (error.code === '42P01' || error.code === '42703') {
      return NextResponse.json(
        { error: 'جدول درخواست تغییر هنوز در دیتابیس راه‌اندازی نشده است.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
