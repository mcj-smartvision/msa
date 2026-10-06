import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { importMspScheduleToProject } from '@/features/schedule/lib/msp-import'

/**
 * POST /api/schedule/import-msp
 * multipart/form-data: project_id, file (MSP XML), dry_run?=1, confirm?=1
 *
 * dry_run=1 → parse + validate + report only (no DB wipe)
 * otherwise → commit import (blocked if cycle detected)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isSystemAdmin(supabase, user.id)
    const formData = await request.formData()
    const projectId = String(formData.get('project_id') ?? '')
    const file = formData.get('file')
    const dryRun =
      String(formData.get('dry_run') ?? '') === '1' ||
      String(formData.get('dry_run') ?? '').toLowerCase() === 'true'
    const confirm =
      String(formData.get('confirm') ?? '') === '1' ||
      String(formData.get('confirm') ?? '').toLowerCase() === 'true'

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'MSP XML file is required' }, { status: 400 })
    }

    if (!admin) {
      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const xmlContent = await file.text()

    // Default to dry-run preview unless confirm=1 (two-step import UX)
    const shouldDryRun = dryRun || !confirm

    const result = await importMspScheduleToProject(
      supabase,
      projectId,
      file.name,
      xmlContent,
      user.id,
      { dryRun: shouldDryRun }
    )

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MSP import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
