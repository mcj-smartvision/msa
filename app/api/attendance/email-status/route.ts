/**
 * @file app/api/attendance/email-status/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/email/send, features/site-ops/lib/auth, features/attendance/lib/service
 */

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
