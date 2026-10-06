import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { importCreRun } from '@/features/site-ops/lib/service'
import { siteOpsErrorResponse } from '@/features/site-ops/lib/http'

const ALLOWED = new Set(['cre-control-ready.json', 'cre-not-control-ready.json'])

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const fixture = String(body.fixture ?? '')
    if (!projectId || !ALLOWED.has(fixture)) {
      return NextResponse.json({ error: 'Invalid projectId or fixture', code: 'VALIDATION' }, { status: 400 })
    }
    const path = join(process.cwd(), 'data', 'site-ops', 'fixtures', fixture)
    const json = JSON.parse(await readFile(path, 'utf8'))
    const run = await importCreRun(supabase, { projectId, json })
    return NextResponse.json({ run })
  } catch (error) {
    return siteOpsErrorResponse(error)
  }
}
