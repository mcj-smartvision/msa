/** Browser camera helpers for gate attendance */

export type BrowserCamera = {
  deviceId: string
  label: string
  groupId: string
}

export async function listBrowserCameras(): Promise<BrowserCamera[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    throw new Error('این مرورگر از دوربین پشتیبانی نمی‌کند')
  }

  // Permission prompt unlocks device labels
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  } catch {
    // Still try enumerate; labels may be empty
  } finally {
    stream?.getTracks().forEach((t) => t.stop())
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'videoinput' && d.deviceId)
    .map((d, index) => ({
      deviceId: d.deviceId,
      label: d.label?.trim() || `دوربین ${index + 1}`,
      groupId: d.groupId || '',
    }))
}

export async function openCameraStream(deviceId?: string | null): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('دسترسی به دوربین ممکن نیست')
  }
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  }
  try {
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch {
    // Fallback if exact deviceId fails
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  }
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  quality = 0.85
): { blob: Blob; dataUrl: string } | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const binary = atob(dataUrl.split(',')[1] ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), dataUrl }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop())
}
