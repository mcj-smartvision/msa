import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { loadChecklistForRequest, requireQcEngineUser } from '@/features/qc/engine/service'

export async function GET(request: NextRequest) {
  try {
    await requireQcEngineUser(createClient())
    const requestId = request.nextUrl.searchParams.get('requestId') ?? ''
    const itemId = request.nextUrl.searchParams.get('itemId') ?? ''
    if (!requestId || !itemId) {
      return NextResponse.json({ error: 'requestId و itemId لازم است' }, { status: 400 })
    }
    const data = await loadChecklistForRequest(requestId, itemId)
    return NextResponse.json(data)
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'بارگذاری چک‌لیست ناموفق بود' },
      { status }
    )
  }
}
