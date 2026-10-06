import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { setPackageStatus } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'
import type { PackageStatus } from '@/features/site-ops/domain'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const status = String(body.status ?? body.ops_status) as PackageStatus
    const pkg = await setPackageStatus(supabase, params.id, status)
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
