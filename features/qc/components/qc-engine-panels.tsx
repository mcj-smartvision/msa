'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Camera, Check, ChevronLeft, Download, FileText, Maximize2, Pencil, Play, Trash2, Upload, XCircle } from 'lucide-react'
import { SectionCard, EmptyState } from '@/features/admin/components/shared'
import { ModalOverlay } from '@/shared/components/common/modal-overlay'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { QcDrawingMarkup, QC_INSPECTOR_PEN_COLOR, QC_SUPERVISOR_PEN_COLOR, type QcDrawingMarkupHandle } from '@/features/qc/components/qc-drawing-markup'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import type { QcMessages } from '@/shared/lib/i18n/qc'
import {
qcActivitiesByGroup,
qcActivityGroupLabel,
qcActivityLabel,
type QcActivityType,
} from '@/features/qc/engine/activity-types'
import { consumeQcSelectedDrawings, clearQcSelectedDrawings, initialQcCreateBlockUntil, isQcRequestCreateBlocked, qcRequestCreateBlockedUntil } from '@/features/qc/engine/drawing-discipline'
import { parseRequestSpeech, parseAiClassifiedText, formatSpeechSummary, mergeParsedSpeech, speechItemCode, type ParsedQcRequestSpeech } from '@/features/qc/engine/parse-request-speech'
import { clearPendingMarked, latestPendingBySource, loadPendingMarked, prunePendingMarked } from '@/features/qc/engine/pending-marked'
import { clearQcRequestDraft, readQcRequestDraft, writeQcRequestDraft, type QcRequestDraft } from '@/features/qc/engine/request-draft'
import {
hasQcNoteMarker,
inferApprovedAtFromRequest,
inferInspectorVerdictFromRequest,
inferLastRejectedAtFromRequest, appendQcNoteMarker,
QC_APPROVED_AT_MARKER,
QC_REJECTED_AT_MARKER,
QC_RESUBMIT_MARKER
} from '@/features/qc/engine/note-markers'
import {
DEFAULT_QC_REQUEST_PRIORITY,
parseQcRequestPriority,
type QcResultPhoto,
type QcChecklistRow,
type QcEngineDashboard,
type QcInspectionHistoryEvent,
type QcInspectionRequest,
type QcInspectorVerdict,
type QcNcrSeverity,
type QcNcrStatus,
type QcRequestDrawing,
type QcRequestPriority,
type QcRequestStatus,
type QcVerdict,
} from '@/features/qc/engine/types'
import { cn } from '@/shared/lib/utils'

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

function canSupervisorEditRequest(row: QcInspectionRequest) {
  return canEditRequest(row.status) || (row.status === 'completed' && effectiveInspectorVerdict(row) === 'rejected')
}

function isRejectedAwaitingResubmit(row: QcInspectionRequest) {
  return row.status === 'completed' && effectiveInspectorVerdict(row) === 'rejected'
}

type RequestItemDraft = {
  id: string
  code: string
  floor: string
  grid: string
}

function isLegacySampleItemCode(code: string) {
  const value = code.trim().toLowerCase()
  return value === 'n200' || value === 'c3-b04'
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

function waitingForInspector(status: QcRequestStatus) {
  return status === 'submitted' || status === 'scheduled' || status === 'in_progress'
}

function qcDrawingsPageHref(drawingsHref: string, requestId?: string | null) {
  if (!requestId) return drawingsHref
  const join = drawingsHref.includes('?') ? '&' : '?'
  return `${drawingsHref}${join}requestId=${encodeURIComponent(requestId)}`
}

function drawingKind(drawing: QcRequestDrawing): 'image' | 'pdf' | 'other' {
  const name = drawing.fileName.toLowerCase()
  const type = (drawing.contentType || '').toLowerCase()
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 'image'
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf'
  return 'other'
}

function requestDrawingRank(drawing: QcRequestDrawing) {
  const name = drawing.fileName.toLowerCase()
  const type = (drawing.contentType || '').toLowerCase()
  if (!drawing.fileName.trim()) return -1
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 3
  if (/-marked/i.test(name)) return 2
  if (drawing.url) return 1
  return -1
}

function uniqueRequestDrawings(drawings: QcRequestDrawing[]) {
  const latest = new Map<string, { drawing: QcRequestDrawing; rank: number }>()
  for (const drawing of drawings) {
    const rank = requestDrawingRank(drawing)
    if (rank < 0) continue
    const key = drawing.sourceDrawingId || drawing.id
    const existing = latest.get(key)
    if (!existing || rank > existing.rank) latest.set(key, { drawing, rank })
  }
  return [...latest.values()].map((item) => item.drawing)
}

function uniqueMarkedForSelection(rows: LocalMarkedDrawing[], selectedIds: string[]) {
  const allowed = [...new Set(selectedIds.filter(Boolean))]
  const latest = new Map<string, LocalMarkedDrawing>()
  for (const row of rows) {
    if (!row.sourceDrawingId || !allowed.includes(row.sourceDrawingId)) continue
    latest.set(row.sourceDrawingId, row)
  }
  return allowed.map((id) => latest.get(id)).filter((row): row is LocalMarkedDrawing => Boolean(row))
}

function inspectorWhisperPrompt() {
  return 'یادداشت بازرس کنترل کیفیت به فارسی. جمله‌های کامل و درست. کلمه‌هایی مثل عدم رعایت استاندارد، قابل قبول نیست، لطفاً اصلاح کنید، فاصله خاموت، قالب‌بندی، جوش، قبول، رد.'
}

function requestDrawingFileUrl(drawing: QcRequestDrawing, officeId?: string | null) {
  if (officeId) return `/api/technical-office/drawings/${encodeURIComponent(officeId)}/file`
  if (drawing.url && drawing.id.startsWith('local-')) return drawing.url
  return `/api/qc-engine/request-drawings/${encodeURIComponent(drawing.id)}/file`
}

function requestPriorityLabel(priority: QcRequestPriority, t: QcMessages) {
  if (priority === 'high') return t.urgencyHigh
  if (priority === 'low') return t.urgencyLow
  return t.urgencyMedium
}

function requestSendStatusLabel(
  row: { status: QcRequestStatus },
  t: QcMessages
) {
  if (row.status === 'draft') return t.requestNotSent
  if (row.status === 'cancelled') return t.requestCancelled
  return t.requestUnderInspection
}

function requestSendBadgeClass(status: QcRequestStatus) {
  if (status === 'draft') return 'bg-slate-100 text-slate-700 border-slate-200'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}

function inspectorAnswerBadgeClass(verdict: QcInspectorVerdict) {
  return verdict === 'approved'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : 'bg-red-50 text-red-800 border-red-200'
}

function requestStatusLabel(
  row: { status: QcRequestStatus; inspectorVerdict?: QcInspectorVerdict | null },
  t: QcMessages
) {
  if (row.inspectorVerdict === 'approved') return t.requestApprovedStatus
  if (row.inspectorVerdict === 'rejected') return t.requestRejectedStatus
  return t[REQUEST_LABEL[row.status]]
}

function severityBadge(severity: QcNcrSeverity) {
  if (severity === 'critical') return { variant: 'destructive' as const, className: '' }
  if (severity === 'major') return { variant: 'outline' as const, className: 'border-amber-300 bg-amber-50 text-amber-800' }
  return { variant: 'outline' as const, className: '' }
}

function engineNcrStatusLabel(status: QcNcrStatus, t: QcMessages) {
  if (status === 'open') return t.ncrOpenStatus
  if (status === 'closed') return t.ncrClosedStatus
  if (status === 'waived') return t.ncrWaived
  if (status === 'pending_verify') return t.ncrPendingVerify
  return t.ncrInAction
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDayKeyFromIso(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return localDayKey(date)
}

type InspectorListBadge = 'overdue' | 'today' | 'pending' | 'completed' | 'rejected' | 'reinspection'

const INSPECTOR_BADGE_SORT: Record<InspectorListBadge, number> = {
  overdue: 0,
  reinspection: 1,
  today: 2,
  pending: 3,
  completed: 4,
  rejected: 5,
}

function isReinspectionRequest(row: QcInspectionRequest) {
  if (row.reinspectCount > 0) return true
  if (hasQcNoteMarker(row.notes, QC_RESUBMIT_MARKER)) return true
  if (!waitingForInspector(row.status) || effectiveInspectorVerdict(row)) return false
  if (row.history.some((entry) => entry.eventType === 'resubmitted')) return true
  if (hasQcNoteMarker(row.notes, QC_REJECTED_AT_MARKER)) return true
  const createdMs = new Date(row.createdAt).getTime()
  const requestedMs = new Date(row.requestedAt).getTime()
  if (requestedMs - createdMs > 2 * 60 * 1000) {
    if (!row.firstSubmittedAt) return true
    const firstMs = new Date(row.firstSubmittedAt).getTime()
    return requestedMs - firstMs > 2 * 60 * 1000
  }
  return false
}

function verdictInferenceInput(row: QcInspectionRequest) {
  return {
    status: row.status,
    inspectorVerdict: row.inspectorVerdict,
    notes: row.notes,
    inspectorNotes: row.inspectorNotes,
    inspectorClassified: row.inspectorClassified,
    lastRejectedAt: row.lastRejectedAt,
    updatedAt: row.updatedAt,
    history: row.history,
  }
}

function effectiveInspectorVerdict(row: QcInspectionRequest): QcInspectorVerdict | null {
  return inferInspectorVerdictFromRequest(verdictInferenceInput(row))
}

function rejectedAtForRequest(row: QcInspectionRequest) {
  return inferLastRejectedAtFromRequest(verdictInferenceInput(row))
}

function approvedAtForRequest(row: QcInspectionRequest) {
  return inferApprovedAtFromRequest(verdictInferenceInput(row))
}

function inspectorDecisionAtForRequest(row: QcInspectionRequest) {
  const verdict = effectiveInspectorVerdict(row)
  if (!verdict) return null
  return verdict === 'rejected' ? rejectedAtForRequest(row) : approvedAtForRequest(row)
}

function supervisorVerdictShortLabel(verdict: QcInspectorVerdict, t: QcMessages) {
  return verdict === 'approved' ? t.inspectorListApproved : t.inspectorListRejected
}

function formatInspectorTime(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(locale.startsWith('fa') ? 'fa-IR' : undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const QC_WORKLIST_COL_NUMBER = 'w-[8%] whitespace-nowrap px-3 py-2.5 text-right'
const QC_WORKLIST_COL_TITLE = 'w-[30%] px-3 py-2.5 text-right'
const QC_WORKLIST_COL_URGENCY = 'w-[15%] whitespace-nowrap px-3 py-2.5 text-center'
const QC_WORKLIST_COL_DATETIME = 'w-[15%] whitespace-nowrap px-3 py-2.5 text-center'
const QC_WORKLIST_COL_STATUS = 'w-[15%] px-3 py-2.5 text-center'
const QC_WORKLIST_COL_ACTION = 'w-[15%] whitespace-nowrap px-3 py-2.5 text-center'
const QC_WORKLIST_COL_CHECKBOX = 'w-[2%] px-2 py-2.5'

function QcWorklistTableHeader({ t, leadingHead }: { t: QcMessages; leadingHead?: ReactNode }) {
  return (
    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
      {leadingHead}
      <th className={QC_WORKLIST_COL_NUMBER}>{t.requestNumberLabel}</th>
      <th className={QC_WORKLIST_COL_TITLE}>{t.inspectionRequest}</th>
      <th className={QC_WORKLIST_COL_URGENCY}>{t.inspectionUrgency}</th>
      <th className={QC_WORKLIST_COL_DATETIME}>{t.requestDateTime}</th>
      <th className={QC_WORKLIST_COL_STATUS}>{t.status}</th>
      <th className={QC_WORKLIST_COL_ACTION} aria-hidden />
    </tr>
  )
}

function QcWorklistTableShell({
  t,
  leadingHead,
  children,
}: {
  t: QcMessages
  leadingHead?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-slate-200">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <QcWorklistTableHeader t={t} leadingHead={leadingHead} />
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

function inspectorListBadge(row: QcInspectionRequest): InspectorListBadge {
  const verdict = effectiveInspectorVerdict(row)
  if (verdict === 'rejected') return 'rejected'
  if (verdict === 'approved') return 'completed'
  if (row.status === 'completed') return 'completed'
  if (waitingForInspector(row.status) && !verdict && isReinspectionRequest(row)) return 'reinspection'
  if (waitingForInspector(row.status) && !verdict) {
    const day = localDayKeyFromIso(row.requestedAt)
    const today = localDayKey()
    if (day && day < today) return 'overdue'
    if (day && day === today) return 'today'
    return 'pending'
  }
  return 'pending'
}

function inspectorBadgeLabel(kind: InspectorListBadge, t: QcMessages) {
  if (kind === 'overdue') return t.overdue
  if (kind === 'today') return t.dueToday
  if (kind === 'reinspection') return t.reinspectRequest
  if (kind === 'completed') return t.inspectorListApproved
  if (kind === 'rejected') return t.inspectorListRejected
  return t.pendingShort
}

function inspectorBadgeClass(kind: InspectorListBadge) {
  if (kind === 'overdue') return 'border-rose-200 bg-rose-100 text-rose-800'
  if (kind === 'today') return 'border-orange-200 bg-orange-100 text-orange-800'
  if (kind === 'reinspection') return 'border-red-200 bg-red-50 text-red-800'
  if (kind === 'completed') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (kind === 'rejected') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function historyEventLabel(eventType: QcInspectionHistoryEvent, t: QcMessages) {
  if (eventType === 'submitted') return t.historySubmitted
  if (eventType === 'rejected') return t.historyRejected
  if (eventType === 'resubmitted') return t.historyResubmitted
  return t.historyApproved
}

function historyEventBadgeClass(eventType: QcInspectionHistoryEvent) {
  if (eventType === 'rejected') return 'border-red-200 bg-red-50 text-red-800'
  if (eventType === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (eventType === 'resubmitted') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function inspectorFloorLabel(floor: string | null | undefined, t: QcMessages) {
  const value = floor?.trim()
  return value ? `${t.floor} ${value}` : ''
}

function formatPassRate(value: number, locale: string) {
  return locale.startsWith('fa') ? `%${value}` : `${value}%`
}

function InspectorKpiCard({
  value,
  label,
  valueClassName,
}: {
  value: string
  label: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-center shadow-card">
      <p className={cn('text-3xl font-bold tracking-tight', valueClassName || 'text-slate-900')}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  )
}

function QcMediaPreview({
  photo,
  alt,
  className,
  thumbnail = false,
}: {
  photo: QcResultPhoto
  alt: string
  className?: string
  thumbnail?: boolean
}) {
  if (!photo.url) {
    return (
      <div className={cn('flex h-28 items-center justify-center bg-sky-50 text-sky-800', className)}>
        <Camera className="h-5 w-5" />
      </div>
    )
  }
  if (photo.mediaKind === 'video') {
    return (
      <div className={cn('relative h-28 w-full bg-black', className)}>
        <video
          src={photo.url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          controls={!thumbnail}
        />
        {thumbnail ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className="h-8 w-8 fill-white text-white" />
          </div>
        ) : null}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo.url} alt={alt} className={cn('h-28 w-full object-cover', className)} />
  )
}

type PendingInspectorMedia = {
  id: string
  url: string
  mediaKind: 'image' | 'video'
  caption: string | null
}

function fileMediaKind(file: File): 'image' | 'video' {
  if (file.type.startsWith('video/')) return 'video'
  if (/\.(mp4|webm|mov|m4v|avi)$/i.test(file.name)) return 'video'
  return 'image'
}

function inspectorVerdictFromText(text: string): 'approved' | 'rejected' | null {
  if (/رد(?:\s*شد)?|قابل\s*قبول\s*نیست|عدم\s*قبول/i.test(text)) return 'rejected'
  if (/تأیید|تایید|قبول\s*شد/i.test(text)) return 'approved'
  return null
}

export function QcEnginePanels({
  projectId,
  t,
  isInspector = false,
  showResults = true,
  showRequestForm = false,
  drawingsHref = '/dashboard/qc/drawings',
}: {
  projectId: string
  t: QcMessages
  isInspector?: boolean
  showResults?: boolean
  showRequestForm?: boolean
  drawingsHref?: string
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
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [inspectionUrgency, setInspectionUrgency] = useState<QcRequestPriority>(DEFAULT_QC_REQUEST_PRIORITY)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([])
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)
  const [sourceDrawingId, setSourceDrawingId] = useState('')
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([])
  const [markedDrawings, setMarkedDrawings] = useState<LocalMarkedDrawing[]>([])
  const [previewDrawing, setPreviewDrawing] = useState<QcRequestDrawing | null>(null)
  const [expandedInlineDrawingId, setExpandedInlineDrawingId] = useState<string | null>(null)
  const [inlineDrawingUrls, setInlineDrawingUrls] = useState<Record<string, string>>({})
  const [markupDrawing, setMarkupDrawing] = useState<QcRequestDrawing | null>(null)
  const [markupOfficeId, setMarkupOfficeId] = useState<string | null>(null)
  const inspectorMarkupRef = useRef<QcDrawingMarkupHandle>(null)
  const [markupSaving, setMarkupSaving] = useState(false)
  const [inspectorSpeech, setInspectorSpeech] = useState('')
  const [inspectorClassified, setInspectorClassified] = useState('')
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
  const [editNotes, setEditNotes] = useState('')
  const [editItems, setEditItems] = useState<RequestItemDraft[]>([])
  const [detailFiles, setDetailFiles] = useState<File[]>([])
  const [checklist, setChecklist] = useState<QcChecklistRow[]>([])
  const [photoCaption, setPhotoCaption] = useState('')
  const [inspectorMediaCaption, setInspectorMediaCaption] = useState('')
  const [inspectorPendingMedia, setInspectorPendingMedia] = useState<PendingInspectorMedia[]>([])
  const [inspectorClassifyBusy, setInspectorClassifyBusy] = useState(false)
  const [mediaUploadBusy, setMediaUploadBusy] = useState(false)
  const inspectorOpened = useRef<Set<string>>(new Set())
  const markedDrawingsRef = useRef<LocalMarkedDrawing[]>([])
  const markedHydrateGen = useRef(0)
  const suppressCreateUntilRef = useRef(initialQcCreateBlockUntil())
  const submitPointerRef = useRef(false)
  const [createBlockedUntil, setCreateBlockedUntil] = useState(initialQcCreateBlockUntil)
  const drawingsConfirmedRef = useRef(false)
  const selectedOfficeIdsRef = useRef<string[]>([])
  markedDrawingsRef.current = markedDrawings
  selectedOfficeIdsRef.current = selectedOfficeIds

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
    setSelectedIds((current) => {
      const valid = new Set(next.items.map((item) => item.id))
      const filtered = current.filter((id) => valid.has(id) && !isLegacySampleItemCode(next.items.find((item) => item.id === id)?.code || ''))
      return filtered.length === current.length ? current : filtered
    })
    return next.requests
  }, [projectId, t.engineError])

  useLayoutEffect(() => {
    const until = initialQcCreateBlockUntil()
    suppressCreateUntilRef.current = Math.max(suppressCreateUntilRef.current, until)
    setCreateBlockedUntil((current) => Math.max(current, until))
  }, [])

  useEffect(() => {
    const until = Math.max(createBlockedUntil, qcRequestCreateBlockedUntil(), suppressCreateUntilRef.current)
    const remaining = until - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setCreateBlockedUntil(0), remaining + 50)
    return () => window.clearTimeout(timer)
  }, [createBlockedUntil])

  useEffect(() => {
    void load()
  }, [load])

  const hydrateMarkedDrawings = useCallback(async () => {
    if (!projectId) return
    const gen = ++markedHydrateGen.current
    const pending = await loadPendingMarked(projectId)
    if (gen !== markedHydrateGen.current) return
    const allowed = selectedOfficeIdsRef.current
    const rows = latestPendingBySource(
      allowed.length ? pending.filter((row) => allowed.includes(row.sourceDrawingId)) : []
    )
    setMarkedDrawings((current) => {
      current.forEach((row) => URL.revokeObjectURL(row.url))
      return rows.map((row) => ({
        id: row.id,
        file: new File([row.blob], row.fileName, { type: row.mimeType || 'image/png' }),
        url: URL.createObjectURL(row.blob),
        title: row.sourceTitle || row.fileName,
        sourceDrawingId: row.sourceDrawingId,
      }))
    })
    if (rows[0]?.sourceDrawingId) setSourceDrawingId((current) => current || rows[0].sourceDrawingId)
  }, [projectId])

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
      setInspectionUrgency(parseQcRequestPriority(draft.priority))
      setSelectedIds(draft.selectedIds)
      setSourceDrawingId(draft.sourceDrawingId)
      setVoiceText(draft.voiceText)
      setTypedSpeech(draft.typedSpeech)
      if (draft.voiceText.trim()) setParsedSpeech(parseAiClassifiedText(draft.voiceText))
      else if (draft.typedSpeech.trim()) setParsedSpeech(parseRequestSpeech(draft.typedSpeech))
    }
    const confirmedIds = consumeQcSelectedDrawings(projectId)
    let allowed: string[] = []
    if (confirmedIds && confirmedIds.length) {
      drawingsConfirmedRef.current = true
      allowed = [...new Set(confirmedIds)]
      setSelectedOfficeIds(allowed)
      if (allowed[0]) setSourceDrawingId(allowed[0])
    } else if (draft?.selectedDrawingsConfirmed && draft.selectedOfficeIds.length) {
      drawingsConfirmedRef.current = true
      allowed = [...new Set(draft.selectedOfficeIds)]
      setSelectedOfficeIds(allowed)
      if (allowed[0]) setSourceDrawingId((current) => current || allowed[0])
    } else {
      drawingsConfirmedRef.current = false
      setSelectedOfficeIds([])
      if (!draft?.selectedDrawingsConfirmed) setSourceDrawingId('')
      clearQcSelectedDrawings()
    }
    selectedOfficeIdsRef.current = allowed
    setDraftReady(true)
    if (confirmedIds) {
      const until = Date.now() + 1500
      suppressCreateUntilRef.current = Math.max(suppressCreateUntilRef.current, until)
      setCreateBlockedUntil((current) => Math.max(current, until))
    }
    void (async () => {
      if (allowed.length) await prunePendingMarked(projectId, allowed)
      else await clearPendingMarked(projectId)
      await hydrateMarkedDrawings()
    })()
  }, [hydrateMarkedDrawings, projectId])

  useEffect(() => {
    if (!draftReady) return
    void hydrateMarkedDrawings()
    const blockAccidentalCreate = () => {
      const until = Date.now() + 1500
      suppressCreateUntilRef.current = Math.max(suppressCreateUntilRef.current, until)
      setCreateBlockedUntil((current) => Math.max(current, until))
      void hydrateMarkedDrawings()
    }
    window.addEventListener('pageshow', blockAccidentalCreate)
    return () => window.removeEventListener('pageshow', blockAccidentalCreate)
  }, [draftReady, hydrateMarkedDrawings, selectedOfficeIds])

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
      priority: inspectionUrgency,
      selectedOfficeIds,
      selectedDrawingsConfirmed: drawingsConfirmedRef.current && selectedOfficeIds.length > 0,
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
        draft.selectedDrawingsConfirmed && draft.selectedOfficeIds.length ||
        draft.sourceDrawingId
    )
    if (!hasContent) {
      clearQcRequestDraft(projectId)
      clearQcSelectedDrawings()
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
    selectedOfficeIds,
    sourceDrawingId,
    voiceText,
    typedSpeech,
    inspectionUrgency,
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

  const inspectorRows = useMemo(() => {
    const activeRequests = data.requests
      .filter((request) => request.status !== 'draft' && request.status !== 'cancelled')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const numberById = new Map<string, number>()
    activeRequests.forEach((request, index) => numberById.set(request.id, index + 1))

    const rows = activeRequests.map((request) => {
      const badge = inspectorListBadge(request)
      const verdict = effectiveInspectorVerdict(request)
      const itemCodes = request.itemIds.flatMap((id, index) => {
        const item = data.items.find((entry) => entry.id === id)
        const itemCode = item?.code || request.itemCodes[index] || ''
        if (!itemCode || isLegacySampleItemCode(itemCode)) return []
        return [itemCode]
      })
      const itemTitle =
        itemCodes.length > 0 ? itemCodes.join(' — ') : qcActivityLabel(request.activityType, locale)
      const displayTitle = request.floor
        ? `${itemTitle} - ${t.floor} ${request.floor}`
        : itemTitle
      return {
        key: request.id,
        requestId: request.id,
        requestNumber: numberById.get(request.id) ?? 0,
        title: itemTitle,
        displayTitle,
        floorLabel: inspectorFloorLabel(request.floor, t),
        badge,
        isReinspection: isReinspectionRequest(request),
        enteredAt: isReinspectionRequest(request) ? request.requestedAt : request.createdAt,
        rejectedAt: rejectedAtForRequest(request),
        decisionAt: verdict ? inspectorDecisionAtForRequest(request) : null,
        reinspectCount: request.reinspectCount,
        priority: request.priority,
        requestedAt: request.requestedAt,
      }
    })

    rows.sort(
      (a, b) =>
        INSPECTOR_BADGE_SORT[a.badge] - INSPECTOR_BADGE_SORT[b.badge] || a.requestedAt.localeCompare(b.requestedAt)
    )
    return rows
  }, [data.items, data.requests, locale, t])

  const inspectorListRows = useMemo(
    () => [...inspectorRows].sort((a, b) => a.requestNumber - b.requestNumber),
    [inspectorRows]
  )

  const inspectorKpis = useMemo(() => {
    const pendingRows = inspectorRows.filter(
      (row) =>
        row.badge === 'overdue' ||
        row.badge === 'today' ||
        row.badge === 'pending' ||
        row.badge === 'reinspection'
    )
    const overdue = inspectorRows.filter((row) => row.badge === 'overdue').length
    const openNcrs = data.ncrs.filter(
      (ncr) => ncr.status === 'open' || ncr.status === 'in_progress' || ncr.status === 'pending_verify'
    ).length
    const decided = data.requests.filter((row) => {
      const verdict = effectiveInspectorVerdict(row)
      return row.status === 'completed' && (verdict === 'approved' || verdict === 'rejected')
    })
    const approved = decided.filter((row) => effectiveInspectorVerdict(row) === 'approved').length
    const passRate = decided.length ? Math.round((approved / decided.length) * 100) : 0
    return {
      pending: pendingRows.length,
      openNcrs,
      passRate,
      overdue,
    }
  }, [data.ncrs, data.requests, inspectorRows])

  const inspectorNcrs = useMemo(() => {
    const order: Record<QcNcrStatus, number> = {
      open: 0,
      in_progress: 1,
      pending_verify: 2,
      closed: 3,
      waived: 4,
    }
    return [...data.ncrs].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt))
  }, [data.ncrs])

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

  async function handleCreateRequest(event?: React.FormEvent) {
    event?.preventDefault()
    if (Date.now() < suppressCreateUntilRef.current || isQcRequestCreateBlocked() || Date.now() < createBlockedUntil) {
      return
    }
    if (busy) return
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
    body.set('priority', inspectionUrgency)
    const baseDrawingId = sourceDrawingId || selectedOfficeIds[0] || ''
    if (baseDrawingId) body.set('sourceDrawingId', baseDrawingId)
    if (selectedOfficeIds.length) body.set('selectedDrawingIds', selectedOfficeIds.join(','))
    const notes = [typedSpeech.trim(), voiceText.trim()].filter((value, index, rows) => value && rows.indexOf(value) === index).join('\n\n')
    if (notes) body.set('notes', notes)
    const drawingsToAttach = uniqueMarkedForSelection(markedDrawings, selectedOfficeIds)
    for (const row of drawingsToAttach) {
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
      createdAt: new Date().toISOString(),
      status: 'draft',
      notes: notes || null,
      floor: floor || null,
      gridFrom: rangeFrom || null,
      gridTo: rangeTo || null,
      sourceDrawingId: baseDrawingId || null,
      sourceDrawingTitle: sourceTitle,
      requestedByName: null,
      itemIds,
      itemCodes: itemIds.map((id) => data.items.find((item) => item.id === id)?.code ?? (code || id)),
      inspectorVerdict: null,
      inspectorNotes: null,
      inspectorClassified: null,
      priority: inspectionUrgency,
      firstSubmittedAt: null,
      lastRejectedAt: null,
      reinspectCount: 0,
      history: [],
      updatedAt: new Date().toISOString(),
      drawings: drawingsToAttach.map((row, index) => ({
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
    setSelectedOfficeIds([])
    drawingsConfirmedRef.current = false
    setMarkedDrawings([])
    await clearPendingMarked(projectId)
    clearQcRequestDraft(projectId)
    clearQcSelectedDrawings()
    setSourceDrawingId('')
    setCode('')
    setDiscipline('')
    setTopic('')
    setElementType('')
    setFloor('')
    setGridX('')
    setGridY('')
    setRangeFrom('')
    setRangeTo('')
    setVoiceText('')
    setTypedSpeech('')
    setParsedSpeech(null)
    setInspectionUrgency(DEFAULT_QC_REQUEST_PRIORITY)
    setMessage(json.warning ? `${t.requestSavedSendHint} ${json.warning}` : t.requestSavedSendHint)
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
    setMessage(t.drawingAttached)
    await load()
  }

  async function removeViewedDrawing(drawing: QcRequestDrawing) {
    if (!viewRequestId || drawing.id.startsWith('local-') || drawing.id.startsWith('office-')) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/qc-engine/request-drawings/${encodeURIComponent(drawing.id)}`, { method: 'DELETE' })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setMessage(t.drawingRemoved)
    await load()
  }

  function startEditRequest(row: QcInspectionRequest) {
    setEditActivity((row.activityType as QcActivityType) || 'rebar')
    setEditFloor(row.floor || '')
    setEditGridFrom(row.gridFrom || '')
    setEditGridTo(row.gridTo || '')
    setEditSourceId(row.sourceDrawingId || '')
    setEditNotes(row.notes || '')
    setEditItems(
      row.itemIds.flatMap((id, index) => {
        const item = data.items.find((entry) => entry.id === id)
        const code = item?.code || row.itemCodes[index] || ''
        if (isLegacySampleItemCode(code)) return []
        return [
          {
            id,
            code,
            floor: item?.floor || '',
            grid: item ? item.gridRef || [item.gridX, item.gridY].filter(Boolean).join('-') : '',
          },
        ]
      })
    )
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
        notes: editNotes,
        itemIds: editItems.map((item) => item.id),
        itemUpdates: editItems.map((item) => ({ id: item.id, code: item.code, floor: item.floor })),
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
    setError(null)
    const res = await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, requestId, status }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return false
    }
    await load()
    return true
  }

  async function sendForInspection(requestId: string) {
    const row = data.requests.find((item) => item.id === requestId)
    if (!row || (row.status !== 'draft' && row.status !== 'submitted')) return
    if (row.status === 'draft') {
      const ok = await patchStatus(requestId, 'submitted')
      if (!ok) return
    }
    setEditingRequest(false)
    setViewRequestId(null)
    setMessage(t.requestSentForInspection)
    if (row.status !== 'draft') await load()
  }

  async function resubmitRejectedRequest() {
    if (!viewRequestId || !viewedRequest || !isRejectedAwaitingResubmit(viewedRequest)) return
    setBusy(true)
    setError(null)
    const payload: Record<string, unknown> = {
      projectId,
      requestId: viewRequestId,
      resubmitRejected: true,
    }
    if (editingRequest) {
      payload.activityType = editActivity
      payload.floor = editFloor
      payload.gridFrom = editGridFrom
      payload.gridTo = editGridTo
      payload.sourceDrawingId = editSourceId
      payload.notes = editNotes
      payload.itemIds = editItems.map((item) => item.id)
      payload.itemUpdates = editItems.map((item) => ({ id: item.id, code: item.code, floor: item.floor }))
    }
    const res = await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setEditingRequest(false)
    setViewRequestId(null)
    setMessage(t.requestResubmittedForInspection)
    await load()
  }

  async function classifyInspectorNotes(sourceText?: string) {
    const text = (sourceText ?? inspectorSpeech).trim()
    if (!text) return
    setInspectorClassifyBusy(true)
    let parsed = parseRequestSpeech(text)
    try {
      const res = await fetch('/api/qc-engine/parse-request-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = (await res.json().catch(() => ({}))) as ParsedQcRequestSpeech & { error?: string }
      if (res.ok) parsed = mergeParsedSpeech(parsed, json)
    } catch {
      /* local parse is enough */
    }
    const verdict = inspectorVerdictFromText(text)
    let summary = formatSpeechSummary(parsed)
    if (verdict) {
      const verdictLine = verdict === 'rejected' ? 'نتیجه: رد' : 'نتیجه: تأیید'
      summary = summary ? `${verdictLine}\n${summary}` : verdictLine
    }
    if (summary) setInspectorClassified(summary)
    setInspectorClassifyBusy(false)
  }

  async function saveInspectorReportDraft() {
    if (!viewRequestId || !canInspectViewed) return
    if (inspectorSpeech.trim() && !inspectorClassified.trim()) {
      await classifyInspectorNotes()
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        requestId: viewRequestId,
        inspectorSaveReport: true,
        notes: inspectorSpeech,
        classified: inspectorClassified,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setMessage(t.inspectorReportSaved)
    await load()
  }

  async function uploadInspectorMediaFiles(files: File[]) {
    if (!viewRequestId || files.length === 0) return
    const caption = inspectorMediaCaption.trim() || null
    const pending = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      mediaKind: fileMediaKind(file),
      caption,
    }))
    setInspectorPendingMedia((current) => [...current, ...pending])
    setMediaUploadBusy(true)
    setError(null)
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const pendingId = pending[index].id
      const body = new FormData()
      body.set('requestId', viewRequestId)
      body.set('caption', inspectorMediaCaption)
      body.set('file', file)
      const res = await fetch('/api/qc-engine/photos', { method: 'POST', body })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        setMediaUploadBusy(false)
        setError(json.error || t.engineError)
        return
      }
      URL.revokeObjectURL(pending[index].url)
      setInspectorPendingMedia((current) => current.filter((row) => row.id !== pendingId))
    }
    setMediaUploadBusy(false)
    setInspectorMediaCaption('')
    setMessage(t.inspectorMediaUploaded)
    await load()
  }

  function revokePendingMedia(rows: PendingInspectorMedia[]) {
    rows.forEach((row) => URL.revokeObjectURL(row.url))
  }

  async function submitInspectorDecision(verdict: QcInspectorVerdict) {
    if (!viewRequestId) return
    if (inspectorSpeech.trim() && !inspectorClassified.trim()) {
      await classifyInspectorNotes()
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/qc-engine/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        requestId: viewRequestId,
        inspectorDecision: verdict,
        notes: inspectorSpeech,
        classified: inspectorClassified,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(json.error || t.engineError)
      return
    }
    setMessage(verdict === 'approved' ? t.requestApproved : t.requestRejected)
    const decisionNow = new Date().toISOString()
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((row) =>
        row.id === viewRequestId
          ? {
              ...row,
              status: 'completed',
              inspectorVerdict: verdict,
              inspectorNotes: inspectorSpeech.trim() || row.inspectorNotes,
              inspectorClassified: inspectorClassified.trim() || row.inspectorClassified,
              lastRejectedAt: verdict === 'rejected' ? decisionNow : row.lastRejectedAt,
              notes: appendQcNoteMarker(
                row.notes,
                verdict === 'approved' ? QC_APPROVED_AT_MARKER : QC_REJECTED_AT_MARKER,
                decisionNow
              ),
            }
          : row
      ),
    }))
    setViewRequestId(null)
    await load()
  }

  function appendInspectorNote(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const next = inspectorSpeech.trim() ? `${inspectorSpeech.trim()}\n${trimmed}` : trimmed
    setInspectorSpeech(next)
    void classifyInspectorNotes(next)
  }

  function drawingOfficeId(drawing: QcRequestDrawing) {
    if (drawing.id.startsWith('office-')) return drawing.id.slice('office-'.length)
    if (drawing.kind === 'office') return drawing.sourceDrawingId
    return null
  }

  function openDrawingMarkup(drawing: QcRequestDrawing, officeId?: string | null) {
    setError(null)
    setMarkupOfficeId(officeId ?? drawingOfficeId(drawing))
    setMarkupDrawing(drawing)
  }

  async function saveInspectorMarkup() {
    if (!viewRequestId || !markupDrawing || !inspectorMarkupRef.current?.canExport()) return
    setMarkupSaving(true)
    setError(null)
    try {
      const file = await inspectorMarkupRef.current.exportPng()
      const body = new FormData()
      body.set('projectId', projectId)
      body.set('requestId', viewRequestId)
      body.set('inspectorMarkup', '1')
      if (markupDrawing.sourceDrawingId) body.set('sourceDrawingId', markupDrawing.sourceDrawingId)
      else if (markupOfficeId) body.set('sourceDrawingId', markupOfficeId)
      body.append('file', file)
      body.append('fileSourceId', markupDrawing.sourceDrawingId || markupOfficeId || '')
      const res = await fetch('/api/qc-engine/requests', { method: 'POST', body })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(json.error || t.engineError)
        return
      }
      setMessage(t.inspectorMarkupSaved)
      setMarkupDrawing(null)
      setMarkupOfficeId(null)
      await load()
    } catch (error) {
      setError(error instanceof Error ? error.message : t.engineError)
    } finally {
      setMarkupSaving(false)
    }
  }

  async function resolveDrawingUrl(drawing: QcRequestDrawing, officeId?: string | null): Promise<string | null> {
    if (drawing.url) return drawing.url
    const cached = inlineDrawingUrls[drawing.id]
    if (cached) return cached
    if (officeId) {
      const res = await fetch(`/api/technical-office/drawings/${encodeURIComponent(officeId)}`)
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setError(json.error || t.engineError)
        return null
      }
      setInlineDrawingUrls((current) => ({ ...current, [drawing.id]: json.url! }))
      return json.url
    }
    if (drawing.id.startsWith('local-')) return drawing.url ?? null
    const res = await fetch(`/api/qc-engine/request-drawings/${encodeURIComponent(drawing.id)}`)
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok || !json.url) {
      setError(json.error || t.engineError)
      return null
    }
    setInlineDrawingUrls((current) => ({ ...current, [drawing.id]: json.url! }))
    return json.url
  }

  async function toggleInlineDrawingPreview(drawing: QcRequestDrawing, officeId?: string | null) {
    setError(null)
    if (expandedInlineDrawingId === drawing.id) {
      setExpandedInlineDrawingId(null)
      return
    }
    const url = await resolveDrawingUrl(drawing, officeId)
    if (!url && drawingKind(drawing) !== 'pdf') return
    setExpandedInlineDrawingId(drawing.id)
  }

  async function openDrawingViewer(drawing: QcRequestDrawing, officeId?: string | null) {
    setError(null)
    const url = await resolveDrawingUrl(drawing, officeId)
    if (!url) {
      if (drawing.id.startsWith('local-')) setPreviewDrawing(drawing)
      return
    }
    setPreviewDrawing({ ...drawing, url, fileName: drawing.fileName })
  }

  async function downloadDrawing(drawing: QcRequestDrawing, officeId?: string | null) {
    if (officeId) {
      await downloadOfficeDrawing(officeId)
      return
    }
    if (drawing.url) {
      const a = document.createElement('a')
      a.href = drawing.url
      a.download = drawing.fileName || 'drawing'
      a.target = '_blank'
      a.rel = 'noreferrer'
      a.click()
      return
    }
    if (!drawing.id.startsWith('local-')) await downloadRequestDrawing(drawing.id)
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
  const supervisorRequestNumbers = useMemo(() => {
    const sorted = [...data.requests].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const map = new Map<string, number>()
    sorted.forEach((request, index) => map.set(request.id, index + 1))
    return map
  }, [data.requests])

  const supervisorRequestList = useMemo(
    () => [...data.requests].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data.requests]
  )

  const viewedRequest = data.requests.find((row) => row.id === viewRequestId) ?? null
  const viewedDrawings = uniqueRequestDrawings(viewedRequest?.drawings ?? [])
  const sourceAlreadyAttached = viewedDrawings.some(
    (drawing) => drawing.sourceDrawingId && drawing.sourceDrawingId === viewedRequest?.sourceDrawingId
  )
  const canEditViewed = viewedRequest ? canSupervisorEditRequest(viewedRequest) : false
  const rejectedAwaitingResubmit = viewedRequest ? isRejectedAwaitingResubmit(viewedRequest) : false
  const viewedSourceTitle =
    viewedRequest?.sourceDrawingTitle ||
    data.officeDrawings.find((drawing) => drawing.id === viewedRequest?.sourceDrawingId)?.title ||
    '—'
  const viewedGridLabel =
    viewedRequest?.gridFrom && viewedRequest.gridTo
      ? `${viewedRequest.gridFrom} – ${viewedRequest.gridTo}`
      : viewedRequest?.gridFrom || viewedRequest?.gridTo || '—'
  const canInspectViewed =
    Boolean(isInspector && viewedRequest && waitingForInspector(viewedRequest.status) && !viewedRequest.inspectorVerdict)

  const viewedRequestPhotos = useMemo(() => {
    if (!viewedRequest) return []
    return data.photos.filter((photo) => photo.requestId === viewedRequest.id)
  }, [data.photos, viewedRequest?.id])

  useEffect(() => {
    if (!viewedRequest || !isInspector) return
    if (!waitingForInspector(viewedRequest.status)) return
    void markInspectorOpened(viewedRequest.id)
  }, [viewedRequest?.id, viewedRequest?.status, isInspector])

  useEffect(() => {
    if (!viewedRequest) {
      setInspectorSpeech('')
      setInspectorClassified('')
      setInspectorPendingMedia((current) => {
        revokePendingMedia(current)
        return []
      })
      return
    }
    setInspectorSpeech(viewedRequest.inspectorNotes || '')
    setInspectorClassified(viewedRequest.inspectorClassified || '')
  }, [viewedRequest?.id])

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

      {isInspector ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InspectorKpiCard value={String(inspectorKpis.pending)} label={t.pendingShort} />
            <InspectorKpiCard
              value={String(inspectorKpis.openNcrs)}
              label={t.openNcrs}
              valueClassName="text-red-600"
            />
            <InspectorKpiCard
              value={formatPassRate(inspectorKpis.passRate, locale)}
              label={t.passRate}
              valueClassName="text-teal-600"
            />
            <InspectorKpiCard
              value={String(inspectorKpis.overdue)}
              label={t.overdue}
              valueClassName="text-orange-500"
            />
          </div>

          <SectionCard title={t.inspectionWorklist}>
            {inspectorRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t.noInspectorRequests}</p>
            ) : (
              <QcWorklistTableShell t={t}>
                {inspectorListRows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn(
                      'hover:bg-slate-50',
                      (row.badge === 'reinspection' || row.isReinspection) && 'bg-red-50'
                    )}
                  >
                    <td className={cn(QC_WORKLIST_COL_NUMBER, 'font-semibold tabular-nums text-slate-900')}>
                      {row.requestNumber}
                    </td>
                    <td className={QC_WORKLIST_COL_TITLE}>
                      <button
                        type="button"
                        className="block w-full text-right font-semibold text-slate-900 hover:text-[#1e3a5f]"
                        onClick={() => setViewRequestId(row.requestId)}
                      >
                        <span className="line-clamp-2" title={row.displayTitle}>
                          {row.isReinspection ? (
                            <>
                              <span>{t.reinspectRequest} </span>
                              {row.displayTitle}
                              {row.rejectedAt ? (
                                <span className="font-normal text-red-700">
                                  {' ('}
                                  {t.rejectedOnDate}{' '}
                                  <FormattedDate value={row.rejectedAt} /> {t.andTime}{' '}
                                  {formatInspectorTime(row.rejectedAt, locale)}
                                  {')'}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            row.displayTitle
                          )}
                        </span>
                      </button>
                    </td>
                    <td className={cn(QC_WORKLIST_COL_URGENCY, 'font-medium text-red-700')}>
                      ({requestPriorityLabel(row.priority, t)})
                    </td>
                    <td className={cn(QC_WORKLIST_COL_DATETIME, 'text-xs tabular-nums text-slate-700')}>
                      <div>
                        <FormattedDate value={row.requestedAt} />
                      </div>
                      <div>{formatInspectorTime(row.requestedAt, locale)}</div>
                    </td>
                    <td className={QC_WORKLIST_COL_STATUS}>
                      <Badge
                        variant="outline"
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 tabular-nums',
                          (row.badge === 'completed' || row.badge === 'rejected') && row.decisionAt
                            ? 'flex-col items-center gap-0.5 py-1'
                            : '',
                          inspectorBadgeClass(row.badge)
                        )}
                      >
                        <span>{inspectorBadgeLabel(row.badge, t)}</span>
                        {(row.badge === 'completed' || row.badge === 'rejected') && row.decisionAt ? (
                          <span className="text-[10px] leading-tight opacity-90">
                            <FormattedDate value={row.decisionAt} />{' '}
                            {formatInspectorTime(row.decisionAt, locale)}
                          </span>
                        ) : null}
                      </Badge>
                    </td>
                    <td className={QC_WORKLIST_COL_ACTION}>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                        onClick={() => setViewRequestId(row.requestId)}
                      >
                        {t.viewRequest}
                        <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </QcWorklistTableShell>
            )}
          </SectionCard>

          <SectionCard title={t.ncrManagement}>
            {inspectorNcrs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t.noEngineNcrs}</p>
            ) : (
              <div className="space-y-3">
                {inspectorNcrs.map((ncr) => {
                  const tone = severityBadge(ncr.severity)
                  return (
                    <div
                      key={ncr.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {ncr.ncrNumber} – {ncr.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {ncr.itemCode} - {engineNcrStatusLabel(ncr.status, t)}
                        </p>
                      </div>
                      <Badge variant={tone.variant} className={cn('shrink-0 rounded-full', tone.className)}>
                        {t[SEVERITY_LABEL[ncr.severity]]}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {showRequestForm ? (
      <SectionCard title={t.inspectionRequest} description={t.inspectionRequestHint}>
        <div className="space-y-3 rounded-[10px] border border-slate-200 bg-slate-50/70 p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
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
                  onBlur={() => {
                    if (typedSpeech.trim()) void applySpeech(typedSpeech)
                  }}
                  placeholder={t.typeRequestPlaceholder}
                />
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
        </form>
        <div className="flex w-full flex-wrap items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="mb-0">{t.inspectionUrgency}</Label>
              {(['high', 'medium', 'low'] as const).map((level) => {
                const selected = parseQcRequestPriority(inspectionUrgency) === level
                return (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    className={selected ? '' : 'bg-white text-slate-800'}
                    onClick={() => setInspectionUrgency(level)}
                  >
                    {level === 'high' ? t.urgencyHigh : level === 'medium' ? t.urgencyMedium : t.urgencyLow}
                  </Button>
                )
              })}
            </div>
            <Link
              href={drawingsHref}
              onClick={() => {
                const draft = snapshotDraft()
                if (draft) writeQcRequestDraft(draft)
              }}
              className="ms-[2cm] inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              {t.selectDrawing}
              {selectedOfficeIds.length ? (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {selectedOfficeIds.length} {t.selectedDrawingCount}
                </span>
              ) : null}
            </Link>
            <span className={cn('ms-auto', (Date.now() < createBlockedUntil || isQcRequestCreateBlocked()) && 'pointer-events-none')}>
          <Button
            type="button"
            disabled={
              busy ||
              (selectedIds.length === 0 &&
                markedDrawings.length === 0 &&
                !code.trim() &&
                !typedSpeech.trim() &&
                !voiceText.trim() &&
                !(parsedSpeech?.items.length))
            }
            onPointerDown={(event) => {
              submitPointerRef.current = event.isPrimary !== false
            }}
            onPointerCancel={() => {
              submitPointerRef.current = false
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (!event.isTrusted) return
              const fromKeyboard = event.detail === 0
              if (!submitPointerRef.current && !fromKeyboard) return
              if (Date.now() < suppressCreateUntilRef.current || isQcRequestCreateBlocked() || Date.now() < createBlockedUntil) {
                return
              }
              submitPointerRef.current = false
              void handleCreateRequest()
            }}
          >
            {t.submitRequest}
          </Button>
            </span>
        </div>
        </div>

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
            <QcWorklistTableShell
              t={t}
              leadingHead={<th className={QC_WORKLIST_COL_CHECKBOX} aria-hidden />}
            >
              {supervisorRequestList.map((row) => {
                const visibleCodes = (row.itemCodes ?? []).filter((code) => code && !isLegacySampleItemCode(code))
                const attachedCount = uniqueRequestDrawings(row.drawings ?? []).length
                const requestTitle = row.floor
                  ? `${qcActivityLabel(row.activityType, locale)} - ${t.floor} ${row.floor}`
                  : qcActivityLabel(row.activityType, locale)
                const decisionAt = inspectorDecisionAtForRequest(row)
                const verdict = effectiveInspectorVerdict(row)
                const attachmentHint = [
                  attachedCount ? `${attachedCount} ${t.attachedDrawings}` : '',
                  visibleCodes.length ? visibleCodes.join('، ') : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className={cn(QC_WORKLIST_COL_CHECKBOX, 'align-top')}>
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedRequestIds.includes(row.id)}
                        onChange={() => toggleRequestSelection(row.id)}
                        aria-label={t.deleteRequest}
                      />
                    </td>
                    <td className={cn(QC_WORKLIST_COL_NUMBER, 'font-semibold tabular-nums text-slate-900')}>
                      {supervisorRequestNumbers.get(row.id) ?? 0}
                    </td>
                    <td className={QC_WORKLIST_COL_TITLE}>
                      <button
                        type="button"
                        className="block w-full text-right hover:text-[#1e3a5f]"
                        onClick={() => setViewRequestId(row.id)}
                      >
                        <span className="line-clamp-2 font-semibold text-slate-900" title={requestTitle}>
                          {requestTitle}
                        </span>
                        {attachmentHint ? (
                          <span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500" title={attachmentHint}>
                            {attachmentHint}
                          </span>
                        ) : null}
                      </button>
                    </td>
                    <td className={cn(QC_WORKLIST_COL_URGENCY, 'font-medium text-red-700')}>
                      ({requestPriorityLabel(row.priority, t)})
                    </td>
                    <td className={cn(QC_WORKLIST_COL_DATETIME, 'text-xs tabular-nums text-slate-700')}>
                      <div>
                        <FormattedDate value={row.requestedAt} />
                      </div>
                      <div>{formatInspectorTime(row.requestedAt, locale)}</div>
                    </td>
                    <td className={QC_WORKLIST_COL_STATUS}>
                      {verdict ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'inline-flex flex-col items-center gap-0.5 rounded-full px-2.5 py-1 tabular-nums',
                            inspectorAnswerBadgeClass(verdict)
                          )}
                        >
                          <span>{supervisorVerdictShortLabel(verdict, t)}</span>
                          {decisionAt ? (
                            <span className="text-[10px] leading-tight opacity-90">
                              <FormattedDate value={decisionAt} /> {formatInspectorTime(decisionAt, locale)}
                            </span>
                          ) : null}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={requestSendBadgeClass(row.status)}>
                          {requestSendStatusLabel(row, t)}
                        </Badge>
                      )}
                    </td>
                    <td className={QC_WORKLIST_COL_ACTION}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                          onClick={() => setViewRequestId(row.id)}
                        >
                          {t.viewRequest}
                          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={busy}
                          aria-label={t.deleteRequest}
                          onClick={() => setPendingDeleteIds([row.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </QcWorklistTableShell>
          )}
        </div>
      </SectionCard>
      ) : null}

      {showResults ? (
        <>
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
                <QcMediaPreview photo={photo} alt={photo.caption || photo.itemCode} />
                <p className="px-2 py-1.5 text-[11px] text-slate-500">
                  {photo.itemCode}
                  {photo.caption ? ` · ${photo.caption}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {!isInspector ? (
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
                      {ncr.itemCode} · {engineNcrStatusLabel(ncr.status, t)} ·{' '}
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
      ) : null}
        </>
      ) : null}

      {viewedRequest ? (
        <ModalOverlay
          open
          onClose={() => {
            setViewRequestId(null)
            setEditingRequest(false)
            setDetailFiles([])
            setPreviewDrawing(null)
            setExpandedInlineDrawingId(null)
            setMarkupDrawing(null)
            setMarkupOfficeId(null)
          }}
          title={t.requestDetails}
          className="sm:max-w-4xl bg-slate-100 text-slate-900"
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
                  <Label htmlFor="qc-edit-notes">{t.requestNotes}</Label>
                  <Textarea
                    id="qc-edit-notes"
                    rows={6}
                    dir="rtl"
                    className="bg-white text-sm leading-6 text-slate-900"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t.inspectableItems}</Label>
                  <p className="text-[11px] text-slate-500">{t.inspectableItemsHint}</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                    {data.items
                      .filter((item) => !isLegacySampleItemCode(item.code))
                      .map((item) => {
                        const checked = editItems.some((entry) => entry.id === item.id)
                        return (
                          <li key={item.id}>
                            <label className="flex items-center gap-2 text-sm text-slate-900">
                              <input
                                type="checkbox"
                                className="shrink-0"
                                checked={checked}
                                onChange={() => {
                                  setEditItems((current) => {
                                    if (checked) return current.filter((entry) => entry.id !== item.id)
                                    return [
                                      ...current,
                                      {
                                        id: item.id,
                                        code: item.code,
                                        floor: item.floor || '',
                                        grid: item.gridRef || [item.gridX, item.gridY].filter(Boolean).join('-'),
                                      },
                                    ]
                                  })
                                }}
                              />
                              <span>
                                {item.code}
                                {item.floor ? ` · ${item.floor}` : ''}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label={t.activityType} value={qcActivityLabel(viewedRequest.activityType, locale)} />
                <DetailField label={t.status} value={requestStatusLabel(viewedRequest, t)} />
                <DetailField
                  label={t.inspectionUrgency}
                  value={
                    viewedRequest.priority === 'high'
                      ? t.urgencyHigh
                      : viewedRequest.priority === 'low'
                        ? t.urgencyLow
                        : t.urgencyMedium
                  }
                />
                <DetailField label={t.floor} value={viewedRequest.floor || '—'} />
                <DetailField label={t.gridRange} value={viewedGridLabel} />
                <DetailField label={t.requestedBy} value={viewedRequest.requestedByName || '—'} />
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">{t.requestDate}</p>
                  <p className="text-sm font-medium text-slate-900">
                    <FormattedDate value={viewedRequest.requestedAt} />
                  </p>
                </div>
                {viewedRequest.sourceDrawingId && !sourceAlreadyAttached ? (
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-500">{t.sourceDrawing}</p>
                  <p className="text-sm font-medium text-slate-900">{viewedSourceTitle}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-1 bg-white text-slate-800" onClick={() => void downloadOfficeDrawing(viewedRequest.sourceDrawingId!)}>
                    <Download className="h-4 w-4" />
                    {t.downloadDrawing}
                  </Button>
                </div>
                ) : null}
                <div className="sm:col-span-2">
                  <DetailField label={t.requestNotes} value={viewedRequest.notes || '—'} />
                </div>
              </div>
            )}
            {!canEditViewed && !isInspector && viewedRequest.status === 'in_progress' ? (
              <p className="text-[11px] text-slate-500">{t.requestLockedAfterInspector}</p>
            ) : null}
            {rejectedAwaitingResubmit && !isInspector ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertDescription>{t.reinspectRequestHint}</AlertDescription>
              </Alert>
            ) : null}

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
                    const kind = drawingKind(drawing)
                    const displayUrl = drawing.url || inlineDrawingUrls[drawing.id] || ''
                    const isExpanded = expandedInlineDrawingId === drawing.id
                    return (
                      <li key={drawing.id} className="rounded-[10px] border border-slate-200 bg-white p-3">
                        <p className="mb-2 truncate text-sm font-semibold text-slate-900">{drawing.fileName}</p>
                        {kind === 'image' ? (
                          <button
                            type="button"
                            className={cn(
                              'mb-3 block w-full overflow-hidden rounded-[8px] border border-slate-100 bg-slate-50 transition-all',
                              isExpanded ? 'ring-2 ring-primary/30' : 'hover:bg-slate-100'
                            )}
                            onClick={() => void toggleInlineDrawingPreview(drawing, officeId)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? t.close : t.viewDrawingFullscreen}
                          >
                            {displayUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={displayUrl}
                                alt={drawing.fileName}
                                className={cn(
                                  'mx-auto w-full object-contain transition-all duration-200',
                                  isExpanded ? 'max-h-[75vh] cursor-zoom-out' : 'max-h-40 cursor-zoom-in'
                                )}
                              />
                            ) : (
                              <div
                                className={cn(
                                  'flex items-center justify-center text-sm text-slate-500',
                                  isExpanded ? 'min-h-[200px]' : 'min-h-[120px]'
                                )}
                              >
                                {t.saving}
                              </div>
                            )}
                          </button>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-white text-slate-800"
                            onClick={() => void openDrawingViewer(drawing, officeId)}
                          >
                            <Maximize2 className="h-4 w-4" />
                            {t.viewDrawingFullscreen}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-white text-slate-800"
                            onClick={() => void downloadDrawing(drawing, officeId)}
                          >
                            <Download className="h-4 w-4" />
                            {t.downloadDrawing}
                          </Button>
                          {canEditViewed && !isInspector && !drawing.id.startsWith('local-') && !drawing.id.startsWith('office-') ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="bg-white text-red-700"
                              disabled={busy}
                              onClick={() => void removeViewedDrawing(drawing)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t.removeAttachedDrawing}
                            </Button>
                          ) : null}
                          {canInspectViewed && kind !== 'other' ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openDrawingMarkup(drawing, officeId)}
                            >
                              <Pencil className="h-4 w-4" />
                              {t.editOnDrawing}
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {canEditViewed && !isInspector ? (
                <div className="space-y-3 rounded-[10px] border border-slate-200 bg-white p-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">{t.officeDrawings}</p>
                    <p className="text-[11px] text-slate-500">{t.officeDrawingsHint}</p>
                    <Link
                      href={qcDrawingsPageHref(drawingsHref, viewedRequest.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <FileText className="h-4 w-4" />
                      {t.selectDrawing}
                    </Link>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <Label className="text-slate-800">{t.markedDrawing}</Label>
                    <p className="text-[11px] text-slate-500">{t.addMarkedDrawingHint}</p>
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
                </div>
              ) : null}
            </div>

            {isInspector ? (
              <div className="space-y-3 rounded-[10px] border border-slate-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">{t.inspectorNotes}</p>
                <p className="text-[11px] text-slate-500">{t.inspectorVoiceHint}</p>
                {canInspectViewed ? (
                  <>
                    <VoiceToTextButton
                      mode="append"
                      variant="default"
                      prompt={inspectorWhisperPrompt()}
                      disabled={busy}
                      onTranscript={appendInspectorNote}
                    />
                    <Textarea
                      rows={6}
                      dir="rtl"
                      className="bg-white text-sm leading-6 text-slate-900"
                      value={inspectorSpeech}
                      onChange={(e) => setInspectorSpeech(e.target.value)}
                      onBlur={() => {
                        if (inspectorSpeech.trim() && !inspectorClassified.trim()) {
                          void classifyInspectorNotes()
                        }
                      }}
                      placeholder={t.inspectorTypePlaceholder}
                    />
                    <div className="space-y-1.5">
                      <Label>{t.inspectorClassified}</Label>
                      <p className="text-[11px] text-slate-500">
                        {inspectorClassifyBusy ? t.classifyingInspectorNote : t.inspectorClassifiedHint}
                      </p>
                      <Textarea
                        rows={5}
                        dir="rtl"
                        className="bg-white text-sm leading-6 text-slate-900"
                        value={inspectorClassified}
                        onChange={(e) => setInspectorClassified(e.target.value)}
                        placeholder={t.inspectorTypePlaceholder}
                      />
                    </div>
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-medium text-slate-900">{t.resultPhotos}</p>
                      <p className="text-[11px] text-slate-500">{t.inspectorMediaHint}</p>
                      {viewedRequestPhotos.length || inspectorPendingMedia.length ? (
                        <ul className="grid gap-3 sm:grid-cols-3">
                          {viewedRequestPhotos.map((photo) => (
                            <li key={photo.id} className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                              <QcMediaPreview
                                photo={photo}
                                alt={photo.caption || photo.itemCode}
                                thumbnail={photo.mediaKind === 'video'}
                              />
                              <p className="px-2 py-1.5 text-[11px] text-slate-500">
                                {photo.mediaKind === 'video' ? t.uploadVideo : t.uploadPhoto}
                                {photo.caption ? ` · ${photo.caption}` : ''}
                              </p>
                            </li>
                          ))}
                          {inspectorPendingMedia.map((pending) => (
                            <li key={pending.id} className="overflow-hidden rounded-[10px] border border-dashed border-slate-300 bg-slate-50">
                              {pending.mediaKind === 'video' ? (
                                <div className="relative h-28 w-full bg-black">
                                  <video
                                    src={pending.url}
                                    className="h-full w-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                                    <Play className="h-8 w-8 fill-white text-white" />
                                  </div>
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={pending.url} alt="" className="h-28 w-full object-cover" />
                              )}
                              <p className="px-2 py-1.5 text-[11px] text-slate-500">
                                {mediaUploadBusy ? t.saving : t.uploadPhotoVideo}
                                {pending.caption ? ` · ${pending.caption}` : ''}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-500">{t.noPhotos}</p>
                      )}
                      <Label>{t.photoCaption}</Label>
                      <Input
                        value={inspectorMediaCaption}
                        onChange={(e) => setInspectorMediaCaption(e.target.value)}
                        className="bg-white"
                        disabled={mediaUploadBusy}
                      />
                      <Label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                        <Upload className="h-4 w-4" />
                        {mediaUploadBusy ? t.saving : t.uploadPhotoVideo}
                        <input
                          type="file"
                          accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.avi"
                          multiple
                          className="hidden"
                          disabled={mediaUploadBusy}
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? [])
                            e.target.value = ''
                            void uploadInspectorMediaFiles(files)
                          }}
                        />
                      </Label>
                    </div>
                  </>
                ) : (
                  <>
                    <DetailField label={t.inspectorNotes} value={viewedRequest.inspectorNotes || inspectorSpeech || '—'} />
                    <DetailField label={t.inspectorClassified} value={viewedRequest.inspectorClassified || inspectorClassified || '—'} />
                  </>
                )}
                {viewedRequestPhotos.length && !canInspectViewed ? (
                  <ul className="grid gap-3 sm:grid-cols-3">
                    {viewedRequestPhotos.map((photo) => (
                      <li key={photo.id} className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                        <QcMediaPreview
                          photo={photo}
                          alt={photo.caption || photo.itemCode}
                          thumbnail={photo.mediaKind === 'video'}
                        />
                        <p className="px-2 py-1.5 text-[11px] text-slate-500">
                          {photo.mediaKind === 'video' ? t.uploadVideo : t.uploadPhoto}
                          {photo.caption ? ` · ${photo.caption}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : viewedRequest.inspectorNotes || viewedRequest.inspectorClassified || viewedRequest.inspectorVerdict ? (
              <div className="space-y-2 rounded-[10px] border border-slate-200 bg-white p-3">
                <DetailField label={t.status} value={requestStatusLabel(viewedRequest, t)} />
                {viewedRequest.inspectorClassified ? (
                  <DetailField label={t.inspectorClassified} value={viewedRequest.inspectorClassified} />
                ) : null}
                {viewedRequest.inspectorNotes ? <DetailField label={t.inspectorNotes} value={viewedRequest.inspectorNotes} /> : null}
              </div>
            ) : null}

            {viewedRequest.history.length > 0 || viewedRequest.reinspectCount > 0 || viewedRequest.firstSubmittedAt ? (
              <div className="space-y-3 rounded-[10px] border border-slate-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">{t.inspectionHistory}</p>
                {viewedRequest.firstSubmittedAt ? (
                  <p className="text-[11px] text-slate-600">
                    {t.firstRequestAt}: <FormattedDate value={viewedRequest.firstSubmittedAt} dateTime />
                  </p>
                ) : null}
                {viewedRequest.history.length > 0 ? (
                  <ul className="space-y-3">
                    {viewedRequest.history.map((entry) => (
                      <li key={entry.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={historyEventBadgeClass(entry.eventType)}>
                            {historyEventLabel(entry.eventType, t)}
                          </Badge>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            <FormattedDate value={entry.occurredAt} dateTime />
                          </span>
                        </div>
                        {entry.itemCodes.length ? (
                          <p className="mt-1 font-medium text-slate-900">{entry.itemCodes.join('، ')}</p>
                        ) : null}
                        {entry.floor ? <p className="text-[11px] text-slate-600">{t.floor}: {entry.floor}</p> : null}
                        {entry.requestNotes ? <p className="mt-1 text-slate-700">{entry.requestNotes}</p> : null}
                        {entry.eventType === 'rejected' && entry.inspectorClassified ? (
                          <p className="mt-1 text-red-800">
                            <span className="font-medium">{t.rejectionReason}: </span>
                            {entry.inspectorClassified}
                          </p>
                        ) : null}
                        {entry.eventType === 'rejected' && entry.inspectorNotes ? (
                          <p className="mt-1 text-slate-600">{entry.inspectorNotes}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : viewedRequest.lastRejectedAt ? (
                  <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-medium">{t.historyRejected}</p>
                    <p className="mt-1 text-[11px] tabular-nums">
                      {t.rejectedOn}: <FormattedDate value={viewedRequest.lastRejectedAt} dateTime />
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-nowrap items-center justify-end gap-2 overflow-x-auto">
              {canInspectViewed ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-white"
                    disabled={busy}
                    onClick={() => void saveInspectorReportDraft()}
                  >
                    {busy ? t.saving : t.saveInspectorReport}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void submitInspectorDecision('approved')}
                  >
                    <Check className="h-4 w-4" />
                    {busy ? t.saving : t.approveRequest}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-white text-red-700"
                    disabled={busy}
                    onClick={() => void submitInspectorDecision('rejected')}
                  >
                    <XCircle className="h-4 w-4" />
                    {t.rejectRequest}
                  </Button>
                </>
              ) : null}
              {editingRequest && canEditViewed && !isInspector ? (
                <>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingRequest(false)}>
                    {t.close}
                  </Button>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void saveRequestEdits()}>
                    {busy ? t.saving : t.saveRequestEdits}
                  </Button>
                </>
              ) : !isInspector ? (
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
              ) : null}
              {viewedRequest.status !== 'cancelled' && viewedRequest.status !== 'completed' && canEditViewed && !isInspector ? (
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
              {!isInspector ? (
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
              ) : null}
              {(viewedRequest.status === 'draft' || viewedRequest.status === 'submitted') && !isInspector ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void sendForInspection(viewedRequest.id)}
                >
                  {t.sendRequest}
                </Button>
              ) : null}
              {rejectedAwaitingResubmit && !isInspector ? (
                <Button type="button" size="sm" disabled={busy} onClick={() => void resubmitRejectedRequest()}>
                  {busy ? t.saving : t.reinspectRequest}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => setViewRequestId(null)}>
                {t.close}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {previewDrawing ? (
        <ModalOverlay
          open
          onClose={() => setPreviewDrawing(null)}
          title={previewDrawing.fileName}
          className="sm:max-w-6xl bg-white text-slate-900"
          overlayClassName="z-[110]"
        >
          <div className="space-y-3">
            {drawingKind(previewDrawing) === 'image' && previewDrawing.url ? (
              <div className="overflow-auto rounded-[10px] border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewDrawing.url}
                  alt={previewDrawing.fileName}
                  className="mx-auto max-h-[80vh] w-full object-contain"
                />
              </div>
            ) : drawingKind(previewDrawing) === 'pdf' && previewDrawing.url ? (
              <iframe
                title={previewDrawing.fileName}
                src={previewDrawing.url}
                className="h-[80vh] w-full rounded-[10px] border border-slate-200 bg-white"
              />
            ) : (
              <p className="text-sm text-slate-600">{t.drawingNeedsDownload}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-white text-slate-800"
                onClick={() => void downloadDrawing(previewDrawing)}
              >
                <Download className="h-4 w-4" />
                {t.downloadDrawing}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPreviewDrawing(null)}>
                {t.close}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {markupDrawing ? (
        <ModalOverlay
          open
          onClose={() => {
            setMarkupDrawing(null)
            setMarkupOfficeId(null)
          }}
          title={markupDrawing.fileName}
          className="sm:max-w-6xl bg-white text-slate-900"
          overlayClassName="z-[110]"
        >
          <div className="space-y-3">
            <p className="text-[11px] text-slate-600">{t.inspectorMarkupHint}</p>
            {drawingKind(markupDrawing) === 'other' ? (
              <p className="text-sm text-slate-600">{t.drawingNeedsDownload}</p>
            ) : (
              <QcDrawingMarkup
                key={markupDrawing.id}
                ref={inspectorMarkupRef}
                drawingId={markupOfficeId || markupDrawing.sourceDrawingId || markupDrawing.id}
                drawingTitle={markupDrawing.fileName}
                fileUrl={requestDrawingFileUrl(markupDrawing, markupOfficeId)}
                penColor={isInspector ? QC_INSPECTOR_PEN_COLOR : QC_SUPERVISOR_PEN_COLOR}
                labels={{
                  pen: t.markupPen,
                  eraser: t.markupEraser,
                  text: t.markupText,
                  textPlaceholder: t.markupTextPlaceholder,
                  undo: t.markupUndo,
                  clear: t.markupClear,
                  page: t.markupPage,
                  unsupported: t.dwgCannotPreview,
                  saving: t.saving,
                }}
                onError={setError}
              />
            )}
            <div className="flex flex-wrap gap-2">
              {canInspectViewed && drawingKind(markupDrawing) !== 'other' ? (
                <Button type="button" disabled={markupSaving || busy} onClick={() => void saveInspectorMarkup()}>
                  <Pencil className="h-4 w-4" />
                  {markupSaving ? t.saving : t.saveInspectorMarkup}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="bg-white text-slate-800"
                onClick={() => void downloadDrawing(markupDrawing, markupOfficeId)}
              >
                <Download className="h-4 w-4" />
                {t.downloadDrawing}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMarkupDrawing(null)
                  setMarkupOfficeId(null)
                }}
              >
                {t.close}
              </Button>
            </div>
            {error ? (
              <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            ) : null}
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
                          accept="image/*,video/*,.mp4,.webm,.mov,.m4v,.avi"
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
