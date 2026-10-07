import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requireUser } from '@/features/site-ops/lib/auth'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import { createHoliday, listHolidays, parseHolidayInput } from '@/features/holidays/lib/service'

/** GET /api/holidays — every holiday, and whether the caller may edit them. */
export async function GET() {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    return NextResponse.json(await listHolidays(supabase), { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/** POST /api/holidays — registers a holiday (admin / project manager). */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    const holiday = await createHoliday(supabase, parseHolidayInput(await request.json()))
    return NextResponse.json({ holiday })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
