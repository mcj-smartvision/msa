import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { isQcActivityType, QC_CHECKLIST_BY_ACTIVITY } from '@/lib/qc-engine/activity-types'
import type {
  QcChecklistRow,
  QcEngineDashboard,
  QcEngineNcr,
  QcInspectableItem,
  QcInspectionRequest,
  QcOfficeDrawing,
  QcRequestDrawing,
  QcRequestStatus,
  QcResultPhoto,
  QcVerdict,
} from '@/lib/qc-engine/types'
import { DRAWINGS_BUCKET, ensureDrawingsBucket, listProjectDrawings } from '@/lib/technical-office/drawings'

const PHOTO_BUCKET = 'qc-engine-photos'
const MARKED_PREFIX = 'qc-marked'

function engine(client: SupabaseClient) {
  return client.schema('qc_engine')
}

function mapItem(row: Record<string, unknown>): QcInspectableItem {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    code: String(row.code),
    name: row.name ? String(row.name) : null,
    disciplineKey: String(row.discipline_key),
    topicKey: String(row.topic_key),
    elementTypeKey: String(row.element_type_key),
    floor: row.floor ? String(row.floor) : null,
    gridRef: row.grid_ref ? String(row.grid_ref) : null,
    gridX: row.grid_x ? String(row.grid_x) : null,
    gridY: row.grid_y ? String(row.grid_y) : null,
  }
}

export async function requireQcEngineUser(userClient: SupabaseClient) {
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user?.email) {
    const error = new Error('Unauthorized')
    ;(error as Error & { status: number }).status = 401
    throw error
  }
  const context = await fetchDashboardUserContext(userClient, user.id, user.email)
  const canWrite =
    context.isSystemAdmin ||
    context.positionKeys.includes('qa_qc_inspector') ||
    context.positionKeys.includes('project_manager') ||
    context.positionKeys.includes('site_supervisor') ||
    context.positionKeys.includes('technical_office')
  const canRead = canWrite || context.positionKeys.includes('hse_officer')
  if (!canRead) {
    const error = new Error('Forbidden')
    ;(error as Error & { status: number }).status = 403
    throw error
  }
  return { user, context, canWrite }
}

export async function assertProjectMember(
  userClient: SupabaseClient,
  userId: string,
  projectId: string,
  isAdmin: boolean
) {
  if (isAdmin) return
  const { data: member } = await userClient
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (!member) {
    const error = new Error('Forbidden')
    ;(error as Error & { status: number }).status = 403
    throw error
  }
}

async function ensurePhotoBucket(storage: SupabaseClient) {
  const { data } = await storage.storage.listBuckets()
  if ((data ?? []).some((bucket) => bucket.name === PHOTO_BUCKET)) return
  await storage.storage.createBucket(PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })
}

export async function loadQcEngineDashboard(projectId: string): Promise<QcEngineDashboard> {
  const db = engine(createServiceClient())
  const [{ data: itemRows, error: itemError }, { data: requestRows, error: requestError }] = await Promise.all([
    db.from('inspectable_item').select('*').eq('project_id', projectId).eq('is_active', true).order('code'),
    db.from('inspection_request').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
  ])
  if (itemError) throw new Error(itemError.message)
  if (requestError) throw new Error(requestError.message)

  const items = (itemRows ?? []).map((row) => mapItem(row as Record<string, unknown>))
  const requestIds = (requestRows ?? []).map((row) => String(row.id))
  let links: { request_id: string; inspectable_item_id: string }[] = []
  if (requestIds.length) {
    const { data, error } = await db
      .from('inspection_request_item')
      .select('request_id, inspectable_item_id')
      .in('request_id', requestIds)
    links = error ? [] : ((data ?? []) as { request_id: string; inspectable_item_id: string }[])
  }

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const requesterIds = [
    ...new Set((requestRows ?? []).map((row) => row.requested_by).filter(Boolean).map((id) => String(id))),
  ]
  const requesterNames = new Map<string, string>()
  if (requesterIds.length) {
    const publicDb = createServiceClient()
    const { data: profiles } = await publicDb.from('profiles').select('id, full_name').in('id', requesterIds)
    for (const profile of profiles ?? []) {
      requesterNames.set(String(profile.id), String(profile.full_name || ''))
    }
  }

  let drawingRows: Record<string, unknown>[] = []
  if (requestIds.length) {
    await recoverMarkedDrawingsFromStorage(projectId, requestIds)
    const { data, error } = await db
      .from('inspection_request_drawing')
      .select('id, request_id, source_drawing_id, file_name, content_type, storage_path')
      .in('request_id', requestIds)
    drawingRows = error ? [] : ((data ?? []) as Record<string, unknown>[])
  }

  const storage = createServiceClient()
  const signedDrawings = new Map<string, string>()
  for (const drawing of drawingRows) {
    const path = drawing.storage_path ? String(drawing.storage_path) : ''
    if (!path) continue
    const { data: signed } = await storage.storage.from(DRAWINGS_BUCKET).createSignedUrl(path, 60 * 30)
    if (signed?.signedUrl) signedDrawings.set(String(drawing.id), signed.signedUrl)
  }

  let officeDrawings: QcOfficeDrawing[] = []
  try {
    officeDrawings = (await listProjectDrawings(projectId)).map((drawing) => ({
      id: drawing.id,
      title: drawing.title,
      fileName: drawing.fileName,
      format: drawing.format,
    }))
  } catch {
    officeDrawings = []
  }
  const officeById = new Map(officeDrawings.map((drawing) => [drawing.id, drawing.title]))

  const requests: QcInspectionRequest[] = (requestRows ?? []).map((row) => {
    const itemIds = links
      .filter((link) => String(link.request_id) === String(row.id))
      .map((link) => String(link.inspectable_item_id))
    const sourceDrawingId = row.source_drawing_id
      ? String(row.source_drawing_id)
      : drawingRows.find((drawing) => String(drawing.request_id) === String(row.id))?.source_drawing_id
        ? String(drawingRows.find((drawing) => String(drawing.request_id) === String(row.id))?.source_drawing_id)
        : null
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      activityType: String(row.activity_type),
      requestedAt: String(row.requested_at),
      status: row.status as QcRequestStatus,
      notes: row.notes ? String(row.notes) : null,
      floor: row.floor ? String(row.floor) : null,
      gridFrom: row.grid_from ? String(row.grid_from) : null,
      gridTo: row.grid_to ? String(row.grid_to) : null,
      sourceDrawingId,
      sourceDrawingTitle: sourceDrawingId ? officeById.get(sourceDrawingId) ?? null : null,
      requestedByName: requesterNames.get(String(row.requested_by)) || null,
      itemIds,
      itemCodes: itemIds.map((id) => itemsById.get(id)?.code ?? id),
      drawings: drawingRows
        .filter((drawing) => String(drawing.request_id) === String(row.id))
        .map(
          (drawing): QcRequestDrawing => ({
            id: String(drawing.id),
            requestId: String(drawing.request_id),
            sourceDrawingId: drawing.source_drawing_id ? String(drawing.source_drawing_id) : null,
            fileName: String(drawing.file_name),
            contentType: drawing.content_type ? String(drawing.content_type) : null,
            url: signedDrawings.get(String(drawing.id)) ?? null,
          })
        ),
    }
  })

  const { data: resultRows } = await db
    .from('inspection_result')
    .select('id, inspectable_item_id')
    .in(
      'request_id',
      requestIds.length ? requestIds : ['00000000-0000-0000-0000-000000000000']
    )
  const resultIds = (resultRows ?? []).map((row) => String(row.id))
  const resultItem = new Map((resultRows ?? []).map((row) => [String(row.id), String(row.inspectable_item_id)]))

  let photos: QcResultPhoto[] = []
  if (resultIds.length) {
    const storage = createServiceClient()
    await ensurePhotoBucket(storage)
    const { data: photoRows, error } = await db
      .from('inspection_result_photo')
      .select('*')
      .in('result_id', resultIds)
      .order('sort_order')
    if (error) throw new Error(error.message)
    photos = []
    for (const row of photoRows ?? []) {
      const itemId = resultItem.get(String(row.result_id)) ?? ''
      const { data: signed } = await storage.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(String(row.storage_ref), 60 * 30)
      photos.push({
        id: String(row.id),
        resultId: String(row.result_id),
        itemId,
        itemCode: itemsById.get(itemId)?.code ?? itemId,
        storageRef: String(row.storage_ref),
        url: signed?.signedUrl ?? null,
        caption: row.caption ? String(row.caption) : null,
      })
    }
  }

  const { data: ncrRows, error: ncrError } = await db
    .from('ncr')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (ncrError) throw new Error(ncrError.message)

  const ncrs: QcEngineNcr[] = (ncrRows ?? []).map((row) => ({
    id: String(row.id),
    ncrNumber: String(row.ncr_number),
    title: itemsById.get(String(row.inspectable_item_id))?.code
      ? `${itemsById.get(String(row.inspectable_item_id))?.code} — رد بازرسی`
      : String(row.ncr_number),
    itemCode: itemsById.get(String(row.inspectable_item_id))?.code ?? '—',
    severity: row.severity as QcEngineNcr['severity'],
    status: row.status as QcEngineNcr['status'],
    createdAt: String(row.created_at),
  }))

  return { items, requests, photos, ncrs, officeDrawings }
}

export async function createInspectableItem(input: {
  projectId: string
  code: string
  name?: string
  disciplineKey: string
  topicKey: string
  elementTypeKey: string
  floor?: string
  gridX?: string
  gridY?: string
  createdBy: string
}) {
  const db = engine(createServiceClient())
  const gridRef = [input.gridX, input.gridY].filter(Boolean).join('-') || null
  const { data, error } = await db
    .from('inspectable_item')
    .insert({
      project_id: input.projectId,
      code: input.code.trim(),
      name: input.name?.trim() || null,
      discipline_key: input.disciplineKey.trim(),
      topic_key: input.topicKey.trim(),
      element_type_key: input.elementTypeKey.trim(),
      floor: input.floor?.trim() || null,
      grid_x: input.gridX?.trim() || null,
      grid_y: input.gridY?.trim() || null,
      grid_ref: gridRef,
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapItem(data as Record<string, unknown>)
}

export async function createInspectionRequest(input: {
  projectId: string
  requestedBy: string
  activityType: string
  itemIds: string[]
  notes?: string
  floor?: string
  gridFrom?: string
  gridTo?: string
  sourceDrawingId?: string | null
}) {
  const db = engine(createServiceClient())
  const base = {
    project_id: input.projectId,
    requested_by: input.requestedBy,
    activity_type: input.activityType,
    requested_at: new Date().toISOString(),
    status: 'submitted' as const,
    notes: input.notes?.trim() || null,
  }
  const withFields = {
    ...base,
    floor: input.floor?.trim() || null,
    grid_from: input.gridFrom?.trim() || null,
    grid_to: input.gridTo?.trim() || null,
    source_drawing_id: input.sourceDrawingId || null,
  }
  let { data, error } = await db.from('inspection_request').insert(withFields).select('*').single()
  if (error && /floor|grid_from|source_drawing|column|schema cache/i.test(error.message)) {
    const retry = await db.from('inspection_request').insert(base).select('*').single()
    data = retry.data
    error = retry.error
  }
  if (error || !data) throw new Error(error?.message || 'ثبت درخواست ناموفق بود.')

  if (input.itemIds.length) {
    const { error: linkError } = await db.from('inspection_request_item').insert(
      input.itemIds.map((id, index) => ({
        request_id: data.id,
        inspectable_item_id: id,
        sort_order: index,
      }))
    )
    if (linkError) throw new Error(linkError.message)
  }
  return String(data.id)
}

async function recoverMarkedDrawingsFromStorage(projectId: string, requestIds: string[]) {
  const storage = createServiceClient()
  const db = engine(storage)
  for (const requestId of requestIds) {
    const folder = `${MARKED_PREFIX}/${projectId}/${requestId}`
    const { data: objects } = await storage.storage.from(DRAWINGS_BUCKET).list(folder, { limit: 50 })
    for (const object of objects ?? []) {
      if (!object.name || object.name.endsWith('/')) continue
      const path = `${folder}/${object.name}`
      const { data: existing } = await db
        .from('inspection_request_drawing')
        .select('id')
        .eq('storage_path', path)
        .maybeSingle()
      if (existing) continue
      await db.from('inspection_request_drawing').insert({
        request_id: requestId,
        file_name: object.name,
        storage_path: path,
        content_type: (object.metadata as { mimetype?: string } | null)?.mimetype ?? null,
      })
    }
  }
}

async function fileBytes(file: File) {
  return Buffer.from(await file.arrayBuffer())
}

export async function attachMarkedDrawings(input: {
  requestId: string
  projectId: string
  uploadedBy: string
  files: File[]
  sourceDrawingId?: string | null
  sourceDrawingIds?: (string | null)[]
}) {
  if (!input.files.length) return
  const storage = createServiceClient()
  const db = engine(storage)
  await ensureDrawingsBucket(storage)

  for (const [index, file] of input.files.entries()) {
    const displayName = file.name.replace(/[^\w.\u0600-\u06FF-]+/g, '_') || 'marked-drawing.jpg'
    const ext = displayName.includes('.') ? displayName.split('.').pop()?.toLowerCase() || 'bin' : 'bin'
    const path = `${MARKED_PREFIX}/${input.projectId}/${input.requestId}/${crypto.randomUUID()}.${ext}`
    const bytes = await fileBytes(file)
    const { error: uploadError } = await storage.storage.from(DRAWINGS_BUCKET).upload(path, bytes, {
      contentType: 'application/octet-stream',
      upsert: false,
    })
    if (uploadError) throw new Error(uploadError.message)
    const sourceDrawingId = input.sourceDrawingIds?.[index] || input.sourceDrawingId || null
    const { error } = await db.from('inspection_request_drawing').insert({
      request_id: input.requestId,
      source_drawing_id: sourceDrawingId,
      file_name: displayName,
      storage_path: path,
      content_type: file.type || 'application/octet-stream',
      uploaded_by: input.uploadedBy,
    })
    if (error) throw new Error(error.message)
  }
}

export async function signRequestDrawing(drawingId: string): Promise<{ url: string; fileName: string }> {
  const storage = createServiceClient()
  const db = engine(storage)
  const { data, error } = await db
    .from('inspection_request_drawing')
    .select('file_name, storage_path')
    .eq('id', drawingId)
    .maybeSingle()
  if (error || !data) throw new Error(error?.message || 'نقشه درخواست پیدا نشد.')
  const { data: signed, error: signError } = await storage.storage
    .from(DRAWINGS_BUCKET)
    .createSignedUrl(String(data.storage_path), 60 * 30)
  if (signError || !signed?.signedUrl) throw new Error(signError?.message || 'لینک دانلود ساخته نشد.')
  return { url: signed.signedUrl, fileName: String(data.file_name) }
}

export function isRequestEditable(status: string) {
  return status === 'draft' || status === 'submitted'
}

export async function assertRequestEditable(requestId: string) {
  const db = engine(createServiceClient())
  const { data, error } = await db.from('inspection_request').select('status').eq('id', requestId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('درخواست پیدا نشد.')
  if (!isRequestEditable(String(data.status))) {
    throw new Error('پس از باز شدن درخواست توسط بازرس، ویرایش ممکن نیست.')
  }
}

export async function setRequestStatus(requestId: string, status: QcRequestStatus) {
  const db = engine(createServiceClient())
  const { error } = await db.from('inspection_request').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function deleteInspectionRequests(projectId: string, requestIds: string[]) {
  const ids = [...new Set(requestIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return { deleted: 0 }

  const db = engine(createServiceClient())
  const storage = createServiceClient()
  const { data: rows, error } = await db.from('inspection_request').select('id').eq('project_id', projectId).in('id', ids)
  if (error) throw new Error(error.message)
  const owned = (rows ?? []).map((row) => String(row.id))
  if (!owned.length) return { deleted: 0 }

  const { data: drawings, error: drawingError } = await db
    .from('inspection_request_drawing')
    .select('storage_path')
    .in('request_id', owned)
  if (drawingError) throw new Error(drawingError.message)

  const { data: results, error: resultError } = await db.from('inspection_result').select('id').in('request_id', owned)
  if (resultError) throw new Error(resultError.message)
  const resultIds = (results ?? []).map((row) => String(row.id))

  const photoPaths: string[] = []
  if (resultIds.length) {
    const { data: photos, error: photoError } = await db
      .from('inspection_result_photo')
      .select('storage_ref')
      .in('result_id', resultIds)
    if (photoError) throw new Error(photoError.message)
    photoPaths.push(...(photos ?? []).map((row) => String(row.storage_ref)).filter(Boolean))
    const { error: ncrError } = await db.from('ncr').delete().in('inspection_result_id', resultIds)
    if (ncrError) throw new Error(ncrError.message)
  }

  const drawingPaths = (drawings ?? []).map((row) => String(row.storage_path)).filter(Boolean)
  if (drawingPaths.length) {
    await storage.storage.from(DRAWINGS_BUCKET).remove(drawingPaths)
  }
  if (photoPaths.length) {
    await storage.storage.from(PHOTO_BUCKET).remove(photoPaths)
  }

  const { error: deleteError } = await db.from('inspection_request').delete().in('id', owned)
  if (deleteError) throw new Error(deleteError.message)
  return { deleted: owned.length }
}

export async function updateInspectionRequest(input: {
  requestId: string
  activityType?: string
  floor?: string
  gridFrom?: string
  gridTo?: string
  sourceDrawingId?: string | null
  itemIds?: string[]
  notes?: string
}) {
  const db = engine(createServiceClient())
  const { data: existing, error: existingError } = await db
    .from('inspection_request')
    .select('status')
    .eq('id', input.requestId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (!existing) throw new Error('درخواست پیدا نشد.')
  if (!isRequestEditable(String(existing.status))) {
    throw new Error('پس از باز شدن درخواست توسط بازرس، ویرایش ممکن نیست.')
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.activityType !== undefined) patch.activity_type = input.activityType
  if (input.floor !== undefined) patch.floor = input.floor.trim() || null
  if (input.gridFrom !== undefined) patch.grid_from = input.gridFrom.trim() || null
  if (input.gridTo !== undefined) patch.grid_to = input.gridTo.trim() || null
  if (input.sourceDrawingId !== undefined) patch.source_drawing_id = input.sourceDrawingId || null
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null
  const { error } = await db.from('inspection_request').update(patch).eq('id', input.requestId)
  if (error) throw new Error(error.message)

  if (input.itemIds) {
    const { error: deleteError } = await db.from('inspection_request_item').delete().eq('request_id', input.requestId)
    if (deleteError) throw new Error(deleteError.message)
    if (input.itemIds.length) {
      const { error: linkError } = await db.from('inspection_request_item').insert(
        input.itemIds.map((id, index) => ({
          request_id: input.requestId,
          inspectable_item_id: id,
          sort_order: index,
        }))
      )
      if (linkError) throw new Error(linkError.message)
    }
  }
}

export async function markRequestOpenedByInspector(requestId: string) {
  const db = engine(createServiceClient())
  const { data, error } = await db.from('inspection_request').select('status').eq('id', requestId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('درخواست پیدا نشد.')
  if (!isRequestEditable(String(data.status))) return
  await setRequestStatus(requestId, 'in_progress')
}

async function ensureActivityTemplate(activityType: string) {
  const db = engine(createServiceClient())
  const key = isQcActivityType(activityType) ? activityType : 'rebar'
  const prompts = QC_CHECKLIST_BY_ACTIVITY[key]
  const { data: existing } = await db
    .from('checklist_template')
    .select('id')
    .eq('discipline_key', key)
    .eq('topic_key', 'activity')
    .eq('element_type_key', 'default')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  let templateId = existing?.id ? String(existing.id) : ''
  if (!templateId) {
    const { data, error } = await db
      .from('checklist_template')
      .insert({
        discipline_key: key,
        topic_key: 'activity',
        element_type_key: 'default',
        title: key,
        version: 1,
        source: 'manual',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    templateId = String(data.id)
    const { error: itemError } = await db.from('checklist_template_item').insert(
      prompts.map((row, index) => ({
        template_id: templateId,
        code: row.code,
        prompt: row.prompt,
        sort_order: index + 1,
      }))
    )
    if (itemError) throw new Error(itemError.message)
  }

  const { data: items, error } = await db
    .from('checklist_template_item')
    .select('id, code, prompt, sort_order')
    .eq('template_id', templateId)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return items ?? []
}

export async function loadChecklistForRequest(
  requestId: string,
  itemId: string
): Promise<{ activityType: string; rows: QcChecklistRow[] }> {
  const db = engine(createServiceClient())
  const { data: request, error } = await db
    .from('inspection_request')
    .select('id, activity_type')
    .eq('id', requestId)
    .maybeSingle()
  if (error || !request) throw new Error(error?.message || 'درخواست پیدا نشد.')

  const activityType = String(request.activity_type)
  const templateItems = await ensureActivityTemplate(activityType)

  const { data: results } = await db
    .from('inspection_result')
    .select('id, template_item_id, verdict, notes')
    .eq('request_id', requestId)
    .eq('inspectable_item_id', itemId)

  const byTemplate = new Map((results ?? []).map((row) => [String(row.template_item_id), row]))

  return {
    activityType,
    rows: templateItems.map((item) => {
      const saved = byTemplate.get(String(item.id))
      return {
        id: String(item.id),
        code: item.code ? String(item.code) : null,
        prompt: String(item.prompt),
        sortOrder: Number(item.sort_order),
        verdict: saved?.verdict ? (saved.verdict as QcVerdict) : null,
        resultId: saved?.id ? String(saved.id) : null,
        notes: saved?.notes ? String(saved.notes) : null,
      }
    }),
  }
}

export async function saveChecklistVerdicts(input: {
  requestId: string
  itemId: string
  inspectorId: string
  verdicts: { templateItemId: string; verdict: QcVerdict; notes?: string }[]
}) {
  const db = engine(createServiceClient())
  const { data: request } = await db
    .from('inspection_request')
    .select('id, project_id, activity_type, status')
    .eq('id', input.requestId)
    .maybeSingle()
  if (!request) throw new Error('درخواست پیدا نشد.')

  if (request.status === 'draft' || request.status === 'submitted' || request.status === 'scheduled') {
    await setRequestStatus(input.requestId, 'in_progress')
  }

  const created: { resultId: string; verdict: QcVerdict; templateItemId: string }[] = []
  for (const row of input.verdicts) {
    const { data: existing } = await db
      .from('inspection_result')
      .select('id')
      .eq('request_id', input.requestId)
      .eq('inspectable_item_id', input.itemId)
      .eq('template_item_id', row.templateItemId)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await db
        .from('inspection_result')
        .update({
          verdict: row.verdict,
          notes: row.notes ?? null,
          inspector_id: input.inspectorId,
          inspected_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
      created.push({ resultId: String(existing.id), verdict: row.verdict, templateItemId: row.templateItemId })
    } else {
      const { data, error } = await db
        .from('inspection_result')
        .insert({
          request_id: input.requestId,
          inspectable_item_id: input.itemId,
          template_item_id: row.templateItemId,
          verdict: row.verdict,
          notes: row.notes ?? null,
          inspector_id: input.inspectorId,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      created.push({ resultId: String(data.id), verdict: row.verdict, templateItemId: row.templateItemId })
    }
  }

  const fails = created.filter((row) => row.verdict === 'fail')
  for (const fail of fails) {
    await openNcrIfNeeded({
      projectId: String(request.project_id),
      resultId: fail.resultId,
      itemId: input.itemId,
      openedBy: input.inspectorId,
    })
  }

  return created
}

async function openNcrIfNeeded(input: {
  projectId: string
  resultId: string
  itemId: string
  openedBy: string
}) {
  const db = engine(createServiceClient())
  const { data: existing } = await db
    .from('ncr')
    .select('id, status')
    .eq('inspection_result_id', input.resultId)
    .not('status', 'in', '("closed","waived")')
    .maybeSingle()
  if (existing) return existing.id

  const { count } = await db.from('ncr').select('id', { count: 'exact', head: true }).eq('project_id', input.projectId)
  const ncrNumber = `NCR-${String((count ?? 0) + 1).padStart(4, '0')}`
  const { data, error } = await db
    .from('ncr')
    .insert({
      project_id: input.projectId,
      ncr_number: ncrNumber,
      inspection_result_id: input.resultId,
      inspectable_item_id: input.itemId,
      severity: 'major',
      root_cause_category: 'workmanship',
      status: 'open',
      opened_by: input.openedBy,
    })
    .select('id')
    .single()
  if (error && !/ncr_one_open_per_result|duplicate/i.test(error.message)) throw new Error(error.message)
  return data?.id
}

export async function uploadResultPhoto(input: {
  resultId: string
  itemId: string
  file: File
  caption?: string
}) {
  const storage = createServiceClient()
  await ensurePhotoBucket(storage)
  const db = engine(storage)
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${input.itemId}/${input.resultId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await storage.storage.from(PHOTO_BUCKET).upload(path, input.file, {
    contentType: input.file.type || 'image/jpeg',
    upsert: false,
  })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await db
    .from('inspection_result_photo')
    .insert({
      result_id: input.resultId,
      storage_ref: path,
      caption: input.caption?.trim() || null,
      taken_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}
