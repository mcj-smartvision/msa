'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle2, Cog, Eye, Landmark, Zap } from 'lucide-react'
import { EmptyState, PageHeader, SectionCard } from '@/components/admin/shared'
import { QcDrawingMarkup, type QcDrawingMarkupHandle } from '@/components/qc/qc-drawing-markup'
import { QcBlobThumb, QcDrawingThumb } from '@/components/qc/qc-drawing-thumb'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getQcMessages } from '@/lib/i18n/qc'
import { useLocale } from '@/components/i18n/locale-provider'
import { isQcActivityType, qcActivityLabel } from '@/lib/qc-engine/activity-types'
import {
  classifyDrawingDiscipline,
  readQcSelectedDrawings,
  writeQcSelectedDrawings,
  type QcDrawingDiscipline,
} from '@/lib/qc-engine/drawing-discipline'
import { addPendingMarked, loadPendingMarked, type QcPendingMarked } from '@/lib/qc-engine/pending-marked'
import type { QcInspectionRequest, QcOfficeDrawing, QcRequestStatus } from '@/lib/qc-engine/types'

const DISCIPLINE_MENU: {
  key: QcDrawingDiscipline
  label: 'drawingStructure' | 'drawingArchitecture' | 'drawingElectrical' | 'drawingMechanical'
  icon: typeof Building2
}[] = [
  { key: 'structure', label: 'drawingStructure', icon: Building2 },
  { key: 'architecture', label: 'drawingArchitecture', icon: Landmark },
  { key: 'mechanical', label: 'drawingMechanical', icon: Cog },
  { key: 'electrical', label: 'drawingElectrical', icon: Zap },
]

function canAttach(status: QcRequestStatus) {
  return status === 'draft' || status === 'submitted'
}

export function QcOfficeDrawingsPage({ projectId }: { projectId: string | null }) {
  const { locale, dir } = useLocale()
  const t = getQcMessages(locale)
  const router = useRouter()
  const markupRef = useRef<QcDrawingMarkupHandle>(null)

  const [drawings, setDrawings] = useState<QcOfficeDrawing[]>([])
  const [requests, setRequests] = useState<QcInspectionRequest[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [discipline, setDiscipline] = useState<QcDrawingDiscipline>('structure')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [saveTarget, setSaveTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pendingMarked, setPendingMarked] = useState<QcPendingMarked[]>([])
  const savedBoxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [drawingsRes, dashboardRes] = await Promise.all([
      fetch(`/api/technical-office/drawings?projectId=${projectId}`),
      fetch(`/api/qc-engine/dashboard?projectId=${projectId}`),
    ])
    const drawingsJson = (await drawingsRes.json().catch(() => ({}))) as {
      drawings?: { id: string; title: string; fileName: string; format: string }[]
      error?: string
    }
    const dashboardJson = (await dashboardRes.json().catch(() => ({}))) as {
      requests?: QcInspectionRequest[]
      error?: string
    }
    if (!drawingsRes.ok) {
      setError(drawingsJson.error || t.engineError)
      setDrawings([])
      setLoading(false)
      return
    }
    setError(null)
    setDrawings(
      (drawingsJson.drawings ?? []).map((drawing) => ({
        id: drawing.id,
        title: drawing.title,
        fileName: drawing.fileName,
        format: drawing.format,
      }))
    )
    setRequests((dashboardJson.requests ?? []).filter((row) => canAttach(row.status)))
    setSelectedIds(readQcSelectedDrawings(projectId))
    const pending = await loadPendingMarked(projectId)
    setPendingMarked(pending)
    setLoading(false)
  }, [projectId, t.engineError])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const buckets: Record<QcDrawingDiscipline, QcOfficeDrawing[]> = {
      structure: [],
      architecture: [],
      electrical: [],
      mechanical: [],
    }
    for (const drawing of drawings) {
      buckets[classifyDrawingDiscipline(drawing.title, drawing.fileName)].push(drawing)
    }
    return buckets
  }, [drawings])

  const viewing = drawings.find((drawing) => drawing.id === viewingId) ?? null
  const editableRequests = requests

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  function openView(id: string) {
    setViewingId(id)
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]))
    setSaved(false)
  }

  function closeView() {
    setViewingId(null)
    setSaved(false)
    setError(null)
  }

  function confirmSelection() {
    if (projectId) {
      const markedIds = pendingMarked.map((row) => row.sourceDrawingId).filter(Boolean)
      writeQcSelectedDrawings(projectId, [...new Set([...selectedIds, ...markedIds])])
    }
    router.push('/dashboard/qc')
  }

  async function saveMarked() {
    if (!projectId || !viewing) return
    const handle = markupRef.current
    if (!handle?.canExport()) {
      setError(viewing.format === 'dwg' ? t.dwgCannotPreview : t.engineError)
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const file = await handle.exportPng()
      if (saveTarget) {
        const editRes = await fetch('/api/qc-engine/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, requestId: saveTarget, edit: true, sourceDrawingId: viewing.id }),
        })
        if (!editRes.ok) {
          const editJson = (await editRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(editJson.error || t.engineError)
        }
        const body = new FormData()
        body.set('projectId', projectId)
        body.set('requestId', saveTarget)
        body.set('sourceDrawingId', viewing.id)
        body.append('file', file)
        const res = await fetch('/api/qc-engine/requests', { method: 'POST', body })
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(json.error || t.engineError)
      } else {
        await addPendingMarked(projectId, {
          id: crypto.randomUUID(),
          sourceDrawingId: viewing.id,
          sourceTitle: viewing.title,
          fileName: file.name.replace(/-marked\.png$/i, `-marked-${Date.now()}.png`),
          mimeType: file.type,
          blob: file,
        })
        writeQcSelectedDrawings(projectId, selectedIds.includes(viewing.id) ? selectedIds : [...selectedIds, viewing.id])
      }
      setSaved(true)
      const pending = await loadPendingMarked(projectId)
      setPendingMarked(pending)
    } catch (saveError) {
      setSaved(false)
      setError(saveError instanceof Error ? saveError.message : t.engineError)
    }
    setSaving(false)
  }

  useEffect(() => {
    if (!saved) return
    savedBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [saved])

  return (
    <div className="space-y-6" dir={dir}>
      <PageHeader
        title={t.officeDrawingsPageTitle}
        actions={
          <Button
            type="button"
            variant="outline"
            className="bg-white text-slate-800"
            onClick={() => {
              confirmSelection()
            }}
          >
            {t.backToRequest}
          </Button>
        }
      />

      <p className="text-sm text-slate-600">{t.officeDrawingsPageHint}</p>

      {error && !viewing ? (
        <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!projectId ? (
        <EmptyState title={t.officeDrawings} description={t.selectProject} />
      ) : loading ? (
        <p className="text-sm text-slate-500">{t.saving}</p>
      ) : drawings.length === 0 ? (
        <EmptyState title={t.officeDrawings} description={t.noOfficeDrawings} />
      ) : viewing ? (
        <SectionCard title={viewing.title} className="border-slate-200 bg-slate-100 text-slate-900">
          <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-600">{t.markupHint}</p>
                <Button type="button" size="sm" variant="outline" className="bg-white text-slate-800" onClick={closeView}>
                  {t.backToDrawingsList}
                </Button>
              </div>
              <QcDrawingMarkup
                key={viewing.id}
                ref={markupRef}
                drawingId={viewing.id}
                drawingTitle={viewing.title}
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
              {saved ? (
                <div
                  ref={savedBoxRef}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-emerald-200 bg-emerald-50 p-3"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" />
                    {saveTarget ? t.markupSavedToRequest : t.markupSavedPending}
                    {!saveTarget && pendingMarked.length > 1 ? ` (${pendingMarked.length})` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="bg-white text-slate-800" onClick={closeView}>
                      {t.markAnotherDrawing}
                    </Button>
                    <Button type="button" onClick={confirmSelection}>
                      {t.backToRequestPage}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-slate-200 bg-white p-3">
                  <div className="min-w-[220px] flex-1 space-y-1.5">
                    <Label>{t.markupSaveToRequest}</Label>
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                      value={saveTarget}
                      onChange={(event) => setSaveTarget(event.target.value)}
                    >
                      <option value="">{t.saveToNewRequest}</option>
                      {editableRequests.map((row) => {
                        const activity = isQcActivityType(row.activityType)
                          ? qcActivityLabel(row.activityType, locale)
                          : row.activityType
                        return (
                          <option key={row.id} value={row.id}>
                            {activity}
                            {row.floor ? ` · ${row.floor}` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <Button type="button" disabled={saving} onClick={() => void saveMarked()}>
                    {saving ? t.saving : t.markupSaveToRequest}
                  </Button>
                </div>
              )}
              {error ? (
                <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
              ) : null}
            </div>
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DISCIPLINE_MENU.map((item) => {
              const count = grouped[item.key].length
              const active = discipline === item.key
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setDiscipline(item.key)}
                  className={
                    active
                      ? 'flex flex-col items-start gap-1 rounded-[12px] border border-primary bg-primary px-3 py-3 text-right text-primary-foreground'
                      : 'flex flex-col items-start gap-1 rounded-[12px] border border-slate-200 bg-white px-3 py-3 text-right text-slate-800 hover:bg-slate-50'
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-semibold">{t[item.label]}</span>
                  <span className={active ? 'text-[11px] text-primary-foreground/90' : 'text-[11px] text-slate-500'}>
                    {count} {t.drawingCount}
                  </span>
                </button>
              )
            })}
          </div>

          <SectionCard
            title={t[DISCIPLINE_MENU.find((item) => item.key === discipline)?.label ?? 'drawingStructure']}
            className="border-slate-200 bg-slate-100 text-slate-900"
          >
            {grouped[discipline].length === 0 ? (
              <p className="text-sm text-slate-600">{t.noDrawingsInSection}</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-[10px] border border-slate-200 bg-white">
                {grouped[discipline].map((drawing) => (
                  <li key={drawing.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.includes(drawing.id)}
                      onChange={() => toggle(drawing.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{drawing.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {drawing.format.toUpperCase()} · {drawing.fileName}
                        {pendingMarked.some((row) => row.sourceDrawingId === drawing.id) ? ` · ${t.alreadyMarked}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QcDrawingThumb drawingId={drawing.id} fileName={drawing.fileName} title={drawing.title} />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-white text-slate-800"
                        onClick={() => openView(drawing.id)}
                      >
                        <Eye className="h-4 w-4" />
                        {t.viewDrawing}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {pendingMarked.length > 0 ? (
            <div className="space-y-2 rounded-[12px] border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-900">
                {t.markedDrawingsOnForm} · {pendingMarked.length}
              </p>
              <div className="flex flex-wrap gap-3">
                {pendingMarked.map((row) => (
                  <div key={row.id} className="w-28 space-y-1">
                    <QcBlobThumb blob={row.blob} title={row.sourceTitle || row.fileName} />
                    <p className="truncate text-[10px] text-slate-600">{row.sourceTitle || row.fileName}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm text-slate-700">
              {selectedIds.length} {t.selectedDrawingCount}
              {pendingMarked.length ? ` · ${pendingMarked.length} ${t.alreadyMarked}` : ''}
            </p>
            <Button type="button" onClick={confirmSelection}>
              {t.confirmDrawings}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
