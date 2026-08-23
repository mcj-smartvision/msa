import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  assertProjectMember,
  assertRequestEditable,
  attachMarkedDrawings,
  createInspectionRequest,
  deleteInspectionRequests,
  markRequestOpenedByInspector,
  requireQcEngineUser,
  setRequestStatus,
  updateInspectionRequest,
} from '@/lib/qc-engine/service'
import type { QcRequestStatus } from '@/lib/qc-engine/types'

function isMarkedDrawing(file: File) {
  const name = file.name.toLowerCase()
  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    name.endsWith('.pdf') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.dwg')
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { user, context, canWrite } = await requireQcEngineUser(supabase)
    if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const projectId = String(form.get('projectId') ?? '')
      if (!projectId) return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
      await assertProjectMember(supabase, user.id, projectId, context.isSystemAdmin)
      const sourceDrawingId = String(form.get('sourceDrawingId') ?? '') || null
      const files = form.getAll('file').filter((item): item is File => item instanceof File && item.size > 0)
      const sourceDrawingIds = form.getAll('fileSourceId').map((value) => String(value ?? '').trim() || null)
      const rejected = files.find((file) => !isMarkedDrawing(file))
      if (rejected) {
        return NextResponse.json(
          { error: 'فقط PDF، تصویر یا DWG برای نقشه علامت‌گذاری‌شده پذیرفته می‌شود.' },
          { status: 400 }
        )
      }

      const existingId = String(form.get('requestId') ?? '')
      if (existingId) {
        await assertRequestEditable(existingId)
        await attachMarkedDrawings({
          requestId: existingId,
          projectId,
          uploadedBy: user.id,
          files,
          sourceDrawingId,
          sourceDrawingIds,
        })
        return NextResponse.json({ id: existingId })
      }

      const itemIds = String(form.get('itemIds') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      const id = await createInspectionRequest({
        projectId,
        requestedBy: user.id,
        activityType: String(form.get('activityType') ?? ''),
        itemIds,
        notes: String(form.get('notes') ?? ''),
        floor: String(form.get('floor') ?? ''),
        gridFrom: String(form.get('gridFrom') ?? ''),
        gridTo: String(form.get('gridTo') ?? ''),
        sourceDrawingId,
      })
      try {
        await attachMarkedDrawings({
          requestId: id,
          projectId,
          uploadedBy: user.id,
          files,
          sourceDrawingId,
          sourceDrawingIds,
        })
      } catch (attachError) {
        return NextResponse.json(
          {
            id,
            warning: attachError instanceof Error ? attachError.message : 'فایل پیوست نشد، ولی درخواست ثبت شد.',
          },
          { status: 200 }
        )
      }
      return NextResponse.json({ id })
    }

    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    if (!projectId) return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })
    await assertProjectMember(supabase, user.id, projectId, context.isSystemAdmin)

    if (body.requestId && body.inspectorOpen) {
      if (!context.positionKeys.includes('qa_qc_inspector')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      await markRequestOpenedByInspector(String(body.requestId))
      return NextResponse.json({ ok: true })
    }

    if (body.requestId && body.edit) {
      await updateInspectionRequest({
        requestId: String(body.requestId),
        activityType: body.activityType,
        floor: body.floor,
        gridFrom: body.gridFrom,
        gridTo: body.gridTo,
        sourceDrawingId: body.sourceDrawingId ? String(body.sourceDrawingId) : null,
        itemIds: Array.isArray(body.itemIds) ? body.itemIds.map(String) : undefined,
        notes: body.notes,
      })
      return NextResponse.json({ ok: true })
    }

    if (body.requestId && body.status) {
      await setRequestStatus(String(body.requestId), body.status as QcRequestStatus)
      return NextResponse.json({ ok: true })
    }

    if (body.delete && Array.isArray(body.requestIds)) {
      const result = await deleteInspectionRequests(
        projectId,
        body.requestIds.map((id: unknown) => String(id))
      )
      return NextResponse.json(result)
    }

    const id = await createInspectionRequest({
      projectId,
      requestedBy: user.id,
      activityType: String(body.activityType ?? ''),
      itemIds: Array.isArray(body.itemIds) ? body.itemIds.map(String) : [],
      notes: body.notes,
      floor: body.floor,
      gridFrom: body.gridFrom,
      gridTo: body.gridTo,
      sourceDrawingId: body.sourceDrawingId ? String(body.sourceDrawingId) : null,
    })
    return NextResponse.json({ id })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ثبت درخواست ناموفق بود' },
      { status }
    )
  }
}
