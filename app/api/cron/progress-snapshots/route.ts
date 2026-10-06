import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { captureProgressSnapshots } from '@/features/schedule/lib/progress-snapshots'

/**
 * Nightly job. Writes only on the last Jalali day unless ?force=1.
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const force = request.nextUrl.searchParams.get('force') === '1'
  try {
    const result = await captureProgressSnapshots(createServiceClient(), { force })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'snapshot failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
