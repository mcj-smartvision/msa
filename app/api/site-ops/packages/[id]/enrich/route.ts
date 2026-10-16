/**
 * @file app/api/site-ops/packages/[id]/enrich/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/site-ops/lib/service, features/site-ops/lib/http
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { enrichOperationalPackage } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const pkg = await enrichOperationalPackage(supabase, params.id, {
      category: body.category,
      locationText: body.locationText ?? body.location_text,
      plannedQty:
        body.plannedQty != null || body.planned_qty != null
          ? Number(body.plannedQty ?? body.planned_qty)
          : null,
      uomText: body.uomText ?? body.uom_text,
      crewText: body.crewText ?? body.crew_text,
      opsStatus: body.opsStatus ?? body.ops_status,
    })
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
