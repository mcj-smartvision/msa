'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileText, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DRAWING_MAX_FILES, type ProjectDrawing } from '@/lib/technical-office/drawings-shared'

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
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        <h2 className="text-base font-semibold text-slate-900">{fa ? 'نقشه‌های کارگاه' : 'Site drawings'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {fa
            ? 'PDF و DWG، تکی یا گروهی. سرپرست کارگاه همین نقشه‌ها را می‌بیند و می‌تواند دانلود کند.'
            : 'PDF and DWG, single or batch. The site supervisor can view and download these files.'}
        </p>
      </div>

      {canUpload ? (
        <form onSubmit={(e) => void handleUpload(e)} className="grid gap-3 rounded-[10px] border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="drawing-title">{fa ? 'عنوان (اختیاری)' : 'Title (optional)'}</Label>
              <Input
                id="drawing-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={fa ? 'برای یک فایل عنوان نقشه، برای چند فایل پیشوند مشترک' : 'Title for one file, or shared prefix for several'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drawing-file">{fa ? 'فایل‌های PDF یا DWG' : 'PDF or DWG files'}</Label>
              <Input
                ref={inputRef}
                id="drawing-file"
                type="file"
                accept=".pdf,.dwg,application/pdf,image/vnd.dwg,application/acad"
                multiple
                onChange={(e) => addFiles(e.target.files)}
              />
              {files.length > 0 ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
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
            </div>
          </div>
          <Button type="submit" disabled={uploading || files.length === 0} className="bg-slate-900 text-white hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            {uploading
              ? fa
                ? 'در حال آپلود...'
                : 'Uploading...'
              : fa
                ? files.length > 1
                  ? `آپلود ${files.length} نقشه`
                  : 'آپلود نقشه'
                : files.length > 1
                  ? `Upload ${files.length} drawings`
                  : 'Upload drawing'}
          </Button>
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
        <ul className="divide-y divide-slate-100 rounded-[10px] border border-slate-200">
          {drawings.map((drawing) => (
            <li key={drawing.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-sky-50 text-sky-800">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{drawing.title}</p>
                <p className="text-[11px] text-slate-500">
                  {(drawing.format ?? 'pdf').toUpperCase()} · {drawing.fileName} · {formatSize(drawing.fileSize)} · {formatStamp(drawing.createdAt, fa)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void handleDownload(drawing.id)}>
                  <Download className="h-4 w-4" />
                  {fa ? 'دانلود' : 'Download'}
                </Button>
                {canUpload ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete(drawing.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
