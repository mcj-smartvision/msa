import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { updatePaymentFlag } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'
import type { PaymentFlag } from '@/features/site-ops/domain'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const flag = String(body.flag ?? body.payment_flag) as PaymentFlag
    const pkg = await updatePaymentFlag(supabase, params.id, {
      flag,
      reason: body.reason ?? body.payment_flag_reason,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
