/**
 * @file app/api/workshop/packages/[id]/submit/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { submitPackageForApproval, workshopErrorResponse } from '@/features/workshop/lib/service'

type Ctx = { params: { id: string } }

export async function POST(_request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const pkg = await submitPackageForApproval(supabase, params.id)
    return NextResponse.json({ package: pkg })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
