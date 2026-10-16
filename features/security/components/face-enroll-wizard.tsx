/**
 * @file features/security/components/face-enroll-wizard.tsx
 * @purpose کامپوننت UI — امنیت و ثبت چهره (face-enroll-wizard)
 * @safe-to-edit CAREFUL
 * @affects امنیت و ثبت چهره
 * @depends-on features/admin/components/shared, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/badge, shared/components/ui/select, features/attendance/lib/camera, features/attendance/lib/face-detect, features/attendance/lib/face-embed.client, features/attendance/lib/face-match, features/security/config
 */

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
import { PageHeader, SectionCard } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
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
cropFaceFromVideo,
detectFacesInVideo,
drawFaceBoxes,
} from '@/features/attendance/lib/face-detect'
import { extractFaceEmbeddingFromVideo, warmFaceEmbedder } from '@/features/attendance/lib/face-embed.client'
import { euclideanDistance } from '@/features/attendance/lib/face-match'
import {
ENROLL_CAPTURE_EVERY_MS,
ENROLL_LIVE_TIPS_FA,
ENROLL_MAX_SAMPLES,
ENROLL_MIN_DIVERSITY,
ENROLL_MIN_SAMPLES,
ENROLL_SESSION_MS,
poseLabel,
} from '@/features/attendance/lib/enroll-poses'
import type { AttendanceEnrollment } from '@/features/attendance/lib/types'
import { cn } from '@/shared/lib/utils'
import { FACE_ENROLL_COPY as copy } from '@/features/security/config'

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
    if (!res.ok) throw new Error(json.error || copy.loadEnrollmentsFailed)
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
      setError(e instanceof Error ? e.message : copy.loadError)
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
      throw new Error(copy.minSamplesNeeded(ENROLL_MIN_SAMPLES))
    }
    setPhase('saving')
    setStatus(copy.savingBiometric)
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
          ? copy.photosTooLarge
          : copy.invalidServerResponse(res.status)
      )
    }
    if (!res.ok) throw new Error(json.error || copy.saveFailedHttp(res.status))

    setPhase('done')
    setStatus(copy.enrolledWithSamples(selectedMember?.fullName, samples.length))
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
      setError(copy.pickPersonFirst)
      return
    }
    setError(null)
    setCaptured([])
    abortRef.current = false
    setPhase('running')
    setSecondsLeft(Math.ceil(ENROLL_SESSION_MS / 1000))
    setLiveTip(ENROLL_LIVE_TIPS_FA[0])
    setStatus(copy.warmingFacenet)

    const samples: CapturedSample[] = []
    let failStreak = { no_face: 0, embed_fail: 0, not_diverse: 0 }
    try {
      await warmFaceEmbedder()
      if (!previewOn) await startCamera(deviceId || undefined)

      setStatus(copy.holdFaceTurnHead)
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
              setStatus(copy.sampleRecorded(samples.length, ENROLL_MAX_SAMPLES))
            } else if (reason === 'no_face' || reason === 'embed_fail') {
              if (reason === 'no_face') failStreak.no_face++
              else failStreak.embed_fail++
              if (samples.length === 0) {
                setStatus(
                  failStreak.embed_fail > failStreak.no_face
                    ? copy.embedFailedHint
                    : copy.noFaceHint
                )
              }
            } else if (reason === 'not_diverse') {
              failStreak.not_diverse++
              setStatus(
                copy.needMorePose(samples.length, ENROLL_MAX_SAMPLES)
              )
            }
          } finally {
            capturingRef.current = false
          }
        }

        await sleep(60)
      }

      if (abortRef.current) throw new Error(copy.cancelled)

      if (samples.length < ENROLL_MIN_SAMPLES) {
        setCaptured(samples)
        setPhase('setup')
        const hint =
          samples.length === 0
            ? copy.noSamplesHint
            : copy.tooFewSamples(samples.length, ENROLL_MIN_SAMPLES)
        throw new Error(hint)
      }

      await saveCapturedSamples(samples)
    } catch (e) {
      const message = e instanceof Error ? e.message : copy.enrollFailed
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
      setError(copy.noSamplesToSave)
      setPhase('setup')
      return
    }
    try {
      await saveCapturedSamples(captured)
    } catch (e) {
      setPhase('retry')
      setError(e instanceof Error ? e.message : copy.saveFailed)
      setStatus(null)
    }
  }

  function cancelRunning() {
    abortRef.current = true
    setPhase('setup')
    setSecondsLeft(0)
    setStatus(copy.cancelled)
    stopCamera()
  }

  async function removePerson(enrollment: AttendanceEnrollment) {
    if (!confirm(copy.confirmDeletePerson(enrollment.personName))) return
    setBusyId(enrollment.id)
    try {
      const qs = new URLSearchParams({
        projectId,
        enrollmentId: enrollment.id,
      })
      const res = await fetch(`/api/attendance/enrollments?${qs}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || copy.deleteFailed)
      await loadEnrollments()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.deleteFailed)
    } finally {
      setBusyId(null)
    }
  }

  async function removeSample(enrollment: AttendanceEnrollment, sampleId: string) {
    if (!confirm(copy.confirmDeleteSample)) return
    setBusyId(`${enrollment.id}:${sampleId}`)
    try {
      const qs = new URLSearchParams({
        projectId,
        enrollmentId: enrollment.id,
        sampleId,
      })
      const res = await fetch(`/api/attendance/enrollments?${qs}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || copy.deleteSampleFailed)
      await loadEnrollments()
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.deleteSampleFailed)
    } finally {
      setBusyId(null)
    }
  }

  const isRunning = phase === 'running' || phase === 'saving'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={copy.title}
          description={copy.scanDescription(projectName)}
        />
        <Button asChild variant="outline">
          <Link href="/dashboard/security">
            <ArrowRight className="h-4 w-4 ml-1" />
            {copy.backToGate}
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <SectionCard
        title={copy.newPersonTitle}
        description={copy.newPersonDescription}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{copy.searchName}</Label>
              <Input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder={copy.memberPlaceholder}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label>{copy.personToEnroll}</Label>
              <Select
                value={userId || undefined}
                onValueChange={setUserId}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder={copy.pickProjectMember} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMembers.map((m) => {
                    const enrolled = enrollments.find((e) => e.userId === m.userId)
                    return (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.fullName}
                        {enrolled?.hasEmbedding
                          ? copy.enrolledOverwrite
                          : enrolled
                            ? copy.incomplete
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
              <Label>{copy.camera}</Label>
              <Select
                value={deviceId || undefined}
                onValueChange={setDeviceId}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue placeholder={copy.pickCamera} />
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
                {copy.startScan}
              </Button>
            ) : null}
            {phase === 'retry' ? (
              <>
                <Button
                  type="button"
                  className="bg-emerald-700 hover:bg-emerald-800"
                  onClick={() => void retrySave()}
                >
                  {copy.retrySave(captured.length)}
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
                  {copy.startOver}
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
                {copy.cancel}
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
                      {copy.sampleProgress(captured.length, ENROLL_MAX_SAMPLES)}
                      {captured.length >= ENROLL_MIN_SAMPLES ? copy.readyToSave : ''}
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
                <span>{copy.saving}</span>
              </div>
            ) : null}

            {phase === 'setup' && !previewOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-sm px-6 text-center">
                <Camera className="h-8 w-8" />
                <span>{copy.startHint}</span>
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
                <span className="font-semibold">{copy.enrollComplete}</span>
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
        title={copy.enrolledPeople}
        description={copy.enrolledPeopleDescription}
      >
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {copy.nobodyEnrolled}
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
                          ? copy.activeBiometric(e.samples?.length ?? e.sampleCount ?? 0)
                          : copy.incompleteBiometric}
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
                      {copy.deletePerson}
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
                              labelFa: copy.primarySample,
                              labelEn: copy.primarySample,
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
                                title={copy.deleteThisPhoto}
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
