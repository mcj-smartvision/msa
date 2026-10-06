/**
 * Client-side face detection (bounding boxes) via MediaPipe Face Detector.
 * Used for overlay + multi-person crops before recognition.
 */

export type FaceBox = {
  x: number
  y: number
  width: number
  height: number
  score: number
}

type FaceDetectorLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => { detections: Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number }; categories?: Array<{ score?: number }> }> }
  close?: () => void
}

let detectorPromise: Promise<FaceDetectorLike | null> | null = null

async function loadDetector(): Promise<FaceDetectorLike | null> {
  if (typeof window === 'undefined') return null
  try {
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    )
    const detector = await vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.55,
    })
    return detector as unknown as FaceDetectorLike
  } catch {
    try {
      const vision = await import('@mediapipe/tasks-vision')
      const fileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )
      const detector = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.55,
      })
      return detector as unknown as FaceDetectorLike
    } catch {
      return null
    }
  }
}

export function getFaceDetector(): Promise<FaceDetectorLike | null> {
  if (!detectorPromise) detectorPromise = loadDetector()
  return detectorPromise
}

export async function detectFacesInVideo(
  video: HTMLVideoElement,
  timestamp = performance.now()
): Promise<FaceBox[]> {
  const detector = await getFaceDetector()
  if (!detector || !video.videoWidth) return []
  const result = detector.detectForVideo(video, timestamp)
  return (result.detections ?? [])
    .map((d) => {
      const b = d.boundingBox
      if (!b) return null
      return {
        x: Math.max(0, b.originX),
        y: Math.max(0, b.originY),
        width: Math.max(1, b.width),
        height: Math.max(1, b.height),
        score: d.categories?.[0]?.score ?? 0,
      } satisfies FaceBox
    })
    .filter((b): b is FaceBox => Boolean(b))
    .sort((a, b) => b.width * b.height - a.width * a.height)
}

/** Expand box and crop face from video → jpeg dataUrl */
export function cropFaceFromVideo(
  video: HTMLVideoElement,
  box: FaceBox,
  padRatio = 0.3,
  quality = 0.72,
  maxEdge = 320
): string | null {
  if (!video.videoWidth) return null
  const padX = box.width * padRatio
  const padY = box.height * padRatio
  const x = Math.max(0, Math.floor(box.x - padX))
  const y = Math.max(0, Math.floor(box.y - padY))
  const w = Math.min(video.videoWidth - x, Math.ceil(box.width + padX * 2))
  const h = Math.min(video.videoHeight - y, Math.ceil(box.height + padY * 2))
  if (w < 24 || h < 24) return null

  const canvas = document.createElement('canvas')
  const target = Math.min(224, maxEdge)
  const scale = Math.min(2.5, Math.max(1, target / Math.min(w, h)))
  canvas.width = Math.min(maxEdge, Math.round(w * scale))
  canvas.height = Math.min(maxEdge, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(video, x, y, w, h, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export function drawFaceBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  boxes: FaceBox[],
  labels?: Array<string | null>
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = video.clientWidth || video.videoWidth
  canvas.height = video.clientHeight || video.videoHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const sx = canvas.width / video.videoWidth
  const sy = canvas.height / video.videoHeight

  boxes.forEach((box, i) => {
    const x = box.x * sx
    const y = box.y * sy
    const w = box.width * sx
    const h = box.height * sy
    const label = labels?.[i]
    ctx.strokeStyle = label ? '#22c55e' : '#4ade80'
    ctx.lineWidth = label ? 4 : 3
    ctx.strokeRect(x, y, w, h)
    if (label) {
      ctx.font = 'bold 16px Tahoma, sans-serif'
      const tw = ctx.measureText(label).width + 20
      ctx.fillStyle = 'rgba(22,163,74,0.95)'
      ctx.fillRect(x, Math.max(0, y - 28), Math.min(canvas.width - x, tw), 28)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 10, Math.max(18, y - 8))
    }
  })
}

/** Instant confirmation beep — person hears/feels success before TTS finishes */
export function playConfirmBeep() {
  if (typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    const beep = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, now + start)
      g.gain.exponentialRampToValueAtTime(0.22, now + start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(now + start)
      o.stop(now + start + dur + 0.02)
    }
    beep(880, 0, 0.12)
    beep(1175, 0.13, 0.16)
    window.setTimeout(() => void ctx.close(), 500)
  } catch {
    // audio optional
  }
}

/** Fast single announcement (not twice) so person still hears it at the gate */
export function announceRecognized(name: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const run = () => {
    const voices = window.speechSynthesis.getVoices()
    const fa = voices.find((v) => v.lang.startsWith('fa'))
    const u = new SpeechSynthesisUtterance(name)
    u.lang = 'fa-IR'
    if (fa) u.voice = fa
    u.rate = 1.15
    window.speechSynthesis.speak(u)
  }
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      run()
    }
    run()
  } else {
    run()
  }
}

/** @deprecated use announceRecognized */
export function announceNameTwice(name: string) {
  announceRecognized(name)
}
