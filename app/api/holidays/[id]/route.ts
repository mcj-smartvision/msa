/**
 * @file app/api/holidays/[id]/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/auth, features/workshop/lib/service, features/holidays/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requireUser } from '@/features/site-ops/lib/auth'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import { deleteHoliday, parseHolidayInput, updateHoliday } from '@/features/holidays/lib/service'

/** PATCH /api/holidays/:id — `{ isActive }` alone toggles it, otherwise the full holiday replaces it. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    const body = (await request.json()) as Record<string, unknown>
    const onlyToggle = Object.keys(body).length === 1 && typeof body.isActive === 'boolean'
    const input = onlyToggle ? { isActive: body.isActive as boolean } : parseHolidayInput(body)
    return NextResponse.json({ holiday: await updateHoliday(supabase, params.id, input) })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

/** DELETE /api/holidays/:id */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    await requireUser(supabase)
    await deleteHoliday(supabase, params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
