'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Info, Loader2, Radio, Search, Square, UserPlus } from 'lucide-react'
import { SectionCard } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import {
listBrowserCameras,
openCameraStream,
stopStream,
type BrowserCamera,
} from '@/features/attendance/lib/camera'
import {
announceRecognized,
cropFaceFromVideo,
detectFacesInVideo,
drawFaceBoxes,
playConfirmBeep,
type FaceBox,
} from '@/features/attendance/lib/face-detect'
import {
extractFaceEmbedding,
extractFaceEmbeddingFromVideo,
warmFaceEmbedder,
} from '@/features/attendance/lib/face-embed.client'
import { FaceRecognitionMethodModal } from '@/features/security/components/face-recognition-method-modal'
import type { AttendanceEnrollment, AttendanceGate, AttendanceTransit } from '@/features/attendance/lib/types'
import { cn } from '@/shared/lib/utils'

type MemberOption = { userId: string; fullName: string; email: string | null; personnelCode?: string | null }

interface GateCameraPanelProps {
  projectId: string
  gates: AttendanceGate[]
  selectedGateId: string
  onGateChange: (gateId: string) => void
  members?: MemberOption[]
  onTransitRecorded: (transit: AttendanceTransit) => void
  onError: (message: string | null) => void
  onEnrolled?: () => void
}

/** How often to call the recognize API while watching */
const WATCH_INTERVAL_MS = 900
/** Face-box detector cadence (every-frame was too heavy) */
const BOX_DETECT_MS = 140

export function GateCameraPanel({
  projectId,
  gates,
  selectedGateId,
  onGateChange,
  onTransitRecorded,
  onError,
  onEnrolled,
}: GateCameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const watchRef = useRef(false)
  const recognizingRef = useRef(false)
  const selectedGateIdRef = useRef(selectedGateId)
  const boxLoopRef = useRef<number | null>(null)
  const lastBoxesRef = useRef<FaceBox[]>([])
  const lastLabelsRef = useRef<Array<string | null>>([])

  const [cameras, setCameras] = useState<BrowserCamera[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [previewOn, setPreviewOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [watching, setWatching] = useState(false)
  const [faceCount, setFaceCount] = useState(0)
  const [enrollments, setEnrollments] = useState<AttendanceEnrollment[]>([])
  const [statusText, setStatusText] = useState<string | null>(null)
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [flashName, setFlashName] = useState<string | null>(null)
  const [methodOpen, setMethodOpen] = useState(false)
  const lastDetectAtRef = useRef(0)
  const flashTimerRef = useRef<number | null>(null)

  const selectedGate = gates.find((g) => g.id === selectedGateId) ?? null
  selectedGateIdRef.current = selectedGateId

  const loadEnrollments = useCallback(async () => {
    const res = await fetch(
      `/api/attendance/enrollments?projectId=${encodeURIComponent(projectId)}`
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'خطا در لیست شناسایی‌ها')
    setEnrollments(json.enrollments as AttendanceEnrollment[])
  }, [projectId])

  const stopPreview = useCallback(() => {
    watchRef.current = false
    setWatching(false)
    if (boxLoopRef.current != null) {
      cancelAnimationFrame(boxLoopRef.current)
      boxLoopRef.current = null
    }
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    const overlay = overlayRef.current
    if (overlay) {
      const ctx = overlay.getContext('2d')
      ctx?.clearRect(0, 0, overlay.width, overlay.height)
    }
    setPreviewOn(false)
    setFaceCount(0)
  }, [])

  const showFlash = useCallback((name: string) => {
    setFlashName(name)
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => setFlashName(null), 2800)
  }, [])

  const detectingRef = useRef(false)

  const startBoxLoop = useCallback(() => {
    const tick = () => {
      const video = videoRef.current
      const overlay = overlayRef.current
      if (video && overlay && video.readyState >= 2) {
        // Always paint last known boxes (cheap)
        if (lastBoxesRef.current.length) {
          drawFaceBoxes(overlay, video, lastBoxesRef.current, lastLabelsRef.current)
        }
        const now = performance.now()
        if (!detectingRef.current && now - lastDetectAtRef.current >= BOX_DETECT_MS) {
          detectingRef.current = true
          lastDetectAtRef.current = now
          void detectFacesInVideo(video, now)
            .then((boxes) => {
              lastBoxesRef.current = boxes
              setFaceCount(boxes.length)
              if (overlayRef.current && videoRef.current) {
                drawFaceBoxes(
                  overlayRef.current,
                  videoRef.current,
                  boxes,
                  lastLabelsRef.current
                )
              }
            })
            .catch(() => undefined)
            .finally(() => {
              detectingRef.current = false
            })
        }
      }
      boxLoopRef.current = requestAnimationFrame(tick)
    }
    if (boxLoopRef.current != null) cancelAnimationFrame(boxLoopRef.current)
    boxLoopRef.current = requestAnimationFrame(tick)
  }, [])

  const startPreview = useCallback(
    async (id?: string) => {
      onError(null)
      try {
        stopStream(streamRef.current)
        streamRef.current = null
        const stream = await openCameraStream(id || deviceId || null)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setPreviewOn(true)
        startBoxLoop()
      } catch (e) {
        onError(e instanceof Error ? e.message : 'باز کردن دوربین ناموفق')
        setPreviewOn(false)
      }
    },
    [deviceId, onError, startBoxLoop]
  )

  const runAutoRecognize = useCallback(async () => {
    if (!watchRef.current || recognizingRef.current) return
    const video = videoRef.current
    if (!video) return

    let boxes = lastBoxesRef.current
    if (boxes.length === 0) {
      boxes = await detectFacesInVideo(video)
      lastBoxesRef.current = boxes
    }
    if (boxes.length === 0) {
      setStatusText('پایش فعال — صورتی در قاب نیست')
      lastLabelsRef.current = []
      return
    }

    // Largest 1–2 faces → FaceNet embeddings (not LLM image compare)
    const crops = boxes
      .slice(0, 2)
      .map((b) => cropFaceFromVideo(video, b, 0.35, 0.92))
      .filter((f): f is string => Boolean(f))

    if (crops.length === 0) return

    recognizingRef.current = true
    setStatusText(`استخراج بیومتریک ${Math.max(1, boxes.length)} صورت...`)
    try {
      const embeddings: number[][] = []
      // Prefer full-frame FaceNet (more reliable than tight crops)
      const primary = await extractFaceEmbeddingFromVideo(video)
      if (primary) embeddings.push(primary.embedding)
      if (embeddings.length === 0) {
        for (const crop of crops.slice(0, 2)) {
          const emb = await extractFaceEmbedding(crop)
          if (emb) embeddings.push(emb)
        }
      }
      if (embeddings.length === 0) {
        setStatusText('چهره دیده شد ولی بردار بیومتریک استخراج نشد — نور/زاویه را بهتر کنید')
        return
      }

      const res = await fetch('/api/attendance/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          gateId: selectedGateIdRef.current || null,
          embeddings,
          auto: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatusText(json.error || 'خطا در شناسایی خودکار')
        return
      }

      const results = (json.results ?? []) as Array<{
        matched: boolean
        duplicate?: boolean
        personName?: string | null
        transit?: AttendanceTransit | null
        confidence?: number
        reason?: string
      }>

      const labels: Array<string | null> = boxes.map(() => null)
      let anyNew = false

      results.forEach((r, i) => {
        if (r.matched && r.personName) {
          labels[i] = r.personName
          if (r.transit && !r.duplicate) {
            anyNew = true
            onTransitRecorded(r.transit)
            playConfirmBeep()
            showFlash(r.personName)
            announceRecognized(r.personName)
          }
        }
      })
      lastLabelsRef.current = labels
      const overlay = overlayRef.current
      if (overlay && video) {
        drawFaceBoxes(overlay, video, boxes, labels)
      }

      if (anyNew) {
        const names = results
          .filter((r) => r.matched && r.transit && !r.duplicate)
          .map((r) => r.personName)
          .filter(Boolean)
        setStatusText(`ثبت شد: ${names.join('، ')}`)
      } else if (results.some((r) => r.matched && r.duplicate)) {
        setStatusText('قبلاً ثبت شده — نزدیک گیت بمانید')
      } else if (results.some((r) => r.reason?.includes('ambiguous'))) {
        setStatusText('شباهت مبهم بین دو نفر — نزدیک‌تر و روبه‌رو بایستید')
      } else {
        setStatusText('صورت دیده شد — هنوز با افراد ثبت‌شده جور نشد')
      }
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : 'خطای پایش')
    } finally {
      recognizingRef.current = false
    }
  }, [onTransitRecorded, projectId, showFlash])

  useEffect(() => {
    if (!watching) return
    const id = window.setInterval(() => {
      void runAutoRecognize()
    }, WATCH_INTERVAL_MS)
    void runAutoRecognize()
    return () => window.clearInterval(id)
  }, [watching, runAutoRecognize])

  async function searchCameras() {
    setScanning(true)
    onError(null)
    setStatusText(null)
    try {
      const list = await listBrowserCameras()
      setCameras(list)
      if (list.length === 0) {
        setStatusText('دوربینی پیدا نشد. اجازه دسترسی دوربین را بررسی کنید.')
        return
      }
      const preferred =
        list.find((c) => c.deviceId === selectedGate?.cameraDeviceId)?.deviceId ||
        list[0]?.deviceId ||
        ''
      setDeviceId(preferred)
      setStatusText(`${list.length} دوربین پیدا شد`)
      await startPreview(preferred)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'جستجوی دوربین ناموفق')
    } finally {
      setScanning(false)
    }
  }

  async function bindSelectedCamera() {
    if (!selectedGateId || !deviceId) {
      onError('گیت و دوربین را انتخاب کنید')
      return
    }
    setBusy(true)
    onError(null)
    try {
      const cam = cameras.find((c) => c.deviceId === deviceId)
      const res = await fetch('/api/attendance/gates/bind-camera', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          gateId: selectedGateId,
          cameraDeviceId: deviceId,
          cameraLabel: cam?.label ?? null,
          cameraGroupId: cam?.groupId ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'اتصال دوربین ناموفق')
      setStatusText(`دوربین «${cam?.label || 'انتخاب‌شده'}» به گیت وصل شد`)
      onEnrolled?.()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'اتصال دوربین ناموفق')
    } finally {
      setBusy(false)
    }
  }

  async function startAutoWatch() {
    onError(null)
    if (enrollments.length === 0) {
      onError('اول حداقل یک نفر را با «ثبت بیومتریک» ثبت کنید')
      return
    }
    if (!enrollments.some((e) => e.hasEmbedding)) {
      onError('ثبت‌های قبلی فقط عکس دارند — همه را دوباره با ثبت بیومتریک چندنمونه‌ای ثبت کنید')
      return
    }
    if (!previewOn) {
      await searchCameras()
    }
    setStatusText('بارگذاری مدل FaceNet…')
    try {
      await warmFaceEmbedder()
    } catch {
      onError('بارگذاری مدل شناسایی چهره ناموفق بود — اینترنت/CDN را بررسی کنید')
      return
    }
    watchRef.current = true
    setWatching(true)
    setStatusText('پایش بیومتریک روشن شد — تردد با تطبیق بردار چهره ثبت می‌شود')
  }

  function stopAutoWatch() {
    watchRef.current = false
    setWatching(false)
    setStatusText('پایش خودکار خاموش شد')
  }

  useEffect(() => {
    void loadEnrollments().catch((e) =>
      onError(e instanceof Error ? e.message : 'خطا در لیست شناسایی‌ها')
    )
    void fetch('/api/attendance/email-status')
      .then((r) => r.json())
      .then((j) => {
        if (j.email?.hint) setEmailHint(j.email.hint)
        else if (j.email?.configured) setEmailHint('سرویس ایمیل آماده است')
      })
      .catch(() => undefined)
    // Warm detectors + FaceNet so first enroll/recognize is not delayed
    void import('@/features/attendance/lib/face-detect').then((m) => m.getFaceDetector())
    void warmFaceEmbedder().catch(() => undefined)
    return () => stopPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (selectedGate?.cameraDeviceId) {
      setDeviceId(selectedGate.cameraDeviceId)
    }
  }, [selectedGate?.cameraDeviceId, selectedGateId])

  return (
    <SectionCard
      title="دوربین گیت — شناسایی بیومتریک"
      description="ثبت چندنمونه‌ای FaceNet، تطبیق ۱:N با آستانه و حاشیه ابهام — بدون حدس LLM"
    >
      <div className="space-y-4">
        {emailHint ? (
          <p
            className={cn(
              'text-xs rounded-md border px-3 py-2',
              emailHint.includes('آماده')
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            )}
          >
            ایمیل: {emailHint}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>گیت</Label>
            <Select value={selectedGateId || undefined} onValueChange={onGateChange}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب گیت" />
              </SelectTrigger>
              <SelectContent>
                {gates.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    {g.cameraLabel ? ` — ${g.cameraLabel}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>دوربین‌های پیدا شده</Label>
            <div className="flex gap-2">
              <Select
                value={deviceId || undefined}
                onValueChange={(id) => {
                  setDeviceId(id)
                  void startPreview(id)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="بعد از جستجو انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((c) => (
                    <SelectItem key={c.deviceId} value={c.deviceId}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                disabled={scanning}
                onClick={() => void searchCameras()}
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-black aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          {watching ? (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              زنده — پایش · {faceCount} صورت
            </div>
          ) : faceCount > 0 ? (
            <div className="absolute top-3 left-3 rounded-full bg-emerald-700/90 px-3 py-1 text-xs font-medium text-white">
              {faceCount} صورت در قاب
            </div>
          ) : null}
          {flashName ? (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-6 pointer-events-none">
              <div className="mx-4 w-full max-w-lg rounded-2xl bg-emerald-600/95 px-6 py-5 text-center shadow-2xl">
                <p className="text-xs font-medium text-emerald-100">شناسایی شد</p>
                <p className="mt-1 text-3xl font-bold text-white tracking-tight">{flashName}</p>
              </div>
            </div>
          ) : null}
          {!previewOn ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 text-sm">
              <Camera className="h-8 w-8" />
              <span>برای شروع، «جستجوی دوربین» را بزنید</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={scanning}
            onClick={() => void searchCameras()}
          >
            <Search className="h-4 w-4 ml-1" />
            جستجوی دوربین‌ها
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !deviceId || !selectedGateId}
            onClick={() => void bindSelectedCamera()}
          >
            <Camera className="h-4 w-4 ml-1" />
            اتصال به این گیت
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-300 text-slate-800"
            onClick={() => setMethodOpen(true)}
          >
            <Info className="h-4 w-4 ml-1" />
            روش شناسایی
          </Button>
          {!watching ? (
            <Button
              type="button"
              disabled={busy || enrollments.length === 0}
              onClick={() => void startAutoWatch()}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <Radio className="h-4 w-4 ml-1" />
              روشن کردن پایش خودکار
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={stopAutoWatch}>
              <Square className="h-4 w-4 ml-1" />
              توقف پایش
            </Button>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">ثبت بیومتریک افراد</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                در صفحه جدا، با راهنمای حرکات سر ثبت می‌شود — اینجا قاطی نمی‌شود
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {enrollments.filter((e) => e.hasEmbedding).length} نفر با بیومتریک فعال
              </p>
            </div>
            <Button asChild className="shrink-0 bg-emerald-700 hover:bg-emerald-800">
              <Link href="/dashboard/security/enroll">
                <UserPlus className="h-4 w-4 ml-1" />
                باز کردن صفحه ثبت
              </Link>
            </Button>
          </div>
        </div>

        {statusText ? (
          <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{statusText}</p>
        ) : null}
      </div>

      <FaceRecognitionMethodModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </SectionCard>
  )
}
