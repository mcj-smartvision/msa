import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
commentOnPackage,
listPackageComments,
workshopErrorResponse,
} from '@/features/workshop/lib/service'

type Ctx = { params: { id: string } }

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const result = await listPackageComments(supabase, params.id)
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const result = await commentOnPackage(supabase, params.id, String(body.comment ?? body.body ?? ''))
    return NextResponse.json(result)
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
