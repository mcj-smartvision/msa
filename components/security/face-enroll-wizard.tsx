'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  Play,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { PageHeader, SectionCard } from '@/components/admin/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listBrowserCameras,
  openCameraStream,
  stopStream,
  type BrowserCamera,
} from '@/lib/attendance/camera'
import {
  cropFaceFromVideo,
  detectFacesInVideo,
  drawFaceBoxes,
} from '@/lib/attendance/face-detect'
import { extractFaceEmbeddingFromVideo, warmFaceEmbedder } from '@/lib/attendance/face-embed.client'
import { euclideanDistance } from '@/lib/attendance/face-match'
import {
  ENROLL_CAPTURE_EVERY_MS,
  ENROLL_LIVE_TIPS_FA,
  ENROLL_MAX_SAMPLES,
  ENROLL_MIN_DIVERSITY,
  ENROLL_MIN_SAMPLES,
  ENROLL_SESSION_MS,
  poseLabel,
} from '@/lib/attendance/enroll-poses'
import type { AttendanceEnrollment } from '@/lib/attendance/types'
import { cn } from '@/lib/utils'

type MemberOption = { userId: string; fullName: string; email: string | null }

type CapturedSample = {
  poseId: string
  labelFa: string
  imageBase64: string
  faceEmbedding: number[]
}

type WizardPhase = 'setup' | 'running' | 'saving' | 'retry' | 'done'

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms))
}

function isDiverseEnough(candidate: number[], kept: number[][]): boolean {
  if (kept.length === 0) return true
  return kept.every((emb) => euclideanDistance(candidate, emb) >= ENROLL_MIN_DIVERSITY)
}

function EnrollProgressRing({
  value,
  max,
  secondsLeft,
  complete,
}: {
  value: number
  max: number
  secondsLeft: number
  complete?: boolean
}) {
  const size = 88
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, value / Math.max(1, max))
  const offset = c * (1 - pct)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete || pct >= 1 ? '#34d399' : '#6ee7b7'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        {complete || pct >= 1 ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-300" />
        ) : (
          <>
            <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
            <span className="text-[10px] text-white/70 mt-0.5">{secondsLeft}s</span>
          </>
        )}
      </div>
    </div>
  )
}

export function FaceEnrollWizardPage({
  projectId,
  projectName,
  members,
}: {
  projectId: string
  projectName: string
  members: MemberOption[]
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const abortRef = useRef(false)
  const capturingRef = useRef(false)

  const [enrollments, setEnrollments] = useState<AttendanceEnrollment[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [userId, setUserId] = useState('')
  const [cameras, setCameras] = useState<BrowserCamera[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [previewOn, setPreviewOn] = useState(false)
  const [phase, setPhase] = useState<WizardPhase>('setup')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [liveTip, setLiveTip] = useState(ENROLL_LIVE_TIPS_FA[0])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [captured, setCaptured] = useState<CapturedSample[]>([])

  const selectedMember = members.find((m) => m.userId === userId) ?? null

  const filteredMembers = members.filter((m) => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return true
    return (
      m.fullName.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
    )
  })

  const loadEnrollments = useCallback(async () => {
    const res = await fetch(
      `/api/attendance/enrollments?projectId=${encodeURIComponent(projectId)}`
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'بارگذاری ثبت‌نام‌ها ناموفق بود')
    setEnrollments(json.enrollments as AttendanceEnrollment[])
  }, [projectId])

  const stopCamera = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setPreviewOn(false)
  }, [])

  const startCamera = useCallback(
    async (id?: string) => {
      const stream = await openCameraStream(id || deviceId || null)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setPreviewOn(true)
    },
    [deviceId]
  )

  useEffect(() => {
    void loadEnrollments().catch((e) =>
      setError(e instanceof Error ? e.message : 'خطای بارگذاری')
    )
    void warmFaceEmbedder().catch(() => undefined)
    void listBrowserCameras()
      .then((list) => {
        setCameras(list)
        if (list[0]) setDeviceId(list[0].deviceId)
      })
      .catch(() => undefined)
    return () => {
      abortRef.current = true
      stopCamera()
    }
  }, [loadEnrollments, stopCamera])

  useEffect(() => {
    if (phase !== 'running' || !previewOn) return
    let alive = true
    const id = window.setInterval(() => {
      void (async () => {
        if (!alive) return
        const video = videoRef.current
        const overlay = overlayRef.current
        if (!video || !overlay) return
        const boxes = await detectFacesInVideo(video)
        if (!alive) return
        drawFaceBoxes(overlay, video, boxes.slice(0, 1))
      })()
    }, 160)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [phase, previewOn])

  async function saveCapturedSamples(samples: CapturedSample[]) {
    if (!userId || samples.length < ENROLL_MIN_SAMPLES) {
      throw new Error(`حداقل ${ENROLL_MIN_SAMPLES} نمونه متنوع لازم است`)
    }
    setPhase('saving')
    setStatus('ذخیره بیومتریک…')
    setError(null)

    const res = await fetch('/api/attendance/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        userId,
        personName: selectedMember?.fullName,
        samples: samples.map((s) => ({
          imageBase64: s.imageBase64.replace(/^data:[^;]+;base64,/, ''),
          faceEmbedding: s.faceEmbedding,
          pose: s.poseId,
          mimeType: 'image/jpeg',
        })),
      }),
    })

    const raw = await res.text()
    let json: { error?: string } = {}
    try {
      json = raw ? (JSON.parse(raw) as { error?: string }) : {}
    } catch {
      throw new Error(
        res.status === 413
          ? 'حجم عکس‌ها زیاد بود — تلاش مجدد ذخیره را بزنید'
          : `پاسخ نامعتبر از سرور (HTTP ${res.status})`
      )
    }
    if (!res.ok) throw new Error(json.error || `ذخیره ناموفق (HTTP ${res.status})`)

    setPhase('done')
    setStatus(`ثبت «${selectedMember?.fullName}» با ${samples.length} نمونه متنوع انجام شد`)
    await loadEnrollments()
    stopCamera()
  }

  async function tryCaptureOne(kept: CapturedSample[]): Promise<{
    sample: CapturedSample | null
    reason: 'ok' | 'no_face' | 'embed_fail' | 'not_diverse' | 'crop_fail'
  }> {
    const video = videoRef.current
    if (!video) return { sample: null, reason: 'no_face' }

    // Run FaceNet on the full video — tight MediaPipe crops often fail SSD detect
    const extracted = await extractFaceEmbeddingFromVideo(video)
    if (!extracted) return { sample: null, reason: 'embed_fail' }

    if (!isDiverseEnough(extracted.embedding, kept.map((s) => s.faceEmbedding))) {
      return { sample: null, reason: 'not_diverse' }
    }

    const crop =
      cropFaceFromVideo(
        video,
        {
          x: extracted.box.x,
          y: extracted.box.y,
          width: extracted.box.width,
          height: extracted.box.height,
          score: 1,
        },
        0.35,
        0.72,
        192
      ) || null

    if (!crop) return { sample: null, reason: 'crop_fail' }

    const n = kept.length + 1
    return {
      sample: {
        poseId: `auto_${n}`,
        labelFa: poseLabel(`auto_${n}`, true),
        imageBase64: crop,
        faceEmbedding: extracted.embedding,
      },
      reason: 'ok',
    }
  }

  async function runFreeScan() {
    if (!userId) {
      setError('ابتدا نام فرد را انتخاب کنید')
      return
    }
    setError(null)
    setCaptured([])
    abortRef.current = false
    setPhase('running')
    setSecondsLeft(Math.ceil(ENROLL_SESSION_MS / 1000))
    setLiveTip(ENROLL_LIVE_TIPS_FA[0])
    setStatus('آماده‌سازی مدل FaceNet (محلی)…')

    const samples: CapturedSample[] = []
    let failStreak = { no_face: 0, embed_fail: 0, not_diverse: 0 }
    try {
      await warmFaceEmbedder()
      if (!previewOn) await startCamera(deviceId || undefined)

      setStatus('صورت را در قاب نگه دار و سر را آرام بچرخان')
      const started = performance.now()
      let tipIdx = 0
      let lastTipAt = started
      let lastTickAt = 0

      while (!abortRef.current) {
        const elapsed = performance.now() - started
        if (elapsed >= ENROLL_SESSION_MS) break
        if (samples.length >= ENROLL_MAX_SAMPLES) break

        const left = Math.max(0, Math.ceil((ENROLL_SESSION_MS - elapsed) / 1000))
        setSecondsLeft(left)

        if (performance.now() - lastTipAt > 4500) {
          tipIdx = (tipIdx + 1) % ENROLL_LIVE_TIPS_FA.length
          setLiveTip(ENROLL_LIVE_TIPS_FA[tipIdx])
          lastTipAt = performance.now()
        }

        if (!capturingRef.current && performance.now() - lastTickAt >= ENROLL_CAPTURE_EVERY_MS) {
          lastTickAt = performance.now()
          capturingRef.current = true
          try {
            const { sample, reason } = await tryCaptureOne(samples)
            if (sample) {
              samples.push(sample)
              setCaptured([...samples])
              failStreak = { no_face: 0, embed_fail: 0, not_diverse: 0 }
              setStatus(`نمونه ${samples.length}/${ENROLL_MAX_SAMPLES} ثبت شد`)
            } else if (reason === 'no_face' || reason === 'embed_fail') {
              if (reason === 'no_face') failStreak.no_face++
              else failStreak.embed_fail++
              if (samples.length === 0) {
                setStatus(
                  failStreak.embed_fail > failStreak.no_face
                    ? 'چهره پیدا شد ولی استخراج بیومتریک نشد — نور را بهتر کن، روبه‌رو بایست'
                    : 'صورت در قاب دیده نمی‌شود — نزدیک‌تر و روبه‌روی دوربین بایست'
                )
              }
            } else if (reason === 'not_diverse') {
              failStreak.not_diverse++
              setStatus(
                `نمونه ${samples.length}/${ENROLL_MAX_SAMPLES} — سر را کمی بیشتر بچرخان تا زاویه جدید ثبت شود`
              )
            }
          } finally {
            capturingRef.current = false
          }
        }

        await sleep(60)
      }

      if (abortRef.current) throw new Error('لغو شد')

      if (samples.length < ENROLL_MIN_SAMPLES) {
        setCaptured(samples)
        setPhase('setup')
        const hint =
          samples.length === 0
            ? 'هیچ نمونه‌ای ثبت نشد. نور محیط را بیشتر کن، صورت را کامل در قاب بگذار و صفحه را یک‌بار رفرش کن.'
            : `فقط ${samples.length} نمونه متنوع گرفته شد (حداقل ${ENROLL_MIN_SAMPLES}). سر را بیشتر بچرخان و دوباره شروع کن.`
        throw new Error(hint)
      }

      await saveCapturedSamples(samples)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'ثبت ناموفق'
      setError(message)
      setStatus(null)
      if (samples.length >= ENROLL_MIN_SAMPLES) {
        setCaptured(samples)
        setPhase('retry')
      } else {
        setPhase('setup')
      }
    } finally {
      setSecondsLeft(0)
    }
  }

  async function retrySave() {
    if (captured.length < ENROLL_MIN_SAMPLES) {
      setError('نمونه‌ای برای ذخیره نمانده — دوباره شروع کنید')
      setPhase('setup')
      return
    }
    try {
      await saveCapturedSamples(captured)
    } catch (e) {
      setPhase('retry')
      setError(e instanceof Error ? e.message : 'ذخیره ناموفق')
      setStatus(null)
    }
  }

  function cancelRunning() {
    abortRef.current = true
    setPhase('setup')
    setSecondsLeft(0)
    setStatus('لغو شد')
    stopCamera()
  }

  async function removePerson(enrollment: AttendanceEnrollment) {
    if (!confirm(`حذف کامل ثبت بیومتریک «${enrollment.personName}»؟`)) return
    setBusyId(enrollment.id)
    try {
      const qs = new URLSearchParams({
        projectId,
        enrollmentId: enrollment.id,
      })
      const res = await fetch(`/api/attendance/enrollments?${qs}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'حذف ناموفق')
      await loadEnrollments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حذف ناموفق')
    } finally {
      setBusyId(null)
    }
  }

  async function removeSample(enrollment: AttendanceEnrollment, sampleId: string) {
    if (!confirm('حذف این عکس نمونه؟')) return
    setBusyId(`${enrollment.id}:${sampleId}`)
    try {
      const qs = new URLSearchParams({
        projectId,
        enrollmentId: enrollment.id,
        sampleId,
      })
      const res = await fetch(`/api/attendance/enrollments?${qs}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'حذف نمونه ناموفق')
      await loadEnrollments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حذف نمونه ناموفق')
    } finally {
      setBusyId(null)
    }
  }

  const isRunning = phase === 'running' || phase === 'saving'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="ثبت بیومتریک افراد"
          description={`${projectName} — اسکن ۳۰ ثانیه‌ای خودکار؛ سر را آزادانه بچرخان`}
        />
        <Button asChild variant="outline">
          <Link href="/dashboard/security">
            <ArrowRight className="h-4 w-4 ml-1" />
            بازگشت به گیت
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <SectionCard
        title="ثبت فرد جدید"
        description="نام را انتخاب کن و شروع را بزن. حدود ۳۰ ثانیه مستقیم نگاه کن و سر را بالا/پایین/چپ/راست بچرخان — سیستم خودش نمونه‌های متنوع را برمی‌دارد."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>جستجوی نام</Label>
              <Input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="نام عضو…"
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label>فرد برای ثبت</Label>
              <Select
                value={userId || undefined}
                onValueChange={setUserId}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب عضو پروژه" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMembers.map((m) => {
                    const enrolled = enrollments.find((e) => e.userId === m.userId)
                    return (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.fullName}
                        {enrolled?.hasEmbedding
                          ? ' (ثبت‌شده — بازنویسی)'
                          : enrolled
                            ? ' (ناقص)'
                            : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {cameras.length > 1 ? (
            <div className="space-y-2">
              <Label>دوربین</Label>
              <Select
                value={deviceId || undefined}
                onValueChange={setDeviceId}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب دوربین" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((c) => (
                    <SelectItem key={c.deviceId} value={c.deviceId}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {phase === 'setup' || phase === 'done' ? (
              <Button
                type="button"
                className="bg-emerald-700 hover:bg-emerald-800"
                disabled={!userId}
                onClick={() => void runFreeScan()}
              >
                <Play className="h-4 w-4 ml-1" />
                شروع اسکن ۳۰ ثانیه‌ای
              </Button>
            ) : null}
            {phase === 'retry' ? (
              <>
                <Button
                  type="button"
                  className="bg-emerald-700 hover:bg-emerald-800"
                  onClick={() => void retrySave()}
                >
                  تلاش مجدد ذخیره ({captured.length} نمونه)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPhase('setup')
                    setCaptured([])
                    setError(null)
                  }}
                >
                  شروع از اول
                </Button>
              </>
            ) : null}
            {phase === 'running' || phase === 'saving' ? (
              <Button
                type="button"
                variant="destructive"
                onClick={cancelRunning}
                disabled={phase === 'saving'}
              >
                لغو
              </Button>
            ) : null}
            {selectedMember ? (
              <Badge variant="outline" className="h-9 px-3 text-sm">
                <UserPlus className="h-3.5 w-3.5 ml-1" />
                {selectedMember.fullName}
              </Badge>
            ) : null}
          </div>

          <div className="relative overflow-hidden rounded-2xl border bg-black aspect-video">
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

            {phase === 'running' ? (
              <>
                <div className="absolute top-3 start-3 end-3 flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-black/55 px-3 py-2 text-white max-w-[60%]">
                    <p className="text-sm font-semibold text-emerald-300">{liveTip}</p>
                    <p className="text-[11px] text-white/75 mt-0.5">
                      {captured.length}/{ENROLL_MAX_SAMPLES} نمونه
                      {captured.length >= ENROLL_MIN_SAMPLES ? ' · آماده ذخیره' : ''}
                    </p>
                  </div>
                  <EnrollProgressRing
                    value={captured.length}
                    max={ENROLL_MAX_SAMPLES}
                    secondsLeft={secondsLeft}
                    complete={captured.length >= ENROLL_MAX_SAMPLES}
                  />
                </div>
              </>
            ) : null}

            {phase === 'saving' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>در حال ذخیره…</span>
              </div>
            ) : null}

            {phase === 'setup' && !previewOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-sm px-6 text-center">
                <Camera className="h-8 w-8" />
                <span>نام را انتخاب کن و «شروع اسکن ۳۰ ثانیه‌ای» را بزن</span>
              </div>
            ) : null}

            {phase === 'done' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-950/70 text-white">
                <EnrollProgressRing
                  value={ENROLL_MAX_SAMPLES}
                  max={ENROLL_MAX_SAMPLES}
                  secondsLeft={0}
                  complete
                />
                <span className="font-semibold">ثبت کامل شد</span>
              </div>
            ) : null}
          </div>

          {status ? (
            <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{status}</p>
          ) : null}

          {captured.length > 0 && phase !== 'setup' ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {captured.map((c) => (
                <div
                  key={c.poseId}
                  className={cn('rounded-lg border overflow-hidden bg-white')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.imageBase64}
                    alt={c.labelFa}
                    className="aspect-square w-full object-cover"
                  />
                  <p className="px-1.5 py-1 text-[10px] text-center truncate">{c.labelFa}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="افراد ثبت‌شده"
        description="نام و عکس‌های نمونه‌ها را ببینید؛ می‌توانید یک عکس یا کل فرد را حذف کنید"
      >
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            هنوز کسی ثبت نشده — از بخش بالا شروع کنید
          </p>
        ) : (
          <ul className="space-y-4">
            {enrollments.map((e) => {
              const personBusy = busyId === e.id
              return (
                <li key={e.id} className="rounded-xl border bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{e.personName || e.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.hasEmbedding
                          ? `${e.samples?.length ?? e.sampleCount ?? 0} نمونه · بیومتریک فعال`
                          : 'بیومتریک ناقص — دوباره ثبت کنید'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={personBusy || isRunning}
                      onClick={() => void removePerson(e)}
                    >
                      {personBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 ml-1" />
                      )}
                      حذف فرد
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {(e.samples && e.samples.length > 0
                      ? e.samples
                      : e.imageUrl
                        ? [
                            {
                              id: 'primary',
                              pose: 'straight',
                              labelFa: 'اصلی',
                              labelEn: 'اصلی',
                              imageUrl: e.imageUrl,
                            },
                          ]
                        : []
                    ).map((sample) => {
                      const sampleBusy = busyId === `${e.id}:${sample.id}`
                      return (
                        <div
                          key={sample.id}
                          className="group relative rounded-lg border overflow-hidden bg-slate-50"
                        >
                          {sample.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sample.imageUrl}
                              alt={sample.labelFa}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <div className="aspect-square bg-muted" />
                          )}
                          <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                            <span className="text-[10px] truncate">{sample.labelFa}</span>
                            {sample.id !== 'primary' ? (
                              <button
                                type="button"
                                className="text-rose-600 hover:text-rose-800 p-0.5"
                                disabled={sampleBusy || isRunning}
                                title="حذف این عکس"
                                onClick={() => void removeSample(e, sample.id)}
                              >
                                {sampleBusy ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
