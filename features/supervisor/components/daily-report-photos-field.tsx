/**
 * @file features/supervisor/components/daily-report-photos-field.tsx
 * @purpose UI آپلود عکس برای تب ثبت گزارش روزانه
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه — تب یادداشت گزارش روزانه
 * @depends-on shared/components/ui/button, features/supervisor/lib/daily-report-photos, shared/lib/i18n/site-supervisor
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { compressDailyReportPhoto } from '@/features/supervisor/lib/compress-daily-report-photo'
import {
  DAILY_REPORT_PHOTO_LIMITS,
  type DailyReportPhotoItem,
} from '@/features/supervisor/lib/daily-report-photos'
import { siteSupervisorT } from '@/shared/lib/i18n/site-supervisor'
import { cn } from '@/shared/lib/utils'

const t = siteSupervisorT

async function readApiJson(res: Response): Promise<{
  reportId?: string
  reportNo?: string
  photo?: DailyReportPhotoItem
  error?: string
  message?: string
}> {
  const text = await res.text()
  try {
    return JSON.parse(text) as {
      reportId?: string
      reportNo?: string
      photo?: DailyReportPhotoItem
      error?: string
      message?: string
    }
  } catch {
    if (res.status === 413 || /request entity too large/i.test(text)) {
      return { error: t.photoTooLarge }
    }
    return { error: t.photoUploadFailed }
  }
}

export function DailyReportPhotosField({
  projectId,
  reportDate,
  note,
  weatherJson,
  refreshKey = 0,
  readOnly = false,
  onPhotosChange,
  className,
}: {
  projectId: string
  reportDate: string
  note: string
  weatherJson?: string | null
  refreshKey?: number
  readOnly?: boolean
  /** Notify parent so A4 preview can include photos */
  onPhotosChange?: (photos: DailyReportPhotoItem[]) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<DailyReportPhotoItem[]>([])
  const [reportId, setReportId] = useState<string | null>(null)
  const [reportNo, setReportNo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onPhotosChangeRef = useRef(onPhotosChange)
  useEffect(() => {
    onPhotosChangeRef.current = onPhotosChange
  }, [onPhotosChange])

  function commitPhotos(
    next: DailyReportPhotoItem[] | ((prev: DailyReportPhotoItem[]) => DailyReportPhotoItem[])
  ) {
    setPhotos((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      onPhotosChangeRef.current?.(resolved)
      return resolved
    })
  }

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = Boolean(opts?.soft)
    if (!soft) setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/supervisor/daily-report-photos?projectId=${encodeURIComponent(projectId)}&reportDate=${encodeURIComponent(reportDate)}`
      )
      const data = (await res.json()) as {
        reportId?: string | null
        reportNo?: string | null
        photos?: DailyReportPhotoItem[]
        error?: string
        message?: string
      }
      if (!res.ok) {
        throw new Error(data.message || data.error || t.photoLoadFailed)
      }
      setReportId(data.reportId ?? null)
      setReportNo(data.reportNo ?? null)
      commitPhotos(data.photos ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t.photoLoadFailed)
      if (!soft) commitPhotos([])
    } finally {
      if (!soft) setLoading(false)
    }
  }, [projectId, reportDate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (refreshKey === 0) return
    void load({ soft: true })
  }, [refreshKey, load])

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const original of list) {
        if (photos.length >= DAILY_REPORT_PHOTO_LIMITS.maxCount) break
        const file = await compressDailyReportPhoto(original)
        const invalid = file.size > DAILY_REPORT_PHOTO_LIMITS.maxBytes
        if (invalid) throw new Error(t.photoTooLarge)
        const body = new FormData()
        body.set('projectId', projectId)
        body.set('reportDate', reportDate)
        body.set('note', note)
        if (weatherJson) body.set('weatherJson', weatherJson)
        body.set('file', file)
        const res = await fetch('/api/supervisor/daily-report-photos', { method: 'POST', body })
        const data = await readApiJson(res)
        if (!res.ok) throw new Error(data.message || data.error || t.photoUploadFailed)
        if (data.reportId) setReportId(data.reportId)
        if (data.reportNo) setReportNo(data.reportNo)
        if (data.photo) commitPhotos((prev) => [...prev, data.photo!])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.photoUploadFailed)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removePhoto(id: string) {
    setError(null)
    try {
      const res = await fetch(
        `/api/supervisor/daily-report-photos?photoId=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) throw new Error(data.message || data.error || t.photoDeleteFailed)
      commitPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : t.photoDeleteFailed)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{t.photoSectionTitle}</p>
          {reportNo ? (
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
              {reportNo}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="tabular-nums">{reportDate}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-slate-500">{t.photoSectionHint}</p>
          )}
        </div>
        {!readOnly ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading || photos.length >= DAILY_REPORT_PHOTO_LIMITS.maxCount}
              onClick={() => inputRef.current?.click()}
              className="bg-white shrink-0"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" aria-hidden />
              ) : (
                <ImagePlus className="h-4 w-4 ml-1" aria-hidden />
              )}
              {t.photoUploadCta}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={DAILY_REPORT_PHOTO_LIMITS.accept}
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) void uploadFiles(e.target.files)
              }}
            />
          </>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">{t.loading}</p>
      ) : photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 py-5 text-center text-xs text-slate-500">
          {t.photoEmpty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.fileName} className="h-24 w-full object-cover" />
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => void removePhoto(photo.id)}
                  className="absolute left-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-rose-600"
                  aria-label={t.photoDelete}
                  title={t.photoDelete}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-rose-700">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  )
}
