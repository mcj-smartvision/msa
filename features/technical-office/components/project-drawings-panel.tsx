'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { DRAWING_MAX_FILES, type DrawingDiscipline, type ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'
import {
DRAWING_DISCIPLINE_OPTIONS,
DRAWING_LIST_TAB_DISCIPLINES,
drawingDisciplineLabel,
} from '@/features/technical-office/lib/drawing-discipline'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

const LIST_TAB_DISCIPLINES = DRAWING_LIST_TAB_DISCIPLINES

const FIELD_BOX =
  'flex min-h-[3.75rem] flex-col rounded-lg border-2 border-[#1e3a5f] bg-white px-3 py-2'
const FIELD_LABEL = 'mb-1 block text-xs font-semibold text-[#1e3a5f]'

function listTabLabel(discipline: DrawingDiscipline, fa: boolean): string {
  if (!fa) return `${drawingDisciplineLabel(discipline)} drawings`
  if (discipline === 'other') return 'نقشه‌های سایر'
  return `نقشه‌های ${drawingDisciplineLabel(discipline)}`
}

function formatSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatStamp(iso: string, fa: boolean) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(fa ? 'fa-IR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

export function ProjectDrawingsPanel({
  projectId,
  canUpload,
  fa = true,
}: {
  projectId: string
  canUpload: boolean
  fa?: boolean
}) {
  const [drawings, setDrawings] = useState<ProjectDrawing[]>([])
  const [title, setTitle] = useState('')
  const [discipline, setDiscipline] = useState<DrawingDiscipline>('structure')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [listTab, setListTab] = useState<DrawingDiscipline>('structure')
  const inputRef = useRef<HTMLInputElement>(null)

  const visibleTabs = LIST_TAB_DISCIPLINES

  const filteredDrawings = useMemo(
    () => drawings.filter((drawing) => drawing.discipline === listTab),
    [drawings, listTab]
  )

  useEffect(() => {
    if (!LIST_TAB_DISCIPLINES.includes(listTab)) {
      setListTab('structure')
    }
  }, [listTab])

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/technical-office/drawings?projectId=${projectId}`)
    const data = (await res.json().catch(() => ({}))) as { drawings?: ProjectDrawing[]; error?: string }
    if (!res.ok) {
      setError(data.error || (fa ? 'بارگذاری نقشه‌ها انجام نشد.' : 'Could not load drawings.'))
      setDrawings([])
      setLoading(false)
      return
    }
    setDrawings(data.drawings ?? [])
    setLoading(false)
  }, [projectId, fa])

  useEffect(() => {
    void load()
  }, [load])

  function addFiles(next: FileList | null) {
    if (!next?.length) return
    setFiles((current) => {
      const merged = [...current]
      for (const file of Array.from(next)) {
        if (merged.some((item) => item.name === file.name && item.size === file.size)) continue
        merged.push(file)
      }
      return merged.slice(0, DRAWING_MAX_FILES)
    })
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!files.length || !projectId) return
    setUploading(true)
    setError(null)
    setMessage(null)
    const body = new FormData()
    body.set('projectId', projectId)
    body.set('title', title)
    body.set('discipline', discipline)
    for (const file of files) body.append('file', file)
    const res = await fetch('/api/technical-office/drawings', { method: 'POST', body })
    const data = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[]; drawings?: ProjectDrawing[] }
    if (!res.ok) {
      setError(data.error || data.errors?.join(' ') || (fa ? 'آپلود انجام نشد.' : 'Upload failed.'))
      setUploading(false)
      return
    }
    const uploaded = data.drawings?.length ?? files.length
    setTitle('')
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
    const extra = data.errors?.length ? ` ${data.errors.join(' ')}` : ''
    setMessage(
      fa
        ? `${uploaded} نقشه بارگذاری شد. سرپرست کارگاه می‌تواند ببیند و دانلود کند.${extra}`
        : `${uploaded} drawing(s) uploaded.${extra}`
    )
    setUploading(false)
    setListTab(discipline)
    await load()
  }

  async function handleDownload(id: string) {
    setError(null)
    const res = await fetch(`/api/technical-office/drawings/${encodeURIComponent(id)}`)
    const data = (await res.json().catch(() => ({}))) as { url?: string; fileName?: string; error?: string }
    if (!res.ok || !data.url) {
      setError(data.error || (fa ? 'دانلود انجام نشد.' : 'Download failed.'))
      return
    }
    const a = document.createElement('a')
    a.href = data.url
    a.download = data.fileName || 'drawing.pdf'
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.click()
  }

  async function handleDelete(id: string) {
    setError(null)
    const res = await fetch(`/api/technical-office/drawings/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(data.error || (fa ? 'حذف انجام نشد.' : 'Delete failed.'))
      return
    }
    await load()
  }

  if (!projectId) {
    return <p className="text-sm text-slate-500">{fa ? 'ابتدا یک پروژه انتخاب کنید.' : 'Select a project first.'}</p>
  }

  return (
    <section className="space-y-4 rounded-[12px] border border-[#5a7088] bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{fa ? 'نقشه‌های پروژه' : 'Project drawings'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {fa
            ? 'PDF و DWG، تکی یا گروهی. سرپرست کارگاه همین نقشه‌ها را می‌بیند و می‌تواند دانلود کند.'
            : 'PDF and DWG, single or batch. The site supervisor can view and download these files.'}
        </p>
      </div>

      {canUpload ? (
        <form
          onSubmit={(e) => void handleUpload(e)}
          className="space-y-3 rounded-[10px] border border-slate-200 bg-slate-50/70 p-4"
          dir="rtl"
        >
          <div
            className="grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)_minmax(0,1.15fr)_minmax(10rem,12rem)] md:items-stretch"
          >
            <div className={cn(FIELD_BOX, 'relative')}>
              <Label htmlFor="drawing-discipline" className={FIELD_LABEL}>
                {fa ? 'رشته نقشه' : 'Discipline'}
              </Label>
              <div className="flex min-h-[1.5rem] flex-1 items-center justify-center">
                <Select value={discipline} onValueChange={(v) => setDiscipline(v as DrawingDiscipline)}>
                  <SelectTrigger
                    id="drawing-discipline"
                    className="relative h-9 w-full border-0 bg-transparent px-8 text-sm shadow-none focus:ring-0 justify-center text-center [&>span]:line-clamp-none [&>span]:w-full [&>span]:text-center [&_svg]:absolute [&_svg]:end-2 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWING_DISCIPLINE_OPTIONS.filter((d) => d !== 'other').map((d) => (
                      <SelectItem key={d} value={d}>
                        {drawingDisciplineLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={FIELD_BOX}>
              <Label htmlFor="drawing-title" className={FIELD_LABEL}>
                {fa ? 'عنوان (اختیاری)' : 'Title (optional)'}
              </Label>
              <Input
                id="drawing-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={fa ? 'پیشوند یا عنوان نقشه' : 'Title or prefix'}
                className="h-9 w-full border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>

            <div className={FIELD_BOX}>
              <Label htmlFor="drawing-file" className={FIELD_LABEL}>
                {fa ? 'فایل نقشه' : 'Drawing file'}
              </Label>
              <input
                ref={inputRef}
                id="drawing-file"
                type="file"
                accept=".pdf,.dwg,application/pdf,image/vnd.dwg,application/acad"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full border-[#1e3a5f] bg-white text-sm text-[#1e3a5f] hover:bg-slate-50"
                onClick={() => inputRef.current?.click()}
              >
                {files.length > 0
                  ? fa
                    ? `${files.length} فایل انتخاب شد`
                    : `${files.length} file(s) selected`
                  : fa
                    ? 'انتخاب فایل'
                    : 'Choose files'}
              </Button>
            </div>

            <Button
              type="submit"
              disabled={uploading || files.length === 0}
              className="h-auto min-h-[3.75rem] w-full rounded-lg border-2 border-sky-600 bg-sky-600 px-4 text-sm text-white shadow-sm shadow-sky-900/20 hover:bg-sky-700 hover:border-sky-700 md:self-stretch"
            >
              <Upload className="h-4 w-4 shrink-0" />
              {uploading
                ? fa
                  ? 'در حال آپلود...'
                  : 'Uploading...'
                : fa
                  ? files.length > 1
                    ? `آپلود ${files.length} نقشه`
                    : 'آپلود نقشه'
                  : files.length > 1
                    ? `Upload ${files.length}`
                    : 'Upload'}
            </Button>
          </div>

          {files.length > 0 ? (
            <ul className="flex flex-wrap gap-2 pe-1">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#1e3a5f]/30 bg-white px-2 py-1 text-[11px] text-slate-700"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700"
                    onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                    aria-label={fa ? 'حذف فایل' : 'Remove file'}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}

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

      {loading ? (
        <p className="text-sm text-slate-500">{fa ? 'در حال بارگذاری...' : 'Loading...'}</p>
      ) : drawings.length === 0 ? (
        <p className="text-sm text-slate-500">
          {fa ? 'هنوز نقشه‌ای برای این پروژه بارگذاری نشده است.' : 'No drawings uploaded for this project yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          <div
            className="flex flex-wrap gap-2 border-b border-slate-200 pb-2"
            role="tablist"
            dir={fa ? 'rtl' : 'ltr'}
            aria-label={fa ? 'دسته نقشه‌ها' : 'Drawing categories'}
          >
            {visibleTabs.map((tabDiscipline) => {
              const count = drawings.filter((d) => d.discipline === tabDiscipline).length
              const selected = listTab === tabDiscipline
              return (
                <button
                  key={tabDiscipline}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={listTabLabel(tabDiscipline, fa)}
                  onClick={() => setListTab(tabDiscipline)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    selected
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className="font-semibold">{drawingDisciplineLabel(tabDiscipline)}</span>
                  <span>{fa ? 'نقشه‌های' : 'drawings'}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                      selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {count.toLocaleString(fa ? 'fa-IR' : 'en-US')}
                  </span>
                </button>
              )
            })}
          </div>

          <div role="tabpanel" aria-label={listTabLabel(listTab, fa)}>
            {filteredDrawings.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {fa
                  ? `در دسته «${drawingDisciplineLabel(listTab)}» نقشه‌ای ثبت نشده است.`
                  : `No drawings in ${drawingDisciplineLabel(listTab)}.`}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-[10px] border border-slate-200">
                {filteredDrawings.map((drawing) => (
                  <li key={drawing.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-sky-50 text-sky-800">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{drawing.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {(drawing.format ?? 'pdf').toUpperCase()} · {drawing.fileName} ·{' '}
                        {formatSize(drawing.fileSize)} · {formatStamp(drawing.createdAt, fa)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleDownload(drawing.id)}
                        className="border-transparent bg-[hsl(24_85%_45%)] text-white shadow-sm shadow-orange-900/15 hover:bg-[hsl(24_85%_40%)]"
                      >
                        <Download className="h-4 w-4" />
                        {fa ? 'دانلود' : 'Download'}
                      </Button>
                      {canUpload ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDelete(drawing.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
