import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { decomposePackage } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const children = (body.children ?? []).map((c: Record<string, unknown>) => ({
      name: String(c.name ?? ''),
      plannedQty: Number(c.plannedQty ?? c.planned_qty),
      uomText: (c.uomText ?? c.uom_text) as string | null,
      locationText: (c.locationText ?? c.location_text) as string | null,
      crewText: (c.crewText ?? c.crew_text) as string | null,
    }))
    const packages = await decomposePackage(supabase, params.id, children)
    return NextResponse.json({ packages })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
