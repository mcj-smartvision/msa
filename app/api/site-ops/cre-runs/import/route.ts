import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { importCreRun } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const projectId = String(body.projectId ?? body.project_id ?? '')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required', code: 'VALIDATION' }, { status: 400 })
    }
    // Avoid treating wrapper keys as CRE payload when nested under export
    const payload =
      body.export != null || body.json != null
        ? (body.export ?? body.json)
        : (() => {
            const { projectId: _p, project_id: _p2, ...rest } = body
            return rest
          })()

    const run = await importCreRun(supabase, { projectId, json: payload })
    return NextResponse.json({ run })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
