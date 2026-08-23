'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Download, FileText, Trash2, Upload } from 'lucide-react'
import { SectionCard, EmptyState } from '@/components/admin/shared'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { QcMarkedThumb } from '@/components/qc/qc-drawing-thumb'
import { VoiceToTextButton } from '@/components/shared/voice-to-text-button'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { useLocale } from '@/components/i18n/locale-provider'
import type { QcMessages } from '@/lib/i18n/qc'
import {
  qcActivitiesByGroup,
  qcActivityGroupLabel,
  qcActivityLabel,
  type QcActivityType,
} from '@/lib/qc-engine/activity-types'
import { readQcSelectedDrawings } from '@/lib/qc-engine/drawing-discipline'
import { parseRequestSpeech, parseAiClassifiedText, formatSpeechSummary, mergeParsedSpeech, speechItemCode, type ParsedQcRequestSpeech } from '@/lib/qc-engine/parse-request-speech'
import { downloadBlob, downloadFilesAsZip } from '@/lib/qc-engine/client-download'
import { clearPendingMarked, loadPendingMarked, removePendingMarked } from '@/lib/qc-engine/pending-marked'
import { clearQcRequestDraft, readQcRequestDraft, writeQcRequestDraft, type QcRequestDraft } from '@/lib/qc-engine/request-draft'
import type {
  QcChecklistRow,
  QcEngineDashboard,
  QcInspectableItem,
  QcInspectionRequest,
  QcNcrSeverity,
  QcRequestStatus,
  QcVerdict,
} from '@/lib/qc-engine/types'
import { cn } from '@/lib/utils'

const REQUEST_LABEL: Record<QcRequestStatus, keyof QcMessages> = {
  draft: 'requestDraft',
  submitted: 'requestSubmitted',
  scheduled: 'requestScheduled',
  in_progress: 'requestInProgress',
  completed: 'requestCompleted',
  cancelled: 'requestCancelled',
}

const SEVERITY_LABEL: Record<QcNcrSeverity, keyof QcMessages> = {
  minor: 'severityMinor',
  major: 'severityMajor',
  critical: 'severityCritical',
}

function canEditRequest(status: QcRequestStatus) {
  return status === 'draft' || status === 'submitted'
}

type LocalMarkedDrawing = {
  id: string
  file: File
  url: string
  title: string
  sourceDrawingId: string
}

function activitySelectOptions(locale: string) {
  return qcActivitiesByGroup().map((group) => (
    <optgroup key={group.group} label={qcActivityGroupLabel(group.group, locale)}>
      {group.types.map((key) => (
        <option key={key} value={key}>
          {qcActivityLabel(key, locale)}
        </option>
      ))}
    </optgroup>
  ))
}

function requestBadgeClass(status: QcRequestStatus) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600'
  if (status === 'in_progress' || status === 'scheduled') return 'bg-amber-50 text-amber-800 border-amber-200'
  return ''
}

function severityBadge(severity: QcNcrSeverity) {
  if (severity === 'critical') return { variant: 'destructive' as const, className: '' }
  if (severity === 'major') return { variant: 'outline' as const, className: 'border-amber-300 bg-amber-50 text-amber-800' }
  return { variant: 'outline' as const, className: '' }
}

export function QcEnginePanels({
  projectId,
  t,
  isInspector = false,
}: {
  projectId: string
  t: QcMessages
  isInspector?: boolean
}) {
  const { locale } = useLocale()
  const [data, setData] = useState<QcEngineDashboard>({
    items: [],
    requests: [],
    photos: [],
    ncrs: [],
    officeDrawings: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [code, setCode] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [topic, setTopic] = useState('')
  const [elementType, setElementType] = useState('')
  const [floor, setFloor] = useState('')
  const [gridX, setGridX] = useState('')
  const [gridY, setGridY] = useState('')

  const [activityType, setActivityType] = useState<QcActivityType>('rebar')
  const [selectMode, setSelectMode] = useState<'exact' | 'range'>('range')
  const [rangeFrom, setRangeFrom] = useState('A')
  const [rangeTo, setRangeTo] = useState('ژ')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([])
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)
  const [sourceDrawingId, setSourceDrawingId] = useState('')
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([])
  const [markedDrawings, setMarkedDrawings] = useState<LocalMarkedDrawing[]>([])
  const [previewMarkedId, setPreviewMarkedId] = useState<string | null>(null)
  const [voiceText, setVoiceText] = useState('')
  const [typedSpeech, setTypedSpeech] = useState('')
  const [parsedSpeech, setParsedSpeech] = useState<ParsedQcRequestSpeech | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [speechBusy, setSpeechBusy] = useState(false)

  const [inspectOpen, setInspectOpen] = useState(false)
  const [inspectRequestId, setInspectRequestId] = useState<string | null>(null)
  const [inspectItemId, setInspectItemId] = useState<string | null>(null)
  const [viewRequestId, setViewRequestId] = useState<string | null>(null)
  const [editingRequest, setEditingRequest] = useState(false)
  const [editActivity, setEditActivity] = useState<QcActivityType>('rebar')
  const [editFloor, setEditFloor] = useState('')
  const [editGridFrom, setEditGridFrom] = useState('')
  const [editGridTo, setEditGridTo] = useState('')
  const [editSourceId, setEditSourceId] = useState('')
  const [editItemIds, setEditItemIds] = useState<string[]>([])
  const [detailFiles, setDetailFiles] = useState<File[]>([])
  const [checklist, setChecklist] = useState<QcChecklistRow[]>([])
  const [photoCaption, setPhotoCaption] = useState('')
  const inspectorOpened = useRef<Set<string>>(new Set())
  const markedDrawingsRef = useRef<LocalMarkedDrawing[]>([])
  const markedHydrateGen = useRef(0)
  markedDrawingsRef.current = markedDrawings

  const load = useCallback(async () => {
    if (!projectId) return [] as QcInspectionRequest[]
    const res = await fetch(`/api/qc-engine/dashboard?projectId=${projectId}`)
    const json = (await res.json().catch(() => ({}))) as QcEngineDashboard & { error?: string }
    if (!res.ok) {
      setError(json.error || t.engineError)
      return []
    }
    setError(null)
    const next = {
      items: json.items ?? [],
      requests: json.requests ?? [],
      photos: json.photos ?? [],
      ncrs: json.ncrs ?? [],
      officeDrawings: json.officeDrawings ?? [],
    }
    setData(next)
    return next.requests
  }, [projectId, t.engineError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!projectId) return
    const draft = readQcRequestDraft(projectId)
    if (draft) {
      setCode(draft.code)
      setDiscipline(draft.discipline)
      setTopic(draft.topic)
      setElementType(draft.elementType)
      setFloor(draft.floor)
      setGridX(draft.gridX)
      setGridY(draft.gridY)
      setActivityType(draft.activityType)
      setSelectMode(draft.selectMode)
      setRangeFrom(draft.rangeFrom)
      setRangeTo(draft.rangeTo)
      setSelectedIds(draft.selectedIds)
      setSourceDrawingId(draft.sourceDrawingId)
      setVoiceText(draft.voiceText)
      setTypedSpeech(draft.typedSpeech)
      if (draft.voiceText.trim()) setParsedSpeech(parseAiClassifiedText(draft.voiceText))
      else if (draft.typedSpeech.trim()) setParsedSpeech(parseRequestSpeech(draft.typedSpeech))
    }
    const ids = readQcSelectedDrawings(projectId)
    if (ids.length) {
      setSelectedOfficeIds(ids)
      if (ids[0]) setSourceDrawingId(ids[0])
    } else if (draft?.sourceDrawingId) {
      setSelectedOfficeIds([draft.sourceDrawingId])
    }
    setDraftReady(true)
  }, [projectId])

  const hydrateMarkedDrawings = useCallback(async () => {
    if (!projectId) return
    const gen = ++markedHydrateGen.current
    const pending = await loadPendingMarked(projectId)
    if (gen !== markedHydrateGen.current) return
    setMarkedDrawings((current) => {
      current.forEach((row) => URL.revokeObjectURL(row.url))
      return pending.map((row) => ({
        id: row.id,
        file: new File([row.blob], row.fileName, { type: row.mimeType || 'image/png' }),
        url: URL.createObjectURL(row.blob),
        title: row.sourceTitle || row.fileName,
        sourceDrawingId: row.sourceDrawingId,
      }))
    })
    const sourceIds = pending.map((row) => row.sourceDrawingId).filter(Boolean)
    if (sourceIds[0]) setSourceDrawingId((current) => current || sourceIds[0])
    if (sourceIds.length) {
      setSelectedOfficeIds((current) => [...new Set([...sourceIds, ...current])])
    }
  }, [projectId])

  useEffect(() => {
    void hydrateMarkedDrawings()
    const onPageShow = () => void hydrateMarkedDrawings()
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [hydrateMarkedDrawings])

  useEffect(() => {
    return () => {
      markedDrawingsRef.current.forEach((row) => URL.revokeObjectURL(row.url))
    }
  }, [])

  function snapshotDraft(): QcRequestDraft | null {
    if (!projectId) return null
    return {
      projectId,
      code,
      discipline,
      topic,
      elementType,
      floor,
      gridX,
      gridY,
      activityType,
      selectMode,
      rangeFrom,
      rangeTo,
      selectedIds,
      sourceDrawingId,
      voiceText,
      typedSpeech,
    }
  }

  useEffect(() => {
    if (!draftReady) return
    const draft = snapshotDraft()
    if (!draft) return
    const hasContent = Boolean(
      draft.code ||
        draft.voiceText ||
        draft.typedSpeech ||
        draft.floor ||
        draft.topic ||
        draft.discipline ||
        draft.elementType ||
        draft.gridX ||
        draft.gridY ||
        draft.selectedIds.length ||
        draft.sourceDrawingId
    )
    if (!hasContent) {
      clearQcRequestDraft(projectId)
      return
    }
    writeQcRequestDraft(draft)
  }, [
    draftReady,
    projectId,
    code,
    discipline,
    topic,
    elementType,
    floor,
    gridX,
    gridY,
    activityType,
    selectMode,
    rangeFrom,
    rangeTo,
    selectedIds,
    sourceDrawingId,
    voiceText,
    typedSpeech,
  ])

  async function markInspectorOpened(requestId: string) {
    if (!isInspector || inspectorOpened.current.has(requestId)) return
    inspectorOpened.current.add(requestId)
    await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, requestId, inspectorOpen: true }),
    })
    await load()
  }

  const floorItems = useMemo(() => {
    if (!floor) return data.items
    return data.items.filter((item) => (item.floor ?? '') === floor)
  }, [data.items, floor])

  const floors = useMemo(
    () => [...new Set(data.items.map((item) => item.floor).filter((value): value is string => Boolean(value)))],
    [data.items]
  )
  const previewMarked = markedDrawings.find((row) => row.id === previewMarkedId) ?? null

  function toggleItem(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  function applyParsed(parsed: ParsedQcRequestSpeech, overwrite = false) {
    setParsedSpeech(parsed)
    if (parsed.activityType) setActivityType(parsed.activityType)
    if (parsed.topic || overwrite) setTopic(parsed.topic ?? '')
    if (parsed.floor || overwrite) setFloor(parsed.floor ?? '')
    if (parsed.code || overwrite) setCode(parsed.code ?? '')
    if (parsed.elementType || overwrite) setElementType(parsed.elementType ?? '')
    if (parsed.discipline || overwrite) setDiscipline(parsed.discipline ?? '')
    if (parsed.gridFrom && parsed.gridTo) {
      setSelectMode('range')
      setRangeFrom(parsed.gridFrom)
      setRangeTo(parsed.gridTo)
    }
    if (parsed.gridX || overwrite) setGridX(parsed.gridX ?? '')
    if (parsed.gridY || overwrite) setGridY(parsed.gridY ?? '')
  }

  function applyAiText(value: string) {
    setVoiceText(value)
    applyParsed(parseAiClassifiedText(value), true)
  }

  async function removeMarkedDrawing(id: string) {
    const row = markedDrawings.find((item) => item.id === id)
    if (row) URL.revokeObjectURL(row.url)
    setMarkedDrawings((current) => current.filter((item) => item.id !== id))
    if (previewMarkedId === id) setPreviewMarkedId(null)
    if (projectId) await removePendingMarked(projectId, id)
  }

  function downloadOneMarked(row: LocalMarkedDrawing) {
    downloadBlob(row.file.name || `${row.title}.png`, row.file)
  }

  async function downloadAllMarked() {
    if (!markedDrawings.length) return
    await downloadFilesAsZip(
      'marked-drawings.zip',
      markedDrawings.map((row) => ({ name: row.file.name || `${row.title}.png`, blob: row.file }))
    )
  }

  async function applySpeech(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setTypedSpeech(trimmed)
    setSpeechBusy(true)
    setError(null)
    let parsed = parseRequestSpeech(trimmed)
    try {
      const res = await fetch('/api/qc-engine/parse-request-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      const json = (await res.json().catch(() => ({}))) as ParsedQcRequestSpeech & { error?: string }
      if (res.ok) parsed = mergeParsedSpeech(parsed, json)
    } catch {
      /* local parse is enough */
    }
    applyParsed(parsed, true)
    setVoiceText(formatSpeechSummary(parsed))
    setSpeechBusy(false)
  }

  async function ensureItemIds(): Promise<string[]> {
    const speechItems =
      parsedSpeech?.items?.length
        ? parsedSpeech.items
        : topic || floor || code || elementType
          ? [
              {
                topic: topic || null,
                floor: floor || null,
                activityType,
                code: code || null,
                elementType: elementType || null,
                discipline: discipline || null,
                gridX: gridX || rangeFrom || null,
                gridY: gridY || rangeTo || null,
                gridFrom: rangeFrom || null,
                gridTo: rangeTo || null,
              },
            ]
          : []
    const used = new Set(data.items.map((item) => item.code.trim().toUpperCase()))
    const ids: string[] = []
    for (const [index, item] of speechItems.entries()) {
      const preferred = item.code?.trim()
      const existingByCode = preferred
        ? data.items.find((row) => row.code.trim().toUpperCase() === preferred.toUpperCase())
        : null
      if (existingByCode) {
        if (!ids.includes(existingByCode.id)) ids.push(existingByCode.id)
        continue
      }
      const itemCode = speechItemCode(item, index, used)
      const existing = data.items.find((row) => row.code.trim().toUpperCase() === itemCode.toUpperCase())
      if (existing) {
        if (!ids.includes(existing.id)) ids.push(existing.id)
        continue
      }
      const res = await fetch('/api/qc-engine/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          code: itemCode,
          name: item.topic || undefined,
          disciplineKey: item.discipline || discipline || item.activityType || activityType,
          topicKey: item.topic || topic || item.activityType || activityType,
          elementTypeKey: item.elementType || elementType || item.activityType || activityType,
          floor: item.floor || floor,
          gridX: item.gridFrom || item.gridX || gridX,
          gridY: item.gridTo || item.gridY || gridY,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { item?: { id?: string }; error?: string }
      if (!res.ok || !json.item?.id) {
        throw new Error(json.error || t.engineError)
      }
      ids.push(json.item.id)
    }
    return ids
  }

  async function handleCreateRequest(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    let itemIds = selectedIds
    try {
      const createdItemIds = await ensureItemIds()
      for (const createdItemId of createdItemIds) {
        if (!itemIds.includes(createdItemId)) itemIds = [...itemIds, createdItemId]
      }
    } catch (createError) {
      setBusy(false)
      setError(createError instanceof Error ? createError.message : t.engineError)
      return
    }
    const body = new FormData()
    body.set('projectId', projectId)
    body.set('activityType', activityType)
    body.set('itemIds', itemIds.join(','))
    body.set('floor', floor)
    body.set('gridFrom', rangeFrom)
    body.set('gridTo', rangeTo)
    const baseDrawingId = sourceDrawingId || selectedOfficeIds[0] || ''
    if (baseDrawingId) body.set('sourceDrawingId', baseDrawingId)
    const notes = [typedSpeech.trim(), voiceText.trim()].filter((value, index, rows) => value && rows.indexOf(value) === index).join('\n\n')
    if (notes) body.set('notes', notes)
    for (const row of markedDrawings) {
      body.append('file', row.file)
      body.append('fileSourceId', row.sourceDrawingId || '')
    }
    const res = await fetch('/api/qc-engine/requests', { method: 'POST', body })
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string; warning?: string }
    setBusy(false)
    if (!res.ok && !json.id) {
      setError(json.error || t.engineError)
      return
    }
    const sourceTitle = data.officeDrawings.find((drawing) => drawing.id === baseDrawingId)?.title ?? null
    const created: QcInspectionRequest = {
      id: json.id || `temp-${Date.now()}`,
      projectId,
      activityType,
      requestedAt: new Date().toISOString(),
      status: 'submitted',
      notes: null,
      floor: floor || null,
      gridFrom: rangeFrom || null,
      gridTo: rangeTo || null,
      sourceDrawingId: baseDrawingId || null,
      sourceDrawingTitle: sourceTitle,
      requestedByName: null,
      itemIds,
      itemCodes: itemIds.map((id) => data.items.find((item) => item.id === id)?.code ?? (code || id)),
      drawings: markedDrawings.map((row, index) => ({
        id: `local-${index}`,
        requestId: json.id || '',
        sourceDrawingId: row.sourceDrawingId || baseDrawingId || null,
        fileName: row.file.name,
        contentType: row.file.type || null,
        url: row.url,
      })),
    }
    setData((current) => ({
      ...current,
      requests: [created, ...current.requests.filter((row) => row.id !== created.id)],
    }))
    setViewRequestId(created.id)
    setSelectedIds([])
    setMarkedDrawings([])
    await clearPendingMarked(projectId)
    clearQcRequestDraft(projectId)
    setSourceDrawingId('')
    setCode('')
    setDiscipline('')
    setTopic('')
    setElementType('')
    setGridX('')
    setGridY('')
    setVoiceText('')
    setTypedSpeech('')
    setParsedSpeech(null)
    setMessage(json.warning ? `${t.requestCreated} ${json.warning}` : t.requestCreated)
    const loaded = await load()
    const fromServer = loaded.find((row) => row.id === created.id)
    if (!fromServer) {
      setData((current) => ({
        ...current,
        requests: [created, ...current.requests.filter((row) => row.id !== created.id)],
      }))
    } else if (fromServer.drawings.length === 0 && created.drawings.length > 0) {
      setData((current) => ({
        ...current,
        requests: current.requests.map((row) => (row.id === created.id ? { ...row, drawings: created.drawings } : row)),
      }))
    }
  }

  async function downloadOfficeDrawing(id: string) {
    setError(null)
    const res = await fetch(`/api/technical-office/drawings/${encodeURIComponent(id)}`)
    const json = (await res.json().catch(() => ({}))) as { url?: string; fileName?: string; error?: string }
    if (!res.ok || !json.url) {
      setError(json.error || t.engineError)
      return
    }
    const a = document.createElement('a')
    a.href = json.url
    a.download = json.fileName || 'drawing.pdf'
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.click()
  }

  async function downloadRequestDrawing(id: string) {
    setError(null)
    const res = await fetch(`/api/qc-engine/request-drawings/${encodeURIComponent(id)}`)
    const json = (await res.json().catch(() => ({}))) as { url?: string; fileName?: string; error?: string }
    if (!res.ok || !json.url) {
      setError(json.error || t.engineError)
      return
    }
    const a = document.createElement('a')
    a.href = json.url
    a.download = json.fileName || 'drawing.pdf'
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.click()
  }

  async function attachToViewedRequest() {
    if (!viewRequestId || detailFiles.length === 0) return
    setBusy(true)
    setError(null)
    const body = new FormData()
    body.set('projectId', projectId)
    body.set('requestId', viewRequestId)
    const current = data.requests.find((row) => row.id === viewRequestId)
    if (current?.sourceDrawingId) body.set('sourceDrawingId', current.sourceDrawingId)
    for (const file of detailFiles) body.append('file', file)
    const res = await fetch('/api/qc-engine/requests', { method: 'POST', body })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setDetailFiles([])
    setMessage(t.requestCreated)
    await load()
  }

  function startEditRequest(row: QcInspectionRequest) {
    setEditActivity((row.activityType as QcActivityType) || 'rebar')
    setEditFloor(row.floor || '')
    setEditGridFrom(row.gridFrom || '')
    setEditGridTo(row.gridTo || '')
    setEditSourceId(row.sourceDrawingId || '')
    setEditItemIds(row.itemIds)
    setEditingRequest(true)
  }

  async function saveRequestEdits() {
    if (!viewRequestId) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        requestId: viewRequestId,
        edit: true,
        activityType: editActivity,
        floor: editFloor,
        gridFrom: editGridFrom,
        gridTo: editGridTo,
        sourceDrawingId: editSourceId,
        itemIds: editItemIds,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setEditingRequest(false)
    setMessage(t.requestCreated)
    await load()
  }

  async function patchStatus(requestId: string, status: QcRequestStatus) {
    setBusy(true)
    await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, requestId, status }),
    })
    setBusy(false)
    await load()
  }

  function toggleRequestSelection(id: string) {
    setSelectedRequestIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }

  function toggleSelectAllRequests() {
    setSelectedRequestIds((current) =>
      current.length === data.requests.length ? [] : data.requests.map((row) => row.id)
    )
  }

  async function confirmDeleteRequests() {
    if (!pendingDeleteIds?.length) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, delete: true, requestIds: pendingDeleteIds }),
    })
    const json = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    const removed = new Set(pendingDeleteIds)
    setPendingDeleteIds(null)
    setSelectedRequestIds((current) => current.filter((id) => !removed.has(id)))
    if (viewRequestId && removed.has(viewRequestId)) setViewRequestId(null)
    if (inspectRequestId && removed.has(inspectRequestId)) {
      setInspectOpen(false)
      setInspectRequestId(null)
      setInspectItemId(null)
    }
    setMessage(t.requestsDeleted)
    await load()
  }

  async function openInspect(requestId: string, itemId: string) {
    await markInspectorOpened(requestId)
    setInspectRequestId(requestId)
    setInspectItemId(itemId)
    setInspectOpen(true)
    const res = await fetch(`/api/qc-engine/checklist?requestId=${requestId}&itemId=${itemId}`)
    const json = (await res.json().catch(() => ({}))) as { rows?: QcChecklistRow[]; error?: string }
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setChecklist(json.rows ?? [])
  }

  async function saveChecklist() {
    if (!inspectRequestId || !inspectItemId) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/qc-engine/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: inspectRequestId,
        itemId: inspectItemId,
        verdicts: checklist
          .filter((row) => row.verdict)
          .map((row) => ({ templateItemId: row.id, verdict: row.verdict, notes: row.notes })),
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setMessage(t.checklistSaved)
    await openInspect(inspectRequestId, inspectItemId)
    await load()
  }

  async function uploadPhoto(resultId: string, file: File | undefined) {
    if (!file || !inspectItemId) return
    setBusy(true)
    const body = new FormData()
    body.set('resultId', resultId)
    body.set('itemId', inspectItemId)
    body.set('caption', photoCaption)
    body.set('file', file)
    const res = await fetch('/api/qc-engine/photos', { method: 'POST', body })
    setBusy(false)
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setError(json.error || t.engineError)
      return
    }
    setPhotoCaption('')
    await load()
  }

  const inspectItem = data.items.find((item) => item.id === inspectItemId) ?? null
  const inspectRequest = data.requests.find((row) => row.id === inspectRequestId) ?? null
  const viewedRequest = data.requests.find((row) => row.id === viewRequestId) ?? null
  const viewedDrawings = viewedRequest?.drawings ?? []
  const canEditViewed = viewedRequest ? canEditRequest(viewedRequest.status) : false
  const viewedSourceTitle =
    viewedRequest?.sourceDrawingTitle ||
    data.officeDrawings.find((drawing) => drawing.id === viewedRequest?.sourceDrawingId)?.title ||
    '—'
  const viewedItemLabel = viewedRequest
    ? viewedRequest.itemIds
        .map((id) => {
          const item = data.items.find((entry) => entry.id === id)
          if (!item) return viewedRequest.itemCodes.find((code) => code) || null
          return [item.code, item.floor, item.gridRef || [item.gridX, item.gridY].filter(Boolean).join('-')]
            .filter(Boolean)
            .join(' · ')
        })
        .filter(Boolean)
        .join('، ') ||
      viewedRequest.itemCodes.filter(Boolean).join('، ') ||
      '—'
    : '—'
  const viewedGridLabel =
    viewedRequest?.gridFrom && viewedRequest.gridTo
      ? `${viewedRequest.gridFrom} – ${viewedRequest.gridTo}`
      : viewedRequest?.gridFrom || viewedRequest?.gridTo || '—'

  useEffect(() => {
    if (!viewedRequest || !isInspector) return
    if (!canEditRequest(viewedRequest.status)) return
    void markInspectorOpened(viewedRequest.id)
  }, [viewedRequest?.id, viewedRequest?.status, isInspector])

  return (
    <>
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SectionCard title={t.inspectionRequest} description={t.inspectionRequestHint}>
        <form onSubmit={(event) => void handleCreateRequest(event)} className="space-y-3 rounded-[10px] border border-slate-200 bg-slate-50/70 p-3">
          <div className="rounded-[10px] border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-2">
                <VoiceToTextButton
                  autoConfirm
                  mode="replace"
                  variant="default"
                  disabled={speechBusy}
                  onTranscript={(text) => void applySpeech(text)}
                />
                <Textarea
                  id="qc-typed-speech"
                  rows={8}
                  dir="rtl"
                  className="min-h-[160px] bg-white text-sm leading-6 text-slate-900 placeholder:text-slate-400"
                  value={typedSpeech}
                  onChange={(e) => setTypedSpeech(e.target.value)}
                  placeholder={t.typeRequestPlaceholder}
                />
                <Button type="button" size="sm" disabled={speechBusy || !typedSpeech.trim()} onClick={() => void applySpeech(typedSpeech)}>
                  {speechBusy ? t.saving : t.applyVoiceFields}
                </Button>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="qc-ai-text">{t.aiClassifiedText}</Label>
                <Textarea
                  id="qc-ai-text"
                  rows={8}
                  dir="rtl"
                  className="min-h-[160px] bg-white text-sm leading-6 text-slate-900 placeholder:text-slate-400"
                  value={voiceText}
                  onChange={(e) => applyAiText(e.target.value)}
                />
              </div>
            </div>
          </div>
          {parsedSpeech?.items.length ? (
            <div className="space-y-2 rounded-[10px] border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-900">
                {t.extractedItems} · {parsedSpeech.items.length}
              </p>
              <p className="text-[11px] text-slate-500">{t.extractedItemsHint}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {parsedSpeech.items.map((item, index) => (
                  <li key={`${item.floor ?? ''}-${item.topic ?? ''}-${index}`} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-900">
                      {index + 1}. {item.topic || (item.activityType ? qcActivityLabel(item.activityType, locale) : t.classifiedItem)}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-600">
                      {[
                        item.floor ? `${t.floor} ${item.floor}` : '',
                        item.elementType,
                        item.activityType ? qcActivityLabel(item.activityType, locale) : '',
                        item.gridFrom && item.gridTo ? `${item.gridFrom} تا ${item.gridTo}` : [item.gridX, item.gridY].filter(Boolean).join('-'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t.activityType}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as QcActivityType)}
              >
                {activitySelectOptions(locale)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-item-topic">{t.topic}</Label>
              <Input id="qc-item-topic" className="bg-white" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-item-element">{t.elementType}</Label>
              <Input id="qc-item-element" className="bg-white" value={elementType} onChange={(e) => setElementType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-item-floor">{t.floor}</Label>
              <Input id="qc-item-floor" className="bg-white" value={floor} onChange={(e) => setFloor(e.target.value)} list="qc-floors" />
              <datalist id="qc-floors">
                {floors.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-item-gx">{t.gridX}</Label>
              <Input id="qc-item-gx" className="bg-white" value={gridX} onChange={(e) => setGridX(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-item-gy">{t.gridY}</Label>
              <Input id="qc-item-gy" className="bg-white" value={gridY} onChange={(e) => setGridY(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <Button type="button" size="sm">
                {t.selectModeRange}
              </Button>
              <div className="space-y-1.5">
                <Label>{t.rangeFrom}</Label>
                <Input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-24 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label>{t.rangeTo}</Label>
                <Input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-24 bg-white" />
              </div>
            </div>
            <Link
              href="/dashboard/qc/drawings"
              onClick={() => {
                const draft = snapshotDraft()
                if (draft) writeQcRequestDraft(draft)
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              {t.selectDrawing}
              {selectedOfficeIds.length ? (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {selectedOfficeIds.length} {t.selectedDrawingCount}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="space-y-2 rounded-[10px] border border-slate-200 bg-slate-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                {t.markedDrawingsOnForm}
                {markedDrawings.length ? ` · ${markedDrawings.length}` : ''}
              </p>
              {markedDrawings.length ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-white text-slate-800"
                  onClick={() => void downloadAllMarked()}
                >
                  <Download className="ml-1 h-4 w-4" />
                  {t.downloadAllMarked}
                </Button>
              ) : null}
            </div>
            {markedDrawings.length ? (
              <div className="flex flex-wrap gap-3">
                {markedDrawings.map((row) => {
                  const isImage =
                    /^image\//.test(row.file.type) || /\.(png|jpe?g|webp|gif)$/i.test(row.file.name)
                  return (
                    <div key={row.id} className="w-28 space-y-1">
                      <button
                        type="button"
                        className="block rounded-[8px] text-right hover:ring-2 hover:ring-primary/40"
                        onClick={() => setPreviewMarkedId(row.id)}
                      >
                        {isImage ? (
                          <QcMarkedThumb src={row.url} title={row.title} />
                        ) : (
                          <div className="flex h-24 w-28 items-center justify-center rounded-[8px] border border-slate-200 bg-white">
                            <FileText className="h-5 w-5 text-slate-500" />
                          </div>
                        )}
                      </button>
                      <p className="truncate text-[10px] text-slate-600" title={row.title}>
                        {row.title}
                      </p>
                      <div className="flex flex-col items-start gap-0.5">
                        <button
                          type="button"
                          className="text-[10px] font-medium text-sky-800 hover:underline"
                          onClick={() => downloadOneMarked(row)}
                        >
                          {t.downloadDrawing}
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-sky-800 hover:underline"
                          onClick={() => void downloadAllMarked()}
                        >
                          {t.downloadAllMarked}
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-red-700 hover:underline"
                          onClick={() => void removeMarkedDrawing(row.id)}
                        >
                          {t.removeMarked}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">{t.noMarkedDrawingsOnForm}</p>
            )}
            <p className="text-[11px] text-slate-600">{t.markedDrawingsFormHint}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t.selectedItems}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {floorItems.map((item) => (
                <label key={item.id} className="flex items-start gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={selectedIds.includes(item.id)} onChange={() => toggleItem(item.id)} />
                  <span>
                    <span className="font-semibold">{item.code}</span>
                    <span className="block text-[11px] text-slate-500">
                      {[item.floor, item.gridRef || [item.gridX, item.gridY].filter(Boolean).join('-')].filter(Boolean).join(' · ') || item.disciplineKey}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy || (selectedIds.length === 0 && markedDrawings.length === 0 && !code.trim())}>
            {t.submitRequest}
          </Button>
        </form>

        <ModalOverlay
          open={Boolean(previewMarked)}
          onClose={() => setPreviewMarkedId(null)}
          title={previewMarked?.title || t.markedDrawingsOnForm}
          className="bg-white sm:max-w-5xl"
        >
          {previewMarked ? (
            <div className="space-y-3">
              <div className="overflow-auto rounded-[10px] border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewMarked.url}
                  alt={previewMarked.title}
                  className="mx-auto max-h-[75vh] w-full object-contain"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="bg-white text-slate-800" onClick={() => downloadOneMarked(previewMarked)}>
                  <Download className="ml-1 h-4 w-4" />
                  {t.downloadDrawing}
                </Button>
                <Button type="button" variant="outline" className="bg-white text-slate-800" onClick={() => void downloadAllMarked()}>
                  <Download className="ml-1 h-4 w-4" />
                  {t.downloadAllMarked}
                </Button>
              </div>
            </div>
          ) : null}
        </ModalOverlay>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{t.requestList}</p>
            {data.requests.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedRequestIds.length === data.requests.length && data.requests.length > 0}
                    onChange={toggleSelectAllRequests}
                  />
                  {t.selectAllRequests}
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-white text-red-700"
                  disabled={busy || selectedRequestIds.length === 0}
                  onClick={() => setPendingDeleteIds(selectedRequestIds)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t.deleteSelectedRequests}
                  {selectedRequestIds.length ? ` (${selectedRequestIds.length})` : ''}
                </Button>
              </div>
            ) : null}
          </div>
          {data.requests.length === 0 ? (
            <EmptyState title={t.inspectionRequest} description={t.noRequests} />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-[10px] border border-slate-200">
              {data.requests.map((row) => (
                <li key={row.id} className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    className="shrink-0"
                    checked={selectedRequestIds.includes(row.id)}
                    onChange={() => toggleRequestSelection(row.id)}
                    aria-label={t.deleteRequest}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-3 py-1 text-right hover:bg-slate-50"
                    onClick={() => setViewRequestId(row.id)}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-sky-50 text-sky-800">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {qcActivityLabel(row.activityType, locale)}
                        {row.floor ? ` · ${t.floor} ${row.floor}` : ''}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        <FormattedDate value={row.requestedAt} />
                        {row.drawings?.length ? ` · ${row.drawings.length} ${t.attachedDrawings}` : ''}
                        {row.itemCodes?.length ? ` · ${row.itemCodes.join('، ')}` : ''}
                      </span>
                    </span>
                    <Badge variant="outline" className={requestBadgeClass(row.status)}>
                      {t[REQUEST_LABEL[row.status]]}
                    </Badge>
                    <span className="text-xs font-medium text-slate-600">{t.viewRequest}</span>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={busy}
                    aria-label={t.deleteRequest}
                    onClick={() => setPendingDeleteIds([row.id])}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t.engineChecklist} description={t.engineChecklistHint}>
        {inspectRequest && checklist.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              {qcActivityLabel(inspectRequest.activityType, locale)}
              {inspectItem ? ` · ${inspectItem.code}` : ''}
            </p>
            <ul className="space-y-2">
              {checklist.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-slate-200 px-3 py-2">
                  <span className="text-sm">{row.prompt}</span>
                  <VerdictBadge t={t} verdict={row.verdict} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState title={t.engineChecklist} description={t.noChecklist} />
        )}
      </SectionCard>

      <SectionCard title={t.resultPhotos} description={t.resultPhotosHint}>
        {data.photos.length === 0 ? (
          <EmptyState title={t.resultPhotos} description={t.noPhotos} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.caption || photo.itemCode} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-sky-50 text-sky-800">
                    <Camera className="h-5 w-5" />
                  </div>
                )}
                <p className="px-2 py-1.5 text-[11px] text-slate-500">
                  {photo.itemCode}
                  {photo.caption ? ` · ${photo.caption}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t.engineNcr}>
        {data.ncrs.length === 0 ? (
          <EmptyState title={t.engineNcr} description={t.noEngineNcrs} />
        ) : (
          <div className="space-y-3">
            {data.ncrs.map((ncr) => {
              const tone = severityBadge(ncr.severity)
              return (
                <div key={ncr.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">
                      {ncr.ncrNumber} — {ncr.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ncr.itemCode} · {ncr.status === 'open' ? t.ncrOpenStatus : ncr.status === 'closed' ? t.ncrClosedStatus : ncr.status === 'waived' ? t.ncrWaived : ncr.status === 'pending_verify' ? t.ncrPendingVerify : t.ncrInProgressStatus} ·{' '}
                      <FormattedDate value={ncr.createdAt} />
                    </p>
                  </div>
                  <Badge variant={tone.variant} className={tone.className}>
                    {t[SEVERITY_LABEL[ncr.severity]]}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {viewedRequest ? (
        <ModalOverlay
          open
          onClose={() => {
            setViewRequestId(null)
            setEditingRequest(false)
            setDetailFiles([])
          }}
          title={t.requestDetails}
          className="sm:max-w-2xl bg-slate-100 text-slate-900"
        >
          <div className="space-y-4">
            {editingRequest && canEditViewed ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.activityType}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    value={editActivity}
                    onChange={(e) => setEditActivity(e.target.value as QcActivityType)}
                  >
                    {activitySelectOptions(locale)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.floor}</Label>
                  <Input className="bg-white" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.gridRange}</Label>
                  <div className="flex gap-2">
                    <Input className="bg-white" value={editGridFrom} onChange={(e) => setEditGridFrom(e.target.value)} placeholder={t.rangeFrom} />
                    <Input className="bg-white" value={editGridTo} onChange={(e) => setEditGridTo(e.target.value)} placeholder={t.rangeTo} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.sourceDrawing}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    value={editSourceId}
                    onChange={(e) => setEditSourceId(e.target.value)}
                  >
                    <option value="">{t.sourceDrawing}</option>
                    {data.officeDrawings.map((drawing) => (
                      <option key={drawing.id} value={drawing.id}>
                        {drawing.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t.selectedItems}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.items.map((item) => (
                      <label key={item.id} className="flex items-start gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={editItemIds.includes(item.id)}
                          onChange={() =>
                            setEditItemIds((current) =>
                              current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
                            )
                          }
                        />
                        <span>
                          <span className="font-semibold">{item.code}</span>
                          <span className="block text-[11px] text-slate-500">
                            {[item.floor, item.gridRef || [item.gridX, item.gridY].filter(Boolean).join('-')].filter(Boolean).join(' · ') || item.disciplineKey}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label={t.activityType} value={qcActivityLabel(viewedRequest.activityType, locale)} />
                <DetailField label={t.status} value={t[REQUEST_LABEL[viewedRequest.status]]} />
                <DetailField label={t.floor} value={viewedRequest.floor || '—'} />
                <DetailField label={t.gridRange} value={viewedGridLabel} />
                <DetailField label={t.requestedBy} value={viewedRequest.requestedByName || '—'} />
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">{t.requestDate}</p>
                  <p className="text-sm font-medium text-slate-900">
                    <FormattedDate value={viewedRequest.requestedAt} />
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">{t.sourceDrawing}</p>
                  <p className="text-sm font-medium text-slate-900">{viewedSourceTitle}</p>
                  {viewedRequest.sourceDrawingId ? (
                    <Button type="button" size="sm" variant="outline" className="mt-1 bg-white text-slate-800" onClick={() => void downloadOfficeDrawing(viewedRequest.sourceDrawingId!)}>
                      <Download className="h-4 w-4" />
                      {t.downloadDrawing}
                    </Button>
                  ) : null}
                </div>
                <DetailField label={t.selectedItems} value={viewedItemLabel} />
              </div>
            )}
            {!canEditViewed ? <p className="text-[11px] text-slate-500">{t.requestLockedAfterInspector}</p> : null}
            {viewedRequest.notes ? <DetailField label={t.requestNotes} value={viewedRequest.notes} /> : null}

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">{t.attachedDrawings}</p>
              {viewedDrawings.length === 0 ? (
                <p className="text-sm text-slate-600">{t.noAttachedFile}</p>
              ) : (
                <ul className="space-y-3">
                  {viewedDrawings.map((drawing) => {
                    const officeId = drawing.id.startsWith('office-')
                      ? drawing.id.slice('office-'.length)
                      : drawing.kind === 'office'
                        ? drawing.sourceDrawingId
                        : null
                    const previewable =
                      Boolean(drawing.url) &&
                      (/^image\//.test(drawing.contentType || '') ||
                        /\.(png|jpe?g|webp|gif)$/i.test(drawing.fileName))
                    return (
                      <li key={drawing.id} className="rounded-[10px] border border-slate-200 bg-white p-3">
                        <p className="mb-2 truncate text-sm font-semibold text-slate-900">{drawing.fileName}</p>
                        {previewable ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={drawing.url ?? ''}
                            alt={drawing.fileName}
                            className="mb-3 max-h-80 w-full rounded-[8px] border border-slate-100 object-contain bg-slate-50"
                          />
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-white text-slate-800"
                            onClick={() => {
                              if (drawing.url) {
                                window.open(drawing.url, '_blank', 'noopener,noreferrer')
                                return
                              }
                              if (officeId) {
                                void downloadOfficeDrawing(officeId)
                                return
                              }
                              if (!drawing.id.startsWith('local-')) void downloadRequestDrawing(drawing.id)
                            }}
                          >
                            <Download className="h-4 w-4" />
                            {previewable ? t.openFile : t.downloadFile}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {canEditViewed ? (
                <div className="space-y-2 rounded-[10px] border border-slate-200 bg-white p-3">
                  <Label className="text-slate-800">{t.markedDrawing}</Label>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,application/pdf,image/*"
                    multiple
                    className="bg-white text-slate-800 file:bg-slate-200 file:text-slate-800"
                    onChange={(e) => setDetailFiles(Array.from(e.target.files ?? []))}
                  />
                  <Button type="button" size="sm" disabled={busy || detailFiles.length === 0} onClick={() => void attachToViewedRequest()}>
                    {t.attachToRequest}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto">
              {editingRequest && canEditViewed ? (
                <>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingRequest(false)}>
                    {t.close}
                  </Button>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void saveRequestEdits()}>
                    {busy ? t.saving : t.saveRequestEdits}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canEditViewed || busy}
                  title={!canEditViewed ? t.requestLockedAfterInspector : undefined}
                  onClick={() => {
                    if (!canEditViewed) return
                    startEditRequest(viewedRequest)
                  }}
                >
                  {t.editText}
                </Button>
              )}
              {viewedRequest.status !== 'cancelled' && viewedRequest.status !== 'completed' && canEditViewed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void patchStatus(viewedRequest.id, 'cancelled')}
                >
                  {t.cancelRequest}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 bg-white text-red-700"
                disabled={busy}
                onClick={() => setPendingDeleteIds([viewedRequest.id])}
              >
                <Trash2 className="h-4 w-4" />
                {t.deleteRequest}
              </Button>
              {viewedRequest.status === 'draft' || viewedRequest.status === 'submitted' ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void patchStatus(viewedRequest.id, 'submitted')}
                >
                  {t.sendRequest}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => setViewRequestId(null)}>
                {t.close}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {inspectOpen && inspectItem ? (
        <ModalOverlay
          open={inspectOpen}
          onClose={() => setInspectOpen(false)}
          title={`${t.inspectItem} ${inspectItem.code}`}
          className="sm:max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {inspectItem.disciplineKey} / {inspectItem.topicKey}
              <span className="block text-[11px] text-slate-500">
                {[inspectItem.floor, inspectItem.gridRef || [inspectItem.gridX, inspectItem.gridY].filter(Boolean).join('-')]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </p>
            <div className="space-y-2">
              {checklist.map((row, index) => (
                <div key={row.id} className="rounded-[10px] border border-slate-200 p-3">
                  <p className="text-sm">{row.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(['pass', 'fail', 'na'] as QcVerdict[]).map((verdict) => (
                      <Button
                        key={verdict}
                        type="button"
                        size="sm"
                        variant={row.verdict === verdict ? 'default' : 'outline'}
                        onClick={() => {
                          const next = [...checklist]
                          next[index] = { ...row, verdict }
                          setChecklist(next)
                        }}
                      >
                        {verdict === 'pass' ? t.verdictPass : verdict === 'fail' ? t.verdictFail : t.verdictNa}
                      </Button>
                    ))}
                  </div>
                  {row.resultId ? (
                    <div className="mt-3 space-y-1.5">
                      <Label>{t.photoCaption}</Label>
                      <Input value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} />
                      <Label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <Upload className="h-4 w-4" />
                        {t.uploadPhoto}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void uploadPhoto(row.resultId!, e.target.files?.[0])}
                        />
                      </Label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setInspectOpen(false)}>
                {t.close}
              </Button>
              <Button type="button" disabled={busy} onClick={() => void saveChecklist()}>
                {busy ? t.saving : t.saveChecklist}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      <ModalOverlay
        open={Boolean(pendingDeleteIds?.length)}
        onClose={() => {
          if (!busy) setPendingDeleteIds(null)
        }}
        title={t.deleteRequest}
        className="sm:max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-900">
            {pendingDeleteIds?.length === 1
              ? t.deleteRequestConfirm
              : t.deleteRequestsConfirm.replace('{count}', String(pendingDeleteIds?.length ?? 0))}
          </p>
          <p className="text-[12px] text-slate-600">{t.deleteRequestsHint}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setPendingDeleteIds(null)}>
              {t.close}
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDeleteRequests()}>
              {busy ? t.saving : t.deleteRequest}
            </Button>
          </div>
        </div>
      </ModalOverlay>
    </>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function VerdictBadge({ t, verdict }: { t: QcMessages; verdict: QcVerdict | null }) {
  if (verdict === 'pass') {
    return <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50">{t.verdictPass}</Badge>
  }
  if (verdict === 'fail') {
    return <Badge variant="destructive">{t.verdictFail}</Badge>
  }
  if (verdict === 'na') {
    return <Badge variant="outline">{t.verdictNa}</Badge>
  }
  return <Badge variant="outline">—</Badge>
}
