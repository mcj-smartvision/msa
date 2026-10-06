import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getEmailRuntimeStatus } from '@/shared/lib/email/send'
import { requireUser } from '@/features/site-ops/lib/auth'
import { attendanceErrorResponse } from '@/features/attendance/lib/service'

export async function GET() {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    return NextResponse.json({ email: getEmailRuntimeStatus() })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
