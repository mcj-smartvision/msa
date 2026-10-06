/**
 * Browser-only FaceNet descriptor extraction (@vladmandic/face-api).
 * Models are served locally from /public/models/face-api (no CDN dependency).
 */

'use client'

import {
FACE_EMBEDDING_DIM,
FACE_EMBEDDING_MODEL,
averageEmbeddings,
l2Normalize,
} from '@/features/attendance/lib/face-match'

/** Same-origin models — avoids jsDelivr timeouts in Iran/restricted networks */
const LOCAL_MODEL_URL = '/models/face-api'
const CDN_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model'

type FaceApiModule = typeof import('@vladmandic/face-api')

let loadPromise: Promise<FaceApiModule> | null = null
let loadError: string | null = null

async function loadNets(faceapi: FaceApiModule, base: string) {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(base),
    faceapi.nets.tinyFaceDetector.loadFromUri(base),
    faceapi.nets.faceLandmark68Net.loadFromUri(base),
    faceapi.nets.faceRecognitionNet.loadFromUri(base),
  ])
}

async function loadFaceApi(): Promise<FaceApiModule> {
  if (typeof window === 'undefined') {
    throw new Error('Face embedding only runs in the browser')
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      try {
        await loadNets(faceapi, LOCAL_MODEL_URL)
      } catch (localErr) {
        try {
          await loadNets(faceapi, CDN_MODEL_URL)
        } catch (cdnErr) {
          loadError =
            localErr instanceof Error
              ? localErr.message
              : 'مدل شناسایی چهره بارگذاری نشد'
          loadPromise = null
          throw new Error(
            `بارگذاری مدل FaceNet ناموفق بود (${loadError}). صفحه را رفرش کنید.`
          )
        }
      }
      loadError = null
      return faceapi
    })()
  }
  return loadPromise
}

/** Warm models so first enroll/recognize is not slow. */
export async function warmFaceEmbedder(): Promise<void> {
  await loadFaceApi()
}

export function getFaceEmbedderLoadError() {
  return loadError
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('face_image_load_failed'))
    img.src = dataUrl
  })
}

async function descriptorFromInput(
  faceapi: FaceApiModule,
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<Float32Array | null> {
  // Prefer SSD on full frames; TinyFace is better on tight crops
  const ssd = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (ssd?.descriptor?.length === FACE_EMBEDDING_DIM) return ssd.descriptor

  const tiny = await faceapi
    .detectSingleFace(
      input,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (tiny?.descriptor?.length === FACE_EMBEDDING_DIM) return tiny.descriptor

  return null
}

/**
 * Best path for live enroll/recognize: run FaceNet on the live video element.
 */
export async function extractFaceEmbeddingFromVideo(
  video: HTMLVideoElement
): Promise<{ embedding: number[]; box: { x: number; y: number; width: number; height: number } } | null> {
  if (!video.videoWidth) return null
  const faceapi = await loadFaceApi()
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection?.descriptor || detection.descriptor.length !== FACE_EMBEDDING_DIM) {
    // Tiny fallback on full frame
    const tiny = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 })
      )
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!tiny?.descriptor || tiny.descriptor.length !== FACE_EMBEDDING_DIM) return null
    const b = tiny.detection.box
    return {
      embedding: l2Normalize(Array.from(tiny.descriptor)),
      box: { x: b.x, y: b.y, width: b.width, height: b.height },
    }
  }

  const b = detection.detection.box
  return {
    embedding: l2Normalize(Array.from(detection.descriptor)),
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
  }
}

/**
 * Extract a 128-d FaceNet descriptor from a face crop (data URL or canvas).
 */
export async function extractFaceEmbedding(
  source: string | HTMLCanvasElement | HTMLVideoElement
): Promise<number[] | null> {
  const faceapi = await loadFaceApi()
  const input =
    typeof source === 'string' ? await dataUrlToImage(source) : source
  const descriptor = await descriptorFromInput(faceapi, input)
  if (!descriptor) return null
  return l2Normalize(Array.from(descriptor))
}

export async function extractAveragedEmbedding(
  sources: Array<string | HTMLCanvasElement>
): Promise<{ embedding: number[]; sampleCount: number; model: string } | null> {
  const samples: number[][] = []
  for (const src of sources) {
    const emb = await extractFaceEmbedding(src)
    if (emb) samples.push(emb)
  }
  if (samples.length < 2) {
    if (samples.length === 1) {
      return { embedding: samples[0], sampleCount: 1, model: FACE_EMBEDDING_MODEL }
    }
    return null
  }
  return {
    embedding: averageEmbeddings(samples),
    sampleCount: samples.length,
    model: FACE_EMBEDDING_MODEL,
  }
}

export { FACE_EMBEDDING_MODEL, FACE_EMBEDDING_DIM }
