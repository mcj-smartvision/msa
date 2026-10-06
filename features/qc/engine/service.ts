import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import { isQcActivityType, QC_CHECKLIST_BY_ACTIVITY } from '@/features/qc/engine/activity-types'
import {
appendQcNoteMarker,
hasQcNoteMarker, inferInspectorVerdictFromRequest,
inferLastRejectedAtFromRequest,
parseQcNoteMarker,
QC_APPROVED_AT_MARKER,
QC_REJECTED_AT_MARKER,
QC_RESUBMIT_MARKER
} from '@/features/qc/engine/note-markers'
import {
parseQcRequestPriority,
type QcChecklistRow,
type QcEngineDashboard,
type QcEngineNcr,
type QcInspectableItem,
type QcInspectionHistoryEvent,
type QcInspectionRequest,
type QcInspectionRequestHistoryEntry,
type QcInspectorVerdict,
type QcOfficeDrawing,
type QcRequestDrawing,
type QcRequestPriority,
type QcRequestStatus,
type QcResultPhoto,
type QcVerdict,
} from '@/features/qc/engine/types'
import {
DRAWINGS_BUCKET,
drawingContentType,
ensureDrawingsBucket,
getProjectDrawingStorage,
listProjectDrawings,
} from '@/features/technical-office/lib/drawings'

const PHOTO_BUCKET = 'qc-engine-photos'
const MARKED_PREFIX = 'qc-marked'
const LEGACY_SAMPLE_ITEM_CODES = new Set(['n200', 'c3-b04'])

function requestDrawingRank(drawing: QcRequestDrawing) {
  const name = drawing.fileName.toLowerCase()
  const type = (drawing.contentType || '').toLowerCase()
  if (!drawing.fileName.trim()) return -1
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 3
  if (/-marked/i.test(name)) return 2
  if (drawing.url) return 1
  return -1
}

function isLegacySampleItemCode(code: string) {
  return LEGACY_SAMPLE_ITEM_CODES.has(code.trim().toLowerCase())
}

async function removeLegacySampleItems(projectId: string) {
  const db = engine(createServiceClient())
  const { data: rows, error } = await db
    .from('inspectable_item')
    .select('id, code')
    .eq('project_id', projectId)
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  const ids = (rows ?? [])
    .filter((row) => isLegacySampleItemCode(String(row.code ?? '')))
    .map((row) => String(row.id))
  if (!ids.length) return
  const { error: unlinkError } = await db.from('inspection_request_item').delete().in('inspectable_item_id', ids)
  if (unlinkError) throw new Error(unlinkError.message)
  const { error: deactivateError } = await db
    .from('inspectable_item')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (deactivateError) throw new Error(deactivateError.message)
}

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

function mapHistoryEntry(row: Record<string, unknown>): QcInspectionRequestHistoryEntry {
  const itemCodes = Array.isArray(row.item_codes) ? row.item_codes.map((code) => String(code)) : []
  const eventType = String(row.event_type)
  const normalizedEvent: QcInspectionHistoryEvent =
    eventType === 'submitted' ||
    eventType === 'rejected' ||
    eventType === 'approved' ||
    eventType === 'resubmitted'
      ? eventType
      : 'submitted'
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    eventType: normalizedEvent,
    occurredAt: String(row.occurred_at),
    actorId: row.actor_id ? String(row.actor_id) : null,
    activityType: row.activity_type ? String(row.activity_type) : null,
    floor: row.floor ? String(row.floor) : null,
    gridFrom: row.grid_from ? String(row.grid_from) : null,
    gridTo: row.grid_to ? String(row.grid_to) : null,
    requestNotes: row.request_notes ? String(row.request_notes) : null,
    inspectorNotes: row.inspector_notes ? String(row.inspector_notes) : null,
    inspectorClassified: row.inspector_classified ? String(row.inspector_classified) : null,
    itemCodes,
    cycleNumber: Number(row.cycle_number ?? 1),
  }
}

type RequestHistorySnapshot = {
  activityType: string
  floor: string | null
  gridFrom: string | null
  gridTo: string | null
  requestNotes: string | null
  itemCodes: string[]
  firstSubmittedAt: string | null
  reinspectCount: number
}

async function loadRequestHistorySnapshot(requestId: string): Promise<RequestHistorySnapshot> {
  const db = engine(createServiceClient())
  const { data, error } = await db.from('inspection_request').select('*').eq('id', requestId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('درخواست پیدا نشد.')

  const { data: linkRows } = await db
    .from('inspection_request_item')
    .select('inspectable_item_id')
    .eq('request_id', requestId)
    .order('sort_order')
  const itemIds = (linkRows ?? []).map((row) => String(row.inspectable_item_id))
  let itemCodes: string[] = []
  if (itemIds.length) {
    const { data: itemRows } = await db.from('inspectable_item').select('id, code').in('id', itemIds)
    const codeById = new Map((itemRows ?? []).map((row) => [String(row.id), String(row.code)]))
    itemCodes = itemIds.map((id) => codeById.get(id) ?? id)
  }

  return {
    activityType: String(data.activity_type),
    floor: data.floor ? String(data.floor) : null,
    gridFrom: data.grid_from ? String(data.grid_from) : null,
    gridTo: data.grid_to ? String(data.grid_to) : null,
    requestNotes: data.notes ? String(data.notes) : null,
    itemCodes,
    firstSubmittedAt: data.first_submitted_at ? String(data.first_submitted_at) : null,
    reinspectCount: Number(data.reinspect_count ?? 0),
  }
}

function inspectionCycleNumber(reinspectCount: number) {
  return reinspectCount + 1
}

async function appendInspectionRequestHistory(input: {
  requestId: string
  eventType: QcInspectionHistoryEvent
  actorId?: string
  occurredAt?: string
  cycleNumber: number
  snapshot?: RequestHistorySnapshot
  inspectorNotes?: string | null
  inspectorClassified?: string | null
}) {
  const db = engine(createServiceClient())
  const snapshot = input.snapshot
  const { error } = await db.from('inspection_request_history').insert({
    request_id: input.requestId,
    event_type: input.eventType,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    actor_id: input.actorId ?? null,
    activity_type: snapshot?.activityType ?? null,
    floor: snapshot?.floor ?? null,
    grid_from: snapshot?.gridFrom ?? null,
    grid_to: snapshot?.gridTo ?? null,
    request_notes: snapshot?.requestNotes ?? null,
    inspector_notes: input.inspectorNotes ?? null,
    inspector_classified: input.inspectorClassified ?? null,
    item_codes: snapshot?.itemCodes ?? [],
    cycle_number: input.cycleNumber,
  })
  if (error && !/inspection_request_history|column|schema cache/i.test(error.message)) {
    throw new Error(error.message)
  }
}

async function backfillReinspectionNoteMarkers(
  requestId: string,
  row: Record<string, unknown>,
  history: QcInspectionRequestHistoryEntry[]
) {
  const status = String(row.status)
  if (status === 'draft' || status === 'cancelled') return null
  if (row.inspector_verdict === 'approved' || row.inspector_verdict === 'rejected') return null

  let notes = row.notes ? String(row.notes) : null
  let changed = false

  const rejectedHistory = history.filter((entry) => entry.eventType === 'rejected').pop()
  const resubmittedHistory = history.filter((entry) => entry.eventType === 'resubmitted').pop()
  const reinspectCount = Number(row.reinspect_count ?? 0)

  const rejectedIso =
    row.last_rejected_at
      ? String(row.last_rejected_at)
      : rejectedHistory?.occurredAt ?? parseQcNoteMarker(notes, QC_REJECTED_AT_MARKER)

  const isResubmit =
    reinspectCount > 0 ||
    Boolean(resubmittedHistory) ||
    hasQcNoteMarker(notes, QC_RESUBMIT_MARKER)

  const createdMs = new Date(String(row.created_at ?? row.requested_at)).getTime()
  const requestedMs = new Date(String(row.requested_at)).getTime()
  const likelyResubmit =
    (status === 'submitted' || status === 'scheduled' || status === 'in_progress') &&
    !row.inspector_verdict &&
    requestedMs - createdMs > 2 * 60 * 1000

  if (!isResubmit && !rejectedIso && !likelyResubmit) return null

  if (rejectedIso && !hasQcNoteMarker(notes, QC_REJECTED_AT_MARKER)) {
    notes = appendQcNoteMarker(notes, QC_REJECTED_AT_MARKER, rejectedIso)
    changed = true
  }

  if ((isResubmit || likelyResubmit) && !hasQcNoteMarker(notes, QC_RESUBMIT_MARKER)) {
    const resubmitIso = resubmittedHistory?.occurredAt ?? String(row.requested_at)
    notes = appendQcNoteMarker(notes, QC_RESUBMIT_MARKER, resubmitIso)
    changed = true
  }

  if (!changed) return null

  const db = engine(createServiceClient())
  const { error } = await db.from('inspection_request').update({ notes }).eq('id', requestId)
  if (error && !/column|schema cache/i.test(error.message)) {
    throw new Error(error.message)
  }
  return notes
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
  await removeLegacySampleItems(projectId)
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

  const historyByRequest = new Map<string, QcInspectionRequestHistoryEntry[]>()
  if (requestIds.length) {
    const { data: historyRows, error: historyError } = await db
      .from('inspection_request_history')
      .select('*')
      .in('request_id', requestIds)
      .order('occurred_at', { ascending: true })
    if (!historyError && historyRows) {
      for (const row of historyRows) {
        const entry = mapHistoryEntry(row as Record<string, unknown>)
        const list = historyByRequest.get(entry.requestId) ?? []
        list.push(entry)
        historyByRequest.set(entry.requestId, list)
      }
    }
  }

  for (const row of requestRows ?? []) {
    const id = String(row.id)
    const history = historyByRequest.get(id) ?? []
    const patchedNotes = await backfillReinspectionNoteMarkers(id, row as Record<string, unknown>, history)
    if (patchedNotes) row.notes = patchedNotes
  }

  const requests: QcInspectionRequest[] = (requestRows ?? []).map((row) => {
    const id = String(row.id)
    const history = historyByRequest.get(id) ?? []
    const notes = row.notes ? String(row.notes) : null
    const inferenceInput = {
      status: String(row.status),
      inspectorVerdict:
        row.inspector_verdict === 'approved' || row.inspector_verdict === 'rejected'
          ? (row.inspector_verdict as QcInspectorVerdict)
          : null,
      notes,
      inspectorNotes: row.inspector_notes ? String(row.inspector_notes) : null,
      inspectorClassified: row.inspector_classified ? String(row.inspector_classified) : null,
      lastRejectedAt: row.last_rejected_at ? String(row.last_rejected_at) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
      history,
    }
    const inspectorVerdict = inferInspectorVerdictFromRequest(inferenceInput)
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
      createdAt: String(row.created_at ?? row.requested_at),
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
      inspectorVerdict,
      inspectorNotes: row.inspector_notes ? String(row.inspector_notes) : null,
      inspectorClassified: row.inspector_classified ? String(row.inspector_classified) : null,
      priority: parseQcRequestPriority(row.priority),
      firstSubmittedAt: row.first_submitted_at ? String(row.first_submitted_at) : null,
      lastRejectedAt: inferLastRejectedAtFromRequest({ ...inferenceInput, inspectorVerdict }),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
      reinspectCount: Number(row.reinspect_count ?? 0),
      history,
      drawings: (() => {
        const latest = new Map<string, { drawing: QcRequestDrawing; rank: number }>()
        for (const drawing of drawingRows.filter((item) => String(item.request_id) === String(row.id))) {
          const mapped: QcRequestDrawing = {
            id: String(drawing.id),
            requestId: String(drawing.request_id),
            sourceDrawingId: drawing.source_drawing_id ? String(drawing.source_drawing_id) : null,
            fileName: String(drawing.file_name ?? ''),
            contentType: drawing.content_type ? String(drawing.content_type) : null,
            url: signedDrawings.get(String(drawing.id)) ?? null,
          }
          const rank = requestDrawingRank(mapped)
          if (rank < 0) continue
          const key = mapped.sourceDrawingId || mapped.id
          const existing = latest.get(key)
          if (!existing || rank > existing.rank) latest.set(key, { drawing: mapped, rank })
        }
        return [...latest.values()].map((item) => item.drawing)
      })(),
    }
  })

  const { data: resultRows } = await db
    .from('inspection_result')
    .select('id, inspectable_item_id, request_id')
    .in(
      'request_id',
      requestIds.length ? requestIds : ['00000000-0000-0000-0000-000000000000']
    )
  const resultIds = (resultRows ?? []).map((row) => String(row.id))
  const resultItem = new Map((resultRows ?? []).map((row) => [String(row.id), String(row.inspectable_item_id)]))
  const resultRequest = new Map((resultRows ?? []).map((row) => [String(row.id), String(row.request_id)]))

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
        requestId: resultRequest.get(String(row.result_id)) ?? '',
        resultId: String(row.result_id),
        itemId,
        itemCode: itemsById.get(itemId)?.code ?? itemId,
        storageRef: String(row.storage_ref),
        url: signed?.signedUrl ?? null,
        caption: row.caption ? String(row.caption) : null,
        mediaKind: qcStorageMediaKind(String(row.storage_ref)),
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
  priority?: QcRequestPriority
}) {
  const db = engine(createServiceClient())
  const base = {
    project_id: input.projectId,
    requested_by: input.requestedBy,
    activity_type: input.activityType,
    requested_at: new Date().toISOString(),
    status: 'draft' as const,
    notes: input.notes?.trim() || null,
  }
  const withFields = {
    ...base,
    floor: input.floor?.trim() || null,
    grid_from: input.gridFrom?.trim() || null,
    grid_to: input.gridTo?.trim() || null,
    source_drawing_id: input.sourceDrawingId || null,
    priority: parseQcRequestPriority(input.priority),
  }
  let { data, error } = await db.from('inspection_request').insert(withFields).select('*').single()
  if (error && /floor|grid_from|source_drawing|priority|column|schema cache/i.test(error.message)) {
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
    if (!file.size) continue
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

export async function attachOfficeDrawingsIfMissing(input: {
  requestId: string
  projectId: string
  uploadedBy: string
  drawingIds: string[]
  alreadyAttachedSourceIds?: (string | null)[]
}) {
  const attached = new Set((input.alreadyAttachedSourceIds ?? []).filter((id): id is string => Boolean(id)))
  const db = engine(createServiceClient())
  for (const drawingId of [...new Set(input.drawingIds.filter(Boolean))]) {
    if (attached.has(drawingId)) continue
    const stored = await getProjectDrawingStorage(drawingId)
    if (!stored) continue
    const { error } = await db.from('inspection_request_drawing').insert({
      request_id: input.requestId,
      source_drawing_id: drawingId,
      file_name: stored.fileName,
      storage_path: stored.path,
      content_type: drawingContentType(stored.format),
      uploaded_by: input.uploadedBy,
    })
    if (error) throw new Error(error.message)
    attached.add(drawingId)
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

export function isRequestEditable(status: string, inspectorVerdict?: string | null) {
  if (status === 'draft' || status === 'submitted') return true
  return status === 'completed' && inspectorVerdict === 'rejected'
}

export function isRejectedAwaitingResubmit(status: string, inspectorVerdict?: string | null) {
  return status === 'completed' && inspectorVerdict === 'rejected'
}

export async function assertRequestEditable(requestId: string) {
  const db = engine(createServiceClient())
  const { data, error } = await db
    .from('inspection_request')
    .select('status, inspector_verdict')
    .eq('id', requestId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('درخواست پیدا نشد.')
  const verdict = data.inspector_verdict ? String(data.inspector_verdict) : null
  if (!isRequestEditable(String(data.status), verdict)) {
    throw new Error('پس از باز شدن درخواست توسط بازرس، ویرایش ممکن نیست.')
  }
}

export async function deleteRequestDrawing(drawingId: string) {
  const db = engine(createServiceClient())
  const storage = createServiceClient()
  const { data, error } = await db
    .from('inspection_request_drawing')
    .select('id, request_id, storage_path')
    .eq('id', drawingId)
    .maybeSingle()
  if (error || !data) throw new Error(error?.message || 'نقشه درخواست پیدا نشد.')
  await assertRequestEditable(String(data.request_id))
  const { error: deleteError } = await db.from('inspection_request_drawing').delete().eq('id', drawingId)
  if (deleteError) throw new Error(deleteError.message)
  const path = String(data.storage_path || '')
  if (path.startsWith(`${MARKED_PREFIX}/`)) {
    await storage.storage.from(DRAWINGS_BUCKET).remove([path])
  }
}

export async function assertRequestInspectable(requestId: string) {
  const db = engine(createServiceClient())
  const { data, error } = await db
    .from('inspection_request')
    .select('status, inspector_verdict')
    .eq('id', requestId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('درخواست پیدا نشد.')
  const status = String(data.status)
  if (status === 'cancelled' || status === 'completed' || data.inspector_verdict) {
    throw new Error('این درخواست برای علامت‌گذاری بازرس باز نیست.')
  }
  if (status !== 'submitted' && status !== 'scheduled' && status !== 'in_progress') {
    throw new Error('این درخواست هنوز برای بازرسی ارسال نشده است.')
  }
}

export function canActAsQcInspector(context: { isSystemAdmin: boolean; positionKeys: string[] }) {
  return context.isSystemAdmin || context.positionKeys.includes('qa_qc_inspector')
}

export async function setRequestStatus(requestId: string, status: QcRequestStatus) {
  const db = engine(createServiceClient())
  const { error } = await db.from('inspection_request').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function submitInspectionRequest(requestId: string, actorId?: string) {
  const db = engine(createServiceClient())
  const snapshot = await loadRequestHistorySnapshot(requestId)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: 'submitted',
    updated_at: now,
    requested_at: now,
  }
  if (!snapshot.firstSubmittedAt) patch.first_submitted_at = now
  let { error } = await db.from('inspection_request').update(patch).eq('id', requestId)
  if (error && /first_submitted_at|column|schema cache/i.test(error.message)) {
    const retry = await db
      .from('inspection_request')
      .update({ status: 'submitted', updated_at: now, requested_at: now })
      .eq('id', requestId)
    error = retry.error
  }
  if (error) throw new Error(error.message)

  await appendInspectionRequestHistory({
    requestId,
    eventType: 'submitted',
    actorId,
    occurredAt: now,
    snapshot,
    cycleNumber: 1,
  })
}

export async function recordInspectorDecision(input: {
  requestId: string
  inspectorId: string
  verdict: QcInspectorVerdict
  notes?: string
  classified?: string
}) {
  const db = engine(createServiceClient())
  const { data: existing, error: existingError } = await db
    .from('inspection_request')
    .select('id, status, notes')
    .eq('id', input.requestId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (!existing) throw new Error('درخواست پیدا نشد.')
  const status = String(existing.status)
  if (status === 'draft') throw new Error('این درخواست هنوز برای بازرسی ارسال نشده است.')
  if (status === 'cancelled') throw new Error('این درخواست لغو شده است.')
  if (status === 'completed') throw new Error('برای این درخواست قبلاً تصمیم گرفته شده است.')
  const now = new Date().toISOString()
  const notes = input.notes?.trim() || null
  const classified = input.classified?.trim() || null
  const snapshot = await loadRequestHistorySnapshot(input.requestId)
  const cycleNumber = inspectionCycleNumber(snapshot.reinspectCount)
  const verdictLine = input.verdict === 'approved' ? 'تأیید بازرس' : 'رد بازرس'
  const decisionMarker =
    input.verdict === 'approved' ? QC_APPROVED_AT_MARKER : QC_REJECTED_AT_MARKER
  const notesWithMarker = appendQcNoteMarker(
    existing.notes ? String(existing.notes) : null,
    decisionMarker,
    now
  )

  const { error: coreError } = await db
    .from('inspection_request')
    .update({ status: 'completed', notes: notesWithMarker, updated_at: now })
    .eq('id', input.requestId)
  if (coreError) throw new Error(coreError.message)

  const optionalPatch: Record<string, unknown> = {
    inspector_verdict: input.verdict,
    inspector_notes: notes,
    inspector_classified: classified,
    assigned_inspector_id: input.inspectorId,
    updated_at: now,
  }
  if (input.verdict === 'rejected') optionalPatch.last_rejected_at = now

  const { error: optionalError } = await db
    .from('inspection_request')
    .update(optionalPatch)
    .eq('id', input.requestId)

  if (
    optionalError &&
    /inspector_verdict|inspector_notes|inspector_classified|last_rejected|assigned_inspector|column|schema cache/i.test(
      optionalError.message
    )
  ) {
    const fallbackNotes = [notesWithMarker, classified, notes, verdictLine].filter(Boolean).join('\n\n')
    const { error: notesError } = await db
      .from('inspection_request')
      .update({ notes: fallbackNotes, updated_at: now })
      .eq('id', input.requestId)
    if (notesError) throw new Error(notesError.message)
  } else if (optionalError) {
    throw new Error(optionalError.message)
  }

  await appendInspectionRequestHistory({
    requestId: input.requestId,
    eventType: input.verdict === 'approved' ? 'approved' : 'rejected',
    actorId: input.inspectorId,
    occurredAt: now,
    snapshot,
    cycleNumber,
    inspectorNotes: notes,
    inspectorClassified: classified,
  })
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

export async function updateInspectableItems(
  projectId: string,
  updates: { id: string; code?: string; floor?: string; name?: string }[]
) {
  if (!updates.length) return
  const db = engine(createServiceClient())
  for (const update of updates) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (update.code !== undefined) {
      const code = update.code.trim()
      if (!code) continue
      patch.code = code
    }
    if (update.floor !== undefined) patch.floor = update.floor.trim() || null
    if (update.name !== undefined) patch.name = update.name.trim() || null
    if (Object.keys(patch).length <= 1) continue
    const { error } = await db
      .from('inspectable_item')
      .update(patch)
      .eq('id', update.id)
      .eq('project_id', projectId)
    if (error) throw new Error(error.message)
  }
}

export async function updateInspectionRequest(input: {
  requestId: string
  projectId?: string
  activityType?: string
  floor?: string
  gridFrom?: string
  gridTo?: string
  sourceDrawingId?: string | null
  itemIds?: string[]
  itemUpdates?: { id: string; code?: string; floor?: string; name?: string }[]
  notes?: string
}) {
  const db = engine(createServiceClient())
  const { data: existing, error: existingError } = await db
    .from('inspection_request')
    .select('status, inspector_verdict')
    .eq('id', input.requestId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (!existing) throw new Error('درخواست پیدا نشد.')
  const verdict = existing.inspector_verdict ? String(existing.inspector_verdict) : null
  if (!isRequestEditable(String(existing.status), verdict)) {
    throw new Error('پس از باز شدن درخواست توسط بازرس، ویرایش ممکن نیست.')
  }
  if (input.projectId && input.itemUpdates?.length) {
    await updateInspectableItems(input.projectId, input.itemUpdates)
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

export async function resubmitRejectedInspectionRequest(input: {
  requestId: string
  projectId?: string
  activityType?: string
  floor?: string
  gridFrom?: string
  gridTo?: string
  sourceDrawingId?: string | null
  itemIds?: string[]
  itemUpdates?: { id: string; code?: string; floor?: string; name?: string }[]
  notes?: string
}) {
  const db = engine(createServiceClient())
  const { data: existing, error: existingError } = await db
    .from('inspection_request')
    .select('status, inspector_verdict, notes, inspector_notes, inspector_classified, last_rejected_at, updated_at')
    .eq('id', input.requestId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (!existing) throw new Error('درخواست پیدا نشد.')

  const status = String(existing.status)
  const verdict = existing.inspector_verdict ? String(existing.inspector_verdict) : null
  if (!isRejectedAwaitingResubmit(status, verdict)) {
    throw new Error('این درخواست برای بازرسی مجدد واجد شرایط نیست.')
  }

  if (input.projectId && input.itemUpdates?.length) {
    await updateInspectableItems(input.projectId, input.itemUpdates)
  }

  const snapshot = await loadRequestHistorySnapshot(input.requestId)
  const newReinspectCount = snapshot.reinspectCount + 1
  const cycleNumber = inspectionCycleNumber(newReinspectCount)
  const editedNotes =
    input.notes !== undefined ? input.notes.trim() : snapshot.requestNotes?.trim() || null
  const now = new Date().toISOString()
  let notesBase = editedNotes
  if (!hasQcNoteMarker(notesBase, QC_REJECTED_AT_MARKER)) {
    const rejectedIso = existing.last_rejected_at
      ? String(existing.last_rejected_at)
      : parseQcNoteMarker(snapshot.requestNotes, QC_REJECTED_AT_MARKER) ??
        (existing.updated_at ? String(existing.updated_at) : null)
    if (rejectedIso) {
      notesBase = appendQcNoteMarker(notesBase, QC_REJECTED_AT_MARKER, rejectedIso)
    }
  }
  const notesWithMarkers = appendQcNoteMarker(notesBase, QC_RESUBMIT_MARKER, now)

  const patch: Record<string, unknown> = {
    status: 'submitted',
    inspector_verdict: null,
    inspector_notes: null,
    inspector_classified: null,
    assigned_inspector_id: null,
    notes: notesWithMarkers,
    updated_at: now,
    requested_at: now,
    reinspect_count: newReinspectCount,
  }
  if (input.activityType !== undefined) patch.activity_type = input.activityType
  if (input.floor !== undefined) patch.floor = input.floor.trim() || null
  if (input.gridFrom !== undefined) patch.grid_from = input.gridFrom.trim() || null
  if (input.gridTo !== undefined) patch.grid_to = input.gridTo.trim() || null
  if (input.sourceDrawingId !== undefined) patch.source_drawing_id = input.sourceDrawingId || null

  let { error } = await db.from('inspection_request').update(patch).eq('id', input.requestId)
  if (
    error &&
    /inspector_verdict|inspector_notes|inspector_classified|assigned_inspector|reinspect_count|column|schema cache/i.test(
      error.message
    )
  ) {
    const fallbackPatch: Record<string, unknown> = {
      status: 'submitted',
      notes: notesWithMarkers,
      updated_at: now,
      requested_at: now,
    }
    if (input.activityType !== undefined) fallbackPatch.activity_type = input.activityType
    if (input.floor !== undefined) fallbackPatch.floor = input.floor.trim() || null
    if (input.gridFrom !== undefined) fallbackPatch.grid_from = input.gridFrom.trim() || null
    if (input.gridTo !== undefined) fallbackPatch.grid_to = input.gridTo.trim() || null
    if (input.sourceDrawingId !== undefined) fallbackPatch.source_drawing_id = input.sourceDrawingId || null
    const retry = await db.from('inspection_request').update(fallbackPatch).eq('id', input.requestId)
    error = retry.error
  }
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

  const resubmitSnapshot: RequestHistorySnapshot = {
    activityType: input.activityType ?? snapshot.activityType,
    floor: input.floor !== undefined ? input.floor.trim() || null : snapshot.floor,
    gridFrom: input.gridFrom !== undefined ? input.gridFrom.trim() || null : snapshot.gridFrom,
    gridTo: input.gridTo !== undefined ? input.gridTo.trim() || null : snapshot.gridTo,
    requestNotes: editedNotes,
    itemCodes: input.itemIds?.length
      ? await (async () => {
          const { data: itemRows } = await db.from('inspectable_item').select('id, code').in('id', input.itemIds!)
          const codeById = new Map((itemRows ?? []).map((row) => [String(row.id), String(row.code)]))
          return input.itemIds!.map((id) => codeById.get(id) ?? id)
        })()
      : snapshot.itemCodes,
    firstSubmittedAt: snapshot.firstSubmittedAt,
    reinspectCount: newReinspectCount,
  }

  await appendInspectionRequestHistory({
    requestId: input.requestId,
    eventType: 'resubmitted',
    occurredAt: now,
    snapshot: resubmitSnapshot,
    cycleNumber,
  })
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
  if (!isAllowedInspectionMedia(input.file)) {
    throw new Error('فقط تصویر یا فیلم برای مستندسازی بازرسی پذیرفته می‌شود.')
  }
  const storage = createServiceClient()
  await ensurePhotoBucket(storage)
  const db = engine(storage)
  const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${input.itemId}/${input.resultId}/${crypto.randomUUID()}.${ext}`
  const contentType =
    input.file.type ||
    (qcStorageMediaKind(path) === 'video' ? 'video/mp4' : 'image/jpeg')
  const { error: uploadError } = await storage.storage.from(PHOTO_BUCKET).upload(path, input.file, {
    contentType,
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

function qcStorageMediaKind(storageRef: string): 'image' | 'video' {
  const ext = storageRef.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'mp4' || ext === 'webm' || ext === 'mov' || ext === 'm4v' || ext === 'avi') return 'video'
  return 'image'
}

function isAllowedInspectionMedia(file: File) {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true
  return /\.(jpg|jpeg|png|webp|gif|bmp|mp4|webm|mov|m4v|avi)$/i.test(file.name)
}

async function ensureRequestMediaResult(requestId: string, inspectorId: string) {
  await assertRequestInspectable(requestId)
  const db = engine(createServiceClient())
  const { data: linkRow, error: linkError } = await db
    .from('inspection_request_item')
    .select('inspectable_item_id')
    .eq('request_id', requestId)
    .order('sort_order')
    .limit(1)
    .maybeSingle()
  if (linkError) throw new Error(linkError.message)
  const itemId = linkRow?.inspectable_item_id ? String(linkRow.inspectable_item_id) : null
  if (!itemId) throw new Error('آیتم بازرسی برای این درخواست پیدا نشد.')

  const { data: request, error: requestError } = await db
    .from('inspection_request')
    .select('activity_type, status')
    .eq('id', requestId)
    .maybeSingle()
  if (requestError || !request) throw new Error(requestError?.message || 'درخواست پیدا نشد.')

  const templateItems = await ensureActivityTemplate(String(request.activity_type))
  const templateItemId = templateItems[0]?.id
  if (!templateItemId) throw new Error('چک‌لیست برای این فعالیت پیدا نشد.')

  const status = String(request.status)
  if (status === 'submitted' || status === 'scheduled') {
    await setRequestStatus(requestId, 'in_progress')
  }

  const { data: existing } = await db
    .from('inspection_result')
    .select('id')
    .eq('request_id', requestId)
    .eq('inspectable_item_id', itemId)
    .eq('template_item_id', templateItemId)
    .maybeSingle()

  if (existing?.id) return { resultId: String(existing.id), itemId }

  const { data, error } = await db
    .from('inspection_result')
    .insert({
      request_id: requestId,
      inspectable_item_id: itemId,
      template_item_id: templateItemId,
      verdict: 'na',
      notes: null,
      inspector_id: inspectorId,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { resultId: String(data.id), itemId }
}

export async function saveInspectorReport(input: {
  requestId: string
  inspectorId: string
  notes?: string
  classified?: string
}) {
  await assertRequestInspectable(input.requestId)
  const db = engine(createServiceClient())
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    inspector_notes: input.notes?.trim() || null,
    inspector_classified: input.classified?.trim() || null,
    assigned_inspector_id: input.inspectorId,
    updated_at: now,
  }
  const { error } = await db.from('inspection_request').update(patch).eq('id', input.requestId)
  if (error && !/inspector_notes|inspector_classified|assigned_inspector|column|schema cache/i.test(error.message)) {
    throw new Error(error.message)
  }

  const { data } = await db.from('inspection_request').select('status').eq('id', input.requestId).maybeSingle()
  const status = data ? String(data.status) : ''
  if (status === 'submitted' || status === 'scheduled') {
    await setRequestStatus(input.requestId, 'in_progress')
  }
}

export async function uploadRequestInspectionMedia(input: {
  requestId: string
  inspectorId: string
  file: File
  caption?: string
}) {
  if (!isAllowedInspectionMedia(input.file)) {
    throw new Error('فقط تصویر یا فیلم برای مستندسازی بازرسی پذیرفته می‌شود.')
  }
  const { resultId, itemId } = await ensureRequestMediaResult(input.requestId, input.inspectorId)
  return uploadResultPhoto({
    resultId,
    itemId,
    file: input.file,
    caption: input.caption,
  })
}
