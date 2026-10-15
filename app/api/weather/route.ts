import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requireUser } from '@/features/site-ops/lib/auth'
import { loadWeather } from '@/features/weather/lib/fetch-weather'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

export const dynamic = 'force-dynamic'

/** GET /api/weather?projectId= — live OpenWeatherMap current + 7 past / 7 future days. */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    const projectId = request.nextUrl.searchParams.get('projectId')
    const payload = await loadWeather(supabase, projectId && projectId !== 'all' ? projectId : null)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
