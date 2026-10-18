/**
 * @file app/api/weather/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/weather/lib/fetch-weather, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requireUser } from '@/features/site-ops/lib/auth'
import { normalizeLocale } from '@/features/project-init/lib/i18n/utils'
import { loadWeather } from '@/features/weather/lib/fetch-weather'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import { LOCALE_COOKIE } from '@/shared/lib/i18n/locale-cookie'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/weather?projectId= — live OpenWeatherMap current + 7 past / 7 future days. */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    const projectId = request.nextUrl.searchParams.get('projectId')
    const locale = normalizeLocale(
      request.nextUrl.searchParams.get('locale') ?? request.cookies.get(LOCALE_COOKIE)?.value
    )
    const payload = await loadWeather(
      supabase,
      projectId && projectId !== 'all' ? projectId : null,
      locale
    )
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
